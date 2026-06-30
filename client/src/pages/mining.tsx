import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Coins,
  History,
  Pickaxe,
  ShieldCheck,
  Sparkles,
  TimerReset,
  Wallet,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { handleUnauthorized, isUnauthorizedError } from "@/lib/authUtils";
import { cn } from "@/lib/utils";
import { nf } from "@/lib/number";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Balance, MiningSession } from "@shared/schema";

const MINING_DURATION_HOURS = 24;
const MINING_DURATION_MS = MINING_DURATION_HOURS * 60 * 60 * 1000;
const MINING_XP_REWARD = 10;
const MINING_XNRT_REWARD = 5;

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function toTime(value?: Date | string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatCountdown(ms: number) {
  if (ms <= 0) return "Completing...";

  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((part) => part.toString().padStart(2, "0"))
    .join(":");
}

function formatDate(value?: Date | string | null) {
  const date = toTime(value);
  if (!date) return "—";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getSessionXnrtReward(session: MiningSession) {
  // New Mining v2 sessions always pay exactly 5 XNRT. Older history may have
  // different finalReward values, so keep their historical display sensible.
  if ((session.finalReward || MINING_XP_REWARD) === MINING_XP_REWARD) {
    return MINING_XNRT_REWARD;
  }
  return Number(((session.finalReward || 0) * 0.5).toFixed(1));
}

function invalidateMiningQueries() {
  queryClient.invalidateQueries({ queryKey: ["/api/mining/current"] });
  queryClient.invalidateQueries({ queryKey: ["/api/mining/history"] });
  queryClient.invalidateQueries({ queryKey: ["/api/balance"] });
  queryClient.invalidateQueries({ queryKey: ["/api/profile/summary"] });
  queryClient.invalidateQueries({ queryKey: ["/api/home/summary"] });
  queryClient.invalidateQueries({ queryKey: ["/api/achievements"] });
  queryClient.invalidateQueries({ queryKey: ["/api/tasks/user"] });
  queryClient.invalidateQueries({ queryKey: ["/api/leaderboard/xp"] });
}

export default function Mining() {
  const { toast } = useToast();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const processedSessionRef = useRef<string | null>(null);

  const {
    data: currentSession,
    isLoading: currentLoading,
    error: currentError,
  } = useQuery<MiningSession | null>({
    queryKey: ["/api/mining/current"],
    refetchInterval: 15_000,
    staleTime: 3_000,
  });

  const {
    data: sessions = [],
    isLoading: sessionsLoading,
    error: sessionsError,
  } = useQuery<MiningSession[]>({
    queryKey: ["/api/mining/history"],
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });

  const { data: balance } = useQuery<Balance | null>({
    queryKey: ["/api/balance"],
    staleTime: 10_000,
  });

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const processRewardsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/mining/process-rewards", {});
      return (await response.json()) as { success: boolean; processedCount: number };
    },
    onSuccess: (result) => {
      if (result.processedCount > 0) {
        toast({
          title: "Mining rewards deposited",
          description: `+${MINING_XP_REWARD} XP and +${MINING_XNRT_REWARD} XNRT added to your account.`,
        });
      }
      invalidateMiningQueries();
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        handleUnauthorized(toast);
      }
    },
  });

  const startMiningMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/mining/start", {});
      return (await response.json()) as MiningSession;
    },
    onSuccess: () => {
      processedSessionRef.current = null;
      toast({
        title: "Mining started",
        description: `Your ${MINING_DURATION_HOURS}-hour session is running. Reward: ${MINING_XP_REWARD} XP + ${MINING_XNRT_REWARD} XNRT.`,
      });
      invalidateMiningQueries();
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        handleUnauthorized(toast);
        return;
      }
      toast({
        title: "Mining could not start",
        description: error.message || "Failed to start mining",
        variant: "destructive",
      });
    },
  });

  const activeSession = currentSession?.status === "active" ? currentSession : null;
  const startTime = toTime(activeSession?.startTime);
  const endTime = toTime(activeSession?.endTime);
  const remainingMs = endTime ? Math.max(0, endTime.getTime() - nowMs) : 0;
  const elapsedMs = startTime ? Math.max(0, nowMs - startTime.getTime()) : 0;
  const sessionDurationMs = startTime && endTime ? Math.max(1, endTime.getTime() - startTime.getTime()) : MINING_DURATION_MS;
  const progress = activeSession ? clamp((elapsedMs / sessionDurationMs) * 100) : 0;
  const canStartMining = !activeSession && !currentLoading;

  useEffect(() => {
    if (!activeSession || !endTime) {
      processedSessionRef.current = null;
      return;
    }

    if (remainingMs <= 0 && processedSessionRef.current !== activeSession.id) {
      processedSessionRef.current = activeSession.id;
      processRewardsMutation.mutate();
    }
  }, [activeSession?.id, endTime?.getTime(), remainingMs]);

  const completedSessions = useMemo(
    () => sessions.filter((session) => session.status === "completed"),
    [sessions]
  );

  const historyStats = useMemo(() => {
    const completed = completedSessions.length;
    const totalXp = completedSessions.reduce(
      (sum, session) => sum + (session.finalReward || MINING_XP_REWARD),
      0
    );
    const totalXnrt = completedSessions.reduce(
      (sum, session) => sum + getSessionXnrtReward(session),
      0
    );

    return { completed, totalXp, totalXnrt };
  }, [completedSessions]);

  const statusBadge = activeSession ? (
    <Badge className="gap-1.5 border-primary/30 bg-primary/10 text-primary" variant="outline">
      <Activity className="h-3.5 w-3.5" /> Live session
    </Badge>
  ) : (
    <Badge className="gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-500" variant="outline">
      <ShieldCheck className="h-3.5 w-3.5" /> Ready
    </Badge>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1.5 rounded-full px-3 py-1">
              <Sparkles className="h-3.5 w-3.5" /> Mining v2
            </Badge>
            <Badge variant="outline" className="rounded-full px-3 py-1">
              {MINING_XNRT_REWARD} XNRT / {MINING_DURATION_HOURS}h
            </Badge>
          </div>
          <h1 className="text-3xl font-bold font-serif">Mining</h1>
          <p className="text-muted-foreground">
            Start one professional 24-hour session and earn exactly {MINING_XP_REWARD} XP + {MINING_XNRT_REWARD} XNRT.
          </p>
        </div>
        {statusBadge}
      </div>

      {(currentError || sessionsError) && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
            <div>
              <p className="font-semibold text-destructive">Mining data could not load</p>
              <p className="text-sm text-muted-foreground">
                Please refresh the page. Backend routes required: /api/mining/current, /api/mining/history, and /api/mining/process-rewards.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
              <Coins className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Reward per session</p>
              <p className="text-xl font-bold">{MINING_XNRT_REWARD} XNRT</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-chart-2/10 text-chart-2">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">XP reward</p>
              <p className="text-xl font-bold">{MINING_XP_REWARD} XP</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-muted text-foreground">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Mining balance</p>
              <p className="text-xl font-bold">{nf(balance?.miningBalance || 0)} XNRT</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-muted text-foreground">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="text-xl font-bold">{nf(historyStats.completed)} sessions</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card">
        <CardContent className="p-0">
          <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-6 p-5 sm:p-6 lg:p-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-2xl sm:text-3xl">24-hour mining session</CardTitle>
                  <CardDescription className="mt-2 max-w-2xl">
                    Rewards are deposited automatically when the timer reaches zero. You can start the next session after the current one completes.
                  </CardDescription>
                </div>
                {statusBadge}
              </div>

              {currentLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-24 w-full rounded-2xl" />
                  <Skeleton className="h-4 w-full rounded-full" />
                  <Skeleton className="h-11 w-44" />
                </div>
              ) : activeSession ? (
                <div className="space-y-5">
                  <div className="rounded-2xl border bg-background/60 p-4 sm:p-5">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm text-muted-foreground">Time remaining</p>
                        <p className="font-mono text-3xl font-black tracking-tight sm:text-5xl" data-testid="text-active-countdown">
                          {formatCountdown(remainingMs)}
                        </p>
                      </div>
                      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg sm:h-20 sm:w-20">
                        <Pickaxe className="h-8 w-8 sm:h-10 sm:w-10" />
                      </div>
                    </div>
                    <Progress value={progress} className="h-3" />
                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Started: {formatDate(activeSession.startTime)}</span>
                      <span>{nf(progress, { maximumFractionDigits: 1 })}%</span>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <RewardMiniCard icon={Coins} label="XNRT reward" value={`+${MINING_XNRT_REWARD} XNRT`} />
                    <RewardMiniCard icon={Zap} label="XP reward" value={`+${MINING_XP_REWARD} XP`} />
                    <RewardMiniCard icon={Clock} label="Ends at" value={formatDate(activeSession.endTime)} />
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => processRewardsMutation.mutate()}
                      disabled={processRewardsMutation.isPending}
                      data-testid="button-process-mining-rewards"
                    >
                      <TimerReset className="h-4 w-4" />
                      Check rewards
                    </Button>
                    <Button type="button" variant="outline" onClick={invalidateMiningQueries}>
                      Refresh status
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="rounded-2xl border bg-background/60 p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-medium text-emerald-500">Ready to mine</p>
                        <p className="mt-1 text-2xl font-black">Earn {MINING_XNRT_REWARD} XNRT in 24 hours</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Fixed reward: {MINING_XP_REWARD} XP + {MINING_XNRT_REWARD} XNRT per completed session.
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="lg"
                        className="min-h-14 rounded-xl px-8 text-base font-bold"
                        disabled={!canStartMining || startMiningMutation.isPending}
                        onClick={() => startMiningMutation.mutate()}
                        data-testid="button-mining-start"
                      >
                        <Pickaxe className="h-5 w-5" />
                        {startMiningMutation.isPending ? "Starting..." : "Start Mining"}
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <RewardMiniCard icon={ShieldCheck} label="Rule" value="1 active session" />
                    <RewardMiniCard icon={Clock} label="Duration" value="24 hours" />
                    <RewardMiniCard icon={Sparkles} label="Auto deposit" value="Enabled" />
                  </div>
                </div>
              )}
            </div>

            <div className="border-t bg-background/40 p-5 sm:p-6 lg:border-l lg:border-t-0 lg:p-8">
              <div className="mb-5 flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <Activity className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="font-bold">Mining performance</h2>
                  <p className="text-sm text-muted-foreground">Lifetime summary from your history</p>
                </div>
              </div>

              <div className="space-y-4">
                <SummaryRow label="Total sessions" value={nf(sessions.length)} />
                <SummaryRow label="Completed sessions" value={nf(historyStats.completed)} />
                <SummaryRow label="XP mined" value={`${nf(historyStats.totalXp)} XP`} />
                <SummaryRow label="XNRT mined" value={`${nf(historyStats.totalXnrt, { maximumFractionDigits: 1 })} XNRT`} />
              </div>

              <Separator className="my-5" />

              <div className="rounded-2xl border bg-card p-4">
                <div className="mb-2 flex items-center gap-2 font-semibold">
                  <TimerReset className="h-4 w-4 text-primary" />
                  Mining policy
                </div>
                <p className="text-sm text-muted-foreground">
                  Mining v2 uses fixed rewards, not XP conversion. Each completed 24-hour session gives exactly {MINING_XP_REWARD} XP and {MINING_XNRT_REWARD} XNRT.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-muted">
              <History className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Mining history</CardTitle>
              <CardDescription>Your latest mining sessions and rewards</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {sessionsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="rounded-2xl border border-dashed py-12 text-center">
              <Pickaxe className="mx-auto mb-4 h-14 w-14 text-muted-foreground" />
              <p className="font-semibold">No mining sessions yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Start your first 24-hour session to create history.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.slice(0, 12).map((session) => {
                const isCompleted = session.status === "completed";
                const sessionReward = getSessionXnrtReward(session);
                const sessionStart = toTime(session.startTime);
                const sessionEnd = toTime(session.endTime);
                const durationHours = sessionStart && sessionEnd
                  ? Math.max(1, Math.round((sessionEnd.getTime() - sessionStart.getTime()) / 3_600_000))
                  : MINING_DURATION_HOURS;

                return (
                  <div
                    key={session.id}
                    className="flex flex-col gap-3 rounded-2xl border bg-card p-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
                    data-testid={`session-${session.id}`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={cn(
                          "grid h-11 w-11 shrink-0 place-items-center rounded-xl",
                          isCompleted ? "bg-emerald-500/10 text-emerald-500" : "bg-primary/10 text-primary"
                        )}
                      >
                        {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : <Pickaxe className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">Mining session</p>
                          <Badge variant="outline" className="capitalize">
                            {session.status}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {formatDate(session.startTime)} · {durationHours}h
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-left sm:text-right">
                      <div>
                        <p className="text-xs text-muted-foreground">XP</p>
                        <p className="font-bold text-chart-2">+{nf(session.finalReward || MINING_XP_REWARD)} XP</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">XNRT</p>
                        <p className="font-bold text-primary">+{nf(sessionReward, { maximumFractionDigits: 1 })} XNRT</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RewardMiniCard({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border bg-background/60 p-4">
      <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <p className="font-bold">{value}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border bg-card px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}
