"use client";

import { useEffect } from "react";

export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(process.env.NEXT_PUBLIC_BUILD_ID ?? "dev")}`).catch((error: unknown) => {
      console.error("Service worker registration failed", error);
    });
  }, []);

  return null;
}
