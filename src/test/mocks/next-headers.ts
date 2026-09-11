import { mockRequest } from "./state";

// Use with: vi.mock("next/headers", () => import("@/test/mocks/next-headers"));
export async function cookies() {
  return {
    get: (name: string) => (name === "gfg_session" && mockRequest.token ? { name, value: mockRequest.token } : undefined),
    set: (name: string, value: string, options?: Record<string, unknown>) => {
      mockRequest.cookiesSet.push({ name, value, options });
    },
    delete: () => {
      throw new Error("use set(..., { maxAge: 0 }) so __Host- cookies are actually cleared");
    },
  };
}

export async function headers() {
  return new Headers({ "x-real-ip": mockRequest.ip, "user-agent": "vitest", origin: "http://localhost:3000" });
}
