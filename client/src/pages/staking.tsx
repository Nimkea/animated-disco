import { useEffect, useMemo, useState, type ComponentType } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  Clock,
  Coins,
  Gift,
  History,
  Info,
  LockKeyhole,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Unlock,
  Users,
  Wallet,
} from "lucide-react";
import { STAKING_TIERS, type StakingTier } from "@shared/schema";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";

type StakeStatus = "active" | "completed" | "withdrawn";

type Stake = {
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

type TierSummary = {
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

type StakingSummary = {
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

type TrustLoanStatus = {
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

const tierIcons: Record<string, string> = {
  royal_sapphire: "💎",
  legendary_emerald: "🟢",
  imperial_platinum: "⚪",
  mythic_diamond: "💠",
  trust_loan: "🤝",
};

const tierAccent: Record<string, string> = {
  royal_sapphire: "from-blue-500/20 to-cyan-500/10 border-blue-500/25",
  legendary_emerald: "from-emerald-500/20 to-green-500/10 border-emerald-500/25",
  imperial_platinum: "from-slate-400/20 to-zinc-500/10 border-slate-400/25",
  mythic_diamond: "from-purple-500/20 to-pink-500/10 border-purple-500/25",
  trust_loan: "from-amber-500/20 to-orange-500/10 border-amber-500/25",
};

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatXnrt(value: unknown, decimals = 2) {
  return toNumber(value).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getTierName(tier: string) {
  if (tier === "trust_loan") return "Trust Loan";
  const config = STAKING_TIERS[tier as StakingTier];
  if (config) return config.name;
  return tier
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getTierConfig(tier: string) {
  return STAKING_TIERS[tier as StakingTier] ?? null;
}

function getStatusBadge(stake: Stake) {
  if (stake.status === "withdrawn") return <Badge variant="secondary">Withdrawn</Badge>;
  if (stake.canWithdraw || stake.status === "completed") return <Badge className="bg-emerald-500/15 text-emerald-600">Matured</Badge>;
  if (stake.isLoan) return <Badge className="bg-amber-500/15 text-amber-600">Trust Loan</Badge>;
  return <Badge className="bg-blue-500/15 text-blue-600">Active</Badge>;
}

function Countdown({ endDate }: { endDate: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const diff = Math.max(0, new Date(endDate).getTime() - now);
  if (diff <= 0) return <span className="font-semibold text-emerald-600">Ready to withdraw</span>;

  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff / (60 * 60 * 1000)) % 24);
  const minutes = Math.floor((diff / (60 * 1000)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  return (
    <span className="font-mono text-sm">
      {days > 0 ? `${days}d ` : ""}
      {String(hours).padStart(2, "0")}:{String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
    </span>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <div className="rounded-2xl bg-primary/10 p-3 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Staking() {
  const { toast } = useToast();
  const [selectedTier, setSelectedTier] = useState<StakingTier>("mythic_diamond");
  const [amount, setAmount] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [historyFilter, setHistoryFilter] = useState("all");
  const [stakeToWithdraw, setStakeToWithdraw] = useState<Stake | null>(null);

  const { data: summary, isLoading } = useQuery<StakingSummary>({
    queryKey: ["/api/stakes/summary"],
  });

  const { data: trustLoanStatus } = useQuery<TrustLoanStatus>({
    queryKey: ["/api/trust-loan/status"],
  });

  const invalidateStaking = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/stakes/summary"] });
    queryClient.invalidateQueries({ queryKey: ["/api/stakes"] });
    queryClient.invalidateQueries({ queryKey: ["/api/balance"] });
    queryClient.invalidateQueries({ queryKey: ["/api/wallet/summary"] });
    queryClient.invalidateQueries({ queryKey: ["/api/home/summary"] });
    queryClient.invalidateQueries({ queryKey: ["/api/profile/summary"] });
    queryClient.invalidateQueries({ queryKey: ["/api/trust-loan/status"] });
  };

  const processRewardsMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/stakes/process-rewards", {}),
    onSuccess: async (response) => {
      const result = await response.json().catch(() => null);
      invalidateStaking();
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
      invalidateStaking();
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
      invalidateStaking();
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

  const claimTrustLoanMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/trust-loan/claim", {}),
    onSuccess: () => {
      invalidateStaking();
      toast({ title: "Trust Loan claimed", description: "Your virtual Trust Loan stake is now active." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to claim Trust Loan", variant: "destructive" });
    },
  });

  const selectedTierConfig = STAKING_TIERS[selectedTier];
  const enteredAmount = toNumber(amount);
  const dailyProfit = enteredAmount > 0 ? (enteredAmount * selectedTierConfig.dailyRate) / 100 : 0;
  const projectedProfit = dailyProfit * selectedTierConfig.duration;
  const availableBalance = toNumber(summary?.balance.available);
  const canCreateStake = enteredAmount >= selectedTierConfig.minAmount && enteredAmount <= selectedTierConfig.maxAmount && enteredAmount <= availableBalance;

  const activeStakes = useMemo(
    () => summary?.stakes.filter((stake) => stake.status === "active" || stake.status === "completed") ?? [],
    [summary?.stakes]
  );
  const historyStakes = useMemo(() => {
    const withdrawn = summary?.stakes.filter((stake) => stake.status === "withdrawn") ?? [];
    if (historyFilter === "all") return withdrawn;
    return withdrawn.filter((stake) => stake.tier === historyFilter);
  }, [summary?.stakes, historyFilter]);

  const trustLoan = trustLoanStatus ?? summary?.trustLoan;
  const trustDirectProgress = Math.min(100, ((trustLoan?.directCount ?? 0) / Math.max(1, trustLoan?.requiredReferrals ?? 1)) * 100);
  const trustInvestorProgress = Math.min(100, ((trustLoan?.investingCount ?? 0) / Math.max(1, trustLoan?.requiredInvestingReferrals ?? 1)) * 100);
  const canClaimTrustLoan = Boolean(trustLoan && "eligible" in trustLoan ? (trustLoan as any).eligible : trustDirectProgress >= 100 && trustInvestorProgress >= 100) && !trustLoanStatus?.hasLoanStake;

  if (isLoading) {
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
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/15 via-background to-background">
        <CardContent className="p-6 md:p-8">
          <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-center">
            <div className="space-y-4">
              <Badge className="w-fit bg-primary/15 text-primary hover:bg-primary/20">Staking v2</Badge>
              <div>
                <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Professional XNRT Staking</h1>
                <p className="mt-2 max-w-2xl text-muted-foreground">
                  Lock XNRT into platform reward tiers, track maturity countdowns, refresh due rewards, and withdraw matured stakes safely.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => setShowCreateDialog(true)} data-testid="button-open-create-stake">
                  Start Staking <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => processRewardsMutation.mutate()}
                  disabled={processRewardsMutation.isPending}
                  data-testid="button-refresh-staking-rewards"
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${processRewardsMutation.isPending ? "animate-spin" : ""}`} />
                  Refresh Rewards
                </Button>
              </div>
            </div>
            <div className="rounded-3xl border bg-background/80 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Next maturity</p>
                  <p className="text-xl font-semibold">{formatDate(summary?.totals.nextMaturityAt)}</p>
                </div>
                <Clock className="h-9 w-9 text-primary" />
              </div>
              <Separator className="my-4" />
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Open stakes</p>
                  <p className="text-lg font-semibold">{(summary?.totals.activeCount ?? 0) + (summary?.totals.completedCount ?? 0)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Withdrawable</p>
                  <p className="text-lg font-semibold">{formatXnrt(summary?.totals.withdrawableAmount)} XNRT</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Alert className="border-amber-500/30 bg-amber-500/5">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Important reward notice</AlertTitle>
        <AlertDescription>{summary?.disclaimer ?? "Staking rewards are simulated in-app platform rewards and not guaranteed investment returns."}</AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Available Balance" value={`${formatXnrt(summary?.balance.available)} XNRT`} subtitle="Ready to stake or withdraw" icon={Wallet} />
        <StatCard title="Staking Balance" value={`${formatXnrt(summary?.balance.staking)} XNRT`} subtitle="Locked principal + accrued rewards" icon={LockKeyhole} />
        <StatCard title="Accrued Rewards" value={`${formatXnrt(summary?.totals.accruedProfit)} XNRT`} subtitle="Open stake profit tracked" icon={Gift} />
        <StatCard title="Projected Profit" value={`${formatXnrt(summary?.totals.projectedProfit)} XNRT`} subtitle="If open stakes mature fully" icon={TrendingUp} />
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="positions">Positions</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="trust-loan">Trust Loan</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {(summary?.tiers ?? Object.entries(STAKING_TIERS).map(([key, tier]) => ({
              key,
              ...tier,
              estimatedTotalProfitAtMin: (Number(tier.minAmount) * Number(tier.dailyRate) * Number(tier.duration)) / 100,
            }))).map((tier) => (
              <Card key={tier.key} className={`overflow-hidden border bg-gradient-to-br ${tierAccent[tier.key] ?? "from-primary/10 to-background"}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <span>{tierIcons[tier.key] ?? "💰"}</span>
                        {tier.name}
                      </CardTitle>
                      <CardDescription>{tier.duration} days lock period</CardDescription>
                    </div>
                    <Badge variant="outline">{tier.dailyRate}% daily</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Min</p>
                      <p className="font-semibold">{formatXnrt(tier.minAmount, 0)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Max</p>
                      <p className="font-semibold">{formatXnrt(tier.maxAmount, 0)}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Projected reward at minimum: {formatXnrt(tier.estimatedTotalProfitAtMin ?? 0)} XNRT.
                  </p>
                  <Button
                    variant={selectedTier === tier.key ? "default" : "outline"}
                    className="w-full"
                    onClick={() => {
                      setSelectedTier(tier.key as StakingTier);
                      setShowCreateDialog(true);
                    }}
                    data-testid={`button-select-tier-${tier.key}`}
                  >
                    Select Tier
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="positions" className="space-y-4">
          {activeStakes.length === 0 ? (
            <Card>
              <CardContent className="p-10 text-center">
                <Coins className="mx-auto mb-4 h-14 w-14 text-muted-foreground" />
                <h3 className="text-lg font-semibold">No active stakes yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">Create a stake to start tracking platform rewards and maturity countdowns.</p>
                <Button className="mt-4" onClick={() => setShowCreateDialog(true)}>Create Stake</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {activeStakes.map((stake) => {
                const tier = getTierConfig(stake.tier);
                return (
                  <Card key={stake.id} className="overflow-hidden" data-testid={`stake-card-${stake.id}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <span>{tierIcons[stake.tier] ?? "💰"}</span>
                            {getTierName(stake.tier)}
                          </CardTitle>
                          <CardDescription>{stake.isLoan ? "Virtual Trust Loan principal; profit only withdrawable" : `${formatXnrt(stake.amount)} XNRT principal`}</CardDescription>
                        </div>
                        {getStatusBadge(stake)}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Maturity progress</span>
                          <span className="font-medium">{Math.round(stake.progressPercent ?? 0)}%</span>
                        </div>
                        <Progress value={stake.progressPercent ?? 0} />
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                        <div>
                          <p className="text-muted-foreground">Daily</p>
                          <p className="font-semibold">{formatXnrt(stake.dailyProfit)} XNRT</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Accrued</p>
                          <p className="font-semibold text-emerald-600">{formatXnrt(stake.totalProfit)} XNRT</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Projected</p>
                          <p className="font-semibold">{formatXnrt(stake.projectedProfit)} XNRT</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Rate</p>
                          <p className="font-semibold">{tier?.dailyRate ?? stake.dailyRate}% / day</p>
                        </div>
                      </div>
                      <div className="rounded-xl bg-muted/50 p-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Ends {formatDate(stake.endDate)}</span>
                          <Countdown endDate={stake.endDate} />
                        </div>
                      </div>
                      <Button
                        className="w-full"
                        disabled={!stake.canWithdraw || withdrawStakeMutation.isPending}
                        onClick={() => setStakeToWithdraw(stake)}
                        data-testid={`button-withdraw-stake-${stake.id}`}
                      >
                        {stake.canWithdraw ? <Unlock className="mr-2 h-4 w-4" /> : <LockKeyhole className="mr-2 h-4 w-4" />}
                        {stake.canWithdraw ? `Withdraw ${formatXnrt(stake.withdrawableAmount)} XNRT` : "Locked until maturity"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Withdrawn stake history</h2>
              <p className="text-sm text-muted-foreground">Completed withdrawals and realized platform rewards.</p>
            </div>
            <Select value={historyFilter} onValueChange={setHistoryFilter}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Filter by tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tiers</SelectItem>
                {Object.entries(STAKING_TIERS).map(([key, tier]) => (
                  <SelectItem key={key} value={key}>{tier.name}</SelectItem>
                ))}
                <SelectItem value="trust_loan">Trust Loan</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {historyStakes.length === 0 ? (
            <Card>
              <CardContent className="p-10 text-center">
                <History className="mx-auto mb-4 h-14 w-14 text-muted-foreground" />
                <h3 className="text-lg font-semibold">No withdrawal history yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">Matured and withdrawn stakes will appear here.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {historyStakes.map((stake) => (
                <Card key={stake.id}>
                  <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl bg-primary/10 p-3 text-xl">{tierIcons[stake.tier] ?? "💰"}</div>
                      <div>
                        <p className="font-semibold">{getTierName(stake.tier)}</p>
                        <p className="text-sm text-muted-foreground">{formatDate(stake.startDate)} → {formatDate(stake.endDate)}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-right text-sm">
                      <div>
                        <p className="text-muted-foreground">Principal</p>
                        <p className="font-semibold">{formatXnrt(stake.withdrawablePrincipal ?? stake.amount)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Profit</p>
                        <p className="font-semibold text-emerald-600">+{formatXnrt(stake.totalProfit)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Total</p>
                        <p className="font-semibold">{formatXnrt(stake.withdrawableAmount)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="trust-loan" className="space-y-4">
          <Card className="overflow-hidden border-amber-500/25 bg-gradient-to-br from-amber-500/10 to-background">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Trust Loan Program</CardTitle>
              <CardDescription>Eligibility-based virtual staking principal. Only generated profit is withdrawable.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <StatCard title="Virtual Amount" value={`${formatXnrt(trustLoan?.amountXnrt ?? summary?.trustLoan.amountXnrt)} XNRT`} subtitle={`${trustLoan?.durationDays ?? summary?.trustLoan.durationDays ?? 30} days program`} icon={Sparkles} />
                <StatCard title="Direct Referrals" value={`${trustLoan?.directCount ?? 0}/${trustLoan?.requiredReferrals ?? 3}`} subtitle="Required L1 referrals" icon={Users} />
                <StatCard title="Investing Referrals" value={`${trustLoan?.investingCount ?? 0}/${trustLoan?.requiredInvestingReferrals ?? 2}`} subtitle="Required approved deposits" icon={BadgeCheck} />
              </div>
              <div className="space-y-3">
                <div>
                  <div className="mb-1 flex justify-between text-sm"><span>Direct referral progress</span><span>{Math.round(trustDirectProgress)}%</span></div>
                  <Progress value={trustDirectProgress} />
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-sm"><span>Investing referral progress</span><span>{Math.round(trustInvestorProgress)}%</span></div>
                  <Progress value={trustInvestorProgress} />
                </div>
              </div>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>How Trust Loan works</AlertTitle>
                <AlertDescription>
                  Trust Loan is a virtual principal stake for qualified users. It does not add withdrawable principal to your wallet; only earned platform reward profit can be withdrawn after maturity.
                </AlertDescription>
              </Alert>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  disabled={!canClaimTrustLoan || claimTrustLoanMutation.isPending}
                  onClick={() => claimTrustLoanMutation.mutate()}
                  data-testid="button-claim-trust-loan"
                >
                  {trustLoanStatus?.hasLoanStake ? "Already Claimed" : canClaimTrustLoan ? "Claim Trust Loan" : "Eligibility Not Complete"}
                </Button>
                <Button asChild variant="outline" data-testid="button-open-trust-loan-page">
                  <Link href="/trust-loan">Open Trust Loan Page</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Create staking position</DialogTitle>
            <DialogDescription>Select a reward tier and lock available XNRT until maturity.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="grid gap-2">
              <Label>Tier</Label>
              <Select value={selectedTier} onValueChange={(value) => setSelectedTier(value as StakingTier)}>
                <SelectTrigger data-testid="select-staking-tier">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STAKING_TIERS).map(([key, tier]) => (
                    <SelectItem key={key} value={key}>{tier.name} · {tier.duration}d · {tier.dailyRate}% daily</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="stake-amount">Amount</Label>
              <Input
                id="stake-amount"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder={`Min ${selectedTierConfig.minAmount.toLocaleString()} XNRT`}
                data-testid="input-stake-amount"
              />
              <p className="text-xs text-muted-foreground">Available: {formatXnrt(summary?.balance.available)} XNRT</p>
            </div>
            <div className="rounded-2xl border bg-muted/30 p-4">
              <div className="grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-muted-foreground">Daily reward</p>
                  <p className="font-semibold">{formatXnrt(dailyProfit)} XNRT</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Projected total</p>
                  <p className="font-semibold">{formatXnrt(projectedProfit)} XNRT</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Unlocks after</p>
                  <p className="font-semibold">{selectedTierConfig.duration} days</p>
                </div>
              </div>
            </div>
            {enteredAmount > 0 && !canCreateStake && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Cannot create stake</AlertTitle>
                <AlertDescription>
                  Check minimum/maximum tier limits and make sure your available balance is enough.
                </AlertDescription>
              </Alert>
            )}
            <Button
              className="w-full"
              onClick={() => createStakeMutation.mutate({ tier: selectedTier, amount })}
              disabled={!canCreateStake || createStakeMutation.isPending}
              data-testid="button-create-stake"
            >
              {createStakeMutation.isPending ? "Creating..." : "Create Stake"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(stakeToWithdraw)}
        onOpenChange={(open) => !open && setStakeToWithdraw(null)}
        onConfirm={() => stakeToWithdraw && withdrawStakeMutation.mutate(stakeToWithdraw.id)}
        title="Withdraw matured stake"
        description={
          stakeToWithdraw
            ? `This will move ${formatXnrt(stakeToWithdraw.withdrawableAmount)} XNRT to your available balance. ${stakeToWithdraw.isLoan ? "Trust Loan virtual principal is not withdrawable." : "Principal and accrued profit will be unlocked."}`
            : "Withdraw this stake?"
        }
        confirmText="Withdraw"
      />
    </div>
  );
}
