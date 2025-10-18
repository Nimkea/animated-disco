import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: 'auto',
      devOptions: {
        enabled: true,
        type: 'module',
        navigateFallback: 'index.html',
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'favicon-16x16.png', 'favicon-32x32.png'],
      manifest: {
        id: '/?app-id=xnrt',
        name: 'XNRT - We Build the NextGen',
        short_name: 'XNRT',
        description: 'Off-chain gamification earning platform. Earn XNRT tokens through staking, mining, referrals, and task completion.',
        start_url: '/?source=pwa',
        scope: '/',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        orientation: 'portrait-primary',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icon-256.png',
            sizes: '256x256',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        shortcuts: [
          {
            name: 'Staking',
            short_name: 'Stake',
            description: 'Start staking XNRT tokens',
            url: '/staking',
            icons: [{ src: '/icon-192.png', sizes: '192x192' }]
          },
          {
            name: 'Mining',
            short_name: 'Mine',
            description: 'Start a mining session',
            url: '/mining',
            icons: [{ src: '/icon-192.png', sizes: '192x192' }]
          },
          {
            name: 'Referrals',
            short_name: 'Refer',
            description: 'View referral network',
            url: '/referrals',
            icons: [{ src: '/icon-192.png', sizes: '192x192' }]
          }
        ]
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,webmanifest}']
      }
    }),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            const after = id.split('node_modules/')[1] || '';
            const [a, b] = after.split('/');
            const pkg = a.startsWith('@') ? `${a}/${b}` : a;
            
            // CRITICAL: React + Charts in same chunk to prevent "Cannot access 'A' before initialization"
            // Recharts depends on React, so they must load together
            const CHART_DEPS = [
              'recharts', 'd3', 'd3-array', 'd3-color', 'd3-format', 'd3-interpolate',
              'd3-path', 'd3-scale', 'd3-scale-chromatic', 'd3-shape', 'd3-time',
              'd3-time-format', 'internmap', 'delaunator', 'robust-predicates'
            ];
            
            if (pkg === 'react' || pkg === 'react-dom' || 
                pkg.startsWith('d3-') || CHART_DEPS.includes(pkg)) {
              return 'vendor-react-charts';
            }
            
            // UI libraries (Radix UI, Lucide, etc.)
            if (pkg.startsWith('@radix-ui') || 
                pkg === 'lucide-react' || 
                pkg === 'framer-motion') {
              return 'vendor-ui';
            }
            
            // Other vendor libraries
            return 'vendor-libs';
          }
          
          // Admin pages - separate bundle (most users never see these)
          if (id.includes('/pages/admin/')) {
            return 'admin';
          }
          
          // User pages - group by feature area
          if (id.includes('/pages/staking') || id.includes('/pages/mining')) {
            return 'earning';
          }
          
          if (id.includes('/pages/referrals') || id.includes('/pages/leaderboard')) {
            return 'social';
          }
          
          if (id.includes('/pages/deposit') || id.includes('/pages/withdrawal')) {
            return 'transactions';
          }
        },
      },
    },
    chunkSizeWarningLimit: 600, // Increase from default 500KB
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
