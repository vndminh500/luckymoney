"use client";

import { useEffect } from "react";

/**
 * Registers /sw.js (offline page for the installed app). Production only: in
 * `next dev` a service worker would sit between the browser and hot reload.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Without it the app still works, only without the offline page.
    });
  }, []);
  return null;
}
