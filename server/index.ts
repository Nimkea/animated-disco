import express, { type Request, type Response, type NextFunction } from "express";
import cookieParser from "cookie-parser";
import cors, { type CorsOptionsDelegate } from "cors";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { startRetryWorker, stopRetryWorker } from "./retryWorker";
import { startDepositScanner } from "./services/depositScanner";

const app = express();

// Trust only the first proxy (Replit reverse proxy)
app.set("trust proxy", 1);

const isDevelopment = app.get("env") === "development";

// ─────────────────────────────────────────────────────────────────────────────
// Helmet (CSP loosened in dev for Vite HMR)
app.use(
  helmet({
    contentSecurityPolicy: isDevelopment
      ? false
      : {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            connectSrc: ["'self'", "wss:", "https:"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
            workerSrc: ["'self'", "blob:"],
            reportUri: ["/csp-report"],
          },
          reportOnly: false,
        },
    crossOriginEmbedderPolicy: false,
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// CORS: allow prod domain, Replit previews, localhost, and configured APP/CLIENT url
const APP_URL = process.env.APP_URL?.trim();
const CLIENT_URL = process.env.CLIENT_URL?.trim();

const allowedHosts = new Set<string>([
  "xnrt.org",
  "www.xnrt.org",
  ...(APP_URL ? [safeHost(APP_URL)] : []),
  ...(CLIENT_URL ? [safeHost(CLIENT_URL)] : []),
]);

const REPLIT_RE = /\.repl\.co$/i;
const LOCAL_RE = /^localhost(?::\d+)?$/i;

function safeHost(u: string): string {
  try {
    return new URL(u).host;
  } catch {
    return "";
  }
}

const corsDelegate: CorsOptionsDelegate<Request> = (req, cb) => {
  const origin = req.header("Origin") || "";
  if (!origin) {
    // No origin (same-origin/CLI); allow
    return cb(null, { origin: true, credentials: true });
  }

  let host = "";
  try {
    host = new URL(origin).host;
  } catch {
    // malformed Origin; reject
    return cb(null, { origin: false });
  }

  const allow =
    allowedHosts.has(host) ||
    REPLIT_RE.test(host) ||
    LOCAL_RE.test(host);

  cb(null, { origin: allow, credentials: true });
};

app.use(cors(corsDelegate));
// Preflight
app.options("*", cors(corsDelegate));

// ─────────────────────────────────────────────────────────────────────────────
// Body & cookie parsing
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// ─────────────────────────────────────────────────────────────────────────────
// Lightweight API logger (truncates long JSON)
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJson: unknown;

  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    capturedJson = body;
    return originalJson(body as any);
  }) as any;

  res.on("finish", () => {
    if (!path.startsWith("/api")) return;
    const duration = Date.now() - start;

    let line = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
    if (capturedJson !== undefined) {
      const s = safeStringify(capturedJson);
      if (s) line += ` :: ${s}`;
    }
    if (line.length > 200) line = line.slice(0, 199) + "…";
    log(line);
  });

  next();
});

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return "";
  }
}

// Basic liveness/readiness endpoints
app.get("/healthz", (_req, res) => res.status(200).json({ ok: true, env: app.get("env") }));
app.get("/readyz", (_req, res) => res.status(200).json({ ready: true }));

// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err?.status || err?.statusCode || 500;
    const message = err?.message || "Internal Server Error";
    res.status(status).json({ message });
    // Surface to logs
    console.error(err);
  });

  if (isDevelopment) {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Bind to platform port (Replit sets PORT=5000; 5000→80 externally)
  const HOST = process.env.HOST || "0.0.0.0";
  const PORT = Number(process.env.PORT || "5000");

  server.listen(
    {
      host: HOST,
      port: PORT,
      reusePort: true, // OK in Replit; allows same port across restarts in some cases
    },
    () => {
      log(`serving on http://${HOST}:${PORT}`);

      // Background workers: start by default only in production,
      // or when explicitly enabled in dev via ENABLE_SCANNER=true
      const enableScanner =
        (process.env.ENABLE_SCANNER ?? (isDevelopment ? "false" : "true"))
          .toLowerCase() === "true";

      try {
        startRetryWorker();
      } catch (e) {
        console.error("[retryWorker] failed to start:", e);
      }

      if (enableScanner) {
        try {
          startDepositScanner();
        } catch (e) {
          console.error("[depositScanner] failed to start:", e);
        }
      } else {
        log("[depositScanner] disabled (set ENABLE_SCANNER=true to enable)");
      }
    }
  );

  server.on("error", (err: any) => {
    if (err?.code === "EADDRINUSE") {
      console.error(`[server] Port ${PORT} is already in use. Stop the other process or change PORT.`);
    } else {
      console.error("[server] error:", err);
    }
  });

  // Graceful shutdown
  const shutdown = (sig: string) => {
    log(`${sig} received, shutting down gracefully`);
    stopRetryWorker();
    server.close(() => {
      log("Server closed");
      process.exit(0);
    });
    // Force exit if close hangs
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
})();
