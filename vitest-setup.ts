import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// jsdom ships no matchMedia implementation, but every real browser has one, so
// components are entitled to call it unguarded. Without this stub, any component
// that reads a media query at mount (Sidebar closes its drawer when the viewport
// crosses into desktop) throws "window.matchMedia is not a function" on render.
//
// Defaults to "does not match", i.e. the mobile branch — which is the one worth
// exercising in tests. A test that needs the desktop branch can override
// `matches` on the returned object.
if (!window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

afterEach(() => {
  cleanup();
});
