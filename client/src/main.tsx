import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerSW } from 'virtual:pwa-register';
import { ThemeProvider } from './contexts/theme-context';
import { initMonitoring } from './lib/monitoring';

// Monitoring: prod-only, single init even with HMR
if (import.meta.env.PROD && !(window as any).__MONITORING_INIT__) {
  (window as any).__MONITORING_INIT__ = true;
  initMonitoring();
}

// PWA service worker (feature-checked)
let updateSW: (reloadPage?: boolean) => void = () => {};
if ("serviceWorker" in navigator) {
  updateSW = registerSW({
    immediate: false,
    onNeedRefresh() {
      const update = () => updateSW(true);
      window.dispatchEvent(new CustomEvent("sw-update-available", { detail: { update } }));
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
  </React.StrictMode>
);
