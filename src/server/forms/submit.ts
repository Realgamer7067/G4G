import "server-only";
import { createHash } from "node:crypto";
import { TAGS, invalidate, type CacheTag } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { UserError } from "@/lib/errors";
import { REASON_COPY, registrationState } from "@/lib/events/status";
import { allFields, type Answers } from "@/lib/forms/engine/schema";
import { validateSubmission } from "@/lib/forms/engine/validate-submission";
import { buildSearchText } from "@/lib/forms/search-text";
import type { RequestMeta } from "@/lib/request-meta";
import { formSubmitLimiter } from "@/lib/security/limiters";
import { zonedDay } from "@/lib/utils/timezone";
import { parseDefinition } from "./definition";
import { claimFormFiles } from "./files";

export type SubmitInput = {
  slug: string;
  eventSlug?: string | null;
  versionId: string;
  answers: Answers;
  startedAt: number;
  honeypot: string;
  meta: RequestMeta;
  now?: Date;
};

export type SubmitResult =
  | { ok: true; message: string; responseId: string | null }
  | { ok: false; status: number; error: string; fieldErrors?: Record<string, string> };

const MIN_FILL_MS = 2_500;

function fail(status: number, error: string, fieldErrors?: Record<string, string>): SubmitResult {
  return { ok: false, status, error, fieldErrors };
}

export function hashIp(ip: string | null): string | null {
  return ip ? createHash("sha256").update(`${process.env.IP_HASH_SALT ?? "gfg-chapter"}:${ip}`).digest("hex") : null;
}

/** Everything a public submission must pass. The only write path from anonymous visitors to responses. */
export async function submitFormResponse(input: SubmitInput): Promise<SubmitResult> {
  const now = input.now ?? new Date();
  if (!formSubmitLimiter.check(input.meta.ip ?? "unknown", now.getTime()).allowed) {
    return fail(429, "Too many submissions from your network. Try again in a minute.");
  }

  const form = await db.form.findUnique({ where: { slug: input.slug }, include: { publishedVersion: true } });
  if (!form?.publishedVersion) return fail(404, "This form isn't available.");

  let event: Awaited<ReturnType<typeof db.event.findUnique>> = null;
  if (input.eventSlug) {
    event = await db.event.findUnique({ where: { slug: input.eventSlug } });
    if (!event || event.lifecycle === "DRAFT" || event.lifecycle === "ARCHIVED" || event.registrationMode !== "FORM" || event.formId !== form.id) {
      return fail(404, "This registration isn't available.");
    }
  } else if (form.visibility !== "PUBLIC_LINK") {
    return fail(404, "This form isn't available.");
  }

  if (input.versionId !== form.publishedVersionId) {
    return fail(409, "This form was updated while you were filling it in. Reload the page to continue with the latest version.");
  }
  // Bots: a filled honeypot is dropped quietly so it learns nothing.
  if (input.honeypot.trim()) return { ok: true, message: form.successMessage, responseId: null };
  if (now.getTime() - input.startedAt < MIN_FILL_MS) return fail(429, "That was quick! Check your answers and submit again.");

  if (!form.acceptingResponses) return fail(409, "This form isn't accepting responses right now.");
  if (form.opensAt && form.opensAt > now) return fail(409, "This form isn't open yet.");
  if (form.closesAt && form.closesAt <= now) return fail(409, "This form has closed.");

  const definition = parseDefinition(form.publishedVersion.definition);
  const result = validateSubmission(definition, input.answers);
  if (!result.ok) return fail(400, "Check the highlighted questions.", result.errors);

  const fields = allFields(definition);
  const email = (() => {
    for (const f of fields) if (f.type === "email" && typeof result.cleaned[f.id] === "string") return result.cleaned[f.id] as string;
    return null;
  })();
  const fileIds = fields.filter((f) => f.type === "file").flatMap((f) => (Array.isArray(result.cleaned[f.id]) ? (result.cleaned[f.id] as string[]) : []));

  try {
    const responseId = await db.$transaction(async (tx) => {
      // Serialise submissions per form so capacity can't be overshot by concurrent requests.
      await tx.$queryRaw`SELECT id FROM "Form" WHERE id = ${form.id} FOR UPDATE`;

      if (event) {
        const count = await tx.formResponse.count({ where: { eventId: event.id } });
        const state = registrationState(event, { count, formAccepting: form.acceptingResponses }, now);
        if (!state.open) throw new UserError(REASON_COPY[state.reason]);
      }
      const caps = [form.maxResponses, event?.maxParticipants].filter((n): n is number => typeof n === "number");
      if (caps.length) {
        const count = await tx.formResponse.count({ where: event ? { eventId: event.id } : { formId: form.id } });
        if (count >= Math.min(...caps)) throw new UserError("All spots are taken. Registrations are closed.");
      }
      if (form.oneResponsePerEmail && email && (await tx.formResponse.count({ where: { formId: form.id, email } })) > 0) {
        throw new UserError("You've already responded with this email address.");
      }

      const response = await tx.formResponse.create({
        data: {
          formId: form.id,
          versionId: form.publishedVersion!.id,
          eventId: event?.id ?? null,
          data: result.cleaned,
          email,
          searchText: buildSearchText(definition, result.cleaned, email),
          pagePath: result.path,
          ipHash: hashIp(input.meta.ip),
          userAgent: input.meta.userAgent,
          submittedAt: now,
        },
      });
      await claimFormFiles(tx, fileIds, response.id, now);
      const day = new Date(`${zonedDay(now, "UTC")}T00:00:00Z`);
      await tx.formDailyStat.upsert({
        where: { formId_date: { formId: form.id, date: day } },
        create: { formId: form.id, date: day, submissions: 1 },
        update: { submissions: { increment: 1 } },
      });
      return response.id;
    });

    const tags: CacheTag[] = [`form:${form.slug}`];
    if (event) tags.push(TAGS.events, `event:${event.slug}`);
    invalidate(...tags);
    return { ok: true, message: form.successMessage, responseId };
  } catch (error) {
    if (error instanceof UserError) return fail(409, error.message);
    throw error;
  }
}
