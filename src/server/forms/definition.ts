import "server-only";
import { UserError } from "@/lib/errors";
import { formDefinitionSchema, type FormDefinition } from "@/lib/forms/engine/schema";

export function parseDefinition(json: unknown): FormDefinition {
  const parsed = formDefinitionSchema.safeParse(json);
  if (!parsed.success) throw new UserError("This form's questions couldn't be read. Open it in the builder and publish again.");
  return parsed.data;
}
