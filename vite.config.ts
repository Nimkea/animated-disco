// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { VitePWA } from "vite-plugin-pwa";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === "production";

export default defineConfig(async () => {
  // Replit dev-only plugins (loaded dynamically)
  const replitPlugins =
    !isProd && process.env.REPL_ID
      ? [
          (await import("@replit/vite-plugin-cartographer")).cartographer(),
          (await import("@replit/vite-plugin-dev-banner")).devBanner(),
        ]
      : [];

  return {
    plugins: [
      react(),
      !isProd && runtimeErrorOverlay(),

      // PWA: we manually register in main.tsx -> disable injection here
      VitePWA({
        strategies: "injectManifest",
        srcDir: "src",
        filename: "sw.ts",
        registerType: "prompt",
        injectRegister: null, // ← important: prevent double registration
        devOptions: {
          enabled: false, // keep SW off in dev unless you really need it
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
            {
              src: "/icon-192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "/icon-256.png",
              sizes: "256x256",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "/icon-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any",
            },
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
          globPatterns: [
            "**/*.{js,css,html,ico,png,svg,woff,woff2,webmanifest}",
          ],
        },
      }),

      ...replitPlugins,
    ].filter(Boolean),

    // project rooted in ./client
    root: path.resolve(__dirname, "client"),

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "client", "src"),
        "@shared": path.resolve(__dirname, "shared"),
        "@assets": path.resolve(__dirname, "attached_assets"),
      },
    },

    build: {
      outDir: path.resolve(__dirname, "dist/public"),
      emptyOutDir: true,
      rollupOptions: {
        output: {
          // Disable custom chunk splitting to avoid React ordering issues
          manualChunks: undefined,
        },
      },
      chunkSizeWarningLimit: 800,
    },

    server: {
      fs: { strict: true, deny: ["**/.*"] },
    },
  };
});
