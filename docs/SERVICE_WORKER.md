# Service Worker & PWA Caching Strategy

## Overview
XNRT uses Workbox-powered service workers for Progressive Web App (PWA) functionality. This document explains the caching strategy and common issues.

## Critical: Code-Split Bundle Caching

### The Problem
When using Vite's code-splitting with manual chunks (vendor-react, vendor-charts, etc.), **you must ensure all chunks load from the same version**. Mixing old and new chunks causes initialization errors like:

```
Uncaught ReferenceError: Cannot access 'A' before initialization
at vendor-charts-GZY0HmWu.js:1:14764
```

### Why This Happens
1. User visits site, SW caches all bundles (version 1)
2. You deploy new code (version 2)
3. SW serves some chunks from cache (v1) and fetches others from network (v2)
4. Code-split chunks have incompatible exports/imports between versions
5. Module initialization fails with "Cannot access before initialization"

### The Solution
We use **NetworkFirst** strategy for JS/CSS bundles instead of StaleWhileRevalidate:

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

## Cache Versioning

### When to Bump Cache Version
Increment `CACHE_VERSION` in `client/src/sw.ts` when:
- Making significant changes to the service worker logic
- Experiencing cache-related issues in production
- Want to force all clients to refresh their caches

```typescript
const CACHE_VERSION = 'v4';  // Increment this (v1, v2, v3, v4...)
```

### Cache Invalidation
The service worker automatically deletes old caches on activation:

```typescript
self.addEventListener('activate', (event) => {
  // Deletes ALL caches that don't match current CACHE_VERSION
  // Forces fresh start for all clients
});
```

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
