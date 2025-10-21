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

/** ---------- Tokens for the cosmic gold palette (aligned with XNRT branding) ---------- */
const tok = {
  xnrt1: "#FFC247",
  xnrt2: "#FF8F1F",
  xp1: "#FFC247",
  xp2: "#FFD966",
  earned1: "#FFC247",
  earned2: "#FFD966",
  stake1: "#FF9B2F",
  stake2: "#FFC247",
  ref1: "#FFD966",
  ref2: "#FFC247",
  mine1: "#FFD966",
  mine2: "#FF9B2F",
};

/** ---------- Coin icon that matches your screenshot ---------- */
function CoinGlyph({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="coinRing" x1="0" x2="1">
          <stop offset="0" stopColor={tok.xnrt1} />
          <stop offset="1" stopColor={tok.xnrt2} />
        </linearGradient>
      </defs>
      <circle
        cx="24"
        cy="24"
        r="18"
        fill="none"
        stroke="url(#coinRing)"
        strokeWidth="4"
      />
      <circle cx="24" cy="24" r="10" fill="none" stroke="url(#coinRing)" strokeWidth="2" />
      <path d="M16 24h16" stroke="url(#coinRing)" strokeWidth="2" />
      <path d="M20 18h8M20 30h8" stroke="url(#coinRing)" strokeWidth="2" />
      <circle
        cx="24"
        cy="24"
        r="21"
        fill="none"
        stroke={tok.xnrt1}
        strokeOpacity="0.12"
        strokeWidth="6"
      />
    </svg>
  );
}

/** ---------- Small UI atoms ---------- */
function Scanline() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] opacity-40 bg-gradient-to-r from-[#FFC247] via-[#FFD966] to-[#FF9B2F]" />
  );
}

function StatTile({
  label,
  value,
  gradient,
  icon,
  href,
}: {
  label: string;
  value: string | number;
  gradient: [string, string];
  icon: React.ReactNode;
  href: string;
}) {
  const num = typeof value === "string" 
    ? (isNaN(parseFloat(value.replace(/[^0-9.-]/g, ""))) ? 0 : parseFloat(value.replace(/[^0-9.-]/g, ""))).toLocaleString()
    : value;

  const body = (
    <Card 
      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl transition-all hover:translate-y-[-2px]"
      style={{
        boxShadow: "0 0 0 rgba(0,0,0,0)",
        transition: "all 0.3s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = `0 12px 28px ${gradient[0]}40`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "0 0 0 rgba(0,0,0,0)";
      }}
    >
      <Scanline />
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p
              className="mt-2 bg-clip-text text-3xl font-extrabold text-transparent"
              style={{
                backgroundImage: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`,
                textShadow: `0 0 20px ${gradient[0]}33`,
              }}
              data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {num}
            </p>
          </div>
          <div
            className="grid h-10 w-10 place-items-center rounded-xl"
            style={{
              backgroundImage: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`,
              boxShadow: `0 0 22px ${gradient[0]}44`,
            }}
          >
            <span className="text-slate-950">{icon}</span>
          </div>
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
    <Link href={href}>
      <Button
        variant="outline"
        className="w-full justify-between rounded-xl border-white/10 bg-white/[0.04] px-4 py-5 text-left backdrop-blur-md transition-all hover:translate-x-[3px] hover:bg-white/[0.07]"
        data-testid={`button-quick-${title.toLowerCase().replace(/\s+/g, "-")}`}
      >
        <span className="flex items-center gap-3">
          {icon}
          <span className="text-left">
            <span className="block font-semibold">{title}</span>
            <span className="block text-xs text-muted-foreground">{hint}</span>
          </span>
        </span>
        <ArrowRight className="h-5 w-5" />
      </Button>
    </Link>
  );
}

