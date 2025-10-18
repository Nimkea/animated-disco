# Service Worker & PWA Caching Strategy

## Overview
XNRT uses Workbox-powered service workers for Progressive Web App (PWA) functionality. This document explains the caching strategy and common issues.

## Critical Issues Fixed

### 1. Code-Split Bundle Caching

**The Problem:** When using Vite's code-splitting with manual chunks (vendor-react, vendor-charts, etc.), **you must ensure all chunks load from the same version**. Mixing old and new chunks causes initialization errors like:

```
Uncaught ReferenceError: Cannot access 'A' before initialization
at vendor-charts-GZY0HmWu.js:1:14764
```

**Why This Happens:**
1. User visits site, SW caches all bundles (version 1)
2. You deploy new code (version 2)
3. SW serves some chunks from cache (v1) and fetches others from network (v2)
4. Code-split chunks have incompatible exports/imports between versions
5. Module initialization fails with "Cannot access before initialization"

**The Solution:** Use **NetworkFirst** strategy for JS/CSS bundles instead of StaleWhileRevalidate:

```typescript
// client/src/sw.ts
registerRoute(
  /\.(?:js|css)$/,
  new NetworkFirst({
    cacheName: `${CACHE_PREFIX}-static-assets-${CACHE_VERSION}`,
    networkTimeoutSeconds: 5,
    // ...
  })
);
```

This ensures:
- ✅ Always tries to fetch fresh bundles from network
- ✅ All chunks come from the same version
- ✅ Falls back to cache only when offline (graceful degradation)
- ✅ No "Cannot access before initialization" errors

### 2. Workbox Precache Deletion (CRITICAL!)

**The Problem:** Workbox manages its own precache with names like `workbox-precache-v2-https://xnrt.org/`. These caches **never include your custom `CACHE_VERSION` string**. If your activation handler deletes caches that don't include `v5`, it will **delete the fresh Workbox precache** containing `/index.html` and other assets.

**Result:** Navigation handler tries to serve deleted `/index.html` → network fetch fails → blank page → "FetchEvent rejected" errors.

**The Solution:** Let Workbox manage its own precaches via `cleanupOutdatedCaches()`:

```typescript
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Enable navigation preload for faster first navigation
      try {
        await self.registration.navigationPreload?.enable();
      } catch (e) {}

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
          .map(cacheName => caches.delete(cacheName))
      );

      await self.clients.claim();
    })()
  );
});
```

**Never do this:**
```typescript
// ❌ WRONG - Deletes Workbox precache!
if (cacheName.startsWith('workbox-precache') && !cacheName.includes(CACHE_VERSION)) {
  caches.delete(cacheName);  // Destroys /index.html cache!
}
```

### 3. Failed Fetch Events

**The Problem:** When a fetch fails (network down, cache miss), the FetchEvent rejects causing "FetchEvent ... promise was rejected" errors and blank pages.

**The Solution:** Add a global catch handler that ensures failed navigations always fallback to the cached shell:

```typescript
import { setCatchHandler, matchPrecache } from 'workbox-routing';

setCatchHandler(async ({ request }) => {
  // For navigation requests, fallback to cached /index.html
  if (request.mode === 'navigate') {
    const cachedShell = await matchPrecache('/index.html');
    if (cachedShell) return cachedShell;
    return new Response('Offline', { status: 503 });
  }
  return new Response('', { status: 504, statusText: 'Gateway Timeout' });
});
```

This ensures:
- ✅ Navigation requests never reject, always return a Response
- ✅ Failed fetches gracefully fallback to cached shell
- ✅ No more blank pages from network failures
- ✅ App remains usable even when offline

## Cache Versioning

### When to Bump Cache Version
Increment `CACHE_VERSION` in `client/src/sw.ts` when:
- Making significant changes to the service worker logic
- Experiencing cache-related issues in production
- Want to force all clients to refresh their caches

```typescript
const CACHE_VERSION = 'v5';  // Increment this (v1, v2, v3, v4, v5...)
```

