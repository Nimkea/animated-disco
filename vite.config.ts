// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "prompt",
      injectRegister: "auto",
      devOptions: {
        enabled: true,
        type: "module",
        navigateFallback: "index.html",
      },
      includeAssets: [
        "favicon.ico",
        "apple-touch-icon.png",
        "favicon-16x16.png",
        "favicon-32x32.png",
      ],
      manifest: {
        id: "/?app-id=xnrt",
        name: "XNRT - We Build the NextGen",
        short_name: "XNRT",
        description:
          "Off-chain gamification earning platform. Earn XNRT tokens through staking, mining, referrals, and task completion.",
        start_url: "/?source=pwa",
        scope: "/",
        theme_color: "#000000",
        background_color: "#000000",
        display: "standalone",
        orientation: "portrait-primary",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-256.png", sizes: "256x256", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        shortcuts: [
          {
            name: "Staking",
            short_name: "Stake",
            description: "Start staking XNRT tokens",
            url: "/staking",
            icons: [{ src: "/icon-192.png", sizes: "192x192" }],
          },
          {
            name: "Mining",
            short_name: "Mine",
            description: "Start a mining session",
            url: "/mining",
            icons: [{ src: "/icon-192.png", sizes: "192x192" }],
          },
          {
            name: "Referrals",
            short_name: "Refer",
            description: "View referral network",
            url: "/referrals",
            icons: [{ src: "/icon-192.png", sizes: "192x192" }],
          },
        ],
      },
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2,webmanifest}"],
      },
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

  // ✅ Ensure React isn't duplicated or hoisted into chart chunks
  resolve: {
    dedupe: ["react", "react-dom"],
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
    commonjsOptions: {
      include: [/recharts/, /d3-/, /node_modules/],
    },
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // ✅ Isolate React first
          if (
            id.includes("node_modules/react") ||
            id.includes("node_modules/react-dom")
          ) {
            return "vendor-react";
          }

          // ✅ Chart libraries (never include React)
          if (
            id.includes("node_modules/recharts") ||
            id.includes("node_modules/d3-")
          ) {
            return "vendor-charts";
          }

          // UI libs
          if (
            id.includes("node_modules/@radix-ui") ||
            id.includes("node_modules/lucide-react") ||
            id.includes("node_modules/framer-motion")
          ) {
            return "vendor-ui";
          }

          // Other vendor libs
          if (id.includes("node_modules")) return "vendor-libs";

          // Admin & feature groupings
          if (id.includes("/pages/admin/")) return "admin";
          if (id.includes("/pages/staking") || id.includes("/pages/mining"))
            return "earning";
          if (
            id.includes("/pages/referrals") ||
            id.includes("/pages/leaderboard")
          )
            return "social";
          if (id.includes("/pages/deposit") || id.includes("/pages/withdrawal"))
            return "transactions";
        },
        inlineDynamicImports: false,
        compact: false,
        minifyInternalExports: false,
      },
    },

    // ✅ safer minifier to avoid scope/hoisting bugs
    minify: "terser",
    terserOptions: {
      compress: {
        passes: 2,
        pure_funcs: ["console.log"],
      },
      mangle: false,
    },
    target: "esnext",
    chunkSizeWarningLimit: 600,
  },

  // ✅ Ensure Recharts & D3 pre-bundle correctly
  optimizeDeps: {
    include: ["recharts"],
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
    },
  },

  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
