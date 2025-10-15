## Overview
XNRT is a React PWA off-chain gamification community earning platform where users earn in-app utility tokens (XNRT) through staking, mining, referrals, and task completion. It aims to provide a robust, secure, and engaging earning experience with a functional authentication system, automated earning mechanisms, and a comprehensive admin dashboard.

## Recent Changes
### Smart Deposit Report with Auto-Verify & Credit (Latest)
- **Feature**: Enhanced "Report Missing Deposit" to auto-verify transactions on BSC and intelligently credit or queue for admin review
- **How It Works**:
  1. User pastes TX hash in "Report Missing Deposit" dialog
  2. System verifies transaction on BSC blockchain using `verifyBscUsdt` service
  3. **Smart Logic**:
     - If TX from **linked wallet** → Instantly credits XNRT to user (same as auto-deposit)
     - If TX from **exchange/unlinked wallet** → Creates UnmatchedDeposit with `reportedByUserId` hint for admin
     - If verification fails → Creates DepositReport for admin investigation
- **Use Cases**:
  - **Exchange Deposits**: Users depositing from Binance/OKX/etc. can paste TX hash for instant verification & admin approval
  - **Linked Wallet Edge Cases**: If auto-deposit scanner missed a TX, user can manually trigger verification
  - **Troubleshooting**: Failed verifications are logged with reason for admin review
- **Technical Implementation**:
  - Enhanced `POST /api/wallet/report-deposit` with blockchain verification
  - Checks for duplicate TX hashes (prevents double-crediting)
  - Extracts sender address from transaction to determine if linked to user
  - Atomic credit for linked wallets with notification
  - Creates UnmatchedDeposit with `reportedByUserId` for admin matching
- **UI Updates**:
  - Deposit page clarifies: "From Exchange? Use Report Missing Deposit with TX hash"
  - Report dialog shows different success messages based on outcome
  - Auto-invalidates balance and deposits queries after successful credit
- **Security**: All existing verification checks apply (confirmations, amount, USDT contract, treasury address)
- **Status**: Complete - production-ready smart deposit verification for both personal wallets and exchanges

### Auto-Deposit System with Blockchain Scanner
- **Feature**: Fully automated deposit system where users link their MetaMask wallet once, then deposits are auto-detected and credited without manual submission
- **Architecture**:
  - **Wallet Linking**: Users link BSC wallets via MetaMask signature verification (ethers.js)
    - Challenge/response flow with time-limited nonces stored in session
    - Signature verification ensures user owns the wallet
    - Multiple wallets can be linked per account
  - **Blockchain Scanner**: Service runs every 60 seconds, scans BSC for USDT transfers to treasury
    - Queries eth_getLogs for Transfer events to XNRT Wallet address
    - Matches deposits to linked wallets automatically
    - Stores unmatched deposits for admin review
    - Tracks scanner state (last block, errors) in database
  - **Auto-Credit Logic**: 
    - Deposits from linked wallets auto-credit after 12 BSC confirmations (~36 seconds)
    - Creates approved transaction atomically with balance update
    - Sends push notification to user on successful credit
    - Pending deposits show in history until confirmations met
- **Database Schema** (New Tables):
  - `LinkedWallet`: Stores user-wallet mappings with signature proof
  - `UnmatchedDeposit`: USDT transfers to treasury not matched to any user
  - `DepositReport`: User-submitted reports for missing deposits (edge case handling)
  - `ScannerState`: Tracks scanner progress, last block scanned, error count
  - Added `transactionHash` unique constraint (lowercase normalized) to prevent duplicates
- **User Experience**:
  - Deposit page shows "Link Your BSC Wallet" card (Step 0)
  - MetaMask integration with one-click wallet linking
  - Updated instructions: "Send → Wait 12 confirmations → Auto-credited"
  - "Report Missing Deposit" dialog for troubleshooting edge cases
  - Manual deposit submission still available as fallback
- **Admin Features**:
  - `GET /api/admin/unmatched-deposits` - View deposits not matched to users
  - `POST /api/admin/unmatched-deposits/:id/match` - Manually match to user and credit
  - `GET /api/admin/deposit-reports` - View user-reported missing deposits
  - `POST /api/admin/deposit-reports/:id/resolve` - Approve/reject reports with optional notes
- **Security**:
  - Signature verification prevents wallet address spoofing
  - Wallet can only be linked to one account (prevents multi-account fraud)
  - Database-level unique constraint on transaction hashes
  - Atomic balance updates prevent race conditions
  - Rate limiting and validation on all endpoints
- **Environment Variables**: RPC_BSC_URL (BSC node endpoint), DEPOSIT_SCAN_INTERVAL_MS (optional, default 60000)
- **Production Notes**: Public BSC RPC may hit rate limits. Paid RPC providers (QuickNode, Infura, Alchemy) recommended for production
- **Status**: Complete - production-ready auto-deposit system with wallet linking, blockchain scanning, and admin tools

### Blockchain Verification System for BSC USDT Deposits
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