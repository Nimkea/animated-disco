/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope;

// Take control immediately
clientsClaim();
self.skipWaiting();

// Precache all assets from the build
precacheAndRoute(self.__WB_MANIFEST);

// Cleanup old caches
cleanupOutdatedCaches();

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
    cacheName: 'google-fonts-cache',
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
    cacheName: 'gstatic-fonts-cache',
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

// JS/CSS Bundles - Cache First (versioned by filename)
registerRoute(
  /\.(?:js|css)$/,
  new CacheFirst({
    cacheName: 'static-assets',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 60 * 60 * 24 * 30  // 30 days
      })
    ]
  })
);

// Web Manifest - Stale While Revalidate
registerRoute(
  /manifest\.webmanifest$/,
  new StaleWhileRevalidate({
    cacheName: 'app-manifest'
  })
);

// App Icons - Stale While Revalidate
registerRoute(
  /\.(?:ico|png|svg)$/,
  new StaleWhileRevalidate({
    cacheName: 'app-icons',
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
    cacheName: 'api-cache',
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
