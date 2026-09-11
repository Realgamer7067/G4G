import type { FormDefinition } from "./engine/schema";

/** Short random id for pages, blocks and options (browser and server). */
export function newId(prefix: string): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return `${prefix}_${Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 10)}`;
}

/** Starting point for a new form: one page asking for a name and an email. */
export function defaultDefinition(): FormDefinition {
  return {
    pages: [
      {
        id: newId("page"),
        title: "Your details",
        description: "",
        branches: [],
        defaultNext: "next",
        blocks: [
          { id: newId("q"), kind: "field", type: "short_text", label: "Full name", required: true, placeholder: "e.g. Priya Shah" },
          { id: newId("q"), kind: "field", type: "email", label: "Email", required: true, placeholder: "you@college.edu" },
        ],
      },
    ],
  };
}
