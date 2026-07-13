import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Providers } from "@/app/providers";

vi.mock("next-auth/react", () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

describe("Providers", () => {
  it("renders its children", () => {
    render(
      <Providers>
        <div>contenido</div>
      </Providers>
    );
    expect(screen.getByText("contenido")).toBeInTheDocument();
  });
});
