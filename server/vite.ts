import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    // Skip SPA fallback for static files - let Vite middleware handle them
    // This includes manifest.json, service workers, images, fonts, etc.
    const hasFileExtension = /\.[a-z0-9]+$/i.test(url.split('?')[0]);
    if (hasFileExtension && !url.endsWith('.html')) {
      return next();
    }

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Serve /assets with immutable cache headers (hashed filenames never change)
  // This MUST be before the general static middleware to take precedence
  app.use("/assets", express.static(path.join(distPath, "assets"), {
    immutable: true,
    maxAge: "1y",
    setHeaders: (res, filepath) => {
      // Ensure correct MIME types for JavaScript modules
      if (filepath.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      } else if (filepath.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css; charset=utf-8');
      }
    }
  }));

  // Serve other static files with shorter cache
  app.use(express.static(distPath, { maxAge: "1h" }));

  // SPA fallback - ONLY for HTML navigations, not for missing assets
  app.use("*", (req, res, next) => {
    const accept = req.headers.accept || "";
    // Only serve index.html for actual HTML navigation requests
    if (accept.includes("text/html")) {
      res.sendFile(path.resolve(distPath, "index.html"));
    } else {
      // For non-HTML requests (like missing JS/CSS), return 404
      next();
    }
  });
}
