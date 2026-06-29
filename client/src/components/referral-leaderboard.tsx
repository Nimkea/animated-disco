import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Medal, Award, Users, AlertCircle, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";

type LeaderboardPeriod = "daily" | "weekly" | "monthly" | "all-time";

interface LeaderboardEntry {
  displayName: string;
  totalReferrals: number;
  totalCommission: string;
  level1Count: number;
  level2Count: number;
  level3Count: number;
  rank: number;
  currentUser?: boolean;
  userId?: string;
  username?: string;
  email?: string;
}

interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
  userPosition: LeaderboardEntry | null;
  meta?: {
    period: LeaderboardPeriod;
    unit: string;
    window: string;
  };
}

const PERIODS: { value: LeaderboardPeriod; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "all-time", label: "All-time" },
];

function formatXnrt(value: string | number) {
  const parsed = typeof value === "number" ? value : parseFloat(value || "0");
  return `${(Number.isFinite(parsed) ? parsed : 0).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })} XNRT`;
}

export function ReferralLeaderboard() {
  const { user } = useAuth();
  const isAdmin = user?.isAdmin || false;
  const [period, setPeriod] = useState<LeaderboardPeriod>("all-time");

  const { data, isLoading, isError, error, refetch } = useQuery<LeaderboardResponse>({
    queryKey: ["/api/leaderboard/referrals", period],
    queryFn: async () => {
      const params = new URLSearchParams({ period, limit: "50" });
      const res = await fetch(`/api/leaderboard/referrals?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch referral leaderboard");
      return res.json();
    },
  });

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
    if (rank === 3) return <Award className="h-5 w-5 text-amber-600" />;
    return <span className="text-sm font-bold text-muted-foreground">#{rank}</span>;
  };

  const renderEntry = (entry: LeaderboardEntry, testIdPrefix = "leaderboard-entry") => (
    <div
      key={`${testIdPrefix}-${entry.rank}`}
      className={`flex items-center gap-3 rounded-lg border p-3 sm:gap-4 ${
        entry.currentUser
          ? "border-primary/40 bg-primary/10"
          : entry.rank <= 3
          ? "border-primary/20 bg-gradient-to-r from-primary/5 to-transparent"
          : "border-border bg-card"
      }`}
      data-testid={`${testIdPrefix}-${entry.rank}`}
    >
      <div className="flex w-8 items-center justify-center shrink-0">
        {getRankIcon(entry.rank)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-semibold" data-testid={`text-displayname-${entry.rank}`}>
            {entry.displayName}
          </p>
          {entry.currentUser && <Badge variant="default">You</Badge>}
        </div>
        <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>{entry.totalReferrals.toLocaleString()} referrals</span>
          <span>•</span>
          <span>{formatXnrt(entry.totalCommission)}</span>
          <span>•</span>
          <span>L1 {entry.level1Count}</span>
          <span>L2 {entry.level2Count}</span>
          <span>L3 {entry.level3Count}</span>
          {isAdmin && entry.userId && (
            <>
              <span>•</span>
              <span className="font-mono text-[10px]" title={entry.email}>ID: {entry.userId.substring(0, 8)}...</span>
            </>
          )}
        </div>
      </div>
      {entry.rank <= 3 && (
        <Badge variant="secondary" className="font-mono shrink-0">
          Top {entry.rank}
        </Badge>
      )}
    </div>
  );

  return (
    <Card data-testid="card-leaderboard">
      <CardHeader>
        <div className="space-y-4">
          <div>
            <CardTitle>Referral Leaderboard</CardTitle>
            <p className="text-sm text-muted-foreground">Window: {data?.meta?.window ?? "all time"}</p>
          </div>
          <div className="flex flex-wrap gap-1">
            {PERIODS.map((item) => (
              <Button
                key={item.value}
                variant={period === item.value ? "default" : "ghost"}
                size="sm"
                onClick={() => setPeriod(item.value)}
                data-testid={`button-period-${item.value}`}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="mb-4 h-12 w-12 text-destructive" />
            <p className="font-medium">Could not load referral leaderboard</p>
            <p className="mb-4 text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "Please try again."}
            </p>
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </div>
        ) : data && data.leaderboard.length > 0 ? (
          <>
            <div className="space-y-2">
              {data.leaderboard.slice(0, 10).map((entry) => renderEntry(entry))}
            </div>

            {data.userPosition && !data.leaderboard.slice(0, 10).some((entry) => entry.currentUser) && (
              <div className="border-t pt-4">
                <p className="mb-2 text-sm text-muted-foreground">Your Position</p>
                {renderEntry(data.userPosition, "leaderboard-user-position")}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Users className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="font-medium">No referral data yet</p>
            <p className="mb-4 max-w-sm text-sm text-muted-foreground">
              Share your referral link and invite users to appear in this ranking.
            </p>
            <Button asChild variant="outline">
              <Link href="/referrals">Open Referrals</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
