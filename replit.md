# XNRT - NextGen Gamification Earning Platform

## Overview
XNRT is a React PWA off-chain gamification community earning platform featuring in-app utility tokens. Users earn XNRT through staking, mining, referrals, and task completion. The platform aims to provide a robust, engaging, and secure environment for gamified earnings, currently in a production-ready state with a fully functional authentication system, automated earning mechanisms, and an admin dashboard.

## User Preferences
- Dark theme by default (cosmic design)
- Mobile-first responsive design
- Accessibility via Radix UI primitives
- Testing-friendly with comprehensive data-testid coverage

## System Architecture
XNRT utilizes a robust architecture designed for performance, scalability, and security.

**UI/UX Decisions:**
- **Design System**: Dark theme with cosmic background and neon gradients.
- **Components**: Leverages Shadcn/ui with Radix UI primitives for accessible and responsive design.
- **Responsiveness**: Mobile-first approach ensuring usability across devices.

**Technical Implementations:**
- **Frontend**: React, TypeScript, Vite, Tailwind CSS for styling, Wouter for routing, and TanStack Query for data fetching and state management.
- **Backend**: Express.js with TypeScript for API services.
- **Database**: PostgreSQL (Neon) using a hybrid ORM architecture with Drizzle ORM for schema definition and session management, and Prisma ORM for all database operations.
- **Authentication**: Hybrid authentication system supporting both Replit OIDC (integrated with Passport.js and `connect-pg-simple` for session storage) and traditional email/password authentication with secure password reset functionality.
- **PWA**: Full Progressive Web App capabilities with vite-plugin-pwa, Workbox caching strategies (NetworkFirst for API, CacheFirst for assets, StaleWhileRevalidate for app shell), service worker update prompts, and installability on all platforms.
- **Monitoring**: Optional Sentry integration for error tracking, Web Vitals monitoring (CLS, INP, FCP, LCP, TTFB), and CSP violation reporting.
- **Charts**: Recharts for data visualization in analytics.

**Feature Specifications:**
- **Admin Dashboard**: Comprehensive management system with 6 protected tabs (Overview, Deposits, Withdrawals, Users, Analytics, Settings) for full control over platform operations, user management, and financial transactions.
- **Deposit System**: USDT to XNRT conversion (1:100) with admin approval, transaction history, and status tracking.
- **Withdrawal System**: XNRT to USDT conversion with a 2% fee, source selection (main/referral balance), BEP20 wallet validation, and admin approval.
- **Staking System**: Four-tiered system (Royal Sapphire, Legendary Emerald, Imperial Platinum, Mythic Diamond) with varying APY and duration, featuring real-time countdowns and atomic withdrawal.
- **Mining System**: 24-hour sessions with energy system, ad boosts, and 50% XP to XNRT conversion, with automated reward distribution and optimized API polling.
- **Referral System**: 3-level commission chain (6%/3%/1% for L1/L2/L3 respectively) triggered by deposits, with commission fallback to company admin. Includes social sharing, QR code generation, and message templates.
- **Daily Check-in System**: Atomic check-in with streak rewards (XNRT & XP) and anti-exploit measures.
- **Achievement System**: Auto-unlocks achievements based on user actions (mining, tasks, check-ins, staking, referrals) with accumulated XP rewards and activity logging.
- **Password Reset System**: Secure password recovery with cryptographically random tokens (64 hex chars), 1-hour expiration, one-time use enforcement, rate limiting (3 requests per 15 minutes), and automatic session revocation on successful reset. Generic responses prevent email enumeration.

**System Design Choices:**
- **Automation**: All core earning mechanisms (staking, mining, referral commissions, daily check-ins, achievement unlocks) are fully automated.
- **Security**: Implemented `requireAuth` and `requireAdmin` middleware, atomic database operations for critical transactions (withdrawals, check-ins, password resets), input validation, rate limiting on sensitive endpoints, and `helmet` middleware for security hardening with CSP in report-only mode. Password reset uses cryptographically secure tokens with strict expiration and one-time use enforcement.
- **Performance**: Optimized Prisma aggregation queries to prevent N+1 problems, reduced API polling intervals, efficient referral chain traversal, and Workbox-powered offline caching for improved load times.
- **Progressive Enhancement**: Feature flags system enables phased rollout of PWA features (offline support, push notifications, real-time updates), allowing safe deployment and A/B testing.
- **Code Quality**: Zero LSP/TypeScript errors, 100% type-safe codebase, and comprehensive E2E test coverage for core user journeys.

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
- **PWA**: vite-plugin-pwa with Workbox
- **Monitoring**: Sentry (optional), web-vitals
- **Security**: helmet with Content Security Policy