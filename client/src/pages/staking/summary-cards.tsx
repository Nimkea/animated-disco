import { Gift, LockKeyhole, TrendingUp, Wallet } from "lucide-react";
import type { StakingSummary } from "./types";
import { formatXnrt, StakingStatCard } from "./utils";

export function StakingSummaryCards({ summary }: { summary?: StakingSummary }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StakingStatCard
        title="Available Balance"
        value={`${formatXnrt(summary?.balance.available)} XNRT`}
        subtitle="Ready to stake or withdraw"
        icon={Wallet}
      />
      <StakingStatCard
        title="Staking Balance"
        value={`${formatXnrt(summary?.balance.staking)} XNRT`}
        subtitle="Locked principal + accrued rewards"
        icon={LockKeyhole}
      />
      <StakingStatCard
        title="Accrued Rewards"
        value={`${formatXnrt(summary?.totals.accruedProfit)} XNRT`}
        subtitle="Open stake profit tracked"
        icon={Gift}
      />
      <StakingStatCard
        title="Projected Profit"
        value={`${formatXnrt(summary?.totals.projectedProfit)} XNRT`}
        subtitle="If open stakes mature fully"
        icon={TrendingUp}
      />
    </div>
  );
}
