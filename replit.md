# XNRT - NextGen Gamification Earning Platform

## Overview
XNRT is a React PWA off-chain gamification community earning platform that allows users to earn in-app utility tokens (XNRT) through staking, mining, referrals, and task completion. The platform aims to provide an engaging and secure environment for gamified earnings, currently featuring a fully functional authentication system, automated earning mechanisms, and an admin dashboard. Its vision is to offer a robust and inspiring earning experience.

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
- **Design System**: Unified cosmic theme system with light and dark modes featuring starfield backgrounds and golden accents. Landing page uses a luxurious golden color palette.
- **Authentication Experience**: Glassmorphic `/auth` page with backdrop-blur, tabbed Login/Register, and Framer Motion animations.
- **Error Handling**: `ErrorBoundary` provides graceful failure recovery with user-friendly fallback UI.
- **Loading States**: Content-aware skeleton screens for improved perceived performance.
- **Confirmation Flows**: Critical actions require user confirmation.
- **Components**: Leverages Shadcn/ui with Radix UI primitives for accessible and responsive design.
- **Responsiveness**: Mobile-first approach.
- **Animations**: Framer-motion for dynamic UI elements and transitions.

**Technical Implementations:**
- **Frontend**: React, TypeScript, Vite, Tailwind CSS, Wouter for routing, and TanStack Query for data management.
- **Backend**: Express.js with TypeScript.
- **Database**: PostgreSQL (Neon) using Drizzle ORM for schema definition and session management, and Prisma ORM for database operations.
- **Authentication**: Hybrid system supporting Replit OIDC (Passport.js) and traditional email/password, with secure password reset and session management.
- **PWA**: Full Progressive Web App capabilities via `vite-plugin-pwa` with custom service worker for offline SPA routing, Workbox caching strategies, and app shortcuts.
- **Monitoring**: Optional Sentry integration for error tracking and Web Vitals.
- **Charts**: Recharts for data visualization.

**Feature Specifications:**
- **Admin Dashboard**: Comprehensive management system with 9 tabs (Overview, Deposits, Withdrawals, Users, Stakes, Tasks, Achievements, Analytics, Settings) including bulk deposit approval and full CRUD for stakes, tasks, and achievements.
- **Deposit System**: USDT to XNRT conversion with admin approval, proof of payment upload, and transaction tracking.
- **Withdrawal System**: XNRT to USDT conversion with a 2% fee, multi-source support, and admin approval.
- **Staking System**: Four-tiered system with varying APY and duration, real-time countdowns, and automated daily reward distribution.
- **Mining System**: 24-hour sessions with ad boosts, XP to XNRT conversion, and automated reward distribution.
- **Referral System**: 3-level commission chain, network visualization, real-time notifications, leaderboard with privacy controls, and social sharing.
- **Daily Check-in System**: Atomic check-ins with streak rewards, calendar view, and anti-exploit measures.
- **Achievement System**: Auto-unlocks achievements based on user actions with XP rewards and confetti celebrations.
- **XP Leaderboard System**: Weekly/monthly rankings with category filters and top 10 display. Includes privacy controls for anonymized handles for non-admin users.
- **Push Notification System**: Web Push notifications with VAPID authentication, subscription management, delivery tracking with exponential backoff retry logic, and event triggers.
- **Password Reset System**: Secure password recovery with cryptographically random, time-limited tokens, plus rate limiting.

**System Design Choices:**
- **Automation**: All core earning mechanisms are fully automated.
- **Security**: Implemented `requireAuth`/`requireAdmin` middleware, atomic database operations, input validation, rate limiting, and `helmet`.
- **Performance**: Optimized Prisma queries, reduced API polling, and Workbox caching.
- **Progressive Enhancement**: Feature flags enable phased rollout of PWA features.
- **Code Quality**: Zero LSP/TypeScript errors, 100% type-safe.

## External Dependencies
- **Database**: Neon (PostgreSQL)
- **Authentication**: Replit OIDC
- **UI Components**: Shadcn/ui, Radix UI Primitives
- **Icons**: Lucide React
- **CSS Framework**: Tailwind CSS
- **State Management**: TanStack Query
- **Routing**: Wouter
- **Charts**: Recharts
- **QR Code Generation**: `qrcode` library
- **PWA**: `vite-plugin-pwa` with Workbox
- **Push Notifications**: `web-push`
- **Animations**: `canvas-confetti`
- **Monitoring**: Sentry (optional), `web-vitals`
- **Security**: `helmet`