/** ---------- Main Page ---------- */
export default function Home() {
  const { toast } = useToast();
  const { celebrate } = useConfetti();
  const { user, isLoading: userLoading } = useAuth();

  const { data: balance } = useQuery<Balance>({ queryKey: ["/api/balance"] });

  const { data: stats } = useQuery<{
    activeStakes: number;
    miningSessions: number;
    totalReferrals: number;
    recentActivity: Array<{ id: string; type: string; description: string; createdAt: Date }>;
  }>({ queryKey: ["/api/stats"] });

  const checkinMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/checkin");
      return await res.json();
    },
    onSuccess: (data: any) => {
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
    onError: (error: any) => {
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
            Welcome,{" "}
            <span 
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: `linear-gradient(135deg, ${tok.xnrt1}, ${tok.xnrt2})`,
              }}
            >
              {displayName}
            </span>
          </h1>
          <p className="text-muted-foreground">Beyond a coin. It's hope</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="glass-chip relative gap-2 px-4 py-2"
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
        {/* Balance (glass + coin glyph) */}
        <Card className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl">
          <Scanline />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Total XNRT Balance
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-6">
            <div className="flex items-end gap-3">
              <CoinGlyph className="h-12 w-12" />
              <div
                className="bg-clip-text text-5xl font-black tracking-tight text-transparent"
                style={{
                  backgroundImage: `linear-gradient(135deg, ${tok.xnrt1}, ${tok.xnrt2})`,
                  textShadow: `0 0 26px ${tok.xnrt1}40`,
                }}
                data-testid="text-balance"
              >
                {parseFloat(xnrtBalance).toLocaleString()}
              </div>
              <span className="text-2xl font-extrabold text-muted-foreground">XNRT</span>
            </div>
          </CardContent>
        </Card>

        {/* XP & Level (progress + glow) */}
        <Card className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl">
          <Scanline />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              XP & Level
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-end gap-2">
                <Award className="h-9 w-9 text-primary drop-shadow-[0_0_18px_rgba(255,194,71,0.45)]" />
                <span className="text-5xl font-black text-primary" data-testid="text-level">
                  {level}
                </span>
              </div>
              <div className="text-right">
                <div
                  className="bg-clip-text text-3xl font-extrabold text-transparent"
                  style={{
                    backgroundImage: `linear-gradient(135deg, ${tok.xp1}, ${tok.xp2})`,
                    textShadow: `0 0 22px ${tok.xp1}60`,
                  }}
                  data-testid="text-xp"
                >
                  {xp.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">
                  {Math.max(0, (Math.floor(xp / 1000) + 1) * 1000 - xp).toLocaleString()} XP
                  to Lv {Math.floor(xp / 1000) + 2}
                </div>
              </div>
            </div>

            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full w-0 rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  backgroundImage: `linear-gradient(90deg, ${tok.xp1}, ${tok.xp2})`,
                  boxShadow: `0 0 16px ${tok.xp1}70`,
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* STATS GRID */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Total Earned"
          value={balance?.totalEarned || "0"}
          gradient={[tok.earned1, tok.earned2]}
          icon={<TrendingUp className="h-5 w-5" />}
          href="/wallet"
        />
        <StatTile
          label="Active Stakes"
          value={stats?.activeStakes || 0}
          gradient={[tok.stake1, tok.stake2]}
          icon={<Gem className="h-5 w-5" />}
          href="/staking"
        />
        <StatTile
          label="Referrals"
          value={stats?.totalReferrals || 0}
          gradient={[tok.ref1, tok.ref2]}
          icon={<Users className="h-5 w-5" />}
          href="/referrals"
        />
        <StatTile
          label="Mining Sessions"
          value={stats?.miningSessions || 0}
          gradient={[tok.mine1, tok.mine2]}
          icon={<Pickaxe className="h-5 w-5" />}
          href="/mining"
        />
      </div>

      {/* ACTIONS + ACTIVITY */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl">
          <Scanline />
          <CardHeader className="pb-2">
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <QuickActionRow
              href="/staking"
              icon={<Gem className="h-5 w-5 text-primary" />}
              title="Start Staking"
              hint="2–3 min • +30–60 XP"
            />
            <QuickActionRow
              href="/mining"
              icon={<Pickaxe className="h-5 w-5 text-primary" />}
              title="Start Mining"
              hint="5–10 min • +40–90 XP"
            />
            <QuickActionRow
              href="/tasks"
              icon={<Award className="h-5 w-5 text-primary" />}
              title="Complete Tasks"
              hint="1–2 min • +15–30 XP"
            />
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl">
          <Scanline />
          <CardHeader className="pb-2">
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {!stats?.recentActivity || stats.recentActivity.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No recent activity. Start earning to see your activity here!
                </p>
              ) : (
                stats.recentActivity.slice(0, 5).map((activity: any) => (
                  <div key={activity.id} className="flex items-start gap-3 text-sm">
                    <div className="mt-2 h-2 w-2 rounded-full bg-primary shadow-[0_0_10px_rgba(255,194,71,.7)]" />
                    <div className="flex-1">
                      <p className="text-foreground">{activity.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(activity.createdAt).toLocaleString()}
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
