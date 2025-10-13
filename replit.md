# XNRT - NextGen Gamification Earning Platform

## Overview
XNRT is a React PWA off-chain gamification community earning platform where users earn in-app utility tokens (XNRT) through staking, mining, referrals, and task completion. It offers a secure, engaging environment with a functional authentication system, automated earning mechanisms, and an admin dashboard, aiming to provide a robust and inspiring earning experience.

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
- **Design System**: Unified cosmic theme with black starfield backgrounds in both light and dark modes, and a luxurious golden color palette for the landing page.
- **Authentication Experience**: Glassmorphic `/auth` page with `backdrop-blur` effects, tabbed Login/Register interface, and `framer-motion` animations.
- **Error Handling**: An `ErrorBoundary` component provides graceful failure recovery.
- **Loading States**: Content-aware skeleton screens are used.
- **Confirmation Flows**: Critical actions require user confirmation.
- **Components**: Leverages Shadcn/ui with Radix UI primitives.
- **Responsiveness**: Mobile-first approach.
- **Animations**: `Framer-motion` for dynamic UI elements and transitions.

**Technical Implementations:**
- **Frontend**: React, TypeScript, Vite, Tailwind CSS, Wouter for routing, and TanStack Query for data management.
- **Backend**: Express.js with TypeScript.
- **Database**: PostgreSQL (Neon) using Drizzle ORM for schema and session management, and Prisma ORM for database operations.
- **Authentication**: Hybrid system supporting Replit OIDC (Passport.js) and traditional email/password, with secure password reset, email verification, and session management.
- **PWA**: Full Progressive Web App capabilities via `vite-plugin-pwa` with a custom service worker for offline SPA routing, Workbox caching, and app shortcuts.
- **Monitoring**: Optional Sentry integration for error tracking and Web Vitals monitoring.
- **Charts**: Recharts for data visualization.

**Feature Specifications:**
- **Admin Dashboard**: Comprehensive management with tabs for Overview, Deposits, Withdrawals, Users, Analytics, and Settings, including bulk deposit approval.
- **Deposit System**: USDT to XNRT conversion with admin approval, proof of payment upload, and transaction tracking.
- **Withdrawal System**: XNRT to USDT conversion with a 2% fee, multi-source support, and admin approval.
- **Staking System**: Four-tiered system with varying APY and duration, real-time countdowns, and automated daily reward distribution.
- **Mining System**: Fully automated 24-hour sessions with auto-completion, XP to XNRT conversion (10 XP + 5 XNRT per session), no cooldown, and automatic reward deposit.
- **Referral System**: 3-level commission chain, network visualization, real-time notifications, leaderboard, social sharing, and privacy controls for company commissions.
- **Daily Check-in System**: Atomic check-ins with streak rewards, calendar view, and anti-exploit measures.
- **Achievement System**: Auto-unlocks achievements with XP rewards and confetti celebrations.
- **XP Leaderboard System**: Weekly/monthly rankings with category filters and privacy controls.
- **Push Notification System**: Web Push notifications with VAPID authentication, subscription management, delivery tracking with exponential backoff, and event triggers.
- **Password Reset System**: Secure recovery with time-limited tokens and rate limiting.
- **Email Verification System**: Secure email verification with tokens, expiry, and rate-limited resend options.

**System Design Choices:**
- **Automation**: All core earning mechanisms are fully automated.
- **Security**: Implemented `requireAuth`/`requireAdmin` middleware, atomic database operations, input validation, rate limiting, and `helmet`.
- **Performance**: Optimized Prisma queries, reduced API polling, and Workbox caching.
- **Progressive Enhancement**: Feature flags enable phased rollout.
- **Code Quality**: Zero LSP/TypeScript errors, 100% type-safe, and E2E test coverage.
- **Database Schema Alignment**: 100% schema alignment between Drizzle and Prisma for consistency and tool compatibility.

## External Dependencies
- **Database**: Neon (PostgreSQL)
- **Authentication**: Replit OIDC
- **Email Service**: Brevo SMTP (via Nodemailer)
- **UI Components**: Shadcn/ui, Radix UI Primitives
- **Icons**: Lucide React
- **CSS Framework**: Tailwind CSS
- **State Management**: TanStack Query
- **Routing**: Wouter
- **Charts**: Recharts
- **QR Code Generation**: qrcode library
- **PWA**: `vite-plugin-pwa` with Workbox
- **Push Notifications**: web-push (VAPID authentication)
- **Animations**: canvas-confetti, framer-motion
- **Monitoring**: Sentry (optional), web-vitals
- **Security**: helmet
- **Unique ID Generation**: nanoid
### Production Email URL Fix ✅
- **Environment Variable Migration**: Updated email service from `REPLIT_DEV_DOMAIN` to `APP_URL` for production domain configuration
- **URL Construction Update**: Both `sendVerificationEmail` and `sendPasswordResetEmail` now use `process.env.APP_URL || 'https://xnrt.org'`
- **Production Secret**: Added `APP_URL=https://xnrt.org` to Deployment → App Secrets for production environment
- **Dev Preview Issue Resolved**: Fixed verification emails pointing to `janeway.replit.dev` (dev preview that sleeps) instead of production domain
- **Frontend API Fix**: Corrected `apiRequest` call signature in verify-email.tsx from `(url, options)` to `(method, url, data)` to fix TypeScript error
- **Fallback Strategy**: Smart fallback to `https://xnrt.org` ensures links work even if APP_URL not set
- **Security**: URL construction uses simple concatenation without user input, token is only dynamic component
- **Architect Approval**: Verified production-ready implementation with secure URL construction and appropriate fallback strategy
- **Next Steps**: Monitor production email deliverability and confirm correct domain rendering in sent emails

### Password Reset Routing Fix ✅
- **Problem**: Email links sent `https://xnrt.org/reset-password?token=XXX` (query param) but route expected `/reset-password/:token` (path param)
- **Route Update**: Changed from `/reset-password/:token` to `/reset-password` in App.tsx to match email link format
- **Token Extraction**: Updated reset-password.tsx to extract token from URL query params using `URLSearchParams`
- **State Management Fix**: Added `hasExtractedToken` flag to properly sequence token extraction and verification
  - Prevents premature "Invalid Reset Link" error during valid token verification
  - Prevents infinite loading state when no token present in URL
  - Shows loading state only during actual network verification
- **UX Flow**: Valid token → "Verifying..." → Form shown | Invalid/missing token → "Verifying..." briefly → Error shown
- **Redirect Update**: Changed all redirects from `/login` to `/auth` for consistency with app routing
- **Auto-redirect**: Reduced timeout from 3s to 2s to match email verification page
- **Architect Approval**: Verified all edge cases handled correctly (valid token, invalid token, missing token)
- **Production Ready**: Complete forgot password → email → reset password → login flow now functional
