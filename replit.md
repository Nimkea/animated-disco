## Overview
XNRT is a React PWA off-chain gamification community earning platform where users earn in-app utility tokens (XNRT) through staking, mining, referrals, and task completion. It aims to provide a robust, secure, and engaging earning experience with a functional authentication system, automated earning mechanisms, and a comprehensive admin dashboard. The platform features a complete branding refresh, a smart deposit reporting system with auto-verification on BSC, and an automated deposit system with blockchain scanning.

## Recent Changes

### Production Deployment Fixes (Oct 19, 2025)
Fixed critical production deployment issues to enable successful autoscale deployment:

**Issue 1: Server Running in Dev Mode (500 Errors)**
- **Problem**: Production server tried to run Vite dev mode, causing "Failed to load /src/main.tsx" errors
- **Root Cause**: `NODE_ENV` wasn't set, so Express defaulted to development mode
- **Fix**: Updated run command to `NODE_ENV=production node dist/index.js`
- **Impact**: Server now correctly serves static files from `dist/public` instead of trying to load development files

**Issue 2: Database Connection Failures**
- **Problem**: Production deployment crashed with "terminating connection due to administrator command" database errors
- **Root Cause**: Manual `DATABASE_URL` in Publishing Secrets pointed to wrong/stale database instance
- **Fix**: Removed manual `DATABASE_URL` secret to allow Replit's auto-injection of production database connection
- **Impact**: Production uses correct, automatically-managed database URL for Replit Production Database

**Issue 3: Deposit Scanner Missing Table**
- **Problem**: Deposit scanner crashed with "ScannerState table does not exist" after database migration removed it
- **Root Cause**: Schema migration accidentally deleted ScannerState table but code still referenced it
- **Fix**: Re-added ScannerState table to schema (`shared/schema.ts`) for durable scanner progress tracking
- **Impact**: Scanner now persists block scanning progress across server restarts, preventing missed deposits during downtime

**Deployment Configuration:**
- **Deployment Type**: Autoscale (stateless, scales based on demand)
- **Build Command**: `npm run build` (builds frontend with Vite, bundles backend with esbuild)
- **Run Command**: `NODE_ENV=production node dist/index.js` (forces production mode)
- **Database**: Replit Production Database with auto-injected `DATABASE_URL`
- **Benefits**: Automatic scaling during traffic spikes, cost-effective (only runs when serving requests), production-ready asset serving

### Production-Readiness Fixes (Oct 19, 2025)
Comprehensive production stability improvements to eliminate MIME errors and enhance deployment reliability:

**Application Entry (`main.tsx`):**
- Wrapped app in `React.StrictMode` to catch side-effects during development
- Gated monitoring (Sentry/Web Vitals) to production-only with HMR-safe single initialization
- Added service worker feature detection before registration
- Set SW registration to `immediate: false` for user-controlled updates (prevents forced reloads)
- Added root element validation with clear error messaging

**Performance & Compatibility (`index.html`, `index.css`):**
- Migrated Google Fonts from CSS `@import` to HTML `<link>` tags with `preconnect` for better CSP compliance and faster loading
- Added `color-scheme` declarations for proper light/dark native controls
- Implemented CSS fallbacks for relative color syntax (`hsl(from...)`) with `@supports` feature detection for older browser support

**Service Worker v9 (`sw.ts`):**
- **Critical MIME Fix**: Added content-type validation plugins to prevent caching HTML responses as JavaScript files
- Removed auto `skipWaiting()` - now user-controlled via UI message for safer updates
- Implemented destination-based route matching (`request.destination === 'script'`) instead of URL patterns
- Tightened `ignoreURLParametersMatching` to only analytics params (was `/.*/`)
- Improved push notification JSON parsing with robust error handling
- Uses `Response.error()` for failed non-navigation requests

