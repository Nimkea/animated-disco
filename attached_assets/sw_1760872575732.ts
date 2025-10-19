/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, NetworkOnly, StaleWhileRevalidate } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope;

// Cache version - increment this to force COMPLETE cache invalidation
const CACHE_VERSION = 'v3';
const CACHE_PREFIX = 'xnrt';

// Take control immediately
clientsClaim();
self.skipWaiting();

// Precache all assets from the build
// Note: Workbox manages its own cache names, but our activate handler will clean old versions
precacheAndRoute(self.__WB_MANIFEST, {
  ignoreURLParametersMatching: [/.*/]
});

// Custom activate event to AGGRESSIVELY delete ALL old caches
self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            // Delete ALL workbox precaches that don't match our version
            if (cacheName.startsWith('workbox-precache') || cacheName.includes('precache')) {
              if (!cacheName.includes(CACHE_VERSION)) {
                console.log('[SW] Deleting old Workbox precache:', cacheName);
                return true;
              }
            }
            // Delete all our custom caches that don't match current version
            if (cacheName.startsWith(CACHE_PREFIX) && !cacheName.includes(CACHE_VERSION)) {
              console.log('[SW] Deleting old versioned cache:', cacheName);
              return true;
            }
            return false;
          })
          .map((cacheName) => caches.delete(cacheName))
      );
    }).then(() => {
      console.log('[SW] Complete cache cleanup finished, version:', CACHE_VERSION);
      // Force all clients to reload with fresh service worker
      return self.clients.claim();
    })
  );
});

// SPA Navigation - Allow ALL routes except APIs and static files
registerRoute(
  new NavigationRoute(
    createHandlerBoundToURL('/index.html'),
    {
      denylist: [
        /^\/api\/.*/,  // Exclude API routes
        /\/[^/?]+\.(?:js|css|json|png|jpg|jpeg|svg|gif|webp|ico|map|woff|woff2)$/  // Exclude static files
      ]
      // NO allowlist - matches all navigation requests except those in denylist
    }
  )
);

// Google Fonts - Cache First
registerRoute(
  /^https:\/\/fonts\.googleapis\.com\/.*/i,
  new CacheFirst({
    cacheName: `${CACHE_PREFIX}-google-fonts-${CACHE_VERSION}`,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 60 * 60 * 24 * 365  // 1 year
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200]
      })
    ]
  })
);

// Google Fonts Static - Cache First
registerRoute(
  /^https:\/\/fonts\.gstatic\.com\/.*/i,
  new CacheFirst({
    cacheName: `${CACHE_PREFIX}-gstatic-fonts-${CACHE_VERSION}`,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 60 * 60 * 24 * 365  // 1 year
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200]
      })
    ]
  })
);

// JS/CSS Bundles - Stale While Revalidate (always check for updates while serving cached version)
registerRoute(
  /\.(?:js|css)$/,
  new StaleWhileRevalidate({
    cacheName: `${CACHE_PREFIX}-static-assets-${CACHE_VERSION}`,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200]
      }),
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 60 * 60 * 24 * 7  // 7 days (shorter to force refresh)
      })
    ]
  })
);

// Web Manifest - Stale While Revalidate
registerRoute(
  /manifest\.webmanifest$/,
  new StaleWhileRevalidate({
    cacheName: `${CACHE_PREFIX}-app-manifest-${CACHE_VERSION}`
  })
);

// App Icons - Stale While Revalidate
registerRoute(
  /\.(?:ico|png|svg)$/,
  new StaleWhileRevalidate({
    cacheName: `${CACHE_PREFIX}-app-icons-${CACHE_VERSION}`,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 60 * 24 * 30  // 30 days
      })
    ]
  })
);

// Auth & Wallet Routes - NEVER cache (NetworkOnly)
registerRoute(
  /\/auth\/.*/,
  new NetworkOnly()
);

registerRoute(
  /\/api\/wallet\/.*/,
  new NetworkOnly()
);

// API Routes - Network First with short cache (1 minute for fresh data)
// Auth & wallet routes are excluded above
registerRoute(
  /\/api\/.*/,
  new NetworkFirst({
    cacheName: `${CACHE_PREFIX}-api-${CACHE_VERSION}`,
    networkTimeoutSeconds: 3,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60  // 1 minute
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200]
      })
    ]
  }),
  'GET'
);

// Listen for skip waiting message
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Push notification handler
self.addEventListener('push', (event: PushEvent) => {
  const data = event.data?.json() || {};
  const { title, body, icon, badge, data: actionData } = data;
  
  event.waitUntil(
    self.registration.showNotification(title || 'XNRT Notification', {
      body: body || 'You have a new notification',
      icon: icon || '/icon-192.png',
      badge: badge || '/icon-192.png',
      data: actionData,
      tag: data.tag || 'xnrt-notification',
    })
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  
  event.waitUntil(
    self.clients.openWindow(event.notification.data?.url || '/')
  );
});
