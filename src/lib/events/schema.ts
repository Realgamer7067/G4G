import { z } from "zod";
import { isChecked } from "@/lib/forms-data";
import { isHttpUrl } from "@/lib/settings/schema";
import { isLocalDateTime } from "@/lib/utils/timezone";

export const EVENT_MODES = ["OFFLINE", "ONLINE", "HYBRID"] as const;
/** FORM is added once the form engine lands (phase 3). */
export const REGISTRATION_MODES = ["NONE", "EXTERNAL"] as const;
export const SPONSOR_TIERS = ["TITLE", "POWERED_BY", "COMMUNITY_PARTNER", "TECHNOLOGY_PARTNER", "PARTNER"] as const;

export const SPONSOR_TIER_LABELS: Record<(typeof SPONSOR_TIERS)[number], string> = {
  TITLE: "Title sponsor",
  POWERED_BY: "Powered by",
  COMMUNITY_PARTNER: "Community partner",
  TECHNOLOGY_PARTNER: "Technology partner",
  PARTNER: "Partner",
};

export const MODE_LABELS: Record<(typeof EVENT_MODES)[number], string> = { OFFLINE: "In person", ONLINE: "Online", HYBRID: "Hybrid" };

const text = (max: number) => z.string().trim().max(max, `Keep it under ${max} characters.`);
const nullableText = (max: number) =>
  text(max)
    .optional()
    .transform((v) => v || null);
const nullableId = z
  .string()
  .trim()
  .nullish()
  .transform((v) => v || null);
const localDateTime = (label: string) =>
  z
    .string({ error: `Pick the ${label}.` })
    .trim()
    .refine((v) => v.includes("T") && isLocalDateTime(v), `Pick the ${label}.`);
const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => v || null)
  .refine((v) => v === null || isHttpUrl(v), "Use a full link that starts with https://.");

export const eventFormSchema = z
  .object({
    id: nullableId,
    title: text(120).min(3, "Give the event a title."),
    slug: text(80).optional().default(""),
    tagline: text(160).default(""),
    description: z.string().max(50_000, "The description is too long.").default(""),
    posterId: nullableId,
    categoryId: nullableId,
    startAt: localDateTime("start date and time"),
    endAt: localDateTime("end date and time"),
    venue: text(200).default(""),
    mode: z.enum(EVENT_MODES).default("OFFLINE"),
    onlineUrl: optionalUrl,
    registrationMode: z.enum(REGISTRATION_MODES).default("NONE"),
    externalRegistrationUrl: optionalUrl,
    registrationDeadline: z
      .string()
      .trim()
      .optional()
      .transform((v) => v || null)
      .refine((v) => v === null || (v.includes("T") && isLocalDateTime(v)), "Pick a date and time."),
    maxParticipants: z.preprocess(
      (v) => (v === "" || v === undefined || v === null ? null : Number(v)),
      z.number({ error: "Enter a number." }).int("Use a whole number.").min(1, "Use at least 1.").max(100_000).nullable(),
    ),
    eligibility: text(500).default(""),
    organizers: z
      .array(z.object({ name: text(80).min(1, "Add a name."), role: text(80).default(""), contact: text(120).default("") }))
      .max(12)
      .default([]),
    contacts: z
      .array(
        z.object({
          name: text(80).min(1, "Add a name."),
          phone: text(40).default(""),
          email: text(254)
            .default("")
            .refine((v) => v === "" || z.email().safeParse(v).success, "Enter a valid email."),
        }),
      )
      .max(6)
      .default([]),
    links: z
      .array(z.object({ label: text(60).min(1, "Add a label."), url: z.string().trim().refine(isHttpUrl, "Use a full link.") }))
      .max(10)
      .default([]),
    sponsors: z
      .array(z.object({ sponsorId: z.string().min(1), type: z.enum(SPONSOR_TIERS), customLabel: text(40).default("") }))
      .max(20)
      .default([]),
    showCountdown: z.unknown().optional().transform(isChecked),
    countdownTarget: z.enum(["START", "DEADLINE"]).default("START"),
    featured: z.unknown().optional().transform(isChecked),
    seoTitle: nullableText(70),
    seoDescription: nullableText(200),
  })
  .superRefine((v, ctx) => {
    if (v.endAt <= v.startAt) ctx.addIssue({ code: "custom", path: ["endAt"], message: "The event must end after it starts." });
    if (v.registrationMode === "EXTERNAL" && !v.externalRegistrationUrl) {
      ctx.addIssue({ code: "custom", path: ["externalRegistrationUrl"], message: "Add the registration link." });
    }
    if (v.registrationDeadline && v.registrationDeadline > v.endAt) {
      ctx.addIssue({ code: "custom", path: ["registrationDeadline"], message: "Registration must close before the event ends." });
    }
    if (v.showCountdown && v.countdownTarget === "DEADLINE" && !v.registrationDeadline) {
      ctx.addIssue({ code: "custom", path: ["countdownTarget"], message: "Set a registration deadline, or count down to the start instead." });
    }
  });

export type EventFormInput = z.infer<typeof eventFormSchema>;
export const EVENT_JSON_KEYS = ["organizers", "contacts", "links", "sponsors"] as const;
