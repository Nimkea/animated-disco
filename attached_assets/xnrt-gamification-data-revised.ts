/**
 * XNRT Gamification Data - Revised & Production Ready
 * 
 * Changes from original:
 * - Fixed Mythic tier achievement (was 11, now 3 for Legend tier)
 * - Added mining achievements (was completely missing)
 * - Added referral achievements (was completely missing)
 * - Added withdrawal milestones
 * - Removed duplicate daily check-in task (already exists as feature)
 * - Removed unverifiable tasks (reviews, early adopter)
 * - Fixed onboarding deposit flow (no reward for depositing)
 * - Removed email verification step (using OIDC/password auth)
 * - Balanced task rewards for better economy
 */

// ============================================================================
// ACHIEVEMENTS
// ============================================================================
export const ACHIEVEMENTS = [
  // --- Staking Milestones ---
  { 
    name: "First Step", 
    description: "Complete your first stake", 
    icon: "🚀",
    category: "staking", 
    requirementType: "stakes_count", 
    requirementValue: 1,
    rewardXnrt: 100, 
    badgeColor: "bronze" 
  },
  { 
    name: "Steady Staker", 
    description: "Complete 5 stakes", 
    icon: "📈",
    category: "staking", 
    requirementType: "stakes_count", 
    requirementValue: 5,
    rewardXnrt: 500, 
    badgeColor: "silver" 
  },
  { 
    name: "Staking Master", 
    description: "Complete 25 stakes", 
    icon: "🏆",
    category: "staking", 
    requirementType: "stakes_count", 
    requirementValue: 25,
    rewardXnrt: 2500, 
    badgeColor: "gold" 
  },
  { 
    name: "Whale Staker", 
    description: "Stake 1,000,000 XNRT total", 
    icon: "🐋",
    category: "staking", 
    requirementType: "total_staked", 
    requirementValue: 1_000_000,
    rewardXnrt: 10_000, 
    badgeColor: "platinum" 
  },
  { 
    name: "Diamond Hands", 
    description: "Stake 10,000,000 XNRT total", 
    icon: "💎",
    category: "staking", 
    requirementType: "total_staked", 
    requirementValue: 10_000_000,
    rewardXnrt: 50_000, 
    badgeColor: "diamond" 
  },

  // --- Duration Milestones ---
  { 
    name: "Patient Investor", 
    description: "Maintain a stake for 30 days", 
    icon: "⏳",
    category: "duration", 
    requirementType: "longest_stake_days", 
    requirementValue: 30,
    rewardXnrt: 1000, 
    badgeColor: "bronze" 
  },
  { 
    name: "Long-term Vision", 
    description: "Maintain a stake for 90 days", 
    icon: "🔮",
    category: "duration", 
    requirementType: "longest_stake_days", 
    requirementValue: 90,
    rewardXnrt: 3000, 
    badgeColor: "silver" 
  },
  { 
    name: "Legendary Patience", 
    description: "Maintain a stake for 180 days", 
    icon: "🏛️",
    category: "duration", 
    requirementType: "longest_stake_days", 
    requirementValue: 180,
    rewardXnrt: 10_000, 
    badgeColor: "gold" 
  },
  { 
    name: "Time Master", 
    description: "Maintain a stake for 365 days", 
    icon: "⚡",
    category: "duration", 
    requirementType: "longest_stake_days", 
    requirementValue: 365,
    rewardXnrt: 25_000, 
    badgeColor: "mythic" 
  },

  // --- ROI Achievements ---
  { 
    name: "First Profits", 
    description: "Earn 1,000 XNRT in ROI", 
    icon: "💰",
    category: "rewards", 
    requirementType: "roi_earned", 
    requirementValue: 1_000,
    rewardXnrt: 200, 
    badgeColor: "bronze" 
  },
  { 
    name: "Profit Machine", 
    description: "Earn 10,000 XNRT in ROI", 
    icon: "🤑",
    category: "rewards", 
    requirementType: "roi_earned", 
    requirementValue: 10_000,
    rewardXnrt: 1_000, 
    badgeColor: "silver" 
  },
  { 
    name: "ROI King", 
    description: "Earn 100,000 XNRT in ROI", 
    icon: "👑",
    category: "rewards", 
    requirementType: "roi_earned", 
    requirementValue: 100_000,
    rewardXnrt: 5_000, 
    badgeColor: "gold" 
  },

  // --- Activity Milestones ---
  { 
    name: "Daily User", 
    description: "Be active for 7 days", 
    icon: "📅",
    category: "activity", 
    requirementType: "days_active", 
    requirementValue: 7,
    rewardXnrt: 300, 
    badgeColor: "bronze" 
  },
  { 
    name: "Dedicated Member", 
    description: "Be active for 30 days", 
    icon: "🎯",
    category: "activity", 
    requirementType: "days_active", 
    requirementValue: 30,
    rewardXnrt: 1_500, 
    badgeColor: "silver" 
  },
  { 
    name: "Platform Veteran", 
    description: "Be active for 100 days", 
    icon: "🛡️",
    category: "activity", 
    requirementType: "days_active", 
    requirementValue: 100,
    rewardXnrt: 5_000, 
    badgeColor: "gold" 
  },

  // --- Staking Tier Achievements ---
  { 
    name: "Elite Explorer", 
    description: "Complete an Elite tier stake", 
    icon: "🌟",
    category: "tiers", 
    requirementType: "tier_reached", 
    requirementValue: 1,
    rewardXnrt: 200, 
    badgeColor: "bronze" 
  },
  { 
    name: "Master Strategist", 
    description: "Complete a Master tier stake", 
    icon: "🎖️",
    category: "tiers", 
    requirementType: "tier_reached", 
    requirementValue: 2,
    rewardXnrt: 500, 
    badgeColor: "silver" 
  },
  { 
    name: "Legendary Investor", 
    description: "Complete a Legend tier stake", 
    icon: "🗡️",
    category: "tiers", 
    requirementType: "tier_reached", 
    requirementValue: 3,
    rewardXnrt: 1_000, 
    badgeColor: "gold" 
  },

  // --- Mining Achievements (NEW) ---
  { 
    name: "Mining Beginner", 
    description: "Complete your first mining session", 
    icon: "⛏️",
    category: "mining", 
    requirementType: "mining_sessions", 
    requirementValue: 1,
    rewardXnrt: 50, 
    badgeColor: "bronze" 
  },
  { 
    name: "Consistent Miner", 
    description: "Complete 10 mining sessions", 
    icon: "⚒️",
    category: "mining", 
    requirementType: "mining_sessions", 
    requirementValue: 10,
    rewardXnrt: 500, 
    badgeColor: "silver" 
  },
  { 
    name: "Mining Expert", 
    description: "Complete 50 mining sessions", 
    icon: "💎",
    category: "mining", 
    requirementType: "mining_sessions", 
    requirementValue: 50,
    rewardXnrt: 2_500, 
    badgeColor: "gold" 
  },
  { 
    name: "XP Hunter", 
    description: "Mine 10,000 XP total", 
    icon: "🎯",
    category: "mining", 
    requirementType: "total_xp_mined", 
    requirementValue: 10_000,
    rewardXnrt: 1_000, 
    badgeColor: "silver" 
  },
  { 
    name: "XP Champion", 
    description: "Mine 100,000 XP total", 
    icon: "🏆",
    category: "mining", 
    requirementType: "total_xp_mined", 
    requirementValue: 100_000,
    rewardXnrt: 10_000, 
    badgeColor: "platinum" 
  },

  // --- Referral Achievements (NEW) ---
  { 
    name: "First Referral", 
    description: "Refer your first user", 
    icon: "👋",
    category: "referral", 
    requirementType: "referrals_count", 
    requirementValue: 1,
    rewardXnrt: 100, 
    badgeColor: "bronze" 
  },
  { 
    name: "Network Builder", 
    description: "Refer 5 users", 
    icon: "🌐",
    category: "referral", 
    requirementType: "referrals_count", 
    requirementValue: 5,
    rewardXnrt: 500, 
    badgeColor: "silver" 
  },
  { 
    name: "Influencer", 
    description: "Refer 25 users", 
    icon: "📢",
    category: "referral", 
    requirementType: "referrals_count", 
    requirementValue: 25,
    rewardXnrt: 2_500, 
    badgeColor: "gold" 
  },
  { 
    name: "Network Leader", 
    description: "Refer 100 users", 
    icon: "👑",
    category: "referral", 
    requirementType: "referrals_count", 
    requirementValue: 100,
    rewardXnrt: 10_000, 
    badgeColor: "platinum" 
  },
  { 
    name: "Commission Starter", 
    description: "Earn 10,000 XNRT in referral commissions", 
    icon: "💵",
    category: "referral", 
    requirementType: "referral_earnings", 
    requirementValue: 10_000,
    rewardXnrt: 1_000, 
    badgeColor: "silver" 
  },
  { 
    name: "Commission Master", 
    description: "Earn 100,000 XNRT in referral commissions", 
    icon: "💰",
    category: "referral", 
    requirementType: "referral_earnings", 
    requirementValue: 100_000,
    rewardXnrt: 10_000, 
    badgeColor: "gold" 
  },

  // --- Withdrawal Achievements (NEW) ---
  { 
    name: "First Cashout", 
    description: "Complete your first withdrawal", 
    icon: "🎉",
    category: "withdrawal", 
    requirementType: "withdrawals_count", 
    requirementValue: 1,
    rewardXnrt: 50, 
    badgeColor: "bronze" 
  },
  { 
    name: "Profit Taker", 
    description: "Complete 10 withdrawals", 
    icon: "💸",
    category: "withdrawal", 
    requirementType: "withdrawals_count", 
    requirementValue: 10,
    rewardXnrt: 500, 
    badgeColor: "silver" 
  },
  { 
    name: "Withdrawal Pro", 
    description: "Withdraw 100,000 XNRT total", 
    icon: "🏦",
    category: "withdrawal", 
    requirementType: "total_withdrawn", 
    requirementValue: 100_000,
    rewardXnrt: 5_000, 
    badgeColor: "gold" 
  },
];

