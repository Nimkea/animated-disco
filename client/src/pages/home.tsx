import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SkeletonDashboard } from "@/components/skeletons";
import {
  Coins,
  TrendingUp,
  Gem,
  Users,
  Pickaxe,
  Flame,
  Award,
  ArrowRight,
  CalendarCheck,
  TrendingDown,
  Minus,
} from "lucide-react";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Balance } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { useConfetti } from "@/hooks/use-confetti";
import { AnimatedCounter } from "@/components/animated-counter";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

export default function Home() {
  const { toast } = useToast();
  const { celebrate } = useConfetti();
  
  // Single source of truth for current user
  const { user, isLoading: userLoading } = useAuth();

  const { data: balance, isLoading: balanceLoading } = useQuery<Balance>({
    queryKey: ["/api/balance"],
  });

  const { data: stats } = useQuery<{
    activeStakes: number;
    miningSessions: number;
    totalReferrals: number;
    recentActivity: Array<{ id: string; type: string; description: string; createdAt: Date }>;
  }>({
    queryKey: ["/api/stats"],
  });

  const checkinMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/checkin");
      return await res.json();
    },
    onSuccess: (data: any) => {
      // Check if streak reached a milestone (7, 14, 30, 60, 90, 180, 365)
      const streakMilestones = [7, 14, 30, 60, 90, 180, 365];
      const isStreakMilestone = streakMilestones.includes(data.streak);
      
      // Calculate level before and after XP gain for level-up detection
      const previousXP = user?.xp ?? 0;
      const newXP = previousXP + (data.xpReward || 0);
      const previousLevel = Math.floor(previousXP / 1000) + 1;
      const newLevel = Math.floor(newXP / 1000) + 1;
      const leveledUp = newLevel > previousLevel;
      
      toast({
        title: "Check-in Successful!",
        description: `Day ${data.streak} streak! Earned ${data.xnrtReward} XNRT and ${data.xpReward} XP`,
      });
      
      // Trigger confetti for streak milestones
      if (isStreakMilestone) {
        celebrate('streak');
      }
      
      // Trigger confetti for level-ups
      if (leveledUp) {
        celebrate('levelup');
      }
      
      // Refresh the user that useAuth reads
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

  if (userLoading) {
    return <SkeletonDashboard />;
  }

  const level = user?.level ?? 1;
  const xp = user?.xp ?? 0;
  const streak = user?.streak ?? 0;
  const xnrtBalance = balance?.xnrtBalance || "0";
  const displayName =
    user?.username ||
    (user as any)?.name ||
    user?.email?.split("@")?.[0] ||
    "User";

  // Mock balance trend data (last 7 days)
  const balanceTrend = [
    { value: parseFloat(xnrtBalance) * 0.7 },
    { value: parseFloat(xnrtBalance) * 0.75 },
    { value: parseFloat(xnrtBalance) * 0.8 },
    { value: parseFloat(xnrtBalance) * 0.85 },
    { value: parseFloat(xnrtBalance) * 0.9 },
    { value: parseFloat(xnrtBalance) * 0.95 },
    { value: parseFloat(xnrtBalance) },
  ];

  // Calculate XP progress to next level
  const xpForCurrentLevel = (level - 1) * 1000;
  const xpForNextLevel = level * 1000;
  const xpProgress = ((xp - xpForCurrentLevel) / (xpForNextLevel - xpForCurrentLevel)) * 100;

  // Generate sparkline data for stats
  const generateSparklineData = (value: number, trend: number) => {
    const points = 7;
    const data = [];
    const avgValue = typeof value === 'string' ? parseFloat(value) : value;
    
    for (let i = 0; i < points; i++) {
      const variance = (Math.random() - 0.5) * 0.2 * avgValue;
      const trendEffect = (i / points) * (trend / 100) * avgValue;
      data.push({ value: Math.max(0, avgValue * 0.7 + variance + trendEffect) });
    }
    return data;
  };

  const quickStats = [
    {
      label: "Total Earned",
      value: balance?.totalEarned || "0",
      icon: TrendingUp,
      color: "text-chart-2",
      trend: 12,
      link: "/wallet",
      sparklineData: generateSparklineData(parseFloat(balance?.totalEarned || "0"), 12),
    },
    {
      label: "Active Stakes",
      value: stats?.activeStakes || 0,
      icon: Gem,
      color: "text-chart-5",
      trend: stats?.activeStakes ? 5 : 0,
      link: "/staking",
      sparklineData: generateSparklineData(stats?.activeStakes || 0, stats?.activeStakes ? 5 : 0),
    },
    {
      label: "Referrals",
      value: stats?.totalReferrals || 0,
      icon: Users,
      color: "text-chart-1",
      trend: stats?.totalReferrals ? 8 : 0,
      link: "/referrals",
      sparklineData: generateSparklineData(stats?.totalReferrals || 0, stats?.totalReferrals ? 8 : 0),
    },
    {
      label: "Mining Sessions",
      value: stats?.miningSessions || 0,
      icon: Pickaxe,
      color: "text-chart-3",
      trend: stats?.miningSessions ? 3 : 0,
      link: "/mining",
      sparklineData: generateSparklineData(stats?.miningSessions || 0, stats?.miningSessions ? 3 : 0),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-serif">
            Welcome, <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">{displayName}</span>
          </h1>
          <p className="text-muted-foreground">Beyond a coin. It's hope</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-2 px-4 py-2" data-testid="badge-streak">
            <Flame className="h-4 w-4 text-orange-500" />
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

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="relative overflow-hidden border-primary/30 bg-card/40 backdrop-blur-xl shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent" />
          <CardHeader className="relative">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total XNRT Balance</CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <div className="flex items-baseline gap-2 mb-4">
              <Coins className="h-8 w-8 text-primary" />
              <span className="text-5xl font-bold font-mono bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent" data-testid="text-balance">
                <AnimatedCounter value={parseFloat(xnrtBalance)} />
              </span>
              <span className="text-2xl text-muted-foreground">XNRT</span>
            </div>
            <div className="h-16 -mx-6">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={balanceTrend}>
                  <defs>
                    <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    fill="url(#balanceGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-secondary/30 bg-card/40 backdrop-blur-xl shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 to-transparent" />
          <CardHeader className="relative">
            <CardTitle className="text-sm font-medium text-muted-foreground">XP & Level</CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <div className="flex items-center justify-between">
              <div className="relative">
                <svg className="w-24 h-24 transform -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    className="text-secondary/20"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 40}`}
                    strokeDashoffset={`${2 * Math.PI * 40 * (1 - xpProgress / 100)}`}
                    className="text-secondary transition-all duration-1000"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl font-bold font-mono text-secondary" data-testid="text-level">
                    <AnimatedCounter value={level} />
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-foreground" data-testid="text-xp">
                  <AnimatedCounter value={xp} />
                </div>
                <div className="text-sm text-muted-foreground">XP Points</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {Math.round(xpProgress)}% to Level {level + 1}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {quickStats.map((stat) => (
          <Link key={stat.label} href={stat.link}>
            <Card className="group relative overflow-hidden border-primary/20 bg-card/40 backdrop-blur-xl hover:bg-card/60 hover:scale-105 cursor-pointer transition-all duration-300 shadow-lg hover:shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="relative p-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <stat.icon className={`h-10 w-10 ${stat.color} group-hover:scale-110 transition-transform`} />
                </div>
                <p className="text-3xl font-bold font-mono mb-2" data-testid={`stat-${stat.label.toLowerCase().replace(' ', '-')}`}>
                  <AnimatedCounter 
                    value={typeof stat.value === 'string' ? parseFloat(stat.value) : stat.value}
                  />
                </p>
                <div className="h-10 -mx-6 mb-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stat.sparklineData}>
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke={`hsl(var(--${stat.color.replace('text-', '')}))`}
                        fill={`hsl(var(--${stat.color.replace('text-', '')}))`}
                        fillOpacity={0.2}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                {stat.trend !== 0 && (
                  <div className="flex items-center gap-1">
                    {stat.trend > 0 ? (
                      <TrendingUp className="h-3 w-3 text-chart-2" />
                    ) : stat.trend < 0 ? (
                      <TrendingDown className="h-3 w-3 text-destructive" />
                    ) : (
                      <Minus className="h-3 w-3 text-muted-foreground" />
                    )}
                    <span className={`text-xs ${stat.trend > 0 ? 'text-chart-2' : stat.trend < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {stat.trend > 0 ? '+' : ''}{stat.trend}% this week
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="relative overflow-hidden border-primary/20 bg-card/40 backdrop-blur-xl shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
          <CardHeader className="relative">
            <CardTitle className="flex items-center justify-between">
              <span>Quick Actions</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="relative space-y-3">
            <Link href="/staking">
              <div className="group relative p-4 rounded-lg border border-chart-5/30 bg-gradient-to-br from-chart-5/10 to-transparent hover:from-chart-5/20 hover:border-chart-5/50 transition-all cursor-pointer" data-testid="button-quick-stake">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-chart-5/20 group-hover:bg-chart-5/30 transition-colors">
                      <Gem className="h-5 w-5 text-chart-5" />
                    </div>
                    <div>
                      <p className="font-semibold">Start Staking</p>
                      <p className="text-xs text-muted-foreground">Earn up to 730% APY</p>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-chart-5 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </Link>
            <Link href="/mining">
              <div className="group relative p-4 rounded-lg border border-chart-3/30 bg-gradient-to-br from-chart-3/10 to-transparent hover:from-chart-3/20 hover:border-chart-3/50 transition-all cursor-pointer" data-testid="button-quick-mine">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-chart-3/20 group-hover:bg-chart-3/30 transition-colors">
                      <Pickaxe className="h-5 w-5 text-chart-3" />
                    </div>
                    <div>
                      <p className="font-semibold">Start Mining</p>
                      <p className="text-xs text-muted-foreground">24hr auto-complete sessions</p>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-chart-3 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </Link>
            <Link href="/tasks">
              <div className="group relative p-4 rounded-lg border border-chart-1/30 bg-gradient-to-br from-chart-1/10 to-transparent hover:from-chart-1/20 hover:border-chart-1/50 transition-all cursor-pointer" data-testid="button-quick-tasks">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-chart-1/20 group-hover:bg-chart-1/30 transition-colors">
                      <Award className="h-5 w-5 text-chart-1" />
                    </div>
                    <div>
                      <p className="font-semibold">Complete Tasks</p>
                      <p className="text-xs text-muted-foreground">Earn XP and rewards</p>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-chart-1 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </Link>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-primary/20 bg-card/40 backdrop-blur-xl shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-secondary/5 to-transparent" />
          <CardHeader className="relative">
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <div className="space-y-3">
              {!stats?.recentActivity || stats.recentActivity.length === 0 ? (
                <div className="text-center py-8">
                  <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                    <TrendingUp className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    No recent activity yet
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Start earning to see your activity here!
                  </p>
                </div>
              ) : (
                stats.recentActivity.slice(0, 5).map((activity: any, i: number) => {
                  // Determine icon and color based on activity type
                  const getActivityStyle = (type: string, description: string) => {
                    if (description.toLowerCase().includes('mining') || type === 'mining') {
                      return { icon: Pickaxe, color: 'text-chart-3', bg: 'bg-chart-3/20', border: 'border-chart-3/30' };
                    } else if (description.toLowerCase().includes('staking') || description.toLowerCase().includes('stake') || type === 'staking') {
                      return { icon: Gem, color: 'text-chart-5', bg: 'bg-chart-5/20', border: 'border-chart-5/30' };
                    } else if (description.toLowerCase().includes('referral') || type === 'referral') {
                      return { icon: Users, color: 'text-chart-1', bg: 'bg-chart-1/20', border: 'border-chart-1/30' };
                    } else if (description.toLowerCase().includes('check-in') || description.toLowerCase().includes('streak') || type === 'checkin') {
                      return { icon: CalendarCheck, color: 'text-orange-500', bg: 'bg-orange-500/20', border: 'border-orange-500/30' };
                    } else {
                      return { icon: Award, color: 'text-primary', bg: 'bg-primary/20', border: 'border-primary/30' };
                    }
                  };
                  
                  const style = getActivityStyle(activity.type, activity.description);
                  const ActivityIcon = style.icon;
                  
                  return (
                    <div key={i} className={`flex items-start gap-3 p-3 rounded-lg bg-card/50 border ${style.border} hover:border-primary/30 transition-colors`}>
                      <div className={`p-2 rounded-lg ${style.bg} flex items-center justify-center`}>
                        <ActivityIcon className={`h-4 w-4 ${style.color}`} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-foreground">{activity.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(activity.createdAt).toLocaleDateString()} at {new Date(activity.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

