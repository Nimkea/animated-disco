## Overview
XNRT is a React PWA off-chain gamification community earning platform where users earn in-app utility tokens (XNRT) through staking, mining, referrals, and task completion. It aims to provide a robust, secure, and engaging earning experience with a functional authentication system, automated earning mechanisms, and a comprehensive admin dashboard. The platform incorporates a complete branding refresh with professional XNRT icons and PWA assets, a smart deposit reporting system with auto-verification on BSC, and an automated deposit system with blockchain scanning.

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
- **Blockchain Integration**: On-chain verification for USDT deposits on Binance Smart Chain using ethers.js, including auto-deposit system with wallet linking and a blockchain scanner.
- **Monitoring**: Optional Sentry integration for error tracking and Web Vitals monitoring.
- **Charts**: Recharts for data visualization.

**Feature Specifications:**
- **Admin Dashboard**: Comprehensive management for Deposits, Withdrawals, Users, Analytics, and Settings, including bulk deposit approval.
- **Deposit/Withdrawal Systems**: USDT to XNRT conversion (deposits) and XNRT to USDT conversion (withdrawals), both with admin approval and tracking. Enhanced with automated deposit scanning and smart deposit reporting with auto-verification.
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