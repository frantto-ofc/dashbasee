"use client";

import { useEffect } from "react";

export default function AuthCacheCleanup() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.getRegistrations().then((registrations) =>
        Promise.all(registrations.filter((registration) => {
          const worker = registration.active || registration.waiting || registration.installing;
          return worker && new URL(worker.scriptURL).pathname === "/sw.js";
        }).map((registration) => registration.unregister())),
      ).catch(() => {});
    }
    if ("caches" in window) {
      void caches.keys().then((keys) => Promise.all(
        keys.filter((key) => key.startsWith("estudio-fluxo-shell")).map((key) => caches.delete(key)),
      )).catch(() => {});
    }
  }, []);
  return null;
}