**Build Configuration (`vite.config.ts`):**
- Disabled service worker in development (`devOptions.enabled: false`) to prevent caching dev HTML
- Set `injectRegister: null` since registration is manually controlled in `main.tsx`
- Implemented safer path resolution using `fileURLToPath` and `__dirname`
- Made Replit dev plugins conditional with `.filter(Boolean)` cleanup
- Maintained optimized vendor chunk strategy (React Core → Utilities → React Ecosystem → Other libs)

**Production Serving (`server/vite.ts`):**
- Changed `distPath` resolution from `import.meta.dirname` to `process.cwd()` for deployment-agnostic builds
- Standardized on `text/javascript` MIME type for JavaScript files
- Maintained `/assets` priority serving with 1-year immutable cache headers
- SPA fallback restricted to HTML navigation requests only

**Impact:**
- ✅ Eliminated MIME type errors from cached development files in production
- ✅ Users now control service worker updates (no forced disruptions)
- ✅ Service worker cannot cache wrong content types
- ✅ Builds work regardless of launch directory or deployment method
- ✅ Improved font loading performance and CSP compatibility
- ✅ Legacy browser support for relative color syntax

## User Preferences
- **Unified Cosmic Theme System**: Users can toggle between light and dark modes, both featuring cosmic starfield backgrounds
- Light mode: Black cosmic background with golden twinkling stars and golden UI accents
- Dark mode: Black cosmic background with white twinkling stars and golden UI accents
- Unified golden amber brand color (HSL 42 90% 50%) across all interactive elements
- Space Grotesk (sans-serif) and Lora (serif) typography throughout
- Mobile-first responsive design
- Accessibility via Radix UI primitives with ARIA labels and proper color contrast (AA compliant)
- Testing-friendly with comprehensive data-testid coverage

## System Architecture
XNRT utilizes a robust architecture designed for performance, scalability, and security.

**UI/UX Decisions:**
- **Design System**: Unified cosmic theme with black starfield backgrounds, a luxurious golden color palette, and glassmorphic elements.
- **Authentication Experience**: Glassmorphic `/auth` page with `backdrop-blur` effects, tabbed Login/Register interface, and `framer-motion` animations. Includes FloatingLabelInput and PasswordStrength components.
- **Error Handling**: `ErrorBoundary` for graceful failure recovery.
- **Loading States**: Content-aware skeleton screens.
- **Confirmation Flows**: Critical actions require user confirmation.
- **Components**: Leverages Shadcn/ui with Radix UI primitives.
- **Responsiveness**: Mobile-first approach.
- **Animations**: `Framer-motion` for dynamic UI, `ShineButton` and `TiltCard` for engaging interactions.
- **Support**: Integrated FAQ ChatBot with smart keyword matching and email fallback, repositioned to sidebar for authenticated users.

**Technical Implementations:**
- **Frontend**: React, TypeScript, Vite, Tailwind CSS, Wouter for routing, and TanStack Query for data management.
- **Backend**: Express.js with TypeScript.
- **Database**: PostgreSQL (Neon) using Drizzle ORM for schema and session management, and Prisma ORM for database operations.
- **Authentication**: Hybrid system supporting Replit OIDC (Passport.js) and traditional email/password, with secure password reset, email verification, and session management.
- **PWA**: Full Progressive Web App capabilities via `vite-plugin-pwa` with a custom service worker for offline SPA routing, Workbox caching, and app shortcuts.
- **Blockchain Integration**: On-chain verification for USDT deposits on Binance Smart Chain using ethers.js. Includes automated deposit system with unique personal deposit addresses (HD wallet derivation), blockchain scanner that auto-detects and credits deposits after 12 confirmations, and legacy support for wallet linking.
- **Monitoring**: Optional Sentry integration for error tracking and Web Vitals monitoring.
- **Charts**: Recharts for data visualization.

**Feature Specifications:**
- **Admin Dashboard**: Comprehensive management for Deposits, Withdrawals, Users, Analytics, and Settings, including bulk deposit approval.
- **Deposit/Withdrawal Systems**:
    - **Deposits**: USDT to XNRT conversion with unique personal deposit addresses per user. Automated scanner watches all user addresses and auto-credits XNRT after 12 confirmations.
    - **Withdrawals**: XNRT to USDT conversion with admin approval and tracking.
