import { z } from "zod";

export const FIELD_TYPES = [
  "short_text",
  "long_text",
  "email",
  "phone",
  "number",
  "dropdown",
  "radio",
  "checkboxes",
  "date",
  "time",
  "url",
  "file",
  "linear_scale",
  "rating",
  "yes_no",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const CHOICE_TYPES: ReadonlySet<FieldType> = new Set(["dropdown", "radio", "checkboxes"]);
export const NUMERIC_TYPES: ReadonlySet<FieldType> = new Set(["number", "linear_scale", "rating"]);
export const TEMPORAL_TYPES: ReadonlySet<FieldType> = new Set(["date", "time"]);

export const CONTENT_TYPES = ["heading", "text", "image", "divider", "callout"] as const;

export const OPERATORS = [
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "any_of",
  "none_of",
  "is_empty",
  "is_filled",
  "gt",
  "lt",
  "before",
  "after",
] as const;
export type Operator = (typeof OPERATORS)[number];

export const FILE_KINDS = ["pdf", "image", "doc", "slides", "zip"] as const;

const idSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, "Ids may only contain letters, numbers, dashes and underscores.");

const conditionSchema = z.object({
  fieldId: idSchema,
  op: z.enum(OPERATORS),
  value: z.union([z.string().max(500), z.number(), z.array(z.string().max(200)).max(50)]).optional(),
});

const groupSchema = z.object({
  mode: z.enum(["all", "any"]),
  conditions: z.array(conditionSchema).max(20),
});

const optionSchema = z.object({
  id: idSchema,
  label: z.string().trim().min(1).max(200),
  visibleWhen: groupSchema.optional(),
});

const smallInt = (min: number, max: number) => z.number().int().min(min).max(max);

const validationSchema = z
  .object({
    minLength: smallInt(0, 10_000),
    maxLength: smallInt(1, 10_000),
    min: z.number(),
    max: z.number(),
    pattern: z.literal("custom"),
    customPattern: z.string().max(200),
    patternMessage: z.string().max(200),
    minSelections: smallInt(0, 100),
    maxSelections: smallInt(1, 100),
    fileTypes: z.array(z.enum(FILE_KINDS)).max(FILE_KINDS.length),
    maxFileMb: smallInt(1, 10),
    maxFiles: smallInt(1, 5),
    scaleMin: smallInt(0, 10),
    scaleMax: smallInt(1, 10),
    scaleMinLabel: z.string().max(40),
    scaleMaxLabel: z.string().max(40),
  })
  .partial();

const fieldSchema = z.object({
  id: idSchema,
  kind: z.literal("field"),
  type: z.enum(FIELD_TYPES),
  label: z.string().trim().min(1).max(300),
  help: z.string().max(500).optional(),
  placeholder: z.string().max(200).optional(),
  required: z.boolean().default(false),
  defaultValue: z.string().max(500).optional(),
  options: z.array(optionSchema).max(100).optional(),
  validation: validationSchema.optional(),
  visibleWhen: groupSchema.optional(),
  width: z.enum(["full", "half"]).optional(),
});

const contentSchema = z.object({
  id: idSchema,
  kind: z.literal("content"),
  type: z.enum(CONTENT_TYPES),
  text: z.string().max(2_000).optional(),
  html: z.string().max(20_000).optional(),
  uploadId: z.string().max(64).optional(),
  tone: z.enum(["info", "warning"]).optional(),
  visibleWhen: groupSchema.optional(),
});

const blockSchema = z.discriminatedUnion("kind", [fieldSchema, contentSchema]);

const branchSchema = z.object({ id: idSchema, when: groupSchema, goTo: z.string().min(1).max(64) });

const pageSchema = z.object({
  id: idSchema,
  title: z.string().trim().max(200),
  description: z.string().max(1_000).optional(),
  blocks: z.array(blockSchema).max(60),
  branches: z.array(branchSchema).max(20).default([]),
  defaultNext: z.string().min(1).max(64).default("next"),
});

export const formDefinitionSchema = z.object({ pages: z.array(pageSchema).min(1).max(30) });

export type FormDefinition = z.output<typeof formDefinitionSchema>;
export type Page = FormDefinition["pages"][number];
export type Block = Page["blocks"][number];
export type Field = Extract<Block, { kind: "field" }>;
export type ContentBlock = Extract<Block, { kind: "content" }>;
export type Branch = Page["branches"][number];
export type ConditionGroup = z.output<typeof groupSchema>;
export type Condition = z.output<typeof conditionSchema>;
export type Option = z.output<typeof optionSchema>;
export type FieldValidation = z.output<typeof validationSchema>;

export type AnswerValue = string | number | string[] | null;
export type Answers = Record<string, AnswerValue | undefined>;

export function allFields(def: FormDefinition): Field[] {
  return def.pages.flatMap((p) => p.blocks.filter((b): b is Field => b.kind === "field"));
}
