export type FieldErrors = Record<string, string[] | undefined>;

/** An error whose message is safe and useful to show the user. */
export class UserError extends Error {
  constructor(
    message: string,
    public fieldErrors?: FieldErrors,
  ) {
    super(message);
    this.name = "UserError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "You don't have permission to do that.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class UnauthorizedError extends Error {
  constructor(message = "Your session has ended. Sign in again.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}
