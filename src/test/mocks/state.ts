/** Shared request state read by the next/headers mock. Reset in beforeEach. */
export const mockRequest = {
  token: undefined as string | undefined,
  ip: "127.0.0.1",
  cookiesSet: [] as { name: string; value: string; options?: Record<string, unknown> }[],
};

export function resetMockRequest(): void {
  mockRequest.token = undefined;
  mockRequest.ip = "127.0.0.1";
  mockRequest.cookiesSet.length = 0;
}
