import * as React from "react";
import { Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Clipboard,
  Gem,
  Gift,
  HandCoins,
  Info,
  LockKeyhole,
  Share2,
  ShieldCheck,
  Sparkles,
  Timer,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { nf } from "@/lib/number";
import { cn } from "@/lib/utils";

type TrustLoanStake = {
  id: string;
  tier: string;
  amount: string | number;
  dailyRate: string | number;
  duration: number;
  startDate: string;
  endDate: string;
  totalProfit: string | number;
  status: string;
  unlockMet?: boolean;
};

type TrustLoanStatus = {
  hasLoanStake: boolean;
  stake: TrustLoanStake | null;
  directCount: number;
  investingCount: number;
  requiredReferrals: number;
  requiredInvestingReferrals: number;
  minInvestUsdtPerReferral: string | number;
  eligible: boolean;
  program: string;
  amountXnrt: number;
  dailyRate?: number;
  durationDays: number;
  projectedProfit?: number;
  config?: {
    enabled: boolean;
    title: string;
    description: string;
    terms: string;
    dailyRate: number;
  };
};

function toNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function percent(value: number, total: number) {
  return Math.min(100, Math.max(0, Math.round((value / Math.max(1, total)) * 100)));
}

function formatDate(value?: string | null) {
  if (!value) return "Not started";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not started";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function daysRemaining(value?: string | null) {
  if (!value) return "—";
  const end = new Date(value).getTime();
  if (Number.isNaN(end)) return "—";
  const remaining = Math.ceil((end - Date.now()) / (24 * 60 * 60 * 1000));
  if (remaining <= 0) return "Matured";
  return `${remaining} day${remaining === 1 ? "" : "s"} left`;
}

function MetricCard({
  title,
  value,
  helper,
  icon,
  className,
}: {
  title: string;
  value: React.ReactNode;
  helper: string;
  icon: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("rounded-3xl border-border/70 bg-card/80 shadow-sm", className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
            <div className="mt-2 text-2xl font-bold text-foreground">{value}</div>
            <p className="mt-1 text-sm text-muted-foreground">{helper}</p>
          </div>
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EligibilityRow({
  title,
  value,
  required,
  helper,
  icon,
}: {
  title: string;
  value: number;
  required: number;
  helper: string;
  icon: React.ReactNode;
}) {
  const progress = percent(value, required);
  const done = value >= required;
  return (
    <div className="rounded-3xl border border-border/70 bg-muted/30 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={cn("grid h-11 w-11 place-items-center rounded-2xl", done ? "bg-emerald-500/15 text-emerald-600" : "bg-primary/15 text-primary")}>
            {done ? <CheckCircle2 className="h-5 w-5" /> : icon}
          </div>
          <div>
            <p className="font-semibold">{title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{helper}</p>
          </div>
        </div>
        <Badge variant={done ? "default" : "outline"} className="shrink-0">
          {nf(value)} / {nf(required)}
        </Badge>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Progress</span>
        <span className="font-medium">{progress}%</span>
      </div>
      <Progress value={progress} className="mt-2 h-2" />
    </div>
  );
}

export default function TrustLoanPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const referralCode = (user as any)?.referralCode as string | undefined;

  const {
    data: status,
    isLoading,
    isError,
    refetch,
  } = useQuery<TrustLoanStatus>({
    queryKey: ["/api/trust-loan/status"],
    staleTime: 20_000,
  });

  const claimMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/trust-loan/claim", {});
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Trust Loan claimed",
        description: "Your virtual staking principal is active. Only generated profit is withdrawable.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/trust-loan/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stakes/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/home/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile/summary"] });
    },
    onError: (error: Error) => {
      toast({ title: "Claim failed", description: error.message, variant: "destructive" });
    },
  });

  const copyReferralLink = async () => {
    if (!referralCode) {
      toast({ title: "Referral code unavailable", description: "Refresh your session and try again.", variant: "destructive" });
      return;
    }
    const link = `${window.location.origin}/?ref=${referralCode}`;
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: "Referral link copied", description: "Share it with friends to unlock Trust Loan eligibility." });
    } catch {
      toast({ title: "Copy failed", description: "Please copy the link manually.", variant: "destructive" });
    }
  };

  const shareReferralLink = async () => {
    if (!referralCode) return copyReferralLink();
    const link = `${window.location.origin}/?ref=${referralCode}`;
    const text = `Join XNRT with my referral code ${referralCode}. Trust Loan unlocks after referral eligibility is complete.`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join XNRT", text, url: link });
        return;
      } catch {
        // User cancelled share; fallback to copy.
      }
    }
    await copyReferralLink();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-72 rounded-3xl" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-36 rounded-3xl" />
          <Skeleton className="h-36 rounded-3xl" />
          <Skeleton className="h-36 rounded-3xl" />
        </div>
      </div>
    );
  }

  if (isError || !status) {
    return (
      <Card className="rounded-3xl border-destructive/30 bg-destructive/10">
        <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Could not load Trust Loan</h1>
            <p className="mt-1 text-sm text-muted-foreground">Please retry. Your wallet and staking data are safe.</p>
          </div>
          <Button onClick={() => refetch()}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  const directProgress = percent(status.directCount, status.requiredReferrals);
  const investingProgress = percent(status.investingCount, status.requiredInvestingReferrals);
  const overallProgress = Math.round((directProgress + investingProgress) / 2);
  const config = status.config;
  const programEnabled = config?.enabled ?? true;
  const programTitle = config?.title || "Trust Loan";
  const programDescription = config?.description ||
    `Trust Loan gives qualified users a virtual ${nf(status.amountXnrt)} XNRT staking principal for ${nf(status.durationDays)} days.`;
  const programTerms = config?.terms ||
    "Trust Loan is a rewards program feature. It is not a cash loan and it does not add withdrawable principal to the user wallet.";
  const canClaim = programEnabled && status.eligible && !status.hasLoanStake;
  const stake = status.stake;
  const stakeProfit = toNumber(stake?.totalProfit);
  const dailyRate = toNumber(stake?.dailyRate, toNumber(status.dailyRate, config?.dailyRate ?? 1.3));
  const projectedProfit = toNumber(status.projectedProfit, (status.amountXnrt * dailyRate * status.durationDays) / 100);

  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden rounded-3xl border-amber-500/25 bg-gradient-to-br from-amber-500/15 via-background to-background shadow-xl shadow-amber-500/5">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-amber-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-8 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
        <CardContent className="relative p-5 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <Badge className="mb-4 gap-2 bg-amber-500/15 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300">
                <HandCoins className="h-3.5 w-3.5" /> {programEnabled ? "Trust Loan Program" : "Trust Loan Disabled"}
              </Badge>
              <h1 className="font-serif text-3xl font-bold leading-tight sm:text-5xl">
                {programTitle}
              </h1>
              <p className="mt-4 text-sm leading-6 text-muted-foreground sm:text-base">
                {programDescription} The principal is not withdrawable; only generated platform reward profit can be withdrawn after maturity.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button
                  onClick={() => claimMutation.mutate()}
                  disabled={!canClaim || claimMutation.isPending}
                  className="gap-2 rounded-2xl"
                  data-testid="button-trust-loan-claim"
                >
                  <Gift className="h-4 w-4" />
                  {status.hasLoanStake ? "Already Claimed" : !programEnabled ? "Program Disabled" : canClaim ? "Claim Trust Loan" : "Eligibility Pending"}
                </Button>
                <Button asChild variant="outline" className="gap-2 rounded-2xl">
                  <Link href="/referrals">
                    <Users className="h-4 w-4" /> Invite Friends
                  </Link>
                </Button>
                <Button asChild variant="ghost" className="gap-2 rounded-2xl">
                  <Link href="/staking">
                    <Gem className="h-4 w-4" /> Staking Dashboard
                  </Link>
                </Button>
              </div>
            </div>

            <div className="w-full max-w-md rounded-3xl border theme-glass-card p-5 backdrop-blur-xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Eligibility</p>
                  <p className="mt-1 text-3xl font-bold">{overallProgress}%</p>
                </div>
                <div className={cn("grid h-14 w-14 place-items-center rounded-2xl", status.eligible ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600")}>
                  {status.eligible ? <BadgeCheck className="h-7 w-7" /> : <LockKeyhole className="h-7 w-7" />}
                </div>
              </div>
              <Progress value={overallProgress} className="mt-4 h-3" />
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-muted/50 p-3">
                  <p className="text-muted-foreground">Direct</p>
                  <p className="font-bold">{nf(status.directCount)} / {nf(status.requiredReferrals)}</p>
                </div>
                <div className="rounded-2xl bg-muted/50 p-3">
                  <p className="text-muted-foreground">Investing</p>
                  <p className="font-bold">{nf(status.investingCount)} / {nf(status.requiredInvestingReferrals)}</p>
                </div>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Minimum approved deposit per investing referral: {nf(status.minInvestUsdtPerReferral)} USDT.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {!programEnabled && (
        <Alert className="rounded-3xl border-muted-foreground/30 bg-muted/40">
          <LockKeyhole className="h-4 w-4" />
          <AlertTitle>Trust Loan is currently disabled</AlertTitle>
          <AlertDescription>Admin has paused new claims. Existing claimed Trust Loan stakes remain visible in your staking history.</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          title="Virtual Principal"
          value={<>{nf(status.amountXnrt)} <span className="text-sm text-muted-foreground">XNRT</span></>}
          helper="Principal is platform-provided and not withdrawable."
          icon={<Sparkles className="h-5 w-5" />}
        />
        <MetricCard
          title="Program Duration"
          value={<>{nf(status.durationDays)} <span className="text-sm text-muted-foreground">days</span></>}
          helper="Reward period after a successful claim."
          icon={<Timer className="h-5 w-5" />}
        />
        <MetricCard
          title="Projected Profit"
          value={<>{nf(projectedProfit)} <span className="text-sm text-muted-foreground">XNRT</span></>}
          helper="Estimated from the current Trust Loan reward rate."
          icon={<Trophy className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> Eligibility checklist
            </CardTitle>
            <CardDescription>Complete both conditions before claiming the Trust Loan.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <EligibilityRow
              title="Direct referrals"
              value={status.directCount}
              required={status.requiredReferrals}
              helper="Invite direct L1 users using your referral link."
              icon={<Users className="h-5 w-5" />}
            />
            <EligibilityRow
              title="Investing referrals"
              value={status.investingCount}
              required={status.requiredInvestingReferrals}
              helper={`Direct referrals with at least ${nf(status.minInvestUsdtPerReferral)} USDT approved deposit.`}
              icon={<BadgeCheck className="h-5 w-5" />}
            />
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button onClick={shareReferralLink} className="flex-1 gap-2 rounded-2xl">
                <Share2 className="h-4 w-4" /> Share Referral Link
              </Button>
              <Button onClick={copyReferralLink} variant="outline" className="flex-1 gap-2 rounded-2xl">
                <Clipboard className="h-4 w-4" /> Copy Link
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" /> Your Trust Loan stake
            </CardTitle>
            <CardDescription>Track your claimed virtual stake and generated profit.</CardDescription>
          </CardHeader>
          <CardContent>
            {stake ? (
              <div className="space-y-4">
                <div className="rounded-3xl border border-border/70 bg-muted/30 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <p className="mt-1 text-2xl font-bold capitalize">{stake.status}</p>
                    </div>
                    <Badge variant="outline">{daysRemaining(stake.endDate)}</Badge>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-background/70 p-3">
                      <p className="text-xs text-muted-foreground">Started</p>
                      <p className="mt-1 text-sm font-medium">{formatDate(stake.startDate)}</p>
                    </div>
                    <div className="rounded-2xl bg-background/70 p-3">
                      <p className="text-xs text-muted-foreground">Maturity</p>
                      <p className="mt-1 text-sm font-medium">{formatDate(stake.endDate)}</p>
                    </div>
                    <div className="rounded-2xl bg-background/70 p-3">
                      <p className="text-xs text-muted-foreground">Generated Profit</p>
                      <p className="mt-1 text-sm font-bold text-emerald-600">{nf(stakeProfit)} XNRT</p>
                    </div>
                    <div className="rounded-2xl bg-background/70 p-3">
                      <p className="text-xs text-muted-foreground">Daily Rate</p>
                      <p className="mt-1 text-sm font-bold">{nf(dailyRate)}% / day</p>
                    </div>
                  </div>
                </div>
                <Button asChild className="w-full gap-2 rounded-2xl">
                  <Link href="/staking">
                    View Staking Positions <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-border p-8 text-center">
                <HandCoins className="mx-auto h-12 w-12 text-primary" />
                <h3 className="mt-4 text-lg font-semibold">No Trust Loan claimed yet</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Complete the eligibility checklist, then claim your virtual staking principal from this page.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" /> How it works
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              ["1", "Invite direct referrals", `Build at least ${status.requiredReferrals} direct L1 referrals.`],
              ["2", "Help referrals invest", `${status.requiredInvestingReferrals} direct referrals must each have an approved deposit of ${nf(status.minInvestUsdtPerReferral)} USDT or more.`],
              ["3", "Claim virtual principal", `Eligible users receive a virtual ${nf(status.amountXnrt)} XNRT staking principal for ${status.durationDays} days.`],
              ["4", "Withdraw only generated profit", "The platform principal is not withdrawable. Only generated reward profit can be withdrawn after maturity."],
            ].map(([step, title, description]) => (
              <div key={step} className="flex gap-3 rounded-2xl border border-border/70 bg-muted/30 p-4">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-bold text-primary">{step}</div>
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Alert className="rounded-3xl border-amber-500/30 bg-amber-500/10">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Important Trust Loan rule</AlertTitle>
            <AlertDescription>
              {programTerms}
            </AlertDescription>
          </Alert>
          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle>Related actions</CardTitle>
              <CardDescription>Use these pages to complete eligibility and manage rewards.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <Button asChild variant="outline" className="h-auto justify-start gap-3 rounded-2xl p-4">
                <Link href="/referrals"><Users className="h-5 w-5 text-primary" /> Referral Dashboard</Link>
              </Button>
              <Button asChild variant="outline" className="h-auto justify-start gap-3 rounded-2xl p-4">
                <Link href="/staking"><Gem className="h-5 w-5 text-primary" /> Staking Positions</Link>
              </Button>
              <Button asChild variant="outline" className="h-auto justify-start gap-3 rounded-2xl p-4">
                <Link href="/wallet"><Wallet className="h-5 w-5 text-primary" /> Wallet</Link>
              </Button>
              <Button asChild variant="outline" className="h-auto justify-start gap-3 rounded-2xl p-4">
                <Link href="/leaderboard"><Trophy className="h-5 w-5 text-primary" /> Leaderboard</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