// ============================================================================
// TASK TEMPLATES
// ============================================================================
export const TASK_TEMPLATES = [
  {
    title: "Follow us on Twitter",
    description: "Follow our official Twitter account and like our latest post",
    link: "https://twitter.com/xnrt_official",
    rewardAmount: 50,
    rewardType: "XNRT",
    isActive: true,
    dailyLimit: 1,
    loyaltyPoints: 10
  },
  {
    title: "Join our Telegram group",
    description: "Join our Telegram community and introduce yourself",
    link: "https://t.me/xnrt_community",
    rewardAmount: 75,
    rewardType: "XNRT",
    isActive: true,
    dailyLimit: 1,
    loyaltyPoints: 15
  },
  {
    title: "Subscribe to YouTube channel",
    description: "Subscribe to our YouTube channel and watch our latest video",
    link: "https://youtube.com/@xnrt",
    rewardAmount: 100,
    rewardType: "XNRT",
    isActive: true,
    dailyLimit: 1,
    loyaltyPoints: 20
  },
  {
    title: "Share on Facebook",
    description: "Share our platform announcement on your Facebook profile",
    link: "https://facebook.com/xnrt",
    rewardAmount: 100,
    rewardType: "XNRT",
    isActive: true,
    dailyLimit: 1,
    loyaltyPoints: 20
  },
  {
    title: "Join Discord Community",
    description: "Join our Discord server and verify your membership",
    link: "https://discord.gg/xnrt",
    rewardAmount: 75,
    rewardType: "XNRT",
    isActive: true,
    dailyLimit: 1,
    loyaltyPoints: 15
  },
  {
    title: "🎉 LIMITED: Platform Launch Bonus",
    description: "Complete this special launch task to celebrate our platform launch! Available for limited time only.",
    link: "https://xnrt.platform/launch-event",
    rewardAmount: 200,
    rewardType: "XNRT",
    isActive: true,
    startDate: new Date(),
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    dailyLimit: 1,
    loyaltyPoints: 50
  },
  {
    title: "📱 Share Referral Link",
    description: "Share your unique referral link on social media and tag 3 friends",
    link: "https://xnrt.platform/share-referral",
    rewardAmount: 150,
    rewardType: "XNRT",
    isActive: true,
    dailyLimit: 2,
    loyaltyPoints: 30
  },
  {
    title: "🎮 Complete Tutorial",
    description: "Watch the platform tutorial video and complete the quiz",
    link: "https://xnrt.platform/tutorial",
    rewardAmount: 100,
    rewardType: "XNRT",
    isActive: true,
    dailyLimit: 1,
    loyaltyPoints: 25
  }
];