### Cache Invalidation

**IMPORTANT:** Only delete YOUR custom runtime caches, never Workbox precaches!

The service worker automatically deletes old **custom runtime caches** on activation:

```typescript
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Let Workbox clean its own precaches
      await cleanupOutdatedCaches();
      
      // Delete only OUR old runtime caches (xnrt-google-fonts-v4, etc.)
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(name => name.startsWith('xnrt-') && !name.endsWith('-v5'))
          .map(name => caches.delete(name))
      );
    })()
  );
});
```

**What gets deleted:**
- ✅ `xnrt-static-assets-v4` (old version)
- ✅ `xnrt-google-fonts-v3` (old version)
- ✅ `xnrt-api-v4` (old version)

**What is preserved:**
- ✅ `workbox-precache-v2-https://xnrt.org/` (managed by Workbox)
- ✅ `xnrt-static-assets-v5` (current version)
- ✅ `xnrt-google-fonts-v5` (current version)

## Caching Strategies by Resource Type

| Resource Type | Strategy | Why |
|--------------|----------|-----|
| JS/CSS Bundles | NetworkFirst | Prevents version mismatches in code-split chunks |
| API Routes | NetworkFirst (1min cache) | Fresh data with fallback for offline |
| Auth/Wallet APIs | NetworkOnly | Never cache sensitive operations |
| Google Fonts | CacheFirst | Static resources, rarely change |
| App Icons | StaleWhileRevalidate | Non-critical, can update in background |
| Navigation (SPA) | Custom Handler | Always serve index.html for client-side routing |

## Deployment Best Practices

### 1. Clear Caches on Major Releases
When deploying breaking changes:
1. Bump `CACHE_VERSION` in `client/src/sw.ts`
2. Deploy and publish
3. Monitor for errors in browser console

### 2. Test Service Worker Locally
```bash
npm run dev  # SW enabled in dev mode
```

Open DevTools → Application → Service Workers to verify:
- ✅ SW is running
- ✅ Caches are using correct version
- ✅ No errors in console

### 3. Force Client Updates
If users have stale service workers:
1. Bump `CACHE_VERSION`
2. Deploy
3. Users will automatically get the new SW on next visit
4. Old caches are automatically deleted

## Troubleshooting

### "Cannot access 'A' before initialization"
**Cause**: Mismatched code-split bundle versions in cache
**Fix**: 
1. Bump `CACHE_VERSION` in `client/src/sw.ts`
2. Redeploy
3. Users' caches will auto-clear

### Service Worker Not Updating
**Cause**: Browser aggressively caching the service worker file itself
**Fix**:
1. Hard refresh (Ctrl+Shift+R / Cmd+Shift+R)
2. DevTools → Application → Service Workers → "Update on reload"
3. Or manually unregister SW and refresh

### Offline Mode Not Working
**Cause**: NetworkFirst timeout or cache not populated
**Fix**:
1. Visit pages while online to populate cache
2. Adjust `networkTimeoutSeconds` if needed
3. Check cache in DevTools → Application → Cache Storage

## Production Monitoring

### Check Service Worker Status
```javascript
// In browser console
navigator.serviceWorker.getRegistrations().then(regs => {
  console.log('Active SWs:', regs);
});
```

### View Cached Resources
DevTools → Application → Cache Storage → Expand caches

### Force Update
```javascript
// In browser console
navigator.serviceWorker.getRegistrations().then(regs => {
  regs.forEach(reg => reg.update());
});
```

## Files to Monitor
- `client/src/sw.ts` - Service worker source
- `vite.config.ts` - Code-splitting configuration
- `dist/public/sw.js` - Compiled service worker (generated)
- `dist/public/manifest.webmanifest` - PWA manifest (generated)

## Related Documentation
- [PRODUCTION_ENV.md](./PRODUCTION_ENV.md) - Environment variables
- [Workbox Documentation](https://developers.google.com/web/tools/workbox)
- [Vite PWA Plugin](https://vite-pwa-org.netlify.app/)
