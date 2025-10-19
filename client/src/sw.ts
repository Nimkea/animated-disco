/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, matchPrecache, precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { NavigationRoute, registerRoute, setCatchHandler } from 'workbox-routing';
import { CacheFirst, NetworkFirst, NetworkOnly, StaleWhileRevalidate } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope;

// Cache version - increment this to force COMPLETE cache invalidation
// v8: Force refresh to fix production MIME type errors from cached dev HTML
//     Clears stale caches mixing dev/prod assets causing "Cannot access before initialization"
const CACHE_VERSION = 'v8';
const CACHE_PREFIX = 'xnrt';

// Take control immediately
clientsClaim();
self.skipWaiting();

// Install event - Force clear ALL old caches for v7+ (aggressive cleanup)
self.addEventListener('install', (event: ExtendableEvent) => {
  console.log('[SW] Installing new service worker, version:', CACHE_VERSION);
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      console.log('[SW] Found existing caches:', cacheNames);
      
      // Delete ALL caches that don't match current version
      await Promise.all(
        cacheNames
          .filter(cacheName => 
            // Keep only caches with current version suffix
            !cacheName.includes(`-${CACHE_VERSION}`) &&
            // And keep Workbox precaches (they're managed separately)
            !cacheName.startsWith('workbox-precache')
          )
          .map(cacheName => {
            console.log('[SW] Deleting old cache during install:', cacheName);
            return caches.delete(cacheName);
          })
      );
      
      console.log('[SW] Install complete, forcing skip waiting');
      await self.skipWaiting();
    })()
  );
});

// Precache all assets from the build
// Workbox manages its own precache names - we NEVER delete them manually
precacheAndRoute(self.__WB_MANIFEST, {
  ignoreURLParametersMatching: [/.*/]
});

// Activate event - Let Workbox handle precache cleanup, only delete our custom runtime caches
self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    (async () => {
      // Enable navigation preload for faster first navigation
      try {
        await self.registration.navigationPreload?.enable();
      } catch (e) {
        // Navigation preload not supported, continue without it
      }

      // Let Workbox handle its own precache migrations (DO NOT delete manually!)
      await cleanupOutdatedCaches();

      // Only prune OUR custom versioned runtime caches (xnrt-*)
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(cacheName => 
            cacheName.startsWith(`${CACHE_PREFIX}-`) && 
            !cacheName.endsWith(`-${CACHE_VERSION}`)
          )
          .map(cacheName => {
            console.log('[SW] Deleting old runtime cache:', cacheName);
            return caches.delete(cacheName);
          })
      );

      console.log('[SW] Activation complete, version:', CACHE_VERSION);
      await self.clients.claim();
    })()
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

// JS/CSS Bundles - CacheFirst with versioned cache name
// CRITICAL: Version in cache name ensures all chunks are from same build
// When CACHE_VERSION changes, activate handler deletes old versioned caches
// This prevents "Cannot access before initialization" from mixing versions
// CacheFirst ensures offline support while version isolation prevents mismatches
registerRoute(
  /\.(?:js|css)$/,
  new CacheFirst({
    cacheName: `${CACHE_PREFIX}-static-assets-${CACHE_VERSION}`,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200]
      }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 * 30  // 30 days
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

// Global catch handler - Ensures FetchEvents NEVER reject
// Provides graceful fallback to cached shell for failed navigations
setCatchHandler(async ({ request }) => {
  // For navigation requests (page loads), fallback to cached /index.html
  if (request.mode === 'navigate') {
    const cachedShell = await matchPrecache('/index.html');
    if (cachedShell) {
      console.log('[SW] Network failed, serving cached shell');
      return cachedShell;
    }
    // If somehow /index.html isn't in precache, return offline page
    return new Response('Offline - Unable to load app shell', { 
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain' }
    });
  }
  
  // For other requests, return empty response with timeout status
  return new Response('', { 
    status: 504, 
    statusText: 'Gateway Timeout' 
  });
});

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
