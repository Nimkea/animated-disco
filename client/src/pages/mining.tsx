import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Pickaxe, Zap, Clock } from "lucide-react";
import type { MiningSession } from "@shared/schema";
import { isUnauthorizedError, handleUnauthorized } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import { nf } from "@/lib/number";

const XP_TO_XNRT_RATE = 0.5;

export default function Mining() {
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: currentSession } = useQuery<MiningSession>({
    queryKey: ["/api/mining/current"],
    refetchInterval: 5000,
    staleTime: 3000,
  });

  const { data: sessions, isLoading: sessionsLoading } = useQuery<MiningSession[]>({
    queryKey: ["/api/mining/history"],
    staleTime: 15000,
    refetchOnWindowFocus: false,
  });

  // Process mining rewards automatically on interval
  const processRewardsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/mining/process-rewards", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mining/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mining/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/balance"] });
    },
  });

  // Auto-process rewards every 30 seconds to check for completed sessions
  useEffect(() => {
    const interval = setInterval(() => {
      processRewardsMutation.mutate();
    }, 30000); // Check every 30 seconds

    // Also process on mount
    processRewardsMutation.mutate();

    return () => clearInterval(interval);
  }, []);

  const startMiningMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/mining/start", {});
    },
    onSuccess: () => {
      toast({
        title: "Mining Started!",
        description: "Your 24-hour mining session has begun. Rewards will be automatically deposited when complete!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/mining/current"] });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        handleUnauthorized(toast);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to start mining",
        variant: "destructive",
      });
    },
  });

  const [timeLeft, setTimeLeft] = useState("");
  const hasInvalidatedRef = useRef(false);
  const lastSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!currentSession || currentSession.status !== "active") {
      hasInvalidatedRef.current = false;
      lastSessionIdRef.current = null;
      setTimeLeft("");
      return;
    }

    // Reset flag when session ID changes (new session started)
    if (currentSession.id !== lastSessionIdRef.current) {
      hasInvalidatedRef.current = false;
      lastSessionIdRef.current = currentSession.id;
    }

    const interval = setInterval(() => {
      const now = new Date().getTime();
      
      // Show time remaining until endTime
      if (currentSession.endTime) {
        const end = new Date(currentSession.endTime).getTime();
        const diff = Math.max(0, end - now); // Prevent negative time if clock skews

        if (diff <= 0) {
          setTimeLeft("Auto-completing...");
          if (!hasInvalidatedRef.current) {
            queryClient.invalidateQueries({ queryKey: ["/api/mining/current"] });
            queryClient.invalidateQueries({ queryKey: ["/api/mining/history"] });
            queryClient.invalidateQueries({ queryKey: ["/api/balance"] });
            hasInvalidatedRef.current = true;
          }
        } else {
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          setTimeLeft(`${hours}h ${minutes}m remaining`);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentSession]);

  const isSessionActive = currentSession?.status === "active";
  const canStartMining = !isSessionActive;
  const baseReward = currentSession?.baseReward || 10;
  
  // Disable start button during mutation to prevent double-clicks
  const startDisabled = startMiningMutation.isPending;

  const isReady = !isSessionActive;

  const getSessionStatus = () => {
    if (isSessionActive) {
      return { label: "Mining in Progress", variant: "default" as const, icon: Pickaxe, bgClass: "" };
    }
    return { label: "Ready to Start!", variant: "default" as const, icon: Zap, bgClass: "bg-chart-2 text-white" };
  };

  const status = getSessionStatus();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-serif">Mining</h1>
        <p className="text-muted-foreground">Fully automated 24-hour mining sessions with auto-deposit rewards</p>
      </div>

      <div className="grid gap-6 md:grid-cols-1">
        <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Mining Session</CardTitle>
              <Badge 
                variant={status.variant}
                className={`gap-1.5 ${status.bgClass}`}
                data-testid="badge-status"
              >
                <status.icon className="h-3.5 w-3.5" />
                {status.label}
              </Badge>
            </div>
            <CardDescription>
              {isSessionActive && "Your mining session will auto-complete in 24 hours and rewards will be deposited automatically"}
              {isReady && "Click START to begin a 24-hour automated mining session"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-center">
              <div className="relative">
                <div
                  className={`w-40 h-40 rounded-full flex items-center justify-center transition-all ${
                    isSessionActive
                      ? "bg-gradient-to-br from-chart-2 to-chart-3"
                      : isReady && !startDisabled
                      ? "bg-gradient-to-br from-primary to-secondary hover:scale-105 active:scale-95 animate-pulse cursor-pointer"
                      : "bg-muted cursor-not-allowed opacity-50"
                  }`}
                  onClick={() => {
                    if (isReady && !startDisabled) {
                      startMiningMutation.mutate();
                    }
                  }}
                  aria-label="Start mining"
                  data-testid="button-mining-start"
                >
                  <div className="text-center">
                    <Pickaxe className="h-16 w-16 text-white mx-auto mb-2" />
                    <p className="text-white font-bold">
                      {isSessionActive ? "MINING" : "START"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {isSessionActive && (
              <>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 text-lg font-mono font-semibold text-chart-2">
                    <Clock className="h-5 w-5" />
                    <span data-testid="text-active-countdown">{timeLeft}</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Base Reward:</span>
                    <span className="font-bold text-chart-2 text-xl">{nf(currentSession.baseReward)} XP</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">XNRT Conversion:</span>
                    <span className="font-bold text-chart-2 text-xl">{(currentSession.baseReward * XP_TO_XNRT_RATE).toFixed(1)} XNRT</span>
                  </div>
                </div>
              </>
            )}

            {isReady && (
              <div className="text-center space-y-2">
                <p className="text-lg font-semibold text-chart-2">Ready to Mine!</p>
                <p className="text-sm text-muted-foreground">Earn {nf(baseReward)} XP and {(baseReward * XP_TO_XNRT_RATE).toFixed(1)} XNRT automatically after 24 hours</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mining History</CardTitle>
          <CardDescription>Your recent mining sessions</CardDescription>
        </CardHeader>
        <CardContent>
          {sessionsLoading ? (
            <div className="space-y-2.5 sm:space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-20 rounded-xl border-white/10 bg-white/5 animate-pulse" role="status" aria-label="Loading sessions" />
              ))}
            </div>
          ) : !sessions || sessions.length === 0 ? (
            <div className="text-center py-12">
              <Pickaxe className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No mining sessions yet</p>
            </div>
          ) : (
            <div className="space-y-2.5 sm:space-y-3">
              {sessions.slice(0, 10).map((session) => {
                const started = new Date(session.startTime);
                const ended = session.endTime ? new Date(session.endTime) : null;
                const durationHrs = ended
                  ? Math.max(1, Math.round((+ended - +started) / 3_600_000))
                  : 24;

                const statusClass =
                  session.status === "completed"
                    ? "border-chart-2/30 bg-chart-2/10 text-chart-2"
                    : "border-muted bg-muted/50 text-muted-foreground";

                return (
                  <div
                    key={session.id}
                    className="relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-3 sm:p-4 transition-colors hover:bg-white/[0.05]"
                    data-testid={`session-${session.id}`}
                  >
                    {/* subtle decorative grid */}
                    <div
                      className="pointer-events-none absolute inset-0 opacity-[0.04] sm:opacity-[0.06]"
                      aria-hidden="true"
                      style={{
                        backgroundImage:
                          "linear-gradient(to right, rgba(255,255,255,.3) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.3) 1px, transparent 1px)",
                        backgroundSize: "20px 20px",
                      }}
                    />
                    <div className="relative z-10 flex items-center gap-3 sm:gap-4">
                      {/* icon plate */}
                      <div
                        className={`grid h-10 w-10 sm:h-12 sm:w-12 place-items-center rounded-lg ${
                          session.status === "completed" ? "bg-chart-2/20" : "bg-muted"
                        }`}
                      >
                        <Pickaxe
                          className={
                            session.status === "completed"
                              ? "text-chart-2"
                              : "text-muted-foreground"
                          }
                          aria-hidden="true"
                        />
                      </div>

                      {/* details */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold leading-none text-sm sm:text-base">Mining Session</p>
                          <Badge
                            variant="outline"
                            className={`h-5 sm:h-6 rounded-full px-2 text-[10px] sm:text-[11px] capitalize border ${statusClass}`}
                          >
                            {session.status}
                          </Badge>
                        </div>
                        <p className="mt-0.5 sm:mt-1 text-[11px] sm:text-xs text-muted-foreground">
                          {new Intl.DateTimeFormat(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          }).format(started)}
                          {ended && (
                            <span className="hidden sm:inline"> · {durationHrs}h</span>
                          )}
                        </p>
                      </div>

                      {/* rewards */}
                      <div className="text-right">
                        <div className="font-bold text-chart-2 text-sm sm:text-base">
                          +{nf(session.finalReward)} XP
                        </div>
                        <div className="text-[11px] sm:text-sm text-muted-foreground">
                          +{(session.finalReward * XP_TO_XNRT_RATE).toFixed(1)} XNRT
                        </div>
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
