import type { Condition, ContentBlock, Field, FormDefinition, Page } from "./schema";

/** Test helpers for building definitions tersely. Not used by the app. */
export function field(id: string, type: Field["type"], extra: Partial<Field> = {}): Field {
  return { id, kind: "field", type, label: extra.label ?? id, required: false, ...extra };
}

export function options(...ids: string[]) {
  return ids.map((id) => ({ id, label: id.toUpperCase() }));
}

export function content(id: string, extra: Partial<ContentBlock> = {}): ContentBlock {
  return { id, kind: "content", type: "text", text: "Info", ...extra };
}

export function page(id: string, blocks: Page["blocks"], extra: Partial<Page> = {}): Page {
  return { id, title: id, blocks, branches: [], defaultNext: "next", ...extra };
}

export const when = (mode: "all" | "any", ...conditions: Condition[]) => ({ mode, conditions });
export const cond = (fieldId: string, op: Condition["op"], value?: Condition["value"]): Condition => ({ fieldId, op, value });

/**
 * A realistic registration form using every logic feature:
 *  p1 "about": year (radio) → domain (dropdown, "ml" hidden for first years)
 *              → stack (checkboxes, options depend on domain; field shown once a domain is picked)
 *              → portfolio (url, only for design) · info callout (only for final years)
 *     first years jump straight to p3.
 *  p2 "experience": required long text.
 *  p3 "contact": email + consent.
 */
export function registrationForm(): FormDefinition {
  return {
    pages: [
      page(
        "about",
        [
          field("year", "radio", { required: true, options: options("y1", "y2", "y3") }),
          field("domain", "dropdown", {
            required: true,
            options: [
              { id: "dev", label: "Development" },
              { id: "design", label: "Design" },
              { id: "ml", label: "AI/ML", visibleWhen: when("all", cond("year", "not_equals", "y1")) },
            ],
          }),
          field("stack", "checkboxes", {
            visibleWhen: when("all", cond("domain", "is_filled")),
            options: [
              { id: "react", label: "React", visibleWhen: when("all", cond("domain", "equals", "dev")) },
              { id: "node", label: "Node", visibleWhen: when("all", cond("domain", "equals", "dev")) },
              { id: "figma", label: "Figma", visibleWhen: when("all", cond("domain", "equals", "design")) },
            ],
            validation: { maxSelections: 2 },
          }),
          field("portfolio", "url", { visibleWhen: when("all", cond("domain", "equals", "design")) }),
          content("final-note", { visibleWhen: when("all", cond("year", "equals", "y3")) }),
        ],
        { branches: [{ id: "b1", when: when("all", cond("year", "equals", "y1")), goTo: "contact" }] },
      ),
      page("experience", [field("experience", "long_text", { required: true, validation: { maxLength: 500 } })]),
      page("contact", [field("email", "email", { required: true }), field("consent", "yes_no", { required: true })]),
    ],
  };
}
