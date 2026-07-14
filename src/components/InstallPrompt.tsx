"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { DownloadIcon, ShareIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Chrome's install event. Not in lib.dom yet, so it's declared here rather than
 * cast away — `prompt()`/`userChoice` is the whole API we depend on.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Platform =
  /** Server render: we cannot know yet, and must not guess. */
  | "unknown"
  /** Already running from the home screen — nothing left to offer. */
  | "installed"
  /** iOS has no install API at all. All we can do is say where the button is. */
  | "ios"
  | "other";

/**
 * Platform is browser state, not React state, so it's read through
 * `useSyncExternalStore` rather than assigned in an effect. Doing the latter
 * means a synchronous `setState` inside `useEffect` — a cascading render that
 * `react-hooks/incompatible-library` rejects outright, and it would also render
 * one frame of the wrong UI before correcting itself.
 */
function subscribe(onChange: () => void): () => void {
  const standalone = window.matchMedia("(display-mode: standalone)");
  standalone.addEventListener("change", onChange);
  // Fired the moment the user accepts the install prompt.
  window.addEventListener("appinstalled", onChange);

  return () => {
    standalone.removeEventListener("change", onChange);
    window.removeEventListener("appinstalled", onChange);
  };
}

function getPlatform(): Platform {
  if (window.matchMedia("(display-mode: standalone)").matches) return "installed";
  // iOS predates display-mode and still reports through this instead.
  if ("standalone" in navigator && navigator.standalone === true) {
    return "installed";
  }
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ? "ios" : "other";
}

const getServerPlatform = (): Platform => "unknown";

export function InstallPrompt() {
  const platform = useSyncExternalStore(
    subscribe,
    getPlatform,
    getServerPlatform
  );

  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      // Chrome shows its own mini-infobar unless we take the event over.
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () =>
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    // The event is single-use — Chrome refuses to prompt with it twice — so it
    // has to go either way, or the button is left dead on the page. On accept,
    // `appinstalled` flips the platform to "installed" and nothing shows again.
    setInstallEvent(null);
  };

  if (platform === "installed" || platform === "unknown") return null;

  if (platform === "ios") {
    return (
      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <ShareIcon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Para instalarla: <strong className="font-medium">Compartir</strong> →{" "}
          <strong className="font-medium">Añadir a pantalla de inicio</strong>.
        </span>
      </p>
    );
  }

  if (!installEvent) return null;

  return (
    <Button variant="outline" size="sm" onClick={install}>
      <DownloadIcon />
      Instalar app
    </Button>
  );
}
