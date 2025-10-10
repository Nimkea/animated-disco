import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerSW } from 'virtual:pwa-register';

// Register service worker with update prompt
const updateSW = registerSW({
  onNeedRefresh() {
    const update = () => {
      updateSW(true);
    };
    
    const event = new CustomEvent('sw-update-available', { detail: { update } });
    window.dispatchEvent(event);
  },
  onOfflineReady() {
    console.log('App ready to work offline');
    const event = new CustomEvent('sw-offline-ready');
    window.dispatchEvent(event);
  },
});

createRoot(document.getElementById("root")!).render(<App />);
