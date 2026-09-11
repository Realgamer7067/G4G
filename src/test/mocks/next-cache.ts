import { vi } from "vitest";

// Use with: vi.mock("next/cache", () => import("@/test/mocks/next-cache"));
export const revalidateTag = vi.fn();
export const revalidatePath = vi.fn();
export const updateTag = vi.fn();
export const unstable_cache = <T extends (...args: never[]) => unknown>(fn: T) => fn;
