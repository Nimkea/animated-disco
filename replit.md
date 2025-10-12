# XNRT - NextGen Gamification Earning Platform

## Overview

XNRT is a Progressive Web App (PWA) built with React and TypeScript that enables users to earn XNRT tokens (an in-app utility token) through multiple gamification mechanisms. The platform combines cryptocurrency earning features with gaming elements, featuring a cosmic-themed interface with professional financial dashboard layouts.

**Core Value Proposition:** Users earn XNRT tokens through staking (up to 730% APY), 24-hour mining sessions, a 3-level referral system, task completion, and achievement unlocks.

**Key Statistics:**
- 112 TypeScript files
- ~7,500 lines of code
- 100% TypeScript coverage
- Production-ready PWA with offline support

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- **Framework:** React 18.3 with TypeScript
- **Build Tool:** Vite with custom service worker (injectManifest strategy)
- **Routing:** Wouter (lightweight client-side routing)
- **State Management:** TanStack Query for server state, React hooks for local state
- **UI Framework:** Tailwind CSS with Shadcn/ui components (Radix UI primitives)
- **Animations:** Framer Motion for page transitions and interactions

**Design System:**
- **Theme:** Unified cosmic theme with black starfield background in both light and dark modes
- **Colors:** Golden amber brand color (HSL 42 90% 50%) for interactive elements; light mode uses golden stars, dark mode uses white stars
- **Typography:** Space Grotesk (sans-serif) for UI/numbers, Lora (serif) for headings
- **Layout:** Mobile-first responsive design with sidebar navigation (desktop) and bottom navigation (mobile)
- **Accessibility:** ARIA labels, AA color contrast compliance, comprehensive data-testid attributes

**Authentication Flow:**
- Glassmorphic `/auth` page with tabbed Login/Register interface
- Centralized `useAuth()` hook querying `/auth/me` endpoint
- Protected routes with automatic redirect to auth page
- Error boundaries for graceful failure recovery

**PWA Implementation:**
- Full offline support via custom service worker (`sw.ts`)
- NavigationRoute for SPA routing without allowlist restrictions
- Cache strategies: StaleWhileRevalidate (app shell), NetworkFirst (API), CacheFirst (media)
- Install prompts, update notifications, and offline indicators
- Web Push notifications with VAPID authentication

**Performance Optimizations:**
- Lazy loading for heavy components
- Content-aware skeleton screens during data fetch
- Code splitting via Vite
- Aggressive cache invalidation with version-based cleanup

### Backend Architecture

**Technology Stack:**
- **Runtime:** Node.js with Express.js
- **Language:** TypeScript with ESM modules
- **Security:** Helmet for headers, rate limiting, CSRF protection
- **Build:** esbuild for production bundling

**Authentication System:**
- Hybrid approach: Replit OIDC (Passport.js) + traditional email/password
- JWT-based sessions with httpOnly cookies
- Session management with revocation support
- Secure password reset with cryptographically random, time-limited tokens
- Rate limiting on auth endpoints (10 login attempts per 15 min, 3 password resets per 15 min)

**API Design:**
- RESTful endpoints with consistent error handling
- CSRF token validation for state-changing operations
- Request validation using Zod schemas
- Middleware chain: helmet → CORS → body parsing → cookie parsing → custom logging

**Security Measures:**
- Content Security Policy (CSP) in report-only mode
- Trust proxy configuration for Replit environment
- Password hashing with bcrypt (12 rounds)
- XSS protection via Helmet
- Rate limiting on sensitive endpoints

### Data Storage

**Database Architecture:**
- **Primary:** PostgreSQL (Neon serverless) for production
- **ORM:** Dual system - Drizzle for schema definition, Prisma for operations
- **Development:** SQLite with Prisma (file-based)
- **Session Storage:** PostgreSQL table managed by connect-pg-simple

**Schema Design:**
- Users table with referral tracking, XP/level/streak fields
- Balances table with source separation (main, staking, mining, referral)
- Transactions table for deposits/withdrawals with status tracking
- Stakes table with tier, amount, duration, and ROI calculations
- Mining sessions with ad boost tracking and XP conversion
- Referrals table for 3-level commission chain (6%/3%/1%)
- Tasks and achievements with progress tracking
- Notifications with delivery status and retry mechanism
- Push subscriptions for Web Push notifications

