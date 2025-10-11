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
- **Design System**: Unified cosmic theme system with black starfield background in both light and dark modes. Golden twinkling stars in light mode, white twinkling stars in dark mode. Landing page features luxurious golden color palette (amber-to-yellow gradients) for premium brand feel with light text for visibility.
- **Authentication Experience**: Glassmorphic `/auth` page with backdrop-blur effects, tabbed Login/Register interface, and framer-motion animations (card entrance, logo spring, tab transitions, button interactions).
- **Error Handling**: An ErrorBoundary component provides graceful failure recovery with user-friendly fallback UI for all authenticated routes.
- **Loading States**: Content-aware skeleton screens are used for improved perceived performance during data fetching.
- **Confirmation Flows**: Critical actions require user confirmation with detailed transaction information.
- **Components**: Leverages Shadcn/ui with Radix UI primitives for accessible and responsive design.
- **Responsiveness**: Mobile-first approach ensuring usability across devices.
- **Animations**: Framer-motion is used for dynamic UI elements and transitions throughout the application.

**Technical Implementations:**
- **Frontend**: React, TypeScript, Vite, Tailwind CSS, Wouter for routing, and TanStack Query for data management.
- **Backend**: Express.js with TypeScript.
- **Database**: PostgreSQL (Neon) using Drizzle ORM for schema definition and session management, and Prisma ORM for database operations.
- **Authentication**: Hybrid system supporting Replit OIDC (Passport.js) and traditional email/password, with secure password reset and session management. All pages use centralized `useAuth()` hook querying `/auth/me` for consistent user state and cache invalidation.
- **PWA**: Full Progressive Web App capabilities via vite-plugin-pwa and Workbox for offline support, caching, and installability. Configured with devOptions for full PWA functionality in development mode. App shortcuts enable quick access to Staking, Mining, and Referrals from the device home screen. Custom XNRT branded icon integrated across all PWA touchpoints. Manifest served as .webmanifest (W3C standard). Custom branded install prompt with 7-day snooze (timestamp-based persistence), polished update notification system with user-controlled updates, and Badging API integration displaying unread notification count on app icon (Android, Windows, ChromeOS).
- **Monitoring**: Optional Sentry integration for error tracking and Web Vitals monitoring.
- **Charts**: Recharts for data visualization.

**Feature Specifications:**
- **Admin Dashboard**: Comprehensive management system with tabs for Overview, Deposits, Withdrawals, Users, Analytics, and Settings.
- **Deposit System**: USDT to XNRT conversion with admin approval and transaction tracking.
- **Withdrawal System**: XNRT to USDT conversion with a 2% fee, source selection, and admin approval.
- **Staking System**: Four-tiered system with varying APY and duration, featuring real-time countdowns.
- **Mining System**: 24-hour sessions with ad boosts, XP to XNRT conversion, and automated reward distribution.
- **Referral System**: 3-level commission chain (6%/3%/1%) with network visualization, real-time notifications, a leaderboard, separate balance tracking, and social sharing features.
- **Daily Check-in System**: Atomic check-ins with streak rewards and anti-exploit measures.
- **Achievement System**: Auto-unlocks achievements based on user actions with XP rewards.
- **Password Reset System**: Secure password recovery with cryptographically random, time-limited, and one-time-use tokens, plus rate limiting.

**System Design Choices:**
- **Automation**: All core earning mechanisms are fully automated.
- **Security**: Implemented `requireAuth`/`requireAdmin` middleware, atomic database operations, input validation, rate limiting, and `helmet` for security hardening.
- **Performance**: Optimized Prisma queries, reduced API polling, and Workbox caching.
- **Progressive Enhancement**: Feature flags enable phased rollout of PWA features.
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
- **PWA**: vite-plugin-pwa with Workbox
- **Monitoring**: Sentry (optional), web-vitals
- **Security**: helmet