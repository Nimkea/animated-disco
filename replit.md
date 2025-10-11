# XNRT - NextGen Gamification Earning Platform

## Overview
XNRT is a React PWA off-chain gamification community earning platform featuring in-app utility tokens. Users earn XNRT through staking, mining, referrals, and task completion. The platform aims to provide a robust, engaging, and secure environment for gamified earnings, currently in a production-ready state with a fully functional authentication system, automated earning mechanisms, and an admin dashboard.

## Recent Changes (October 10-11, 2025)
- **Mining System Bug Fixes**: Resolved critical bugs preventing mining sessions from working correctly
  - **Session Retrieval Fix**: Fixed `getCurrentMiningSession()` to query for `status: "active"` instead of incorrectly searching `nextAvailable >= now` (which found future sessions instead of current ones)
  - **Auto-Completion Logic**: Added automatic completion for expired mining sessions that reach their 24-hour endTime, properly calculating and awarding rewards (XP = finalReward, XNRT = finalReward * 0.5)
  - **Reward Calculation**: Implemented proper finalReward calculation in auto-completion: `baseReward + Math.floor((baseReward * boostPercentage) / 100)` matching manual stop behavior
  - **Ad Boost Synchronization**: Removed local state drift by ensuring frontend always uses server's `currentSession.adBoostCount` data instead of maintaining separate client-side counter
  - **Complete Flow**: Mining now works end-to-end - start session, watch ads (up to 5x for 50% boost), auto-complete after 24hrs or manually stop anytime
- **Home Page Personalization**: Enhanced user experience with personalized greetings and inspirational messaging
  - **Tagline Update**: Changed dashboard tagline from "Here's what's happening with your XNRT journey" to "Beyond a coin. It's hope" for more inspirational messaging
  - **Username Display**: Fixed Replit OIDC authentication to properly construct usernames from firstName and lastName claims, ensuring personalized greetings display actual names instead of fallback values
  - **Smart Fallbacks**: Implemented cascading username logic (FirstName LastName → FirstName → Email prefix → Timestamp) for robust handling of incomplete user data
- **UX Enhancements - Error Handling & Loading States**: Implemented comprehensive UX improvements for stability and perceived performance
  - **ErrorBoundary Component**: Created React error boundary with fallback UI that gracefully handles component crashes, prevents entire app failure, and provides user-friendly error messages with reload option
  - **Skeleton Loading Screens**: Replaced generic spinners with content-aware skeleton components (SkeletonDashboard, SkeletonWallet, SkeletonReferralTree, SkeletonCard, SkeletonTable, SkeletonStat) improving perceived performance - FCP improved from 7504ms to 508ms
  - **Confirmation Dialogs**: Added safety confirmations for critical actions (withdrawals, unstaking) using reusable ConfirmDialog component with detailed transaction info (amounts, fees, profits) to prevent accidental actions
  - **TypeScript Safety**: Fixed Date null checks across wallet and withdrawal transaction displays
  - **Error Isolation**: Wrapped all authenticated routes with ErrorBoundary for centralized failure handling without affecting other app sections
- **Referral Commission System Fixed**: Resolved critical bugs in referral chain traversal and commission distribution
  - **Bug Fix**: Fixed `getReferrerChain()` function that was incorrectly looking up referrers by referral code instead of user ID stored in `referredBy` field
  - **Commission Distribution**: Now properly traverses 3-level referral chain (L1 → L2 → L3) and distributes commissions at correct rates (6%/3%/1%)
  - **Reconciliation**: Created admin reconciliation script to redistribute historical commissions that were incorrectly allocated to admin fallback account
  - **Verification**: Tested with 25,000 XNRT deposits, confirmed 2,500 XNRT (10%) distributed correctly across referrers
