import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";

vi.mock("next-auth/next", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

describe("ProtectedRoute", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to /login when there is no session", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);

    await expect(
      ProtectedRoute({ children: <div>secreto</div> })
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("renders children when a session exists", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: { id: "1", name: "Ana", email: "ana@example.com" },
      expires: "2026-08-01T00:00:00.000Z",
    } as never);

    const element = await ProtectedRoute({ children: <div>secreto</div> });
    render(element);

    expect(screen.getByText("secreto")).toBeInTheDocument();
    expect(redirect).not.toHaveBeenCalled();
  });
});
