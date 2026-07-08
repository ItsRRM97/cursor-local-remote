"use client";

import { useSyncExternalStore } from "react";

const COARSE_POINTER_QUERY = "(pointer: coarse)";

function subscribe(onStoreChange: () => void) {
  const mq = window.matchMedia(COARSE_POINTER_QUERY);
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

function getSnapshot() {
  return window.matchMedia(COARSE_POINTER_QUERY).matches;
}

function getServerSnapshot() {
  return false;
}

/** True on touch-primary devices (matches globals.css `@media (pointer: coarse)`). */
export function useCoarsePointer() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
