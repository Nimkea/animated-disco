import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Pickaxe, Zap, Clock, TrendingUp, Video } from "lucide-react";
import type { MiningSession } from "@shared/schema";
import { isUnauthorizedError } from "@/lib/authUtils";

export default function Mining() {
  const { toast } = useToast();

  const { data: currentSession } = useQuery<MiningSession>({
    queryKey: ["/api/mining/current"],
    refetchInterval: 5000,
  });

  const { data: sessions } = useQuery<MiningSession[]>({
    queryKey: ["/api/mining/history"],
  });

  const startMiningMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/mining/start", {});
    },
    onSuccess: () => {
      toast({
        title: "Mining Started!",
        description: "Your mining session has begun. Watch ads to boost your rewards!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/mining/current"] });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to start mining",
        variant: "destructive",
      });
    },
  });

  const stopMiningMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/mining/stop", {});
    },
    onSuccess: (data: any) => {
      toast({
        title: "Mining Complete!",
        description: `You earned ${data.xpReward} XP and ${data.xnrtReward?.toFixed(1)} XNRT!`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/mining/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mining/history"] });
      queryClient.invalidateQueries({ queryKey: ["/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/balance"] });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to stop mining",
        variant: "destructive",
      });
    },
  });

  const watchAdMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/mining/watch-ad", {});
    },
    onSuccess: () => {
      const newBoostCount = (currentSession?.adBoostCount || 0) + 1;
      toast({
        title: "Ad Watched!",
        description: `+10% boost added! Total: ${newBoostCount * 10}%`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/mining/current"] });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to watch ad",
        variant: "destructive",
      });
    },
  });

  const [timeLeft, setTimeLeft] = useState("");
  const hasInvalidatedRef = useRef(false);
  const lastSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!currentSession) {
      hasInvalidatedRef.current = false;
      lastSessionIdRef.current = null;
      return;
    }

    // Reset flag when session ID changes (new session started)
    if (currentSession.id !== lastSessionIdRef.current) {
      hasInvalidatedRef.current = false;
      lastSessionIdRef.current = currentSession.id;
    }

    const interval = setInterval(() => {
      const now = new Date().getTime();
      
      // If session is active, show time remaining until endTime
      if (currentSession.status === "active" && currentSession.endTime) {
        const end = new Date(currentSession.endTime).getTime();
        const diff = end - now;

        if (diff <= 0) {
          setTimeLeft("Complete!");
          if (!hasInvalidatedRef.current) {
            queryClient.invalidateQueries({ queryKey: ["/api/mining/current"] });
            hasInvalidatedRef.current = true;
          }
        } else {
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          setTimeLeft(`Mining Active - ${hours}h ${minutes}m remaining`);
        }
      } 
      // Otherwise show cooldown to next available session
      else if (currentSession.nextAvailable) {
        const next = new Date(currentSession.nextAvailable).getTime();
        const diff = next - now;

        if (diff <= 0) {
          setTimeLeft("Ready!");
          if (!hasInvalidatedRef.current) {
            queryClient.invalidateQueries({ queryKey: ["/api/mining/current"] });
            hasInvalidatedRef.current = true;
          }
        } else {
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((diff % (1000 * 60)) / 1000);
          setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentSession]);

  const isSessionActive = currentSession?.status === "active";
  const canStartMining = !currentSession || (currentSession.nextAvailable && new Date(currentSession.nextAvailable) <= new Date());
  const boostPercentage = currentSession?.boostPercentage || 0;
  const estimatedReward = (currentSession?.baseReward || 10) + (currentSession?.baseReward || 10) * (boostPercentage / 100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-serif">Mining</h1>
        <p className="text-muted-foreground">Mine XNRT tokens every 24 hours with ad boosts</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5">
          <CardHeader>
            <CardTitle>Mining Session</CardTitle>
            <CardDescription>
              {isSessionActive ? "Session in progress" : canStartMining ? "Ready to start" : "Next session available in"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-center">
              <div
                className={`w-40 h-40 rounded-full flex items-center justify-center cursor-pointer transition-all ${
                  isSessionActive
                    ? "bg-gradient-to-br from-chart-2 to-chart-3 hover:scale-105 active:scale-95"
                    : canStartMining
                    ? "bg-gradient-to-br from-primary to-secondary hover:scale-105 active:scale-95"
                    : "bg-muted cursor-not-allowed"
                }`}
                onClick={() => {
                  if (isSessionActive) {
                    stopMiningMutation.mutate();
                  } else if (canStartMining) {
                    startMiningMutation.mutate();
                  }
                }}
                data-testid="button-mining-toggle"
              >
                <div className="text-center">
                  <Pickaxe className="h-16 w-16 text-white mx-auto mb-2" />
                  <p className="text-white font-bold">
                    {isSessionActive ? "STOP" : "START"}
                  </p>
                </div>
              </div>
            </div>

            {!canStartMining && !isSessionActive && (
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 text-2xl font-mono font-bold">
                  <Clock className="h-6 w-6 text-primary" />
                  <span data-testid="text-countdown">{timeLeft}</span>
                </div>
              </div>
            )}

            {isSessionActive && (
              <>
                <div className="text-center mb-4">
                  <div className="flex items-center justify-center gap-2 text-lg font-mono font-semibold text-chart-2">
                    <Clock className="h-5 w-5" />
                    <span data-testid="text-active-countdown">{timeLeft}</span>
                  </div>
                </div>
              </>
            )}

            {isSessionActive && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Base Reward:</span>
                  <span className="font-bold">{currentSession.baseReward} XP</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Boost:</span>
                  <Badge variant="secondary" className="font-mono">
                    +{boostPercentage}%
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Estimated Reward:</span>
                  <span className="font-bold text-chart-2 text-xl">{Math.round(estimatedReward)} XP</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ad Boost System</CardTitle>
            <CardDescription>Watch up to 5 ads for +10% each (max +50%)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Ads Watched:</span>
              <span className="text-2xl font-bold font-mono" data-testid="text-ad-count">
                {currentSession?.adBoostCount || 0}/5
              </span>
            </div>

            <Progress value={((currentSession?.adBoostCount || 0) / 5) * 100} />

            <Button
              className="w-full"
              size="lg"
              disabled={!isSessionActive || (currentSession?.adBoostCount || 0) >= 5 || watchAdMutation.isPending}
              onClick={() => watchAdMutation.mutate()}
              data-testid="button-watch-ad"
            >
              <Video className="mr-2 h-5 w-5" />
              {watchAdMutation.isPending ? "Loading Ad..." : "Watch Ad (+10%)"}
            </Button>

            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-2 rounded-full ${
                    i < (currentSession?.adBoostCount || 0) ? "bg-chart-2" : "bg-muted"
                  }`}
                />
              ))}
            </div>
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
                      {session.adBoostCount > 0 && (
                        <Badge variant="secondary" className="gap-1">
                          <Zap className="h-3 w-3" />
                          +{session.boostPercentage}%
                        </Badge>
                      )}
                      <div className="font-bold text-chart-2">+{session.finalReward} XP</div>
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
