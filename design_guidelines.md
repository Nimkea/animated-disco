# XNRT Platform - Design Guidelines

## Design Approach
**Reference-Based Approach**: Inspired by Binance and Coinbase's cryptocurrency platforms combined with Habitica's gamified earning interfaces - featuring professional financial dashboards with gaming aesthetics and comprehensive earning visualizations.

## Core Design Principles
- **Cosmic Gaming Aesthetic**: Dark theme with neon gradients and glassmorphism effects
- **Financial Credibility**: Professional cryptocurrency platform layout with gaming gamification overlays
- **Mobile-First PWA**: Installable, offline-capable, native-like experience
- **Prominent Value Display**: Large, eye-catching balance and earnings displays

## Color Palette

**Primary Colors:**
- Primary (Neon Blue): 203.8863 88.2845% 53.1373%
- Secondary (Neon Purple): 341.4894 75.2000% 50.9804%
- Background: 0 0% 0%
- Card Background: 228 9.8039% 10%
- Text (Light Foreground): 200 6.6667% 91.1765%

**Gradient Applications:**
- Hero sections and headers: Blue-to-purple gradients
- CTAs and action buttons: Vibrant neon gradients
- Balance displays: Gradient text for emphasis
- Card accents: Subtle gradient borders

## Typography

**Font Families:**
- Primary: 'Space Grotesk' (mono) - for UI elements, numbers, balances
- Secondary: 'Lora' (serif) - for headings, emphasis text

**Hierarchy:**
- Balance Displays: 3xl-6xl, bold, gradient text
- Section Headers: 2xl-4xl, Lora serif
- Body Text: base-lg, Space Grotesk
- Stats/Numbers: xl-3xl, monospace, prominent

## Layout System

**Spacing Units:** Tailwind units of 4, 6, 8, 12, 16, 20 for consistent rhythm

**Container Structure:**
- Dashboard: Sidebar navigation (fixed left) + main content area
- Cards: 1.3rem border radius, dark background with glassmorphism
- Mobile: Bottom navigation, collapsible sidebar
- Max-width: 7xl for main content containers

## Component Library

**Glassmorphism Cards:**
- Background: Semi-transparent dark with blur effect
- Border: Subtle gradient borders (1-2px)
- Shadow: Glow effects with neon colors
- Backdrop: blur-lg for glass effect

**Balance Displays:**
- Extra large typography (4xl-6xl)
- Gradient text treatment
- Prominent positioning (hero sections)
- Real-time update animations

**Navigation:**
- Comprehensive sidebar: Home, Wallet, Deposit, Withdrawal, Staking, Mining, Referrals, Profile, Tasks, Achievements, Rewards
- Active state: Neon blue highlight with glow
- Icons: Use Heroicons for consistency
- Mobile: Bottom tab bar with key sections

**Progress Indicators:**
- Circular progress for countdowns (mining, staking)
- Linear bars for XP levels and streaks
- Animated fill with gradient colors
- Percentage displays with large numbers

**Action Buttons:**
- Primary: Gradient background (blue-to-purple)
- Hover: Enhanced glow and scale effects
- Active states: Ripple animations
- CTAs: Extra large, prominent placement

**Stats Cards:**
- Grid layout: 2-4 columns on desktop
- Icon + Label + Value structure
- Neon accent colors for icons
- Hover: Subtle lift and glow effects

**Data Tables:**
- Transaction history: Alternating row backgrounds
- Status badges: Color-coded (pending, approved, rejected)
- Responsive: Card layout on mobile
- Filters: Top-aligned with clear visual separation

**Forms:**
- Dark inputs with subtle borders
- Focus: Neon blue glow effect
- Validation: Real-time with color feedback
- Labels: Clear hierarchy, Lora serif for important fields

## Visual Effects

**Cosmic Background:**
- Twinkling stars (100+ randomly positioned)
- Staggered animations for depth
- Dark gradient base (black to deep blue/purple)
- Subtle animated nebula effects

**Animations:**
- Framer Motion for smooth transitions
- Hover effects: Scale, glow, lift
- Loading states: Pulse, shimmer
- Number counters: Animated increments
- Streak celebrations: Confetti/particle effects

**Glassmorphism:**
- backdrop-filter: blur(16px)
- Semi-transparent backgrounds (10-20% opacity)
- Gradient borders for definition
- Layered depth with shadows

## Images

**Splash Screen:**
- XNRT logo centered
- Tagline: "We Build the NextGen - A project of NextGen Rise Foundation"
- Cosmic animated background
- Smooth transition to auth screens

**Dashboard:**
- No large hero images (focus on data and balances)
- Icon-based visual hierarchy
- Gradient backgrounds instead of photos
- Achievement badges and tier icons

**Staking Tiers:**
- Tier-specific gradient cards (no photos)
- Gem/crystal icons for each tier (Royal Sapphire, Legendary Emerald, Imperial Platinum, Mythic Diamond)
- Animated glow effects on hover

## Responsive Design

**Breakpoints:**
- Mobile: Base (single column, bottom nav)
- Tablet: md (2-column grids, drawer sidebar)
- Desktop: lg+ (full sidebar, 3-4 column grids)

**Mobile Optimizations:**
- Touch-friendly tap targets (min 44px)
- Swipe gestures for navigation
- Pull-to-refresh functionality
- Native-like transitions
- Sticky headers for context

## Accessibility

**Contrast:**
- Maintain WCAG AA standards despite dark theme
- Neon colors on dark backgrounds for high contrast
- Important text: Light foreground on dark background

**Focus States:**
- Visible focus rings with neon blue
- Keyboard navigation support
- Screen reader friendly labels

## Quality Standards

- Pixel-perfect alignment using Tailwind spacing
- Consistent card shadows and glows
- Smooth 60fps animations
- Loading skeletons for all async content
- Error states with helpful messaging
- Empty states with actionable CTAs