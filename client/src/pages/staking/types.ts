import type { StakingTier } from "@shared/schema";

export type StakeStatus = "active" | "completed" | "withdrawn";

export type Stake = {
  id: string;
  tier: string;
  amount: string;
  dailyRate: string;
  duration: number;
  startDate: string;
  endDate: string;
  totalProfit: string;
  status: StakeStatus | string;
  loanProgram?: string | null;
  progressPercent?: number;
  daysLeft?: number;
  isMatured?: boolean;
  canWithdraw?: boolean;
  isLoan?: boolean;
  dailyProfit?: string;
  projectedProfit?: string;
  withdrawablePrincipal?: string;
  withdrawableAmount?: string;
};

export type TierSummary = {
  key: string;
  name: string;
  duration: number;
  minAmount: number;
  maxAmount: number;
  dailyRate: number;
  apy: number;
  estimatedTotalProfitAtMin?: number;
  riskLabel?: string;
};

export type StakingSummary = {
  balance: {
    available: string;
    staking: string;
    totalEarned: string;
  };
  totals: {
    activeCount: number;
    completedCount: number;
    withdrawnCount: number;
    activePrincipal: string;
    accruedProfit: string;
    projectedProfit: string;
    withdrawableAmount: string;
    nextMaturityAt: string | null;
  };
  trustLoan: {
    directCount: number;
    investingCount: number;
    requiredReferrals: number;
    requiredInvestingReferrals: number;
    amountXnrt: number;
    durationDays: number;
    eligible: boolean;
  };
  tiers: TierSummary[];
  stakes: Stake[];
  disclaimer: string;
};

export type TrustLoanStatus = {
  hasLoanStake: boolean;
  directCount: number;
  investingCount: number;
  requiredReferrals: number;
  requiredInvestingReferrals: number;
  amountXnrt: number;
  durationDays: number;
  eligible?: boolean;
  stake?: Stake | null;
};

export type StakingFormState = {
  selectedTier: StakingTier;
  amount: string;
};
