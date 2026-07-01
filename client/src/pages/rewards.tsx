import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarCheck, CheckCircle2, Sparkles, TrendingUp, Award } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import type { Balance } from "@shared/schema";
import { CheckInCalendar } from "@/components/checkin-calendar";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { nf } from "@/lib/number";

interface CheckinStatus {
  currentStreak: number;
  lastCheckIn: string | null;
  checkedInToday: boolean;
  nextClaimAt?: string;
  nextStreak?: number;
  nextReward?: { xnrtReward: number; xpReward: number };
  missedStreak?: boolean;
}

interface CheckinResponse {
  streak: number;
  xnrtReward: number;
  requestedXnrtReward?: number;
  xpReward: number;
  rewardCapped?: boolean;
  nextClaimAt?: string;
}

export default function Rewards() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: balance } = useQuery<Balance>({
    queryKey: ["/api/balance"],
  });

  const { data: checkinStatus } = useQuery<CheckinStatus>({
    queryKey: ["/api/checkin/status"],
  });

  const checkinMutation = useMutation<CheckinResponse, Error>({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/checkin");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Daily check-in claimed",
        description: `Day ${data.streak} streak: +${data.xpReward} XP and +${data.xnrtReward} XNRT${data.rewardCapped ? " after cap" : ""}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/checkin/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/checkin/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/home/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile/summary"] });
    },
    onError: (error) => {
      toast({ title: "Check-in failed", description: error.message, variant: "destructive" });
    },
  });

  const level = user?.level || 1;
  const nextLevelXP = level * 1000;
  const currentXP = user?.xp || 0;
  const xpProgress = (currentXP / nextLevelXP) * 100;

  const currentStreak = checkinStatus?.currentStreak ?? user?.streak ?? 0;
  const checkedInToday = Boolean(checkinStatus?.checkedInToday);
  const nextRewardXnrt = checkinStatus?.nextReward?.xnrtReward ?? 0;
  const nextRewardXp = checkinStatus?.nextReward?.xpReward ?? 0;
  const nextStreak = checkinStatus?.nextStreak ?? Math.max(1, currentStreak + 1);
  const streakMilestones = [3, 7, 14, 30, 60, 90, 180, 365];
  const nextMilestone = streakMilestones.find((m) => m > currentStreak) || 365;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-serif">Rewards</h1>
        <p className="text-muted-foreground">Track daily check-ins, XP progress, streaks, and reward history</p>
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
              <span className="text-5xl font-bold font-mono text-primary">{level}</span>
              <span className="text-2xl text-muted-foreground">→</span>
              <span className="text-5xl font-bold font-mono text-muted-foreground">{level + 1}</span>
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
              Daily Check-in Streak
            </CardTitle>
            <CardDescription>
              {checkedInToday ? "Today’s claim is completed" : `Next claim: Day ${nf(nextStreak)} reward`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold font-mono text-secondary">{nf(currentStreak)}</span>
              <span className="text-2xl text-muted-foreground">days</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border bg-background/60 p-3">
                <p className="text-xs text-muted-foreground">Next XNRT</p>
                <p className="font-mono text-xl font-bold text-primary">+{nf(nextRewardXnrt)}</p>
              </div>
              <div className="rounded-xl border bg-background/60 p-3">
                <p className="text-xs text-muted-foreground">Next XP</p>
                <p className="font-mono text-xl font-bold text-primary">+{nf(nextRewardXp)}</p>
              </div>
            </div>
            <Button
              onClick={() => checkinMutation.mutate()}
              disabled={checkedInToday || checkinMutation.isPending}
              className="w-full gap-2"
              data-testid="button-rewards-checkin"
            >
              {checkedInToday ? <CheckCircle2 className="h-4 w-4" /> : <CalendarCheck className="h-4 w-4" />}
              {checkedInToday ? "Claimed Today" : checkinMutation.isPending ? "Claiming…" : "Claim Daily Reward"}
            </Button>
            <p className="text-sm text-muted-foreground">
              {Math.max(0, nextMilestone - currentStreak)} days until the next streak milestone.
            </p>
          </CardContent>
        </Card>
      </div>

      <CheckInCalendar />

      <Card>
        <CardHeader>
          <CardTitle>Streak Milestones</CardTitle>
          <CardDescription>Milestones help unlock streak achievements and status badges.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {streakMilestones.map((milestone) => {
              const achieved = currentStreak >= milestone;

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
                  <p className="text-sm font-semibold text-primary">Achievement milestone</p>
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
                <Badge variant="outline">XNRT</Badge>
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