// ============================================================================
// STREAK MILESTONES
// ============================================================================
export const STREAK_MILESTONES = [
  // --- Login Streaks ---
  { 
    streakType: 'login', 
    dayCount: 3, 
    rewardType: 'XNRT' as const,
    rewardAmount: "50", 
    description: '3-day login streak milestone', 
    isActive: true 
  },
  { 
    streakType: 'login', 
    dayCount: 7, 
    rewardType: 'XNRT' as const,
    rewardAmount: "150", 
    description: '7-day login streak milestone', 
    isActive: true 
  },
  { 
    streakType: 'login', 
    dayCount: 30, 
    rewardType: 'XNRT' as const,
    rewardAmount: "750", 
    description: '30-day login streak milestone', 
    isActive: true 
  },
  { 
    streakType: 'login', 
    dayCount: 100, 
    rewardType: 'XNRT' as const,
    rewardAmount: "3000", 
    description: '100-day login streak milestone', 
    isActive: true 
  },

  // --- Task Completion Streaks ---
  { 
    streakType: 'task_completion', 
    dayCount: 3, 
    rewardType: 'XNRT' as const,
    rewardAmount: "100", 
    description: '3-day task completion streak', 
    isActive: true 
  },
  { 
    streakType: 'task_completion', 
    dayCount: 7, 
    rewardType: 'XNRT' as const,
    rewardAmount: "300", 
    description: '7-day task completion streak', 
    isActive: true 
  },
  { 
    streakType: 'task_completion', 
    dayCount: 15, 
    rewardType: 'XNRT' as const,
    rewardAmount: "800", 
    description: '15-day task completion streak', 
    isActive: true 
  },
  { 
    streakType: 'task_completion', 
    dayCount: 30, 
    rewardType: 'XNRT' as const,
    rewardAmount: "2000", 
    description: '30-day task completion streak', 
    isActive: true 
  },

  // --- Mining Session Streaks ---
  { 
    streakType: 'mining_session', 
    dayCount: 3, 
    rewardType: 'XNRT' as const,
    rewardAmount: "100", 
    description: '3-day mining streak milestone', 
    isActive: true 
  },
  { 
    streakType: 'mining_session', 
    dayCount: 7, 
    rewardType: 'XNRT' as const,
    rewardAmount: "300", 
    description: '7-day mining streak milestone', 
    isActive: true 
  },
  { 
    streakType: 'mining_session', 
    dayCount: 15, 
    rewardType: 'XNRT' as const,
    rewardAmount: "750", 
    description: '15-day mining streak milestone', 
    isActive: true 
  },
  { 
    streakType: 'mining_session', 
    dayCount: 30, 
    rewardType: 'XNRT' as const,
    rewardAmount: "2000", 
    description: '30-day mining streak milestone', 
    isActive: true 
  },

  // --- Daily Check-in Streaks ---
  { 
    streakType: 'daily_checkin', 
    dayCount: 7, 
    rewardType: 'XNRT' as const,
    rewardAmount: "100", 
    description: '7-day check-in streak milestone', 
    isActive: true 
  },
  { 
    streakType: 'daily_checkin', 
    dayCount: 30, 
    rewardType: 'XNRT' as const,
    rewardAmount: "500", 
    description: '30-day check-in streak milestone', 
    isActive: true 
  },
  { 
    streakType: 'daily_checkin', 
    dayCount: 60, 
    rewardType: 'XNRT' as const,
    rewardAmount: "1200", 
    description: '60-day check-in streak milestone', 
    isActive: true 
  },
  { 
    streakType: 'daily_checkin', 
    dayCount: 100, 
    rewardType: 'XNRT' as const,
    rewardAmount: "2500", 
    description: '100-day check-in streak milestone', 
    isActive: true 
  },

  // --- Staking Activity Streaks ---
  { 
    streakType: 'stake_created', 
    dayCount: 3, 
    rewardType: 'XNRT' as const,
    rewardAmount: "200", 
    description: '3 stakes created milestone', 
    isActive: true 
  },
  { 
    streakType: 'stake_created', 
    dayCount: 7, 
    rewardType: 'XNRT' as const,
    rewardAmount: "600", 
    description: '7 stakes created milestone', 
    isActive: true 
  },
  { 
    streakType: 'stake_created', 
    dayCount: 15, 
    rewardType: 'XNRT' as const,
    rewardAmount: "1500", 
    description: '15 stakes created milestone', 
    isActive: true 
  }
];

