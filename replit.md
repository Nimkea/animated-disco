## Overview
XNRT is a React PWA off-chain gamification community earning platform where users earn in-app utility tokens (XNRT) through staking, mining, referrals, and task completion. It aims to provide a robust, secure, and engaging earning experience with a functional authentication system, automated earning mechanisms, and a comprehensive admin dashboard. The platform incorporates a complete branding refresh with professional XNRT icons and PWA assets, a smart deposit reporting system with auto-verification on BSC, and an automated deposit system with blockchain scanning.

## Recent Changes
- **October 19, 2025** (Late Evening):
  - **Critical Security & UX Polish**:
    - **Service Worker Cache v5→v6**: Bumped cache version to force complete cache invalidation after security fixes, resolving "Cannot read properties of null (reading 'useRef')" error caused by mixing old/new bundle chunks
    - **Module Preload Hints**: Added modulepreload for main.tsx to ensure React loads before ecosystem libraries
    - **CSRF Enhancement**: Updated CSRF validation to use double-submit cookie pattern with session-awareness logging. Validates token match and logs warnings if middleware ordering is incorrect (requireAuth → validateCSRF)
    - **Production Logging Security**: Removed API response body logging in production mode to prevent leaking sensitive data (tokens, balances, passwords)
    - **Registration Rate Limiting**: Added rate limiter (10 attempts/15min) to protect against brute force registration attacks
    - **User Enumeration Fix**: Changed registration errors from specific "Email already registered"/"Username already taken" to generic "An account with this email or username already exists" to prevent user enumeration attacks
    - **VAPID Key Cleanup**: Removed brittle JSON string parsing for VAPID keys, now expects raw keys in environment variables with proper error handling
  - **Accessibility & UX Improvements**:
    - **Font Loading**: Removed duplicate Google Fonts link from HTML (kept CSS @import only) to prevent double loading
    - **Pinch-Zoom**: Removed `maximum-scale=1` from viewport meta to enable pinch-zoom (WCAG 2.1 requirement)
    - **Toast Timeout Fix**: Fixed absurd 16.7-minute toast timeout → 5 seconds for better UX
    - **CSS Transitions**: Scoped transitions to interactive elements only (buttons, links, inputs) and added `prefers-reduced-motion` support for accessibility
    - **Social Meta Tags**: Changed og:image and twitter:image to absolute URLs for proper sharing previews
- **October 19, 2025** (Earlier):
  - **Critical Security Fixes**:
    - **JWT Authentication**: Removed hardcoded fallback secret from `server/auth/jwt.ts` and added JWT_SECRET to mandatory environment validation with minimum 32-character requirement
    - **Database Connection Management**: Implemented singleton Prisma client pattern in `server/db.ts` to prevent connection pool exhaustion. Replaced all 11 instances of `new PrismaClient()` across scripts/, server/, and prisma/seed.ts
    - **Environment Validation Enhancement**: Added VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and SMTP_PASSWORD to required environment variables with validation
  - **HD Wallet Architecture Upgrade**:
    - **EVM Standard Compliance**: Changed BIP44 derivation path from m/44'/714'/0'/0 (BNB Beacon) to m/44'/60'/0'/0 (EVM standard) for MetaMask compatibility
    - **Multi-Address Support**: Added DepositAddress model to support multiple deposit addresses per user (both Prisma and Drizzle schemas)
    - **Backward Compatibility**: Scanner now monitors both legacy (coin type 714) and new (coin type 60) addresses simultaneously
    - **Migration Script**: Created `server/scripts/migrateDepositAddresses.ts` to backfill existing User.depositAddress into DepositAddress table while preserving legacy addresses
    - **Sweeper Support**: Updated `getDerivedPrivateKey()` to accept optional coinType parameter, enabling private key derivation for both legacy and new addresses
  - **Transaction Idempotency**: Changed Transaction unique constraint from single `transactionHash` to composite `@@unique([transactionHash, walletAddress])` to prevent double-credits when one transaction sends to multiple user addresses
