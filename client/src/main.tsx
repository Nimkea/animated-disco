import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerSW } from "virtual:pwa-register";
import { ThemeProvider } from "./contexts/theme-context";
import { initMonitoring } from "./lib/monitoring";

// Global flags to prevent double inits (StrictMode/HMR)
declare global {
  interface Window {
    __SW_INIT__?: boolean;
    __MONITORING_INIT__?: boolean;
  }
}

// Monitoring: prod-only, single init even with HMR
if (import.meta.env.PROD && !window.__MONITORING_INIT__) {
  window.__MONITORING_INIT__ = true;
  initMonitoring();
}

// PWA service worker: feature-check + once-only guard
if ("serviceWorker" in navigator && !window.__SW_INIT__) {
  window.__SW_INIT__ = true;

  const updateSW = registerSW({
    immediate: false,
    onNeedRefresh() {
      const doUpdate = () => updateSW(true);
      window.dispatchEvent(
        new CustomEvent("sw-update-available", {
          detail: { update: doUpdate },
        }),
      );
    },
    onOfflineReady() {
      window.dispatchEvent(new CustomEvent("sw-offline-ready"));
      console.log("App ready to work offline");
    },
  });
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");

createRoot(rootEl).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);