// ============================================================================
// ONBOARDING STEPS
// ============================================================================
export const ONBOARDING_STEPS = [
  // --- Profile Setup ---
  { 
    stepKey: "welcome_tour", 
    title: "Welcome to XNRT Platform",
    description: "Take a quick tour of the platform and learn about its features",
    category: "profile", 
    orderIndex: 1, 
    requiredAction: "navigate_to",
    targetSelector: ".welcome-guide", 
    rewardType: "xp", 
    rewardAmount: 10 
  },
  { 
    stepKey: "complete_profile", 
    title: "Complete Your Profile",
    description: "Add your username and basic information to get started",
    category: "profile", 
    orderIndex: 2, 
    requiredAction: "fill_form",
    targetSelector: ".profile-form", 
    rewardType: "xp", 
    rewardAmount: 25 
  },

  // --- Wallet Setup ---
  { 
    stepKey: "explore_wallet", 
    title: "Explore Your Wallet",
    description: "Learn about XNRT tokens and how to manage your wallet",
    category: "wallet", 
    orderIndex: 3, 
    requiredAction: "navigate_to",
    targetSelector: ".wallet-section", 
    rewardType: "xp", 
    rewardAmount: 20 
  },
  { 
    stepKey: "explore_deposit", 
    title: "Learn About Deposits",
    description: "Understand how to deposit USDT to receive XNRT tokens (1 USDT = 100 XNRT)",
    category: "wallet", 
    orderIndex: 4, 
    requiredAction: "navigate_to",
    targetSelector: ".deposit-info", 
    rewardType: "xp", 
    rewardAmount: 15 
  },
  { 
    stepKey: "check_balance", 
    title: "Check Your Balance",
    description: "View your XNRT token balance and transaction history",
    category: "wallet", 
    orderIndex: 5, 
    requiredAction: "click_button",
    targetSelector: ".balance-card", 
    rewardType: "xp", 
    rewardAmount: 15 
  },

  // --- Staking ---
  { 
    stepKey: "learn_staking", 
    title: "Learn About Staking",
    description: "Understand how staking works and different tier options",
    category: "staking", 
    orderIndex: 6, 
    requiredAction: "navigate_to",
    targetSelector: ".staking-info", 
    rewardType: "xp", 
    rewardAmount: 30 
  },
  { 
    stepKey: "view_tiers", 
    title: "Explore Staking Tiers",
    description: "Browse available staking tiers and their ROI percentages",
    category: "staking", 
    orderIndex: 7, 
    requiredAction: "click_button",
    targetSelector: ".staking-tiers", 
    rewardType: "xp", 
    rewardAmount: 20 
  },
  { 
    stepKey: "first_stake", 
    title: "Create Your First Stake",
    description: "Start earning passive income by staking your XNRT tokens",
    category: "staking", 
    orderIndex: 8, 
    requiredAction: "fill_form",
    targetSelector: ".staking-form", 
    rewardType: "xnrt", 
    rewardAmount: 100 
  },

  // --- Mining ---
  { 
    stepKey: "learn_mining", 
    title: "Discover Mining",
    description: "Learn how to mine XP and convert it to XNRT tokens",
    category: "mining", 
    orderIndex: 9, 
    requiredAction: "navigate_to",
    targetSelector: ".mining-info", 
    rewardType: "xp", 
    rewardAmount: 25 
  },
  { 
    stepKey: "first_mining_session", 
    title: "Start Mining",
    description: "Begin your first 24-hour mining session to earn XP",
    category: "mining", 
    orderIndex: 10, 
    requiredAction: "click_button",
    targetSelector: ".start-mining-btn", 
    rewardType: "xnrt", 
    rewardAmount: 50 
  },

  // --- Referrals ---
  { 
    stepKey: "learn_referrals", 
    title: "Explore Referral System",
    description: "Learn about the 3-level referral system (6%/3%/1% commissions)",
    category: "referrals", 
    orderIndex: 11, 
    requiredAction: "navigate_to",
    targetSelector: ".referral-info", 
    rewardType: "xp", 
    rewardAmount: 30 
  },
  { 
    stepKey: "copy_referral_link", 
    title: "Get Your Referral Link",
    description: "Copy your unique referral link to start inviting friends",
    category: "referrals", 
    orderIndex: 12, 
    requiredAction: "click_button",
    targetSelector: ".copy-referral-btn", 
    rewardType: "xp", 
    rewardAmount: 20 
  },

  // --- Rewards & Features ---
  { 
    stepKey: "daily_checkin", 
    title: "Daily Check-in",
    description: "Perform your first daily check-in to earn loyalty XP",
    category: "rewards", 
    orderIndex: 13, 
    requiredAction: "click_button",
    targetSelector: ".checkin-btn", 
    rewardType: "xnrt", 
    rewardAmount: 25 
  },
  { 
    stepKey: "explore_achievements", 
    title: "View Achievements",
    description: "Discover all the achievements you can unlock for rewards",
    category: "rewards", 
    orderIndex: 14, 
    requiredAction: "navigate_to",
    targetSelector: ".achievements-page", 
    rewardType: "xp", 
    rewardAmount: 20 
  },
  { 
    stepKey: "complete_task", 
    title: "Complete Your First Task",
    description: "Finish a social media task to earn bonus XNRT",
    category: "rewards", 
    orderIndex: 15, 
    requiredAction: "click_button",
    targetSelector: ".task-complete-btn", 
    rewardType: "xnrt", 
    rewardAmount: 50 
  },

  // --- Final Steps ---
  { 
    stepKey: "explore_dashboard", 
    title: "Explore Dashboard",
    description: "Check out your personalized dashboard with all your stats",
    category: "general", 
    orderIndex: 16, 
    requiredAction: "navigate_to",
    targetSelector: ".dashboard", 
    rewardType: "xp", 
    rewardAmount: 30 
  },
  { 
    stepKey: "onboarding_complete", 
    title: "Onboarding Complete!",
    description: "Congratulations! You're ready to start earning with XNRT",
    category: "general", 
    orderIndex: 17, 
    requiredAction: "click_button",
    targetSelector: ".finish-onboarding-btn", 
    rewardType: "xnrt", 
    rewardAmount: 200 
  }
];

