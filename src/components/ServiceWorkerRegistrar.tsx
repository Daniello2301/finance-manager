"use client";

import { useEffect } from "react";

/**
 * Registers the app-shell service worker. Renders nothing.
 *
 * Production only, on purpose: a worker that caches `/_next/static/` fights
 * Turbopack's hot reload in development, and the failure mode — a stale chunk
 * served from cache while the dev server has moved on — looks like a bug in
 * your own code for a good half hour.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    void navigator.serviceWorker.register("/sw.js").catch((error) => {
      // Nothing user-facing: without a worker the app simply behaves as it did
      // before it had one. Not worth a toast, worth a console line.
      console.error("No se pudo registrar el service worker:", error);
    });
  }, []);

  return null;
}
