import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Medal, Award, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface LeaderboardEntry {
  userId: string;
  username: string;
  email: string;
  totalReferrals: number;
  totalCommission: string;
  level1Count: number;
  level2Count: number;
  level3Count: number;
  rank: number;
}

interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
  userPosition: LeaderboardEntry | null;
}

export function ReferralLeaderboard() {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'all-time'>('all-time');

  const { data, isLoading } = useQuery<LeaderboardResponse>({
    queryKey: ['/api/leaderboard/referrals', period],
    queryFn: async () => {
      const res = await fetch(`/api/leaderboard/referrals?period=${period}`);
      if (!res.ok) throw new Error('Failed to fetch leaderboard');
      return res.json();
    },
  });

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
    if (rank === 3) return <Award className="h-5 w-5 text-amber-600" />;
    return <span className="text-sm font-bold text-muted-foreground">#{rank}</span>;
  };

  return (
    <Card data-testid="card-leaderboard">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Referral Leaderboard</CardTitle>
          <div className="flex gap-1">
            {(['daily', 'weekly', 'monthly', 'all-time'] as const).map((p) => (
              <Button
                key={p}
                variant={period === p ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setPeriod(p)}
                data-testid={`button-period-${p}`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1).replace('-', ' ')}
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
        ) : data && data.leaderboard.length > 0 ? (
          <>
            <div className="space-y-2">
              {data.leaderboard.slice(0, 10).map((entry) => (
                <div
                  key={entry.userId}
                  className={`flex items-center gap-4 p-3 rounded-lg border ${
                    entry.rank <= 3 ? 'bg-gradient-to-r from-primary/5 to-transparent border-primary/20' : 'bg-card border-border'
                  }`}
                  data-testid={`leaderboard-entry-${entry.rank}`}
                >
                  <div className="w-8 flex items-center justify-center">
                    {getRankIcon(entry.rank)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{entry.username || entry.email}</p>
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      <span>{entry.totalReferrals} referrals</span>
                      <span>•</span>
                      <span>{parseFloat(entry.totalCommission).toLocaleString()} XNRT</span>
                    </div>
                  </div>
                  {entry.rank <= 3 && (
                    <Badge variant="secondary" className="font-mono">
                      Top {entry.rank}
                    </Badge>
                  )}
                </div>
              ))}
            </div>

            {data.userPosition && data.userPosition.rank > 10 && (
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-2">Your Position</p>
                <div className="flex items-center gap-4 p-3 rounded-lg border bg-primary/5 border-primary/20" data-testid="leaderboard-user-position">
                  <div className="w-8 flex items-center justify-center">
                    <span className="text-sm font-bold text-primary">#{data.userPosition.rank}</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">You</p>
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      <span>{data.userPosition.totalReferrals} referrals</span>
                      <span>•</span>
                      <span>{parseFloat(data.userPosition.totalCommission).toLocaleString()} XNRT</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No leaderboard data available for this period</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
