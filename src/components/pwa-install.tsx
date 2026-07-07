"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-fetch";
import { CloseIcon } from "./icons";

const IOS_HINT_KEY = "clr-ios-pwa-hint-dismissed";

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

    if (isIos() && !localStorage.getItem(IOS_HINT_KEY)) {
      setShowIosHint(true);
    }
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
        <div className="fixed bottom-[var(--clr-composer-offset)] left-3 right-3 z-30 mx-auto max-w-md rounded-lg border border-border bg-bg-elevated px-4 py-3 text-clr-xs text-text-muted shadow-lg sm:left-auto safe-bottom">
          <div className="flex items-start justify-between gap-2">
            <p>
              <span className="text-text-secondary font-medium">Install on iOS:</span>{" "}
              Share → <span className="text-text-secondary">Add to Home Screen</span>
            </p>
            <button
              type="button"
              onClick={() => {
                localStorage.setItem(IOS_HINT_KEY, "1");
                setShowIosHint(false);
              }}
              className="shrink-0 icon-btn hover:bg-bg-hover text-text-muted"
              aria-label="Dismiss install hint"
            >
              <CloseIcon size={12} />
            </button>
          </div>
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
