import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Medal, Award, Star, AlertCircle, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";

type LeaderboardPeriod = "daily" | "weekly" | "monthly" | "all-time";
type LeaderboardCategory =
  | "overall"
  | "mining"
  | "tasks"
  | "achievements"
  | "checkins"
  | "staking"
  | "referral_earnings";

interface LeaderboardEntry {
  displayName: string;
  xp: number;
  categoryXp: number;
  categoryScore: number;
  rank: number;
  unit?: "XP" | "XNRT";
  category?: string;
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
    category: LeaderboardCategory;
    label: string;
    unit: "XP" | "XNRT";
    window: string;
  };
}

const PERIODS: { value: LeaderboardPeriod; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "all-time", label: "All-time" },
];

const CATEGORIES: { value: LeaderboardCategory; label: string }[] = [
  { value: "overall", label: "Overall XP" },
  { value: "mining", label: "Mining XP" },
  { value: "tasks", label: "Task XP" },
  { value: "achievements", label: "Achievement XP" },
  { value: "checkins", label: "Check-in XP" },
  { value: "staking", label: "Staking XNRT" },
  { value: "referral_earnings", label: "Referral XNRT" },
];

function formatScore(value: number, unit = "XP") {
  const safeValue = Number.isFinite(value) ? value : 0;
  const formatted = unit === "XNRT"
    ? safeValue.toLocaleString(undefined, { maximumFractionDigits: 2 })
    : Math.round(safeValue).toLocaleString();
  return `${formatted} ${unit}`;
}

export function XPLeaderboard() {
  const { user } = useAuth();
  const isAdmin = user?.isAdmin || false;
  const [period, setPeriod] = useState<LeaderboardPeriod>("all-time");
  const [category, setCategory] = useState<LeaderboardCategory>("overall");

  const { data, isLoading, isError, error, refetch } = useQuery<LeaderboardResponse>({
    queryKey: ["/api/leaderboard/xp", period, category],
    queryFn: async () => {
      const params = new URLSearchParams({ period, category, limit: "50" });
      const res = await fetch(`/api/leaderboard/xp?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch XP leaderboard");
      return res.json();
    },
  });

  const unit = data?.meta?.unit ?? (category === "staking" || category === "referral_earnings" ? "XNRT" : "XP");
  const heading = data?.meta?.label ?? CATEGORIES.find((item) => item.value === category)?.label ?? "Leaderboard";
  const windowLabel = data?.meta?.window ?? "all time";

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
          <span data-testid={`text-score-${entry.rank}`}>
            {formatScore(entry.categoryScore ?? entry.categoryXp ?? entry.xp, entry.unit ?? unit)}
          </span>
          {category !== "overall" && (
            <>
              <span>•</span>
              <span>{entry.xp.toLocaleString()} Total XP</span>
            </>
          )}
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
    <Card data-testid="card-xp-leaderboard">
      <CardHeader>
        <div className="space-y-4">
          <div>
            <CardTitle>{heading}</CardTitle>
            <p className="text-sm text-muted-foreground">Window: {windowLabel}</p>
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

          <div className="flex flex-wrap gap-1">
            {CATEGORIES.map((item) => (
              <Button
                key={item.value}
                variant={category === item.value ? "default" : "outline"}
                size="sm"
                onClick={() => setCategory(item.value)}
                data-testid={`button-category-${item.value}`}
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
            <p className="font-medium">Could not load leaderboard</p>
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
            <Star className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="font-medium" data-testid="text-no-data">No leaderboard data yet</p>
            <p className="mb-4 max-w-sm text-sm text-muted-foreground">
              Complete mining sessions, tasks, check-ins, or achievements to appear in this ranking.
            </p>
            <Button asChild variant="outline">
              <Link href="/tasks">View Tasks</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