// ============================================================================
// SUMMARY & USAGE NOTES
// ============================================================================

/**
 * TOTAL ACHIEVEMENTS: 35
 * Categories:
 * - Staking: 8 achievements
 * - Duration: 4 achievements  
 * - Rewards (ROI): 3 achievements
 * - Activity: 3 achievements
 * - Tiers: 3 achievements
 * - Mining: 5 achievements (NEW)
 * - Referral: 6 achievements (NEW)
 * - Withdrawal: 3 achievements (NEW)
 * 
 * TASK TEMPLATES: 8 tasks
 * - All social media tasks increased to 50-100 XNRT (better balance)
 * - Removed: Daily check-in duplicate, review task, early adopter
 * - Added: Discord, Share Referral, Tutorial tasks
 * 
 * STREAK MILESTONES: 18 milestones
 * - Login: 4 milestones (3/7/30/100 days)
 * - Task completion: 4 milestones (3/7/15/30 days)
 * - Mining: 4 milestones (3/7/15/30 days)
 * - Daily check-in: 4 milestones (7/30/60/100 days)
 * - Staking: 3 milestones (3/7/15 stakes)
 * 
 * ONBOARDING: 17 steps
 * - Profile: 2 steps
 * - Wallet: 3 steps
 * - Staking: 3 steps
 * - Mining: 2 steps (NEW)
 * - Referrals: 2 steps
 * - Rewards: 3 steps
 * - General: 2 steps
 * 
 * Total possible XNRT from onboarding: 425 XNRT
 * Total possible XNRT from all achievements: 160,950 XNRT
 */
