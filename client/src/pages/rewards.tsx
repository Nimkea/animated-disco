import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gift, Sparkles, TrendingUp, Award } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { Balance } from "@shared/schema";
import { CheckInCalendar } from "@/components/checkin-calendar";

export default function Rewards() {
  const { user } = useAuth();

  const { data: balance } = useQuery<Balance>({
    queryKey: ["/api/balance"],
  });

  const nextLevelXP = (user?.level || 1) * 1000;
  const currentXP = user?.xp || 0;
  const xpProgress = (currentXP / nextLevelXP) * 100;

  const streakMilestones = [7, 14, 30, 60, 90, 180, 365];
  const nextMilestone = streakMilestones.find(m => m > (user?.streak || 0)) || 365;
  const streakReward = nextMilestone === 7 ? 50 : nextMilestone * 10;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-serif">Rewards</h1>
        <p className="text-muted-foreground">Track your progress and upcoming rewards</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              Level Progress
            </CardTitle>
            <CardDescription>Next level at {nextLevelXP.toLocaleString()} XP</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold font-mono text-primary">{user?.level}</span>
              <span className="text-2xl text-muted-foreground">→</span>
              <span className="text-5xl font-bold font-mono text-muted-foreground">{(user?.level || 1) + 1}</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-semibold">{currentXP.toLocaleString()} / {nextLevelXP.toLocaleString()} XP</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-500"
                  style={{ width: `${Math.min(100, xpProgress)}%` }}
                />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {(nextLevelXP - currentXP).toLocaleString()} XP needed to level up
            </p>
          </CardContent>
        </Card>

        <Card className="border-secondary/20 bg-gradient-to-br from-card to-secondary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-secondary" />
              Streak Rewards
            </CardTitle>
            <CardDescription>Next bonus at {nextMilestone} day streak</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold font-mono text-secondary">{user?.streak}</span>
              <span className="text-2xl text-muted-foreground">days</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Next Reward</span>
                <Badge variant="secondary" className="font-mono">
                  +{streakReward} XNRT
                </Badge>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-secondary to-chart-5 transition-all duration-500"
                  style={{ width: `${((user?.streak || 0) / nextMilestone) * 100}%` }}
                />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {nextMilestone - (user?.streak || 0)} days until next streak bonus
            </p>
          </CardContent>
        </Card>
      </div>

      <CheckInCalendar />

      <Card>
        <CardHeader>
          <CardTitle>Streak Milestones</CardTitle>
          <CardDescription>Earn XNRT by maintaining your daily check-in streak</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {streakMilestones.map((milestone) => {
              const achieved = (user?.streak || 0) >= milestone;
              const reward = milestone === 7 ? 50 : milestone * 10;

              return (
                <div
                  key={milestone}
                  className={`p-4 border rounded-md ${
                    achieved 
                      ? "border-chart-2/30 bg-chart-2/5" 
                      : "border-border"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl font-bold">{milestone}</span>
                    <Badge variant={achieved ? "default" : "outline"} className={achieved ? "bg-chart-2" : ""}>
                      {achieved ? "✓" : ""}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">days streak</p>
                  <p className="text-lg font-bold text-primary">+{reward} XNRT</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Earning Summary</CardTitle>
          <CardDescription>Your total rewards from all sources</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border border-border rounded-md">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-md bg-primary/20 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">Total Earned</p>
                  <p className="text-sm text-muted-foreground">All-time earnings</p>
                </div>
              </div>
              <p className="text-3xl font-bold font-mono text-primary">
                {parseFloat(balance?.totalEarned || "0").toLocaleString()} XNRT
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex items-center justify-between p-4 border border-border rounded-md">
                <div>
                  <p className="text-sm text-muted-foreground">From Staking</p>
                  <p className="text-2xl font-bold font-mono">
                    {parseFloat(balance?.stakingBalance || "0").toLocaleString()}
                  </p>
                </div>
                <Badge variant="outline">XNRT</Badge>
              </div>

              <div className="flex items-center justify-between p-4 border border-border rounded-md">
                <div>
                  <p className="text-sm text-muted-foreground">From Referrals</p>
                  <p className="text-2xl font-bold font-mono">
                    {parseFloat(balance?.referralBalance || "0").toLocaleString()}
                  </p>
                </div>
                <Badge variant="outline">XNRT</Badge>
              </div>

              <div className="flex items-center justify-between p-4 border border-border rounded-md">
                <div>
                  <p className="text-sm text-muted-foreground">From Mining</p>
                  <p className="text-2xl font-bold font-mono">
                    {parseFloat(balance?.miningBalance || "0").toLocaleString()}
                  </p>
                </div>
                <Badge variant="outline">XP</Badge>
              </div>

              <div className="flex items-center justify-between p-4 border border-border rounded-md">
                <div>
                  <p className="text-sm text-muted-foreground">Experience Points</p>
                  <p className="text-2xl font-bold font-mono">
                    {(user?.xp || 0).toLocaleString()}
                  </p>
                </div>
                <Badge variant="outline">XP</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
