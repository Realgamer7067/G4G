import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { ForbiddenError, UnauthorizedError, UserError, type FieldErrors } from "./errors";

export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: FieldErrors };

export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    unstable_rethrow(error); // let redirect()/notFound()/forbidden() propagate
    if (error instanceof UserError) {
      return error.fieldErrors
        ? { ok: false, error: error.message, fieldErrors: error.fieldErrors }
        : { ok: false, error: error.message };
    }
    if (error instanceof z.ZodError) {
      return {
        ok: false,
        error: "Check the highlighted fields.",
        fieldErrors: z.flattenError(error).fieldErrors as FieldErrors,
      };
    }
    if (error instanceof ForbiddenError || error instanceof UnauthorizedError) {
      return { ok: false, error: error.message };
    }
    console.error(error);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}