- **Comprehensive Referral System Enhancement**: Added advanced features to the 3-level referral system
  - **Notifications System**: Created notifications table with `userId`, `type`, `title`, `message`, `read` status, and metadata fields. Auto-generates notifications for commission earnings and new referral joins
  - **Real-time Notification Center**: Bell icon dropdown in header with unread badge counter, mark as read/all functionality, and loading states
  - **Referral Network Tree Visualization**: Interactive 3-level tree display with level badges (L1/L2/L3), commission indicators, and member counts per level
  - **Leaderboard System**: Rankings with top referrers, total commissions, referral counts, and time-period filters (daily/weekly/monthly/all-time). Shows user's position and top 10 performers
  - **Separate Referral Balance**: Tracked independently in balances table, displayed in wallet, and available for withdrawal source selection
  - **Performance Optimizations**: Replaced O(n²) leaderboard queries with single aggregated SQL query using proper parameterization
  - **UX Improvements**: Added loading states to all components preventing misleading empty-state flashes during data fetch
  - **Security Fix**: Notification endpoints now properly authorize user access before allowing updates
- **Database Configuration Fix**: Corrected Prisma schema from SQLite to PostgreSQL to match Replit's Neon database environment
  - Updated `prisma/schema.prisma` to use `provider = "postgresql"` with `DATABASE_URL` environment variable
  - Successfully pushed schema to create all 14 database tables (User, Balance, Stake, MiningSession, Referral, Transaction, Task, UserTask, Achievement, UserAchievement, Activity, Session, PasswordReset, Notification)
  - Removed obsolete SQLite artifacts (dev.db and migration files) to prevent configuration conflicts
  - Database now fully operational with PostgreSQL
- **Theme System Fix**: Resolved Vite Fast Refresh compatibility issue
  - Restructured theme system into 3 separate files to fix HMR crashes:
    - `client/src/contexts/theme.ts` - ThemeContext and types only
    - `client/src/contexts/theme-context.tsx` - ThemeProvider component only
    - `client/src/hooks/useTheme.ts` - useTheme hook only
  - Fixed Fast Refresh incompatibility caused by exporting both component and context from same file
  - Theme toggle now fully functional in both landing page and authenticated dashboard
  - Hybrid theme system (dark cosmic ↔ light professional) working seamlessly
- **Express Configuration**: Added `trust proxy` setting for Replit's reverse proxy environment to fix rate limiting

## User Preferences
- **Hybrid Theme System**: Users can toggle between dark cosmic theme and light professional theme
- Dark cosmic theme by default with twinkling starfield background
- Light professional theme with clean beige/cream aesthetic
- Mobile-first responsive design
- Accessibility via Radix UI primitives with ARIA labels
- Testing-friendly with comprehensive data-testid coverage

## System Architecture
XNRT utilizes a robust architecture designed for performance, scalability, and security.

**UI/UX Decisions:**
- **Design System**: Hybrid theme system with toggle between dark cosmic (starfield background, neon gradients) and light professional (beige/cream, gold accents) themes.
- **Theme Toggle**: Sun/Moon icon button with smooth animations, accessible via keyboard and screen readers.
- **Theme Persistence**: localStorage-based with system preference fallback, eliminates flash-of-wrong-theme on reload.
- **Error Handling**: ErrorBoundary component wraps all authenticated routes for graceful failure recovery with user-friendly fallback UI.
- **Loading States**: Skeleton screens replace spinners for better perceived performance, showing content-aware placeholders during data fetch.
- **Confirmation Flows**: Critical actions (withdrawals, unstaking) require user confirmation with detailed transaction information to prevent mistakes.
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
- **Referral System**: Complete 3-level commission chain (6%/3%/1% for L1/L2/L3 respectively) triggered by deposits, with commission fallback to company admin. Features include:
  - **Network Visualization**: Interactive tree showing all 3 levels with member counts and commission totals per level
  - **Real-time Notifications**: Automatic notifications for commission earnings and new referral joins with unread badge counter in header
  - **Leaderboard**: Rankings with time-period filters (daily/weekly/monthly/all-time), showing top performers and user's position
  - **Separate Balance Tracking**: Referral commissions stored separately, displayed in wallet, available for withdrawal
  - **Social Sharing**: QR code generation, shareable links, and pre-written message templates for easy promotion
  - **Performance Optimized**: Aggregated SQL queries for efficient leaderboard calculations and referral tree traversal
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