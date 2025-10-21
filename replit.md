## Overview
XNRT is a React PWA off-chain gamification community earning platform where users earn in-app utility tokens (XNRT) through staking, mining, referrals, and task completion. It aims to provide a robust, secure, and engaging earning experience with a functional authentication system, automated earning mechanisms, and a comprehensive admin dashboard. The platform incorporates a complete branding refresh with professional XNRT icons and PWA assets, a smart deposit reporting system with auto-verification on BSC, and an automated deposit system with blockchain scanning.

## Recent Changes
- **October 21, 2025**: Built comprehensive announcements system for platform-wide communication:
  - **Database Schema**: Added Announcement table (Drizzle + Prisma) with fields: id, title, content, type (info/warning/success/error), isActive, createdBy, createdAt, expiresAt. Includes indexes on isActive and createdAt for performance.
  - **Admin API**: Implemented full CRUD endpoints with Zod validation, proper auth (requireAuth + requireAdmin + validateCSRF), and RESTful error handling (201 Created, 204 No Content, 404 Not Found). Fixed critical req.authUser bug and added insertAnnouncementSchema validation.
  - **Admin Interface**: Created announcements management tab with create/edit dialog, delete confirmation, type-based styling (4 variants with icons), and creator tracking. Integrated into admin dashboard with Megaphone icon.
  - **User Banner**: Built dismissible announcement banner component for home page with localStorage persistence, type-specific Alert variants, and auto-fetch from public API (shows active, non-expired announcements limited to 5).
- **October 21, 2025**: Completed analytics dashboard enhancements with real-time widgets and export functionality:
  - **Real-time Analytics**: Added `/api/admin/analytics/realtime` endpoint with active users (last 15 min), today's deposits/withdrawals (count + totals), and pending transaction counts. Frontend displays Live Overview section with 4 auto-refreshing cards (30s interval).
  - **Analytics Export**: Implemented `/api/admin/analytics/export` endpoint supporting CSV and JSON formats with proper headers and date-stamped filenames. Added export buttons to analytics page with download handlers and toast notifications.
- **October 21, 2025**: Added iOS splash screens, professional email templates, and performance optimizations:
  - **iOS Splash Screens**: Generated 17 custom branded splash screens (black background + golden XNRT logo) for all iPhone and iPad models using sharp. Covers iPhone 12-15 families, Minis, older 4.7/5.5-inch devices, and common iPad sizes. All screens properly linked in index.html.
  - **Email Template System**: Created comprehensive HTML email template system with XNRT cosmic branding (black background, golden accents, inline CSS for email client compatibility). Implemented templates for verification, password reset, deposit confirmation, withdrawal notification, achievement unlock, and welcome emails. All templates integrated into server/services/email.ts with proper typing and text fallbacks.
  - **Performance Optimizations**: Added resource hints (dns-prefetch, preconnect, preload) to index.html for faster font loading. Enhanced build configuration with smart code splitting (react-vendor, charts-vendor, ui-vendor, web3-vendor) and organized asset output (images/, fonts/ directories).
- **October 21, 2025**: Enhanced PWA mobile experience for iOS and Android:
  - **iOS Optimizations**: Added Apple-specific meta tags (mobile-web-app-capable, status-bar-style, app-title), viewport-fit=cover for safe area support, and comprehensive safe area CSS variables (env(safe-area-inset-*)). Created splash screen documentation with generation instructions.
  - **Android Enhancements**: Added display_override fallback modes, app categories (finance, lifestyle, productivity), IARC rating, and internationalization support (lang, dir).
  - **Mobile Touch Improvements**: Implemented mobile-only 44x44px minimum touch targets (@media pointer: coarse), disabled tap highlights for custom ripple effects, prevented zoom on input focus (16px minimum), scoped iOS momentum scrolling to specific containers, and added pull-to-refresh control.
  - **Accessibility**: Touch-callout disabled only on buttons/links to preserve iOS copy/paste on inputs. All changes scoped to mobile devices to prevent desktop layout disruption.
- **October 20, 2025**: Fixed production errors and development ENOSPC issues:
  - **Vite Config**: Consolidated all node_modules into single vendor chunk to prevent React fragmentation and load-order issues. Enabled polling watcher with comprehensive ignore patterns to resolve ENOSPC file watcher limits.
  - **CSP Security**: Removed 'unsafe-eval' from production CSP (strict security). CSP disabled in development to allow HMR.
  - **Static Serving**: Fixed distPath to dist/public, added proper Content-Type headers for JS/CSS/webmanifest, prevented HTML fallback for missing assets.
  - **Server/Vite Integration**: Fixed async Vite config invocation to properly resolve root path and load plugins.
  - **Environment Variables**: Added CHOKIDAR_USEPOLLING and WATCHPACK_POLLING to dev script for stable file watching.
  - All production builds now generate single vendor bundle; development server runs without ENOSPC errors.
- **October 17, 2025**: Project cleanup - removed 160+ temporary development artifacts from `attached_assets/` folder (old images, pasted text files, outdated icon bundles, patch files, and screenshots). All active PWA icons remain in `client/public/`. Project size significantly reduced.

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
- **Admin Dashboard**: Comprehensive management for Deposits, Withdrawals, Users, Analytics, Announcements, and Settings, including bulk deposit approval.
- **Announcements System**: Platform-wide communication system with admin CRUD interface and user-facing dismissible banners. Supports 4 priority levels (info/warning/success/error), expiry dates, and active/inactive status. Public API serves active announcements to authenticated users on home page.
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