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
} from "lucide-react";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { User, Balance } from "@shared/schema";

export default function Home() {
  const { toast } = useToast();
  
  const { data: user, isLoading: userLoading } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

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
      toast({
        title: "Check-in Successful!",
        description: `Day ${data.streak} streak! Earned ${data.xnrtReward} XNRT and ${data.xpReward} XP`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
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

  const level = user?.level || 1;
  const xp = user?.xp || 0;
  const streak = user?.streak || 0;
  const xnrtBalance = balance?.xnrtBalance || "0";

  const quickStats = [
    {
      label: "Total Earned",
      value: balance?.totalEarned || "0",
      icon: TrendingUp,
      color: "text-chart-2",
      link: "/wallet",
    },
    {
      label: "Active Stakes",
      value: stats?.activeStakes || 0,
      icon: Gem,
      color: "text-chart-5",
      link: "/staking",
    },
    {
      label: "Referrals",
      value: stats?.totalReferrals || 0,
      icon: Users,
      color: "text-chart-1",
      link: "/referrals",
    },
    {
      label: "Mining Sessions",
      value: stats?.miningSessions || 0,
      icon: Pickaxe,
      color: "text-chart-3",
      link: "/mining",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-serif">
            Welcome, <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">{user?.username || user?.email?.split('@')[0] || "User"}</span>
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
        <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Total XNRT Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <Coins className="h-8 w-8 text-primary" />
              <span className="text-5xl font-bold font-mono bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent" data-testid="text-balance">
                {parseFloat(xnrtBalance).toLocaleString()}
              </span>
              <span className="text-2xl text-muted-foreground">XNRT</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-secondary/20 bg-gradient-to-br from-card to-secondary/5">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">XP & Level</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-baseline gap-2">
                <Award className="h-8 w-8 text-secondary" />
                <span className="text-5xl font-bold font-mono text-secondary" data-testid="text-level">
                  {level}
                </span>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-foreground" data-testid="text-xp">{xp.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">XP Points</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {quickStats.map((stat) => (
          <Link key={stat.label} href={stat.link}>
            <Card className="hover-elevate active-elevate-2 cursor-pointer transition-all">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-3xl font-bold font-mono mt-2" data-testid={`stat-${stat.label.toLowerCase().replace(' ', '-')}`}>
                      {typeof stat.value === 'string' ? parseFloat(stat.value).toLocaleString() : stat.value}
                    </p>
                  </div>
                  <stat.icon className={`h-10 w-10 ${stat.color}`} />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Quick Actions</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/staking">
              <Button variant="outline" className="w-full justify-between" data-testid="button-quick-stake">
                <span className="flex items-center gap-2">
                  <Gem className="h-5 w-5 text-chart-5" />
                  Start Staking
                </span>
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link href="/mining">
              <Button variant="outline" className="w-full justify-between" data-testid="button-quick-mine">
                <span className="flex items-center gap-2">
                  <Pickaxe className="h-5 w-5 text-chart-3" />
                  Start Mining
                </span>
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link href="/tasks">
              <Button variant="outline" className="w-full justify-between" data-testid="button-quick-tasks">
                <span className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-chart-1" />
                  Complete Tasks
                </span>
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {!stats?.recentActivity || stats.recentActivity.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No recent activity. Start earning to see your activity here!
                </p>
              ) : (
                stats.recentActivity.slice(0, 5).map((activity: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-primary mt-2" />
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

