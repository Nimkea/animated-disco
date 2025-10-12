/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope;

// Cache version - increment this to force cache invalidation
const CACHE_VERSION = 'v2';
const CACHE_PREFIX = 'xnrt';

// Take control immediately
clientsClaim();
self.skipWaiting();

// Precache all assets from the build
precacheAndRoute(self.__WB_MANIFEST);

// Cleanup old caches from Workbox
cleanupOutdatedCaches();

// Custom activate event to delete all old versioned caches
self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            // Delete caches that don't match current version
            return cacheName.startsWith(CACHE_PREFIX) && !cacheName.includes(CACHE_VERSION);
          })
          .map((cacheName) => {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          })
      );
    }).then(() => {
      console.log('[SW] Cache cleanup complete, version:', CACHE_VERSION);
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

// API Routes - Network First with short cache (1 minute for fresh data)
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
