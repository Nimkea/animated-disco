import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Activity as ActivityIcon,
  ArrowRight,
  Award,
  CalendarCheck,
  CheckCircle2,
  Clipboard,
  Clock3,
  Flame,
  Gem,
  Gift,
  HandCoins,
  Pickaxe,
  RefreshCw,
  Rocket,
  Share2,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  Users,
  Wallet,
  Zap,
} from "lucide-react";

import { AnnouncementBanner } from "@/components/announcement-banner";
import { SkeletonDashboard } from "@/components/skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useConfetti } from "@/hooks/use-confetti";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { nf } from "@/lib/number";

type Activity = {
  id: string;
  type: string;
  description: string;
  createdAt: string;
};

type HomeSummary = {
  user: {
    id: string;
    username: string | null;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
    referralCode: string;
    createdAt: string;
  };
  xp: {
    total: number;
    level: number;
    progressPercent: number;
    toNextLevel: number;
  };
  balance: {
    available: number;
    staking: number;
    mining: number;
    referral: number;
    totalEarned: number;
  };
  mining: {
    status: "active" | "ready";
    activeSessionId: string | null;
    startTime: string | null;
    endTime: string | null;
    remainingMs: number;
    progressPercent: number;
    completedSessions: number;
    totalXpMined: number;
    totalXnrtMined: number;
    reward: {
      xp: number;
      xnrt: number;
      durationHours: number;
    };
  };
  staking: {
    activeStakes: number;
    totalActiveStaked: number;
  };
  referrals: {
    direct: number;
    level2: number;
    level3: number;
    totalNetwork: number;
    paidCommission: number;
    balance: number;
    rank: number | null;
  };
  tasks: {
    completed: number;
    totalActive: number;
    remaining: number;
    progressPercent: number;
  };
  achievements: {
    unlocked: number;
    total: number;
    remaining: number;
    progressPercent: number;
  };
  leaderboard: {
    xpRank: number | null;
    referralRank: number | null;
  };
  checkin: {
    currentStreak: number;
    lastCheckIn: string | null;
    checkedInToday: boolean;
  };
  recentActivities: Activity[];
};

type CheckinResponse = {
  streak: number;
  xnrtReward: number;
  xpReward: number;
};