- **Earning Systems**: Staking, Mining, Referral, Daily Check-in, and Achievement systems with automated rewards and anti-exploit measures.
- **XP Leaderboard System**: Weekly/monthly rankings with category filters.
- **Push Notification System**: Web Push notifications with VAPID authentication, subscription management, and event triggers.
- **Security Features**: Secure password reset and email verification systems with time-limited tokens and rate limiting.

**System Design Choices:**
- **Automation**: All core earning mechanisms and deposit systems are fully automated.
- **Security**: Implemented `requireAuth`/`requireAdmin` middleware, atomic database operations, input validation, rate limiting, `helmet`, signature verification for wallet linking, and unique constraints for transaction hashes.
- **Performance**: Optimized Prisma queries, reduced API polling, and Workbox caching.
- **Progressive Enhancement**: Feature flags enable phased rollout.
- **Code Quality**: Zero LSP/TypeScript errors, 100% type-safe, and E2E test coverage.
- **Database Schema Alignment**: 100% schema alignment between Drizzle and Prisma.
- **Canonical Domain**: Production traffic consolidated on `xnrt.org` via 301 redirect from `xnrt.replit.app`. This prevents SEO duplicate content penalties, session cookie fragmentation across domains, and analytics splits. The redirect preserves full URLs (path + query) and only activates in production mode.

## External Dependencies
- **Database**: Neon (PostgreSQL)
- **Authentication**: Replit OIDC
- **Email Service**: Brevo SMTP (via Nodemailer)
- **Blockchain**: ethers.js v6 (BSC/USDT verification)
- **UI Components**: Shadcn/ui, Radix UI Primitives, Lucide React
- **CSS Framework**: Tailwind CSS
- **State Management**: TanStack Query
- **Routing**: Wouter
- **Charts**: Recharts
- **QR Code Generation**: `qrcode` library
- **PWA**: `vite-plugin-pwa` with Workbox
- **Push Notifications**: `web-push` (VAPID authentication)
- **Animations**: `canvas-confetti`, `framer-motion`
- **Monitoring**: Sentry (optional), `web-vitals`
- **Security**: `helmet`
- **Unique ID Generation**: `nanoid`

## Production Deployment

### Deployment Configuration
- **Type**: Autoscale (scales automatically based on traffic demand)
- **Build**: `npm run build` (compiles React frontend + bundles Express backend)
- **Run**: `node dist/index.js` (production-optimized server)

### Required Production Secrets
All secrets must be configured in the Publishing tool's Environment Variables section:

**Critical Secrets:**
- `DATABASE_URL` - PostgreSQL connection (auto-configured if using Replit's production database)
- `SESSION_SECRET` - Session encryption key (generate new for production)
- `JWT_SECRET` - JWT token signing key (generate new for production)
- `MASTER_SEED` - HD wallet master seed for generating user deposit addresses (⚠️ highly sensitive)
- `RPC_BSC_URL` - Binance Smart Chain RPC endpoint (e.g., https://bsc-dataseed.binance.org/)
- `USDT_BSC_ADDRESS` - USDT contract address on BSC (0x55d398326f99059fF775485246999027B3197955)
- `VAPID_PUBLIC_KEY` - Web push public key
- `VAPID_PRIVATE_KEY` - Web push private key
- `SMTP_PASSWORD` - Brevo SMTP password for email sending

**Note**: SMTP host/port/user are hardcoded in the application (smtp-relay.brevo.com:587)

### Deployment Checklist
See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete step-by-step deployment guide including:
- Database setup (Replit production DB or external)
- Secrets configuration with security best practices
- Database migration steps
- Autoscale settings recommendations
- Post-deployment verification tests
- Troubleshooting common issues
- Custom domain setup (xnrt.org)

### Environment Separation
- **Development**: Local secrets, development database, HMR enabled, service worker disabled
- **Production**: Separate secrets, production database, monitoring enabled, service worker active with caching