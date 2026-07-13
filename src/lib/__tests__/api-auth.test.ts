import { describe, expect, it, vi } from "vitest";
import { getServerSession } from "next-auth/next";
import { requireSession } from "@/lib/api-auth";
import { UnauthorizedError } from "@/lib/errors";

vi.mock("next-auth/next", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

describe("requireSession", () => {
  it("returns the session when one exists", async () => {
    const session = {
      user: { id: "1", name: "Ana", email: "ana@example.com" },
      expires: "2026-08-01T00:00:00.000Z",
    };
    vi.mocked(getServerSession).mockResolvedValueOnce(session as never);

    await expect(requireSession()).resolves.toEqual(session);
  });

  it("throws UnauthorizedError when there is no session", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);

    await expect(requireSession()).rejects.toThrow(UnauthorizedError);
  });

  it("throws UnauthorizedError when the session has no user id", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: {},
      expires: "2026-08-01T00:00:00.000Z",
    } as never);

    await expect(requireSession()).rejects.toThrow(UnauthorizedError);
  });
});
