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

export default function Mining() {
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: currentSession } = useQuery<MiningSession>({
    queryKey: ["/api/mining/current"],
    refetchInterval: 5000,
  });

  const { data: sessions } = useQuery<MiningSession[]>({
    queryKey: ["/api/mining/history"],
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
                    <span className="font-bold text-chart-2 text-xl">{currentSession.baseReward} XP</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">XNRT Conversion:</span>
                    <span className="font-bold text-chart-2 text-xl">{(currentSession.baseReward * 0.5).toFixed(1)} XNRT</span>
                  </div>
                </div>
              </>
            )}

            {isReady && (
              <div className="text-center space-y-2">
                <p className="text-lg font-semibold text-chart-2">Ready to Mine!</p>
                <p className="text-sm text-muted-foreground">Earn {baseReward} XP and {(baseReward * 0.5).toFixed(1)} XNRT automatically after 24 hours</p>
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
          {!sessions || sessions.length === 0 ? (
            <div className="text-center py-12">
              <Pickaxe className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No mining sessions yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.slice(0, 10).map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-4 border border-border rounded-md hover-elevate"
                  data-testid={`session-${session.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-md flex items-center justify-center ${
                      session.status === "completed" ? "bg-chart-2/20" : "bg-muted"
                    }`}>
                      <Pickaxe className={session.status === "completed" ? "text-chart-2" : "text-muted-foreground"} />
                    </div>
                    <div>
                      <p className="font-semibold">Mining Session</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(session.startTime).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <div className="font-bold text-chart-2">+{session.finalReward} XP</div>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      +{(session.finalReward * 0.5).toFixed(1)} XNRT
                    </div>
                    <Badge variant={session.status === "completed" ? "default" : "secondary"} className="mt-1">
                      {session.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
