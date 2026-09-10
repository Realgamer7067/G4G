import { hash, verify } from "@node-rs/argon2";

// OWASP-recommended argon2id parameters. @node-rs/argon2 defaults to argon2id.
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 };

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS);
}

export async function verifyPassword(passwordHash: string, plain: string): Promise<boolean> {
  try {
    return await verify(passwordHash, plain);
  } catch {
    return false;
  }
}

export function passwordProblem(plain: string): string | null {
  if (plain.length < 12) return "Use at least 12 characters.";
  if (plain.length > 256) return "Use at most 256 characters.";
  return null;
}
