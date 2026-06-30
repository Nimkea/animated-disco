import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { StakingTier } from "@shared/schema";
import type { TierSummary } from "./types";
import { formatXnrt, tierAccent, tierIcons } from "./utils";

export function StakingTierGrid({
  tiers,
  selectedTier,
  onSelectTier,
}: {
  tiers: TierSummary[];
  selectedTier: StakingTier;
  onSelectTier: (tier: StakingTier) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {tiers.map((tier) => (
        <Card
          key={tier.key}
          className={`premium-card group rounded-3xl border bg-gradient-to-br ${tierAccent[tier.key] ?? "from-primary/10 to-background"}`}
        >
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <span>{tierIcons[tier.key] ?? "💰"}</span>
                  {tier.name}
                </CardTitle>
                <CardDescription>{tier.duration} days lock period</CardDescription>
              </div>
              <Badge variant="outline">{tier.dailyRate}% daily</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Min</p>
                <p className="font-semibold">{formatXnrt(tier.minAmount, 0)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Max</p>
                <p className="font-semibold">{formatXnrt(tier.maxAmount, 0)}</p>
              </div>
            </div>
            <div className="premium-info-tile rounded-xl border p-3 text-xs text-muted-foreground">
              <p>Projected reward at minimum: {formatXnrt(tier.estimatedTotalProfitAtMin ?? 0)} XNRT.</p>
            </div>
            <Button
              variant={selectedTier === tier.key ? "default" : "outline"}
              className="w-full premium-action-button"
              onClick={() => onSelectTier(tier.key as StakingTier)}
              data-testid={`button-select-tier-${tier.key}`}
            >
              Select Tier
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
