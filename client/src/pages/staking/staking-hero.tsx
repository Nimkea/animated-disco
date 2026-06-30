import { ArrowRight, Clock, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { StakingSummary } from "./types";
import { formatDate, formatXnrt } from "./utils";

export function StakingHero({
  summary,
  isRefreshing,
  onCreateStake,
  onRefreshRewards,
}: {
  summary?: StakingSummary;
  isRefreshing: boolean;
  onCreateStake: () => void;
  onRefreshRewards: () => void;
}) {
  const openStakes = (summary?.totals.activeCount ?? 0) + (summary?.totals.completedCount ?? 0);

  return (
    <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/15 via-background to-background">
      <CardContent className="p-6 md:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-center">
          <div className="space-y-4">
            <Badge className="w-fit bg-primary/15 text-primary hover:bg-primary/20">Staking v3</Badge>
            <div>
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                XNRT STAKING
              </h1>
              <p className="mt-2 max-w-2xl text-muted-foreground">
                Create XNRT staking positions, track maturity countdowns, and refresh due rewards from one clean dashboard.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={onCreateStake} data-testid="button-open-create-stake">
                Start Staking <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                onClick={onRefreshRewards}
                disabled={isRefreshing}
                data-testid="button-refresh-staking-rewards"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                Refresh Rewards
              </Button>
            </div>
          </div>
          <div className="rounded-3xl border bg-background/80 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Next maturity</p>
                <p className="text-xl font-semibold">{formatDate(summary?.totals.nextMaturityAt)}</p>
              </div>
              <Clock className="h-9 w-9 text-primary" />
            </div>
            <Separator className="my-4" />
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Open stakes</p>
                <p className="text-lg font-semibold">{openStakes}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Withdrawable</p>
                <p className="text-lg font-semibold">{formatXnrt(summary?.totals.withdrawableAmount)} XNRT</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
