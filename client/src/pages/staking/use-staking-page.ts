import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { STAKING_TIERS, type StakingTier } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Stake, StakingSummary } from "./types";
import { formatXnrt, toNumber } from "./utils";

function invalidateStakingQueries() {
  queryClient.invalidateQueries({ queryKey: ["/api/stakes/summary"] });
  queryClient.invalidateQueries({ queryKey: ["/api/stakes"] });
  queryClient.invalidateQueries({ queryKey: ["/api/balance"] });
  queryClient.invalidateQueries({ queryKey: ["/api/wallet/summary"] });
  queryClient.invalidateQueries({ queryKey: ["/api/home/summary"] });
  queryClient.invalidateQueries({ queryKey: ["/api/profile/summary"] });
}

export function useStakingPage() {
  const { toast } = useToast();
  const [selectedTier, setSelectedTier] = useState<StakingTier>("mythic_diamond");
  const [amount, setAmount] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [historyFilter, setHistoryFilter] = useState("all");
  const [stakeToWithdraw, setStakeToWithdraw] = useState<Stake | null>(null);

  const { data: summary, isLoading } = useQuery<StakingSummary>({
    queryKey: ["/api/stakes/summary"],
  });


  const processRewardsMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/stakes/process-rewards", {}),
    onSuccess: async (response) => {
      const result = await response.json().catch(() => null);
      invalidateStakingQueries();
      toast({
        title: "Rewards refreshed",
        description:
          result?.totalProfitCredited > 0
            ? `${formatXnrt(result.totalProfitCredited)} XNRT staking rewards credited.`
            : "No new staking rewards were due yet.",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to refresh rewards", variant: "destructive" });
    },
  });

  useEffect(() => {
    processRewardsMutation.mutate();
    // Run once when opening the staking page to settle due rewards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createStakeMutation = useMutation({
    mutationFn: async (data: { tier: StakingTier; amount: string }) => apiRequest("POST", "/api/stakes", data),
    onSuccess: () => {
      invalidateStakingQueries();
      setShowCreateDialog(false);
      setAmount("");
      toast({ title: "Stake created", description: "Your XNRT is now locked in the selected staking tier." });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "Please log in again.", variant: "destructive" });
        setTimeout(() => (window.location.href = "/auth"), 500);
        return;
      }
      toast({ title: "Error", description: error.message || "Failed to create stake", variant: "destructive" });
    },
  });

  const withdrawStakeMutation = useMutation({
    mutationFn: async (stakeId: string) => apiRequest("POST", `/api/stakes/${stakeId}/withdraw`, {}),
    onSuccess: async (response) => {
      const result = await response.json().catch(() => null);
      invalidateStakingQueries();
      setStakeToWithdraw(null);
      toast({
        title: "Stake withdrawn",
        description: `${formatXnrt(result?.totalAmount ?? 0)} XNRT moved to available balance.`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to withdraw stake", variant: "destructive" });
    },
  });


  const selectedTierConfig = STAKING_TIERS[selectedTier];
  const enteredAmount = toNumber(amount);
  const dailyProfit = enteredAmount > 0 ? (enteredAmount * selectedTierConfig.dailyRate) / 100 : 0;
  const projectedProfit = dailyProfit * selectedTierConfig.duration;
  const availableBalance = toNumber(summary?.balance.available);
  const canCreateStake =
    enteredAmount >= selectedTierConfig.minAmount &&
    enteredAmount <= selectedTierConfig.maxAmount &&
    enteredAmount <= availableBalance;

  const activeStakes = useMemo(
    () => summary?.stakes.filter((stake) => stake.status === "active" || stake.status === "completed") ?? [],
    [summary?.stakes]
  );

  const historyStakes = useMemo(() => {
    const withdrawn = summary?.stakes.filter((stake) => stake.status === "withdrawn") ?? [];
    if (historyFilter === "all") return withdrawn;
    return withdrawn.filter((stake) => stake.tier === historyFilter);
  }, [summary?.stakes, historyFilter]);


  return {
    summary,
    isLoading,
    selectedTier,
    setSelectedTier,
    amount,
    setAmount,
    showCreateDialog,
    setShowCreateDialog,
    historyFilter,
    setHistoryFilter,
    stakeToWithdraw,
    setStakeToWithdraw,
    activeStakes,
    historyStakes,
    dailyProfit,
    projectedProfit,
    canCreateStake,
    processRewardsMutation,
    createStakeMutation,
    withdrawStakeMutation,
  };
}
