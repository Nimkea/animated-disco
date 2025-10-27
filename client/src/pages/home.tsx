import * as React from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SkeletonDashboard } from "@/components/skeletons";
import {
  TrendingUp,
  Gem,
  Users,
  Pickaxe,
  Flame,
  Award,
  ArrowRight,
  CalendarCheck,
} from "lucide-react";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Balance } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { useConfetti } from "@/hooks/use-confetti";
import { AnnouncementBanner } from "@/components/announcement-banner";
import { nf } from "@/lib/number";

function CoinGlyph({ className = "h-10 w-10" }: { className?: string }) {
  const id = React.useId();
  const gradId = `coinRing-${id}`;
  
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      aria-hidden="true"
      role="img"
    >
      <defs>
        <linearGradient id={gradId} x1="0" x2="1">
          <stop offset="0" stopColor="hsl(42, 90%, 50%)" />
          <stop offset="1" stopColor="hsl(42, 90%, 60%)" />
        </linearGradient>
      </defs>
      <circle
        cx="24"
        cy="24"
        r="18"
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth="4"
      />
      <circle cx="24" cy="24" r="10" fill="none" stroke={`url(#${gradId})`} strokeWidth="2" />
      <path d="M16 24h16" stroke={`url(#${gradId})`} strokeWidth="2" />
      <path d="M20 18h8M20 30h8" stroke={`url(#${gradId})`} strokeWidth="2" />
      <circle
        cx="24"
        cy="24"
        r="21"
        fill="none"
        stroke="hsl(42, 90%, 50%)"
        strokeOpacity="0.12"
        strokeWidth="6"
      />
    </svg>
  );
}

