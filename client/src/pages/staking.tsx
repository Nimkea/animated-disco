import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { StakingHero } from "./staking/staking-hero";
import { StakingRiskNotice } from "./staking/risk-notice";
import { StakingSummaryCards } from "./staking/summary-cards";
import { StakingTierGrid } from "./staking/tier-grid";
import { StakingPositionsTab } from "./staking/positions-tab";
import { StakingHistoryTab } from "./staking/history-tab";
import { TrustLoanPanel } from "./staking/trust-loan-panel";
import { CreateStakeDialog } from "./staking/create-stake-dialog";
import { useStakingPage } from "./staking/use-staking-page";
import { buildTierSummaries, formatXnrt } from "./staking/utils";

export default function Staking() {
  const staking = useStakingPage();

  if (staking.isLoading) {
    return (
      <div className="container mx-auto space-y-6 p-4 md:p-6">
        <Skeleton className="h-48 w-full rounded-3xl" />
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 p-4 md:p-6" data-testid="staking-page">
      <StakingHero
        summary={staking.summary}
        isRefreshing={staking.processRewardsMutation.isPending}
        onCreateStake={() => staking.setShowCreateDialog(true)}
        onRefreshRewards={() => staking.processRewardsMutation.mutate()}
      />

      <StakingRiskNotice disclaimer={staking.summary?.disclaimer} />
      <StakingSummaryCards summary={staking.summary} />

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="positions">Positions</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="trust-loan">Trust Loan</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <StakingTierGrid
            tiers={buildTierSummaries(staking.summary?.tiers)}
            selectedTier={staking.selectedTier}
            onSelectTier={(tier) => {
              staking.setSelectedTier(tier);
              staking.setShowCreateDialog(true);
            }}
          />
        </TabsContent>

        <TabsContent value="positions" className="space-y-4">
          <StakingPositionsTab
            stakes={staking.activeStakes}
            isWithdrawing={staking.withdrawStakeMutation.isPending}
            onCreateStake={() => staking.setShowCreateDialog(true)}
            onWithdraw={staking.setStakeToWithdraw}
          />
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <StakingHistoryTab
            stakes={staking.historyStakes}
            historyFilter={staking.historyFilter}
            onHistoryFilterChange={staking.setHistoryFilter}
          />
        </TabsContent>

        <TabsContent value="trust-loan" className="space-y-4">
          <TrustLoanPanel
            summary={staking.summary}
            trustLoanStatus={staking.trustLoanStatus}
            trustDirectProgress={staking.trustDirectProgress}
            trustInvestorProgress={staking.trustInvestorProgress}
            canClaimTrustLoan={staking.canClaimTrustLoan}
            isClaiming={staking.claimTrustLoanMutation.isPending}
            onClaim={() => staking.claimTrustLoanMutation.mutate()}
          />
        </TabsContent>
      </Tabs>

      <CreateStakeDialog
        open={staking.showCreateDialog}
        onOpenChange={staking.setShowCreateDialog}
        selectedTier={staking.selectedTier}
        onSelectedTierChange={staking.setSelectedTier}
        amount={staking.amount}
        onAmountChange={staking.setAmount}
        availableBalance={staking.summary?.balance.available}
        dailyProfit={staking.dailyProfit}
        projectedProfit={staking.projectedProfit}
        canCreateStake={staking.canCreateStake}
        isCreating={staking.createStakeMutation.isPending}
        onCreate={() => staking.createStakeMutation.mutate({ tier: staking.selectedTier, amount: staking.amount })}
      />

      <ConfirmDialog
        open={Boolean(staking.stakeToWithdraw)}
        onOpenChange={(open) => !open && staking.setStakeToWithdraw(null)}
        onConfirm={() => staking.stakeToWithdraw && staking.withdrawStakeMutation.mutate(staking.stakeToWithdraw.id)}
        title="Withdraw matured stake"
        description={
          staking.stakeToWithdraw
            ? `This will move ${formatXnrt(staking.stakeToWithdraw.withdrawableAmount)} XNRT to your available balance. ${staking.stakeToWithdraw.isLoan ? "Trust Loan virtual principal is not withdrawable." : "Principal and accrued profit will be unlocked."}`
            : "Withdraw this stake?"
        }
        confirmText="Withdraw"
      />
    </div>
  );
}
