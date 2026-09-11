import { UserError } from "./errors";

const UNSAFE_KEYS = new Set(["__proto__", "prototype", "constructor"]);

/**
 * Turns flat FormData into a nested object: `socials.github` → `{ socials: { github } }`.
 * Keys listed in `jsonKeys` hold JSON produced by client-side editors (repeaters, ordering).
 * Repeated keys become arrays. Files are ignored (uploads go through the upload route).
 */
export function formDataToObject(fd: FormData, jsonKeys: readonly string[] = []): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of fd.entries()) {
    if (typeof value !== "string") continue;
    const parts = key.split(".");
    if (parts.some((p) => !p || UNSAFE_KEYS.has(p))) continue;

    let parsed: unknown = value;
    if (jsonKeys.includes(key)) {
      try {
        parsed = JSON.parse(value || "null");
      } catch {
        throw new UserError("Some of the form data was malformed. Reload the page and try again.");
      }
    }

    let node = out;
    for (const part of parts.slice(0, -1)) {
      const next = node[part];
      if (typeof next !== "object" || next === null || Array.isArray(next)) node[part] = {};
      node = node[part] as Record<string, unknown>;
    }
    const leaf = parts.at(-1)!;
    if (leaf in node && !jsonKeys.includes(key)) {
      const existing = node[leaf];
      node[leaf] = Array.isArray(existing) ? [...existing, parsed] : [existing, parsed];
    } else {
      node[leaf] = parsed;
    }
  }
  return out;
}

/** Checkbox value → boolean ("on" when checked, absent when not). */
export function isChecked(value: unknown): boolean {
  return value === "on" || value === "true" || value === true;
}
