import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { InstallPrompt } from "@/components/InstallPrompt";

const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36";
const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1";

/** jsdom has no matchMedia; vitest-setup stubs it as "no match" by default. */
function stubEnvironment({
  userAgent,
  standalone = false,
}: {
  userAgent: string;
  standalone?: boolean;
}) {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(userAgent);
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query.includes("display-mode: standalone") && standalone,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  );
}

function fireBeforeInstallPrompt() {
  const prompt = vi.fn().mockResolvedValue(undefined);
  const event = Object.assign(new Event("beforeinstallprompt"), {
    prompt,
    userChoice: Promise.resolve({ outcome: "accepted" as const }),
  });
  window.dispatchEvent(event);
  return { prompt };
}

describe("InstallPrompt", () => {
  beforeEach(() => {
    stubEnvironment({ userAgent: ANDROID_UA });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows nothing until the browser says the app can be installed", () => {
    render(<InstallPrompt />);

    expect(
      screen.queryByRole("button", { name: /instalar/i })
    ).not.toBeInTheDocument();
  });

  it("offers a real install button once Chrome fires beforeinstallprompt", async () => {
    render(<InstallPrompt />);
    fireBeforeInstallPrompt();

    expect(
      await screen.findByRole("button", { name: /instalar app/i })
    ).toBeInTheDocument();
  });

  it("clicking it triggers the browser's own install prompt", async () => {
    const user = userEvent.setup();
    render(<InstallPrompt />);
    const { prompt } = fireBeforeInstallPrompt();

    await user.click(await screen.findByRole("button", { name: /instalar app/i }));

    expect(prompt).toHaveBeenCalled();
    // The event is single-use — Chrome refuses a second prompt() — so the
    // button must not linger as a dead control.
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /instalar app/i })
      ).not.toBeInTheDocument()
    );
  });

  // iOS has no install API whatsoever: waiting for beforeinstallprompt there
  // would show nothing at all, on the platform where the hint is needed most.
  it("shows the Añadir a pantalla de inicio hint on iOS instead of a button", async () => {
    stubEnvironment({ userAgent: IPHONE_UA });
    render(<InstallPrompt />);

    expect(await screen.findByText(/pantalla de inicio/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /instalar/i })
    ).not.toBeInTheDocument();
  });

  it("shows nothing at all once the app is already installed", async () => {
    stubEnvironment({ userAgent: ANDROID_UA, standalone: true });
    const { container } = render(<InstallPrompt />);

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
