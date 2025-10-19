import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { VitePWA } from 'vite-plugin-pwa';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === "production";

export default defineConfig({
  plugins: [
    react(),
    !isProd && runtimeErrorOverlay(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: null,
      devOptions: {
        enabled: false,
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
    ...(!isProd && process.env.REPL_ID
      ? [
          (await import("@replit/vite-plugin-cartographer")).cartographer(),
          (await import("@replit/vite-plugin-dev-banner")).devBanner(),
        ]
      : []),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            const after = id.split('node_modules/')[1] || '';
            const [a, b] = after.split('/');
            const pkg = a.startsWith('@') ? `${a}/${b}` : a;
            
            // STAGE 1: React Core - loads and initializes FIRST (critical!)
            // This small bundle ensures React is fully ready before anything else
            if (pkg === 'react' || pkg === 'react-dom' || pkg === 'react-is' || pkg === 'scheduler') {
              return 'vendor-react-core';
            }
            
            // Prevent circular dependencies - extract shared dependencies
            if (pkg === 'tslib' || pkg === 'object-assign') {
              return 'vendor-react-core';
            }
            
            // STAGE 2: Utility libraries (independent, no circular deps)
            // These must load BEFORE React ecosystem to prevent initialization errors
            const UTILITIES = [
              'ms', 'debug', 'date-fns', 'nanoid', 'clsx', 'class-variance-authority',
              'tailwind-merge', 'tailwindcss-animate', 'zod', 'memoizee'
            ];
            
            if (UTILITIES.includes(pkg)) {
              return 'vendor-utilities';
            }
            
            // STAGE 3: React Ecosystem - loads AFTER React core and utilities
            // All packages that depend on React hooks (useState, useRef, etc.)
            const REACT_DEPENDENT = [
              // Charts (depends on React)
              'recharts', 'd3', 'd3-array', 'd3-color', 'd3-format', 'd3-interpolate',
              'd3-path', 'd3-scale', 'd3-scale-chromatic', 'd3-shape', 'd3-time',
              'd3-time-format', 'internmap', 'delaunator', 'robust-predicates',
              // UI libraries (depend on React)
              'lucide-react', 'framer-motion',
              // State management & routing (depend on React)
              '@tanstack/react-query', 'wouter',
              // Forms (depend on React)
              'react-hook-form', '@hookform/resolvers',
              // Other React components
              '@sentry/react', 'react-day-picker', 'embla-carousel-react',
              'react-resizable-panels', 'cmdk', 'vaul', 'input-otp',
              'react-icons', 'canvas-confetti', 'next-themes'
            ];
            
            // Check if package depends on React
            if (REACT_DEPENDENT.includes(pkg) || 
                pkg.startsWith('d3-') || 
                pkg.startsWith('@radix-ui/')) {
              return 'vendor-react-ecosystem';
            }
            
            // STAGE 4: Non-React libraries (independent)
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
    chunkSizeWarningLimit: 800,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