function formatDuration(ms: number) {
  const safeMs = Math.max(0, ms || 0);
  const totalSeconds = Math.floor(safeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function formatRank(rank: number | null | undefined) {
  return rank ? `#${nf(rank)}` : "Not ranked";
}

function safeDate(value: string | null | undefined) {
  if (!value) return "No activity yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No activity yet";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";
}

function StatCard({
  title,
  value,
  suffix,
  helper,
  icon,
  href,
  className,
}: {
  title: string;
  value: number | string;
  suffix?: string;
  helper: string;
  icon: React.ReactNode;
  href: string;
  className?: string;
}) {
  const card = (
    <Card className={cn("group h-full overflow-hidden rounded-2xl theme-elevated-card transition-all hover:-translate-y-0.5 hover:bg-accent/60", className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-bold text-foreground">{nf(value)}</span>
              {suffix ? <span className="text-xs font-semibold text-muted-foreground">{suffix}</span> : null}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
          </div>
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return <Link href={href}>{card}</Link>;
}

function ProgressCard({
  title,
  value,
  total,
  percent,
  icon,
  href,
  helper,
}: {
  title: string;
  value: number;
  total: number;
  percent: number;
  icon: React.ReactNode;
  href: string;
  helper: string;
}) {
  return (
    <Card className="overflow-hidden rounded-2xl theme-elevated-card">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 text-primary">{icon}</div>
            <div>
              <p className="font-semibold">{title}</p>
              <p className="text-xs text-muted-foreground">{helper}</p>
            </div>
          </div>
          <Button asChild variant="ghost" size="sm" className="gap-1">
            <Link href={href}>
              Open <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        <div className="mt-4 flex items-end justify-between text-sm">
          <span className="font-semibold">{nf(value)} / {nf(total)}</span>
          <span className="text-muted-foreground">{nf(percent)}%</span>
        </div>
        <Progress value={Math.max(0, Math.min(100, percent || 0))} className="mt-2 h-2 bg-muted" />
      </CardContent>
    </Card>
  );
}

function QuickAction({
  href,
  icon,
  title,
  hint,
  primary,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  hint: string;
  primary?: boolean;
}) {
  return (
    <Button
      asChild
      variant={primary ? "default" : "outline"}
      className={cn(
        "h-auto w-full justify-between rounded-2xl px-4 py-4 text-left",
        !primary && "theme-outline-action"
      )}
    >
      <Link href={href}>
        <span className="flex items-center gap-3">
          <span className={cn("grid h-10 w-10 place-items-center rounded-full", primary ? "bg-white/20" : "bg-primary/15 text-primary")}>{icon}</span>
          <span>
            <span className="block font-semibold">{title}</span>
            <span className={cn("block text-xs", primary ? "text-primary-foreground/80" : "text-muted-foreground")}>{hint}</span>
          </span>
        </span>
        <ArrowRight className="h-5 w-5" />
      </Link>
    </Button>
  );
}

export default function Home() {
  const { toast } = useToast();
  const { celebrate } = useConfetti();
  const { isLoading: userLoading } = useAuth();
  const [now, setNow] = React.useState(() => Date.now());

  const {
    data: summary,
    isLoading: summaryLoading,
    isError: summaryError,
    refetch,
  } = useQuery<HomeSummary>({
    queryKey: ["/api/home/summary"],
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });

  React.useEffect(() => {
    if (summary?.mining.status !== "active") return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [summary?.mining.status, summary?.mining.endTime]);

  const miningRemainingMs = React.useMemo(() => {
    if (!summary?.mining.endTime) return 0;
    return Math.max(0, new Date(summary.mining.endTime).getTime() - now);
  }, [now, summary?.mining.endTime]);

  const miningProgress = React.useMemo(() => {
    if (!summary?.mining.startTime || !summary?.mining.endTime) {
      return summary?.mining.progressPercent ?? 0;
    }
    const start = new Date(summary.mining.startTime).getTime();
    const end = new Date(summary.mining.endTime).getTime();
    const duration = Math.max(1, end - start);
    return Math.min(100, Math.max(0, Math.round(((now - start) / duration) * 100)));
  }, [now, summary?.mining.endTime, summary?.mining.progressPercent, summary?.mining.startTime]);

  const checkinMutation = useMutation<CheckinResponse, Error>({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/checkin");
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Check-in successful",
        description: `Day ${data.streak} streak! Earned ${data.xnrtReward} XNRT and ${data.xpReward} XP.`,
      });
      if ([7, 14, 30, 60, 90, 180, 365].includes(data.streak)) celebrate("streak");
      queryClient.invalidateQueries({ queryKey: ["/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/home/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (error) => {
      toast({
        title: "Check-in failed",
        description: error.message || "Already checked in today",
        variant: "destructive",
      });
    },
  });

  const processMiningMutation = useMutation<{ success: boolean; processedCount: number }, Error>({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/mining/process-rewards");
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.processedCount > 0 ? "Mining rewards credited" : "Mining status refreshed",
        description:
          data.processedCount > 0
            ? `Your 24-hour mining reward has been added.`
            : "No completed mining session was pending.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/home/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mining/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mining/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/balance"] });
      queryClient.invalidateQueries({ queryKey: ["/auth/me"] });
    },
    onError: (error) => {
      toast({ title: "Mining refresh failed", description: error.message, variant: "destructive" });
    },
  });

  const copyReferralLink = async () => {
    if (!summary?.user.referralCode) return;
    const link = `${window.location.origin}/?ref=${summary.user.referralCode}`;
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: "Referral link copied", description: "Share it with friends to grow your network." });
    } catch {
      toast({ title: "Copy failed", description: "Please copy your referral code manually.", variant: "destructive" });
    }
  };

  const shareReferralLink = async () => {
    if (!summary?.user.referralCode) return;
    const link = `${window.location.origin}/?ref=${summary.user.referralCode}`;
    const text = `Join XNRT with my referral code ${summary.user.referralCode}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join XNRT", text, url: link });
        return;
      } catch {
        // User may cancel native share; fall back to copy.
      }
    }
    await copyReferralLink();
  };

  if (userLoading || summaryLoading) return <SkeletonDashboard />;

  if (summaryError || !summary) {
    return (
      <div className="space-y-6">
        <AnnouncementBanner />
        <Card className="rounded-2xl border-destructive/30 bg-destructive/10">
          <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold">Could not load home dashboard</h1>
              <p className="mt-1 text-sm text-muted-foreground">Please retry. Your wallet and earning data are safe.</p>
            </div>
            <Button onClick={() => refetch()} className="gap-2">
              <RefreshCw className="h-4 w-4" /> Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const fullName = [summary.user.firstName, summary.user.lastName].filter(Boolean).join(" ");
  const displayName = fullName || summary.user.username || summary.user.email?.split("@")[0] || "User";
  const checkedInToday = summary.checkin.checkedInToday;
  const miningActive = summary.mining.status === "active";
  const miningReadyToClaim = miningActive && miningRemainingMs <= 0;

  return (
    <div className="space-y-6">
      <AnnouncementBanner />

      <Card className="relative overflow-hidden rounded-3xl theme-hero-card">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-10 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
        <CardContent className="relative p-5 sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border/70 bg-background/60 dark:border-white/15 dark:bg-white/10 text-xl font-bold text-primary shadow-inner">
                {summary.user.profileImageUrl ? (
                  <img src={summary.user.profileImageUrl} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  initials(displayName)
                )}
              </div>
              <div>
                <Badge className="mb-2 gap-1 bg-primary/20 text-primary hover:bg-primary/25">
                  <Sparkles className="h-3.5 w-3.5" /> Professional earning dashboard
                </Badge>
                <h1 className="font-serif text-3xl font-bold leading-tight sm:text-4xl">
                  Welcome, <span className="text-primary">{displayName}</span>
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  Track mining, rewards, tasks, achievements, referrals, and ranks from one clean dashboard.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[360px]">
              <Button
                onClick={() => checkinMutation.mutate()}
                disabled={checkedInToday || checkinMutation.isPending}
                className="h-auto justify-start gap-3 rounded-2xl py-4"
                data-testid="button-checkin"
              >
                {checkedInToday ? <CheckCircle2 className="h-5 w-5" /> : <CalendarCheck className="h-5 w-5" />}
                <span className="text-left">
                  <span className="block font-semibold">{checkedInToday ? "Checked in today" : "Daily Check-in"}</span>
                  <span className="block text-xs opacity-80">
                    {checkedInToday ? "Next reward tomorrow" : `${nf(summary.checkin.currentStreak)} day streak`}
                  </span>
                </span>
              </Button>
              <Button asChild variant="outline" className="h-auto justify-start gap-3 rounded-2xl theme-outline-action py-4">
                <Link href="/profile">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  <span className="text-left">
                    <span className="block font-semibold">Profile Hub</span>
                    <span className="block text-xs text-muted-foreground">Level {nf(summary.xp.level)} account</span>
                  </span>
                </Link>
              </Button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <div className="rounded-2xl border theme-inset-panel p-4 backdrop-blur-md">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Total XNRT earned</p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-primary sm:text-5xl">{nf(summary.balance.totalEarned)}</span>
                    <span className="text-lg font-semibold text-muted-foreground">XNRT</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[310px]">
                  <div className="rounded-xl theme-tile p-3">
                    <p className="text-xs text-muted-foreground">Available</p>
                    <p className="font-bold">{nf(summary.balance.available)}</p>
                  </div>
                  <div className="rounded-xl theme-tile p-3">
                    <p className="text-xs text-muted-foreground">Mining</p>
                    <p className="font-bold">{nf(summary.balance.mining)}</p>
                  </div>
                  <div className="rounded-xl theme-tile p-3">
                    <p className="text-xs text-muted-foreground">Referral</p>
                    <p className="font-bold">{nf(summary.balance.referral)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border theme-inset-panel p-4 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">XP Level</p>
                  <p className="mt-1 text-2xl font-bold">Level {nf(summary.xp.level)}</p>
                </div>
                <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                  {formatRank(summary.leaderboard.xpRank)} XP rank
                </Badge>
              </div>
              <div className="mt-4 flex items-end justify-between text-sm">
                <span>{nf(summary.xp.total)} XP</span>
                <span className="text-muted-foreground">{nf(summary.xp.toNextLevel)} XP to next</span>
              </div>
              <Progress value={summary.xp.progressPercent} className="mt-2 h-2 bg-muted" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Available Balance"
          value={summary.balance.available}
          suffix="XNRT"
          helper="Ready for staking or withdrawal"
          href="/wallet"
          icon={<Wallet className="h-5 w-5" />}
        />
        <StatCard
          title="Active Staking"
          value={summary.staking.totalActiveStaked}
          suffix="XNRT"
          helper={`${nf(summary.staking.activeStakes)} active stake${summary.staking.activeStakes === 1 ? "" : "s"}`}
          href="/staking"
          icon={<Gem className="h-5 w-5" />}
        />
        <StatCard
          title="Referral Network"
          value={summary.referrals.totalNetwork}
          helper={`${nf(summary.referrals.direct)} direct • ${formatRank(summary.leaderboard.referralRank)}`}
          href="/referrals"
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          title="Mining Sessions"
          value={summary.mining.completedSessions}
          helper={`${nf(summary.mining.totalXnrtMined)} XNRT mined lifetime`}
          href="/mining"
          icon={<Pickaxe className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="overflow-hidden rounded-3xl theme-elevated-card">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Pickaxe className="h-5 w-5 text-primary" /> 24-hour Mining Engine
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Every full mining cycle gives exactly {nf(summary.mining.reward.xnrt)} XNRT + {nf(summary.mining.reward.xp)} XP.
                </p>
              </div>
              <Badge variant="outline" className={cn("w-fit gap-2 theme-outline-action", miningActive && "border-primary/30 bg-primary/10 text-primary")}>
                {miningActive ? <Clock3 className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
                {miningActive ? "Mining active" : "Ready to start"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
              <div className="grid place-items-center rounded-3xl border theme-inset-panel p-6 text-center">
                <div className="relative grid h-40 w-40 place-items-center rounded-full border border-primary/30 bg-primary/10 shadow-inner shadow-primary/20">
                  <div className="absolute inset-3 rounded-full border border-dashed border-primary/25" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Countdown</p>
                    <p className="mt-2 text-3xl font-bold text-primary">{miningActive ? formatDuration(miningRemainingMs) : "24:00:00"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">HH:MM:SS</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 rounded-3xl border theme-inset-panel p-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Mining progress</span>
                  <span className="text-muted-foreground">{nf(miningActive ? miningProgress : 0)}%</span>
                </div>
                <Progress value={miningActive ? miningProgress : 0} className="h-3 bg-muted" />

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl theme-tile p-3">
                    <p className="text-xs text-muted-foreground">Reward</p>
                    <p className="mt-1 font-bold text-primary">{nf(summary.mining.reward.xnrt)} XNRT</p>
                  </div>
                  <div className="rounded-2xl theme-tile p-3">
                    <p className="text-xs text-muted-foreground">XP</p>
                    <p className="mt-1 font-bold">+{nf(summary.mining.reward.xp)} XP</p>
                  </div>
                  <div className="rounded-2xl theme-tile p-3">
                    <p className="text-xs text-muted-foreground">Duration</p>
                    <p className="mt-1 font-bold">{nf(summary.mining.reward.durationHours)} hours</p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button asChild className="flex-1 gap-2 rounded-2xl">
                    <Link href="/mining">
                      <Pickaxe className="h-4 w-4" /> {miningActive ? "View Mining" : "Start Mining"}
                    </Link>
                  </Button>
                  {miningReadyToClaim ? (
                    <Button
                      variant="outline"
                      className="flex-1 gap-2 rounded-2xl theme-outline-action"
                      onClick={() => processMiningMutation.mutate()}
                      disabled={processMiningMutation.isPending}
                    >
                      <Gift className="h-4 w-4" /> Claim Reward
                    </Button>
                  ) : (
                    <Button asChild variant="outline" className="flex-1 gap-2 rounded-2xl theme-outline-action">
                      <Link href="/rewards">
                        <Gift className="h-4 w-4" /> Rewards
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-3xl theme-elevated-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Rocket className="h-5 w-5 text-primary" /> Quick actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <QuickAction
              href="/mining"
              icon={<Pickaxe className="h-5 w-5" />}
              title={miningActive ? "Open Mining Session" : "Start Mining"}
              hint="24h session • 5 XNRT + 10 XP"
              primary={!miningActive}
            />
            <QuickAction
              href="/tasks"
              icon={<Target className="h-5 w-5" />}
              title="Complete Tasks"
              hint={`${nf(summary.tasks.remaining)} remaining today`}
            />
            <QuickAction
              href="/trust-loan"
              icon={<HandCoins className="h-5 w-5" />}
              title="Trust Loan"
              hint="Referral-based virtual stake"
            />
            <QuickAction
              href="/leaderboard"
              icon={<Trophy className="h-5 w-5" />}
              title="View Leaderboard"
              hint={`${formatRank(summary.leaderboard.xpRank)} XP rank`}
            />
            <QuickAction
              href="/wallet"
              icon={<Wallet className="h-5 w-5" />}
              title="Open Wallet"
              hint="Deposit, stake, withdraw"
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ProgressCard
          title="Tasks progress"
          value={summary.tasks.completed}
          total={summary.tasks.totalActive}
          percent={summary.tasks.progressPercent}
          helper={`${nf(summary.tasks.remaining)} active task${summary.tasks.remaining === 1 ? "" : "s"} left`}
          icon={<Target className="h-5 w-5" />}
          href="/tasks"
        />
        <ProgressCard
          title="Achievements"
          value={summary.achievements.unlocked}
          total={summary.achievements.total}
          percent={summary.achievements.progressPercent}
          helper={`${nf(summary.achievements.remaining)} milestone${summary.achievements.remaining === 1 ? "" : "s"} remaining`}
          icon={<Award className="h-5 w-5" />}
          href="/achievements"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="overflow-hidden rounded-3xl theme-elevated-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Share2 className="h-5 w-5 text-primary" /> Invite and earn
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border theme-inset-panel p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Your referral code</p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <code className="rounded-xl bg-muted px-3 py-2 dark:bg-white/10 font-mono text-lg font-bold text-primary">{summary.user.referralCode}</code>
                <Button variant="outline" size="sm" className="gap-2 theme-outline-action" onClick={copyReferralLink}>
                  <Clipboard className="h-4 w-4" /> Copy
                </Button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl theme-tile p-3 text-center">
                <p className="text-xs text-muted-foreground">Direct</p>
                <p className="text-xl font-bold">{nf(summary.referrals.direct)}</p>
              </div>
              <div className="rounded-2xl theme-tile p-3 text-center">
                <p className="text-xs text-muted-foreground">Network</p>
                <p className="text-xl font-bold">{nf(summary.referrals.totalNetwork)}</p>
              </div>
              <div className="rounded-2xl theme-tile p-3 text-center">
                <p className="text-xs text-muted-foreground">Commission</p>
                <p className="text-xl font-bold">{nf(summary.referrals.paidCommission)}</p>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button onClick={shareReferralLink} className="flex-1 gap-2 rounded-2xl">
                <Share2 className="h-4 w-4" /> Share link
              </Button>
              <Button asChild variant="outline" className="flex-1 gap-2 rounded-2xl theme-outline-action">
                <Link href="/referrals">
                  <Users className="h-4 w-4" /> Referral dashboard
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-3xl theme-elevated-card">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-xl">
                <ActivityIcon className="h-5 w-5 text-primary" /> Recent activity
              </CardTitle>
              <Button asChild variant="ghost" size="sm" className="gap-1">
                <Link href="/profile">
                  View all <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!summary.recentActivities.length ? (
              <div className="rounded-2xl border border-dashed border-border/70 p-8 text-center">
                <Sparkles className="mx-auto h-8 w-8 text-primary" />
                <p className="mt-3 font-semibold">No activity yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Start mining, complete a task, or invite friends to build your timeline.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {summary.recentActivities.map((activity) => (
                  <div key={activity.id} className="flex gap-3 rounded-2xl border theme-inset-panel p-3">
                    <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground">{activity.description}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{safeDate(activity.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
