## Overview
XNRT is a React PWA off-chain gamification community earning platform where users earn in-app utility tokens (XNRT) through staking, mining, referrals, and task completion. It aims to provide a robust, secure, and engaging earning experience with a functional authentication system, automated earning mechanisms, and a comprehensive admin dashboard.

## Recent Changes
### Blockchain Verification System for BSC USDT Deposits (Latest)
- **Feature**: Added on-chain verification for USDT deposits on Binance Smart Chain
- **Implementation**:
  - Created `verifyBscUsdt.ts` service using ethers.js v6 to verify transactions on BSC
  - Added verification endpoint: `POST /api/admin/deposits/:id/verify`
  - Updated Prisma/Drizzle schemas with `verified`, `confirmations`, and `verificationData` fields
  - Enhanced admin UI with "Verify on BSC" button and real-time status badges
- **Security Features**:
  - Validates transaction exists on blockchain (prevents fake hashes)
  - Checks USDT was sent to correct XNRT Wallet address (0x715C32...)
  - Verifies amount matches claimed deposit
  - Requires 12 BSC confirmations before approval
  - Displays verification status: ✅ Verified / ❌ Failed / ⏳ Pending confirmations
- **Environment Variables**: RPC_BSC_URL, USDT_BSC_ADDRESS, BSC_CONFIRMATIONS, XNRT_WALLET
- **Status**: Complete - production-ready blockchain verification system

### Branding Update: "Company Wallet" → "XNRT Wallet"
- **Change**: Renamed all instances of "Company Wallet" to "XNRT Wallet" for better branding consistency
- **Locations Updated**:
  - Deposit page: "Send USDT to XNRT Wallet" and "XNRT Wallet Address" label
  - Admin deposits tab: "XNRT Wallet: 0x715C..." in description
  - Admin settings: "XNRT Wallet" section title
- **Benefit**: More branded, clearer purpose, and professional appearance throughout the platform
- **Status**: Complete - all labels updated for consistent XNRT branding

### ChatBot Repositioned to Sidebar
- **Problem**: Floating chat button was positioned in top-right corner, but user requested it be moved to bottom-left sidebar area above Logout button
- **Solution**: Implemented controlled chatbot component with dual-mode operation:
  - **Authenticated App**: Rectangular "Chat Support" button in sidebar footer (above Logout) with MessageCircle icon
  - **Landing Page**: Retains floating circular button (backward compatible)
- **Technical Implementation**:
  - Modified ChatBot to accept optional props: `isOpen`, `onOpenChange`, `showLauncher`
  - Added state management in AuthenticatedApp component
  - Connected AppSidebar button to control chatbot open/close state
  - Preserved all existing functionality: mobile bottom sheet, desktop card, FAQ system, keyboard handling
- **UX Benefits**: 
  - Better integration with navigation hierarchy
  - No overlap with notification bell or theme toggle
  - Consistent with sidebar design language
  - Mobile sidebar auto-closes when chat opens
- **Architect Approval**: Changes verified as production-ready with no regressions
- **Status**: Chatbot now accessible via sidebar navigation for authenticated users, floating button for landing page visitors

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
- **Support**: Integrated FAQ ChatBot with smart keyword matching and email fallback.

**Technical Implementations:**
- **Frontend**: React, TypeScript, Vite, Tailwind CSS, Wouter for routing, and TanStack Query for data management.
- **Backend**: Express.js with TypeScript.
- **Database**: PostgreSQL (Neon) using Drizzle ORM for schema and session management, and Prisma ORM for database operations.
- **Authentication**: Hybrid system supporting Replit OIDC (Passport.js) and traditional email/password, with secure password reset, email verification, and session management.
- **PWA**: Full Progressive Web App capabilities via `vite-plugin-pwa` with a custom service worker for offline SPA routing, Workbox caching, and app shortcuts.
- **Monitoring**: Optional Sentry integration for error tracking and Web Vitals monitoring.
- **Charts**: Recharts for data visualization.

**Feature Specifications:**
- **Admin Dashboard**: Comprehensive management for Deposits, Withdrawals, Users, Analytics, and Settings, including bulk deposit approval.
- **Deposit/Withdrawal Systems**: USDT to XNRT conversion (deposits) and XNRT to USDT conversion (withdrawals), both with admin approval and tracking.
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
- **Automation**: All core earning mechanisms are fully automated.
- **Security**: Implemented `requireAuth`/`requireAdmin` middleware, atomic database operations, input validation, rate limiting, and `helmet`.
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