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
- **Authentication**: Hybrid system supporting Replit OIDC (Passport.js) and traditional email/password, with secure password reset and session management.
- **PWA**: Full Progressive Web App capabilities via `vite-plugin-pwa` with a custom service worker for offline SPA routing, Workbox caching, and app shortcuts.
- **Monitoring**: Optional Sentry integration for error tracking and Web Vitals monitoring.
- **Charts**: Recharts for data visualization.

**Feature Specifications:**
- **Admin Dashboard**: Comprehensive management with tabs for Overview, Deposits, Withdrawals, Users, Analytics, and Settings, including bulk deposit approval.
- **Deposit System**: USDT to XNRT conversion with admin approval, proof of payment upload, and transaction tracking.
- **Withdrawal System**: XNRT to USDT conversion with a 2% fee, multi-source support, and admin approval.
- **Staking System**: Four-tiered system with varying APY and duration, real-time countdowns, and automated daily reward distribution.
- **Mining System**: Fully automated 24-hour sessions with auto-completion, XP to XNRT conversion (10 XP + 5 XNRT per session), no cooldown for immediate restart, and automatic reward deposit.
- **Referral System**: 3-level commission chain, network visualization, real-time notifications, leaderboard, and social sharing.
- **Daily Check-in System**: Atomic check-ins with streak rewards, calendar view, and anti-exploit measures.
- **Achievement System**: Auto-unlocks achievements with XP rewards and confetti celebrations.
- **XP Leaderboard System**: Weekly/monthly rankings with category filters and privacy controls (anonymized handles for non-admins).
- **Push Notification System**: Web Push notifications with VAPID authentication, subscription management, delivery tracking with exponential backoff, and event triggers.
- **Password Reset System**: Secure recovery with time-limited tokens and rate limiting.

**System Design Choices:**
- **Automation**: All core earning mechanisms are fully automated.
- **Security**: Implemented `requireAuth`/`requireAdmin` middleware, atomic database operations, input validation, rate limiting, and `helmet`.
- **Performance**: Optimized Prisma queries, reduced API polling, and Workbox caching.
- **Progressive Enhancement**: Feature flags enable phased rollout.
- **Code Quality**: Zero LSP/TypeScript errors, 100% type-safe, and E2E test coverage.

## External Dependencies
- **Database**: Neon (PostgreSQL)
- **Authentication**: Replit OIDC
- **UI Components**: Shadcn/ui, Radix UI Primitives
- **Icons**: Lucide React
- **CSS Framework**: Tailwind CSS
- **State Management**: TanStack Query
- **Routing**: Wouter
- **Charts**: Recharts
- **QR Code Generation**: qrcode library
- **PWA**: `vite-plugin-pwa` with Workbox
- **Push Notifications**: web-push (VAPID authentication)
- **Animations**: canvas-confetti
- **Monitoring**: Sentry (optional), web-vitals
- **Security**: helmet

## Recent Updates (Oct 12, 2025)
### Mining System Simplification ✅
- **No Cooldown**: Removed 24-hour cooldown restriction - users can start a new mining session immediately after previous one completes
- **Auto-Completion**: Implemented automated 24-hour timer that auto-stops mining and deposits rewards without manual intervention
- **Ad Boost Removed**: Disabled ad boost system for cleaner, simpler earning experience (may re-enable in future)
- **Simplified UI**: Removed stop button and ad boost components - users only see countdown timer and estimated rewards
- **Auto-Processing**: Frontend triggers reward processing every 30 seconds to detect and complete expired sessions
- **Immediate Restart**: Set nextAvailable to current time so users can restart mining instantly after completion
- **Secure Implementation**: Maintained CSRF protection and authentication on all endpoints including auto-processing
- **Updated Messaging**: All success messages and UI text reflect automatic completion and deposit flow

### Mining System Robustness Improvements ✅
- **Confetti Safety**: Replaced unsupported 'star' shape with 'square'/'circle' in canvas-confetti, added try/catch error handling to prevent UI crashes, and optional chaining for feature flags
- **Robust 401 Detection**: Enhanced `isUnauthorizedError()` with `ApiError` type that checks status/code fields instead of fragile regex matching for more reliable authentication error handling
- **DRY Authentication Handling**: Extracted `handleUnauthorized()` helper to eliminate code duplication across all three mining mutations (start/stop/watch-ad)
- **Type Safety**: Added `StopMiningResponse` type with proper JSON parsing for end-to-end type enforcement in stop mining mutation
- **Race Condition Prevention**: Implemented `startOrStopDisabled` flag using `isPending` to prevent double-click button spam during mutations
- **Constants Extraction**: Converted magic numbers to named constants (`AD_MAX = 5`, `AD_STEP = 10`) for maintainable ad boost system configuration
- **Countdown Safety**: Added `Math.max(0, diff)` to prevent negative countdown display if server/client clock skews
- **Accessibility**: Added `aria-label` attributes to start/stop and watch-ad buttons for screen reader support
- **Null Safety**: Implemented safe type checking on `xnrtReward` before calling `toFixed()` in toast messages
- **Improved Reward Calculation**: Refactored estimated reward formula to use constants and proper percentage math

### Referral Link URL Parameter Fix ✅
- **Auto-Capture Implementation**: Added useEffect hooks to both `/auth` and `/register` pages to automatically parse `?ref=` URL parameter on component mount
- **Seamless Signup Flow**: When users access referral links (e.g., `https://xnrt.org/?ref=XNRTX8K2N9P4`), the referral code is automatically extracted and populated in the registration form
- **User Feedback**: Toast notification displays when referral code is applied, showing the captured code to the user
- **Smart Tab Switching**: On `/auth` page, automatically switches to "register" tab when ref parameter is detected for optimal UX
- **Security**: React safely renders toast content, preventing XSS attacks from malicious referral codes
- **Browser Standard**: Uses native URLSearchParams API for reliable cross-browser URL parameter parsing

### Referral Privacy Controls ✅
- **Company Commission Privacy**: Hidden company fallback commission data from regular users for cleaner interface and business privacy
- **Admin Transparency**: Company commissions remain fully visible to admin users for analytics and monitoring
- **Conditional Rendering**: Implemented `user?.isAdmin` checks to filter company data in summary section and 4-card grid
- **UX Benefits**: Regular users see simplified 3-level commission structure without internal business metrics
- **Filter Implementation**: Used `.filter(stat => user?.isAdmin || stat.level > 0)` to conditionally show company card only to admins

### Referral Code Format Upgrade ✅
- **Guaranteed Uniqueness**: Switched from collision-prone format to nanoid-based generation for cryptographically secure unique codes
- **Brand-Aligned Prefix**: Changed prefix from `REF` to `XNRT` for better brand recognition (e.g., `XNRTX8K2N9P4`, `XNRTM5T7QW9L`)
- **Old Format**: `REF + username[0:4] + timestamp[-4:]` (risk of collision within 10 seconds for similar usernames)
- **New Format**: `XNRT + nanoid(8).toUpperCase()` (2.8 trillion possible combinations, zero collision risk)
- **Implementation**: Updated both `server/auth/routes.ts` and `server/storage.ts` to use nanoid library
- **Backward Compatible**: Existing users retain their original codes - only new registrations use XNRT format