- **October 18, 2025**:
  - **Bundle Initialization Fix (Final)**: Resolved "Cannot read properties of null (reading 'useRef')" error by implementing three-stage bundle loading. Split bundles into: (1) `vendor-react-core` containing only React and React-DOM that loads first, (2) `vendor-react-ecosystem` with all React-dependent libraries (charts, UI, forms, routing) that loads after React is ready, and (3) `vendor-libs` for non-React dependencies. This staged approach ensures React fully initializes before any library tries to access React hooks, eliminating all initialization race conditions.
  - **RPC Timeout Fix**: Resolved DepositScanner crashes caused by hanging RPC requests. Configured ethers.js FetchRequest with 30-second timeout (`fetchReq.timeout = 30000`) before passing to JsonRpcProvider. This ensures HTTP requests are properly aborted on timeout, eliminating previous hang behavior while preserving scan logic.
  - **Service Worker Cache Strategy (v5)**: Implemented CacheFirst with versioned cache names (`xnrt-static-assets-v5`) for JS/CSS bundles. The version number in cache name guarantees all cached chunks are from the same build, preventing "Cannot access 'A' before initialization" errors while maintaining full offline PWA functionality. Activation handler automatically removes old versioned caches on deployment.
  - **Service Worker Activation Fix (v5)**: Resolved critical blank page issue caused by incorrect cache deletion in activate handler. Previously deleted Workbox precaches (containing /index.html), causing navigation failures. Now uses `cleanupOutdatedCaches()` to let Workbox manage its own precaches, and only deletes custom `xnrt-*` runtime caches. Added global `setCatchHandler()` to ensure failed navigations always fallback to cached shell instead of rejecting.
  - **Production Deployment Fix**: Resolved critical white screen issue in production by implementing multi-domain CORS support for `xnrt.replit.app` and `xnrt.org` with graceful origin rejection.
  - **Environment Validation System**: Added comprehensive startup validation (`server/validateEnv.ts`) that aborts server boot with clear error messages when critical environment variables are missing or invalid. Validates DATABASE_URL, SESSION_SECRET, MASTER_SEED (BIP39 12/15/18/21/24 words), RPC_BSC_URL, and USDT_BSC_ADDRESS.
  - **Production Documentation**: Created comprehensive `docs/PRODUCTION_ENV.md` documenting all required and optional environment variables with examples, security recommendations, and Replit-specific deployment guidance.
  - **CORS Security Enhancement**: Updated CORS middleware to explicitly whitelist production domains while maintaining same-origin support for autoscale deployments. In development mode, automatically allows all `*.replit.dev` domains for seamless testing. Unknown origins are gracefully rejected without exposing errors.
- **October 17, 2025**: 
  - Project cleanup - removed 160+ temporary development artifacts from `attached_assets/` folder (old images, pasted text files, outdated icon bundles, patch files, and screenshots). All active PWA icons remain in `client/public/`. Project size significantly reduced.
  - Build optimization - implemented advanced code-splitting in Vite configuration with manual chunks for vendor libraries (React, UI, charts) and route-based splitting (admin, earning, social, transactions). Initial bundle size reduced from 1,429 KB to 124 KB (393 KB to 268 KB gzipped - 32% improvement). Admin code now loads on-demand only for admins.

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
    - **Deposits**: USDT to XNRT conversion with unique personal deposit addresses per user. Users can deposit directly from exchanges (Binance, OKX) without wallet linking, gas fees, or blockchain interaction. HD wallet derivation (BIP44 path m/44'/60'/0'/0/{index}) generates unique EVM-compatible BSC addresses. Automated scanner watches all user addresses (both legacy 714 and new 60 coin types) and auto-credits XNRT after 12 confirmations.
    - **Withdrawals**: XNRT to USDT conversion with admin approval and tracking.
- **Earning Systems**:
    - **Staking**: Four-tiered system with varying APY, real-time countdowns, and automated daily reward distribution.
    - **Mining**: Automated 24-hour sessions with XP to XNRT conversion and automatic reward deposit.
    - **Referral**: 3-level commission chain, network visualization, leaderboard, and social sharing.
    - **Daily Check-in**: Atomic check-ins with streak rewards and anti-exploit measures.
    - **Achievement**: Auto-unlocks achievements with XP rewards.
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