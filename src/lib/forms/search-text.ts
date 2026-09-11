import { formatAnswer } from "./engine/display";
import { allFields, type Answers, type FormDefinition } from "./engine/schema";

/** Lowercased text of every answer, stored with the response so admins can search with ILIKE. */
export function buildSearchText(def: FormDefinition, answers: Answers, email: string | null): string {
  const parts = [email ?? ""];
  for (const f of allFields(def)) {
    if (f.type === "file") continue;
    const text = formatAnswer(f, answers[f.id]);
    if (text) parts.push(text);
  }
  return parts.join(" ").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 5_000);
}
