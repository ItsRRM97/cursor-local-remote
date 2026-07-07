"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-fetch";

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    return null;
  }
}

export function PwaInstall() {
  const [enabled, setEnabled] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    apiFetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.settings?.pwa_prompt !== false) setEnabled(true);
      })
      .catch(() => setEnabled(true));
  }, []);

  useEffect(() => {
    if (!enabled) return;

    registerServiceWorker().then(() => {
      import("@khmyznikov/pwa-install").catch(() => {});
    });

    if (isIos()) setShowIosHint(true);
  }, [enabled]);

  if (!enabled) return null;

  return (
    <>
      <pwa-install
        manifest-url="/manifest.webmanifest"
        name="Cursor Local Remote"
        description="Control Cursor IDE from any device on your local network"
        icon="/apple-touch-icon.png"
        install-description="Install CLR for quick access from your home screen"
      />
      {showIosHint && (
        <div className="fixed bottom-3 left-3 right-3 z-30 mx-auto max-w-md rounded-lg border border-border bg-bg-elevated px-3 py-2 text-[11px] text-text-muted shadow-lg sm:left-auto">
          iOS: Share → <span className="text-text-secondary">Add to Home Screen</span>
        </div>
      )}
      {isAndroid() && (
        <noscript>
          Android: use Chrome menu → Install app after signing in.
        </noscript>
      )}
    </>
  );
}
