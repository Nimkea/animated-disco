## Overview
XNRT is a React PWA off-chain gamification community earning platform where users earn in-app utility tokens (XNRT) through staking, mining, referrals, and task completion. It aims to provide a robust, secure, and engaging earning experience with a functional authentication system, automated earning mechanisms, and a comprehensive admin dashboard. The platform incorporates a complete branding refresh with professional XNRT icons and PWA assets, a smart deposit reporting system with auto-verification on BSC, and an automated deposit system with blockchain scanning.

## Recent Changes
- **October 18, 2025**:
  - **Service Worker Activation Fix (v5)**: Resolved critical blank page issue caused by incorrect cache deletion in activate handler. Previously deleted Workbox precaches (containing /index.html), causing navigation failures. Now uses `cleanupOutdatedCaches()` to let Workbox manage its own precaches, and only deletes custom `xnrt-*` runtime caches. Added global `setCatchHandler()` to ensure failed navigations always fallback to cached shell instead of rejecting. Bumped cache version to v5.
  - **Service Worker Cache Strategy (v4)**: Resolved "Cannot access 'A' before initialization" error in production caused by aggressive StaleWhileRevalidate caching mixing old and new code-split bundle versions. Changed JS/CSS caching strategy to NetworkFirst to ensure all chunks load from the same version. Created `docs/SERVICE_WORKER.md` with comprehensive caching strategy documentation and troubleshooting guide.
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
    - **Deposits**: USDT to XNRT conversion with unique personal deposit addresses per user. Users can deposit directly from exchanges (Binance, OKX) without wallet linking, gas fees, or blockchain interaction. HD wallet derivation (BIP44 path m/44'/714'/0'/0/{index}) generates unique BSC addresses. Automated scanner watches all user addresses and auto-credits XNRT after 12 confirmations.
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