**Data Flow:**
- Atomic transactions for balance updates
- Optimistic updates on frontend with TanStack Query
- Server-side validation for all mutations
- Audit trail via activity logging

### Core Features Architecture

**Staking System:**
- Four tiers with varying APY (402% to 730%)
- Simple interest calculation (not compound)
- Automated daily reward distribution via cron-like workers
- Real-time countdown timers
- Withdrawal on maturity with automatic balance updates

**Mining System:**
- 24-hour session-based mining
- Ad boost system (up to 10 ads per session, +10% each)
- XP to XNRT conversion on completion
- Server-side progress tracking to prevent manipulation
- One active session per user with immediate restart capability

**Referral System:**
- 3-level commission chain: Level 1 (6%), Level 2 (3%), Level 3 (1%)
- Company fallback for missing referrer levels
- Network visualization with tree structure
- Real-time commission notifications
- Separate balance tracking with withdrawal support
- Social sharing features

**Admin Dashboard:**
- Tabbed interface: Overview, Deposits, Withdrawals, Users, Analytics, Settings
- Bulk deposit approval with sequential processing
- Transaction hash recording for completed withdrawals
- User management with balance breakdown
- Analytics charts using Recharts

**Gamification:**
- Daily check-in system with streak rewards
- Achievement auto-unlocking based on user actions
- XP leaderboard with weekly/monthly rankings
- Task system with progress tracking
- Confetti celebrations for milestone achievements

**Notification System:**
- Web Push notifications with VAPID authentication
- Exponential backoff retry logic (5/15/30/60 min delays, max 5 attempts)
- Subscription management per user
- Delivery tracking with retry worker
- In-app notification center with read/unread status

## External Dependencies

### Third-Party Services

**Database:**
- Neon Serverless PostgreSQL (primary production database)
- Connection pooling via `@neondatabase/serverless`

**Authentication:**
- Replit OIDC via `openid-client` and `passport`
- JWT signing/verification via `jsonwebtoken`
- Password hashing via `bcrypt`

**Monitoring (Optional):**
- Sentry for error tracking (`@sentry/react`)
- Web Vitals monitoring for performance metrics

### Key NPM Packages

**Frontend:**
- `@tanstack/react-query` - Server state management
- `wouter` - Lightweight routing
- `@radix-ui/*` - Accessible UI primitives (20+ packages)
- `framer-motion` - Animations
- `recharts` - Data visualization
- `canvas-confetti` - Celebration effects
- `date-fns` - Date manipulation
- `react-hook-form` + `@hookform/resolvers` - Form handling
- `zod` - Schema validation
- `vite-plugin-pwa` - PWA capabilities

**Backend:**
- `express` - Web server
- `prisma` + `@prisma/client` - Database ORM
- `drizzle-orm` + `drizzle-kit` - Schema definition
- `helmet` - Security headers
- `express-rate-limit` - Rate limiting
- `web-push` - Push notifications
- `cookie-parser` - Cookie handling
- `cors` - CORS middleware
- `nanoid` - ID generation

**Build Tools:**
- `vite` - Frontend build
- `esbuild` - Backend bundling
- `tsx` - TypeScript execution
- `concurrently` - Parallel script execution

### Environment Variables

**Required:**
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret for JWT signing
- `CLIENT_URL` - Frontend URL for CORS

**Optional:**
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` - Web Push authentication
- `VAPID_SUBJECT` - Contact email for push notifications
- `ENABLE_PUSH_NOTIFICATIONS` - Feature flag for push (default: true)
- `SENTRY_DSN` - Error tracking (if enabled)
- `REPLIT_DOMAINS` / `REPL_ID` / `ISSUER_URL` - Replit OIDC

### Build Configuration

**Development:**
- Vite dev server on port 5173 (default)
- Express server with tsx on port 5000
- Concurrent execution via `npm run dev`
- Hot module replacement (HMR) enabled

**Production:**
- Frontend: Vite build → `dist/client/`
- Backend: esbuild bundle → `dist/server/index.js`
- Service worker: Custom TypeScript → compiled to `dist/client/sw.js`
- Static file serving from Express in production mode
- Deployment target: Replit Autoscale (pay-per-use)