function StatTile({
  label,
  value,
  colorClass,
  icon,
  href,
}: {
  label: string;
  value: string | number;
  colorClass: string;
  icon: React.ReactNode;
  href: string;
}) {
  const num = nf(value);

  const body = (
    <Card 
      className="group relative overflow-hidden rounded-2xl border-white/10 bg-white/5 backdrop-blur-md transition-all hover:translate-y-[-2px] hover:bg-white/[0.07]"
      data-testid={`card-stat-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p
            className="mt-1 text-2xl font-bold"
            data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}
          >
            {num}
          </p>
        </div>
        <div
          className={`grid h-10 w-10 place-items-center rounded-full ${colorClass}`}
        >
          {icon}
        </div>
      </CardContent>
    </Card>
  );

  return href ? <Link href={href}>{body}</Link> : body;
}

function QuickActionRow({
  href,
  icon,
  title,
  hint,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <Button
      asChild
      variant="outline"
      className="w-full justify-between rounded-xl border-white/10 bg-white/[0.02] px-4 py-6 text-left backdrop-blur-sm transition-all hover:translate-x-[3px] hover:bg-white/[0.05]"
      data-testid={`button-quick-${title.toLowerCase().replace(/\s+/g, "-")}`}
      aria-label={`${title} – ${hint}`}
    >
      <Link href={href}>
        <span className="flex items-center gap-3">
          {icon}
          <span className="text-left">
            <span className="block font-semibold">{title}</span>
            <span className="block text-xs text-muted-foreground">{hint}</span>
          </span>
        </span>
        <ArrowRight className="h-5 w-5" />
      </Link>
    </Button>
  );
}

type Activity = { 
  id: string; 
  type: string; 
  description: string; 
  createdAt: string;
};

type CheckinResponse = {
  streak: number;
  xnrtReward: number;
  xpReward: number;
};

export default function Home() {
  const { toast } = useToast();
  const { celebrate } = useConfetti();
  const { user, isLoading: userLoading } = useAuth();

  const { data: balance, isLoading: balanceLoading } = useQuery<Balance>({ 
    queryKey: ["/api/balance"],
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });

  const { data: stats, isLoading: statsLoading } = useQuery<{
    activeStakes: number;
    miningSessions: number;
    totalReferrals: number;
    recentActivity: Activity[];
  }>({ 
    queryKey: ["/api/stats"],
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });

  const checkinMutation = useMutation<CheckinResponse, Error>({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/checkin");
      if (!res.ok) throw new Error((await res.text()) || "Check-in failed");
      return await res.json();
    },
    onSuccess: (data) => {
      const streakMilestones = [7, 14, 30, 60, 90, 180, 365];
      const isStreakMilestone = streakMilestones.includes(data.streak);

      const previousXP = user?.xp ?? 0;
      const newXP = previousXP + (data.xpReward || 0);
      const previousLevel = Math.floor(previousXP / 1000) + 1;
      const newLevel = Math.floor(newXP / 1000) + 1;
      const leveledUp = newLevel > previousLevel;

      toast({
        title: "Check-in Successful!",
        description: `Day ${data.streak} streak! Earned ${data.xnrtReward} XNRT and ${data.xpReward} XP`,
      });

      if (isStreakMilestone) celebrate("streak");
      if (leveledUp) celebrate("levelup");

      queryClient.invalidateQueries({ queryKey: ["/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (error) => {
      toast({
        title: "Check-in Failed",
        description: error.message || "Already checked in today",
        variant: "destructive",
      });
    },
  });

  if (userLoading) return <SkeletonDashboard />;

  const level = user?.level ?? 1;
  const xp = user?.xp ?? 0;
  const streak = user?.streak ?? 0;
  const xnrtBalance = balance?.xnrtBalance || "0";
  const displayName =
    user?.username || (user as any)?.name || user?.email?.split("@")?.[0] || "User";

  const pct = Math.max(0, Math.min(100, (xp % 1000) / 10));

  return (
    <div className="space-y-6">
      <AnnouncementBanner />

      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-serif text-3xl font-bold">
            Welcome, <span className="text-primary">{displayName}</span>
          </h1>
          <p className="text-sm text-muted-foreground">Beyond a coin. It's hope</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="gap-2 border-white/10 bg-white/5 px-3 py-2 backdrop-blur-sm"
            data-testid="badge-streak"
          >
            <Flame className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">{streak} Day Streak</span>
          </Badge>
          <Button
            onClick={() => checkinMutation.mutate()}
            disabled={checkinMutation.isPending}
            data-testid="button-checkin"
            className="gap-2"
          >
            <CalendarCheck className="h-4 w-4" />
            {checkinMutation.isPending ? "Checking in..." : "Daily Check-in"}
          </Button>
        </div>
      </div>

      {/* HERO GRID */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Balance */}
        <Card className="relative overflow-hidden rounded-2xl border-white/10 bg-white/5 backdrop-blur-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total XNRT Balance
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-6">
            {balanceLoading ? (
              <div className="h-10 w-48 rounded bg-white/10 animate-pulse" role="status" aria-label="Loading balance" />
            ) : (
              <div className="flex items-center gap-3">
                <CoinGlyph className="h-12 w-12" />
                <div className="flex items-baseline gap-2">
                  <span
                    className="text-4xl font-bold text-primary"
                    data-testid="text-balance"
                  >
                    {nf(xnrtBalance)}
                  </span>
                  <span className="text-xl font-semibold text-muted-foreground">XNRT</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* XP & Level */}
        <Card className="relative overflow-hidden rounded-2xl border-white/10 bg-white/5 backdrop-blur-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              XP & Level
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="h-9 w-9 text-primary" />
                <span className="text-4xl font-bold text-primary" data-testid="text-level">
                  {level}
                </span>
              </div>
              <div className="text-right">
                <div
                  className="text-2xl font-bold text-foreground"
                  data-testid="text-xp"
                >
                  {nf(xp)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {nf(Math.max(0, (Math.floor(xp / 1000) + 1) * 1000 - xp))} XP
                  to Lv {Math.floor(xp / 1000) + 2}
                </div>
              </div>
            </div>

            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* STATS GRID */}
      {statsLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-2xl border-white/10 bg-white/5 animate-pulse" role="status" aria-label="Loading stats" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Total Earned"
            value={balance?.totalEarned || "0"}
            colorClass="bg-[hsl(var(--stat-green))]"
            icon={<TrendingUp className="h-5 w-5 text-white" />}
            href="/wallet"
          />
          <StatTile
            label="Active Stakes"
            value={stats?.activeStakes || 0}
            colorClass="bg-[hsl(var(--stat-pink))]"
            icon={<Gem className="h-5 w-5 text-white" />}
            href="/staking"
          />
          <StatTile
            label="Referrals"
            value={stats?.totalReferrals || 0}
            colorClass="bg-[hsl(var(--stat-blue))]"
            icon={<Users className="h-5 w-5 text-white" />}
            href="/referrals"
          />
          <StatTile
            label="Mining Sessions"
            value={stats?.miningSessions || 0}
            colorClass="bg-[hsl(var(--stat-gold))]"
            icon={<Pickaxe className="h-5 w-5 text-white" />}
            href="/mining"
          />
        </div>
      )}

      {/* ACTIONS + ACTIVITY */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="relative overflow-hidden rounded-2xl border-white/10 bg-white/5 backdrop-blur-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <QuickActionRow
              href="/staking"
              icon={<Gem className="h-5 w-5 text-[hsl(var(--stat-pink))]" />}
              title="Start Staking"
              hint="2–3 min • +30–60 XP"
            />
            <QuickActionRow
              href="/mining"
              icon={<Pickaxe className="h-5 w-5 text-[hsl(var(--stat-blue))]" />}
              title="Start Mining"
              hint="5–10 min • +40–90 XP"
            />
            <QuickActionRow
              href="/tasks"
              icon={<Award className="h-5 w-5 text-[hsl(var(--stat-gold))]" />}
              title="Complete Tasks"
              hint="1–2 min • +15–30 XP"
            />
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden rounded-2xl border-white/10 bg-white/5 backdrop-blur-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {!stats?.recentActivity || stats.recentActivity.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No recent activity. Start earning to see your activity here!
                </p>
              ) : (
                stats.recentActivity.slice(0, 5).map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3 text-sm">
                    <div className="mt-1.5 h-2 w-2 rounded-full bg-primary" />
                    <div className="flex-1">
                      <p className="text-foreground">{activity.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Intl.DateTimeFormat(undefined, { 
                          dateStyle: "medium", 
                          timeStyle: "short" 
                        }).format(new Date(activity.createdAt))}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
