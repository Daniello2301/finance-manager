import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

/**
 * Loads and executes the REAL `public/sw.js` — the artifact that ships — inside
 * a fake ServiceWorkerGlobalScope, rather than testing a re-implementation of
 * its logic. A service worker sits in front of every request the app makes; a
 * test of a copy of it would prove nothing about what users actually run.
 */
function loadServiceWorker() {
  const source = readFileSync(
    path.join(process.cwd(), "public", "sw.js"),
    "utf8"
  );

  const listeners = new Map<string, (event: unknown) => void>();
  const cachedResponses = new Map<string, unknown>();

  const self = {
    location: { origin: "https://finanzas.test" },
    addEventListener: (type: string, fn: (event: unknown) => void) => {
      listeners.set(type, fn);
    },
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn() },
  };

  const caches = {
    open: vi.fn().mockResolvedValue({ add: vi.fn(), put: vi.fn() }),
    keys: vi.fn().mockResolvedValue([]),
    delete: vi.fn(),
    match: vi.fn(async (key: string) => cachedResponses.get(key)),
  };

  const factory = new Function(
    "self",
    "caches",
    "fetch",
    `${source}\nreturn { pickStrategy, isShellAsset };`
  );

  const fetchMock = vi.fn();
  const api = factory(self, caches, fetchMock) as {
    pickStrategy: (request: unknown) => string;
    isShellAsset: (pathname: string) => boolean;
  };

  return { ...api, listeners, caches, fetchMock, cachedResponses };
}

function request(
  url: string,
  { method = "GET", mode = "cors" }: { method?: string; mode?: string } = {}
) {
  return { url, method, mode };
}

describe("service worker routing", () => {
  // The rule the whole file exists to enforce. A cached balance is a number
  // that was true once, presented as if it were true now.
  it("never handles /api requests — data always comes from the network", () => {
    const { pickStrategy } = loadServiceWorker();

    expect(
      pickStrategy(request("https://finanzas.test/api/accounts"))
    ).toBe("passthrough");
    expect(
      pickStrategy(request("https://finanzas.test/api/dashboard/summary"))
    ).toBe("passthrough");
    expect(
      pickStrategy(
        request("https://finanzas.test/api/transactions", { method: "POST" })
      )
    ).toBe("passthrough");
  });

  it("never handles anything that isn't a GET", () => {
    const { pickStrategy } = loadServiceWorker();

    for (const method of ["POST", "PATCH", "DELETE"]) {
      expect(
        pickStrategy(request("https://finanzas.test/dashboard", { method }))
      ).toBe("passthrough");
    }
  });

  it("leaves cross-origin requests alone", () => {
    const { pickStrategy } = loadServiceWorker();

    expect(pickStrategy(request("https://fonts.gstatic.com/f.woff2"))).toBe(
      "passthrough"
    );
  });

  it("serves the content-hashed bundle and the icons from cache", () => {
    const { pickStrategy } = loadServiceWorker();

    expect(
      pickStrategy(request("https://finanzas.test/_next/static/chunks/a1b2.js"))
    ).toBe("cache-first");
    expect(pickStrategy(request("https://finanzas.test/icon-192.png"))).toBe(
      "cache-first"
    );
    expect(
      pickStrategy(request("https://finanzas.test/manifest.webmanifest"))
    ).toBe("cache-first");
  });

  it("treats page navigations as network-first", () => {
    const { pickStrategy } = loadServiceWorker();

    expect(
      pickStrategy(
        request("https://finanzas.test/dashboard", { mode: "navigate" })
      )
    ).toBe("navigate");
  });

  it("falls back to the offline page when a navigation cannot reach the network", async () => {
    const sw = loadServiceWorker();
    sw.cachedResponses.set("/offline", { body: "sin conexión" });
    sw.fetchMock.mockRejectedValue(new Error("offline"));

    const fetchListener = sw.listeners.get("fetch");
    expect(fetchListener).toBeDefined();

    let responded: Promise<unknown> | undefined;
    fetchListener?.({
      request: request("https://finanzas.test/dashboard", { mode: "navigate" }),
      respondWith: (promise: Promise<unknown>) => {
        responded = promise;
      },
    });

    await expect(responded).resolves.toEqual({ body: "sin conexión" });
  });

  it("precaches the offline page on install", async () => {
    const sw = loadServiceWorker();
    const cache = { add: vi.fn().mockResolvedValue(undefined), put: vi.fn() };
    sw.caches.open.mockResolvedValue(cache);

    const installListener = sw.listeners.get("install");
    let work: Promise<unknown> | undefined;
    installListener?.({
      waitUntil: (promise: Promise<unknown>) => {
        work = promise;
      },
    });

    await work;
    expect(cache.add).toHaveBeenCalledWith("/offline");
  });
});
