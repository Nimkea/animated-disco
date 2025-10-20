/// <reference lib="webworker" />
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  matchPrecache,
  precacheAndRoute,
} from "workbox-precaching";
import { clientsClaim } from "workbox-core";
import {
  NavigationRoute,
  registerRoute,
  setCatchHandler,
} from "workbox-routing";
import {
  CacheFirst,
  NetworkFirst,
  NetworkOnly,
  StaleWhileRevalidate,
} from "workbox-strategies";
import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { ExpirationPlugin } from "workbox-expiration";

declare const self: ServiceWorkerGlobalScope;

// Cache version - increment this to force COMPLETE cache invalidation
// v10: Removed navigation preload to fix preloadResponse warning,
//      separated D3 from Recharts in build chunks to prevent init errors
const CACHE_VERSION = "v10";
const CACHE_PREFIX = "xnrt";

// Take control of clients immediately after activate
clientsClaim();

// Install: prune our older runtime caches (keep workbox precache)
self.addEventListener("install", (event: ExtendableEvent) => {
  console.log("[SW] Installing new service worker, version:", CACHE_VERSION);
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(
            (n) =>
              n.startsWith(`${CACHE_PREFIX}-`) &&
              !n.endsWith(`-${CACHE_VERSION}`),
          )
          .map((n) => {
            console.log("[SW] Deleting old runtime cache:", n);
            return caches.delete(n);
          }),
      );
      console.log("[SW] Install complete");
    })(),
  );
});

// Precache all assets from the build
precacheAndRoute(self.__WB_MANIFEST, {
  // Ignore only analytics params
  ignoreURLParametersMatching: [/^utm_/, /^fbclid$/, /^gclid$/, /^msclkid$/],
});

// Activate: cleanup workbox caches
self.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil(
    (async () => {
      await cleanupOutdatedCaches();
      console.log("[SW] Activation complete, version:", CACHE_VERSION);
      await self.clients.claim();
    })(),
  );
});

// SPA navigations → app shell; deny api/static
registerRoute(
  new NavigationRoute(createHandlerBoundToURL("/index.html"), {
    denylist: [
      /^\/api\/.*/,
      /\/[^/?]+\.(?:js|css|json|png|jpg|jpeg|svg|gif|webp|ico|map|woff|woff2)$/,
    ],
  }),
);

// Google Fonts (CSS) – Cache First
registerRoute(
  /^https:\/\/fonts\.googleapis\.com\/.*/i,
  new CacheFirst({
    cacheName: `${CACHE_PREFIX}-google-fonts-${CACHE_VERSION}`,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 60 * 60 * 24 * 365,
      }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
);

// Google Fonts (static) – Cache First
registerRoute(
  /^https:\/\/fonts\.gstatic\.com\/.*/i,
  new CacheFirst({
    cacheName: `${CACHE_PREFIX}-gstatic-fonts-${CACHE_VERSION}`,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 60 * 60 * 24 * 365,
      }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
);

// Content-type guard plugin factory
const onlyIfContentType = (startsWith: string) => ({
  cacheWillUpdate: async ({ response }: { response: Response }) => {
    if (!response || response.status !== 200) return null;
    const ct = response.headers.get("content-type") || "";
    return ct.startsWith(startsWith) ? response : null;
  },
});

// Scripts – Cache First (with MIME guards)
registerRoute(
  ({ request }) => request.destination === "script",
  new CacheFirst({
    cacheName: `${CACHE_PREFIX}-scripts-${CACHE_VERSION}`,
    plugins: [
      onlyIfContentType("text/javascript"),
      onlyIfContentType("application/javascript"),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 * 30,
      }),
    ],
  }),
);

// Styles – Cache First (with MIME guard)
registerRoute(
  ({ request }) => request.destination === "style",
  new CacheFirst({
    cacheName: `${CACHE_PREFIX}-styles-${CACHE_VERSION}`,
    plugins: [
      onlyIfContentType("text/css"),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 60 * 60 * 24 * 30,
      }),
    ],
  }),
);

// Manifest – Stale While Revalidate
registerRoute(
  /manifest\.webmanifest$/,
  new StaleWhileRevalidate({
    cacheName: `${CACHE_PREFIX}-app-manifest-${CACHE_VERSION}`,
  }),
);

// App icons – Stale While Revalidate
registerRoute(
  /\.(?:ico|png|svg)$/,
  new StaleWhileRevalidate({
    cacheName: `${CACHE_PREFIX}-app-icons-${CACHE_VERSION}`,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 60 * 24 * 30,
      }),
    ],
  }),
);

// Auth & wallet – NEVER cache
registerRoute(/\/auth\/.*/, new NetworkOnly());
registerRoute(/\/api\/wallet\/.*/, new NetworkOnly());

// API – Network First (short cache)
registerRoute(
  /\/api\/.*/,
  new NetworkFirst({
    cacheName: `${CACHE_PREFIX}-api-${CACHE_VERSION}`,
    networkTimeoutSeconds: 3,
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
  "GET",
);

// Global catch → offline shell for navigations
setCatchHandler(async ({ request }) => {
  if (request.mode === "navigate") {
    const cachedShell = await matchPrecache("/index.html");
    if (cachedShell) {
      console.log("[SW] Network failed, serving cached shell");
      return cachedShell;
    }
    return new Response("Offline - Unable to load app shell", {
      status: 503,
      statusText: "Service Unavailable",
      headers: { "Content-Type": "text/plain" },
    });
  }
  return Response.error();
});

// Skip waiting (only when UI asks)
self.addEventListener("message", (event: ExtendableMessageEvent) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    console.log("[SW] Skip waiting triggered by UI");
    self.skipWaiting();
  }
});

// Push notifications
self.addEventListener("push", (event: PushEvent) => {
  event.waitUntil(
    (async () => {
      let data: any = {};
      try {
        data = event.data ? event.data.json() : {};
      } catch (e) {
        console.error("[SW] Failed to parse push data:", e);
      }
      const { title, body, icon, badge, data: actionData, tag } = data;
      await self.registration.showNotification(title || "XNRT Notification", {
        body: body || "You have a new notification",
        icon: icon || "/icon-192.png",
        badge: badge || "/icon-192.png",
        data: actionData,
        tag: tag || "xnrt-notification",
      });
    })(),
  );
});

// Notification click → open URL (or home)
self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(event.notification.data?.url || "/"));
});
