/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { NavigationRoute, registerRoute, setCatchHandler } from 'workbox-routing';
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

// Clean up old caches - let Workbox manage its own precaches
self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    (async () => {
      // Let Workbox clean up its own outdated precaches safely
      await cleanupOutdatedCaches();
      
      // Only delete OUR custom versioned caches (never touch Workbox caches)
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((cacheName) => {
            // Only delete our custom caches that don't match current version
            // NEVER touch caches starting with "workbox-" - Workbox manages those
            return cacheName.startsWith(CACHE_PREFIX) && !cacheName.includes(CACHE_VERSION);
          })
          .map((cacheName) => {
            console.log('[SW] Deleting old custom cache:', cacheName);
            return caches.delete(cacheName);
          })
      );
      
      console.log('[SW] Cache cleanup finished, version:', CACHE_VERSION);
      
      // Take control of all clients
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

// Global catch handler - prevents FetchEvent rejections on network/cache failures
// This ensures the SW never crashes and always returns a response
setCatchHandler(async ({ request, event }) => {
  // For navigation requests, try to serve the SPA shell from cache
  if (request.mode === 'navigate') {
    // Try to find index.html in any precache
    const cacheNames = await caches.keys();
    const precacheName = cacheNames.find(name => name.includes('precache'));
    
    if (precacheName) {
      const cache = await caches.open(precacheName);
      const cachedResponse = await cache.match('/index.html', { ignoreSearch: true });
      
      if (cachedResponse) {
        console.log('[SW] Serving cached index.html as fallback for:', request.url);
        return cachedResponse;
      }
    }
    
    // If even index.html is not cached, return a friendly offline page
    return new Response(
      '<!DOCTYPE html><html><head><title>Offline</title></head><body><h1>Offline</h1><p>Please check your internet connection</p></body></html>',
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'text/html' }
      }
    );
  }
  
  // For non-navigation requests (assets, API calls), return appropriate error
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
