import { describe, expect, it } from "vitest";

import manifest from "@/app/manifest";

describe("web app manifest", () => {
  const result = manifest();

  // Without display:standalone the icon on the home screen opens a bookmark in
  // the browser, chrome and all — which is the one thing installing was for.
  it("declares itself standalone", () => {
    expect(result.display).toBe("standalone");
  });

  it("opens on the dashboard, not the marketing landing page", () => {
    expect(result.start_url).toBe("/dashboard");
    expect(result.scope).toBe("/");
  });

  // Chrome refuses to offer installation without both of these sizes.
  it("carries the 192px and 512px icons Chrome requires to install", () => {
    const sizes = result.icons?.map((icon) => icon.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
  });

  // Android masks icons to its own shape and keeps only the inner 80%. Without
  // a maskable variant it shrinks ours into a white circle.
  it("carries a maskable icon so Android doesn't shave the corners off", () => {
    const maskable = result.icons?.find((icon) => icon.purpose === "maskable");
    expect(maskable).toBeDefined();
    expect(maskable?.sizes).toBe("512x512");
  });

  // A manifest is JSON read by the OS, not CSS — oklch means nothing to it.
  it("uses colours the OS can actually parse", () => {
    expect(result.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(result.background_color).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
