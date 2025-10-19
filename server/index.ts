import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { startRetryWorker, stopRetryWorker } from "./retryWorker";
import { startDepositScanner } from "./services/depositScanner";
import { validateEnvironment } from "./validateEnv";

// Validate environment variables before starting server
validateEnvironment();

const app = express();

// Trust proxy - required for Replit's reverse proxy environment
// Set to 1 to trust the first proxy (Replit's reverse proxy)
// This is more secure than 'true' and satisfies express-rate-limit security requirements
app.set('trust proxy', 1);

// Security headers - relax only in development for Vite HMR and Replit preview
const isDevelopment = app.get("env") === "development";
app.use(helmet({
  contentSecurityPolicy: isDevelopment ? false : {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'wasm-unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "https:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      workerSrc: ["'self'"],
      reportUri: ["/csp-report"],
    },
    reportOnly: true, // Start with report-only mode
  },
  crossOriginEmbedderPolicy: false, // Disabled - not needed and could break third-party resources
}));

// CORS configuration
// In production, frontend and backend are same-origin (served from same Express server)
// But we allow specific domains for cross-origin requests (if needed)
const allowedOrigins = [
  'http://localhost:5000',
  'http://localhost:3000',
  'http://127.0.0.1:5000',
  'http://127.0.0.1:3000',
  'https://xnrt.replit.app',
  'https://xnrt.org',
  'https://www.xnrt.org',
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or same-origin)
    if (!origin) return callback(null, true);
    
    // In development, allow all Replit development domains (*.replit.dev)
    if (isDevelopment && origin.endsWith('.replit.dev')) {
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // Reject the origin but don't throw error
      console.warn(`[CORS] Rejected origin: ${origin}`);
      callback(null, false);
    }
  },
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  // Only capture response bodies in development to avoid leaking sensitive data
  // (tokens, balances, passwords, etc.) in production logs
  if (isDevelopment) {
    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
  }

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      // Production: Only log method, path, status, and duration (no response body)
      // Development: Include response body for debugging
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (isDevelopment && capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    
    startRetryWorker();
    startDepositScanner();
  });

  process.on('SIGTERM', () => {
    log('SIGTERM received, shutting down gracefully');
    stopRetryWorker();
    server.close(() => {
      log('Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    log('SIGINT received, shutting down gracefully');
    stopRetryWorker();
    server.close(() => {
      log('Server closed');
      process.exit(0);
    });
  });
})();
