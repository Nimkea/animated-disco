import { LockKeyhole, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Stake } from "./types";
import {
  formatDate,
  formatXnrt,
  getStatusBadge,
  getTierConfig,
  getTierName,
  StakingCountdown,
  tierIcons,
} from "./utils";

export function StakePositionCard({
  stake,
  isWithdrawing,
  onWithdraw,
}: {
  stake: Stake;
  isWithdrawing: boolean;
  onWithdraw: (stake: Stake) => void;
}) {
  const tier = getTierConfig(stake.tier);
  const isTrustLoan = Boolean(stake.isLoan);

  return (
    <Card key={stake.id} className="overflow-hidden" data-testid={`stake-card-${stake.id}`}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <span>{tierIcons[stake.tier] ?? "💰"}</span>
              {getTierName(stake.tier)}
            </CardTitle>
            <CardDescription>
              {isTrustLoan
                ? "Virtual Trust Loan principal; profit only withdrawable"
                : `${formatXnrt(stake.amount)} XNRT principal`}
            </CardDescription>
          </div>
          {getStatusBadge(stake)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Maturity progress</span>
            <span className="font-medium">{Math.round(stake.progressPercent ?? 0)}%</span>
          </div>
          <Progress value={stake.progressPercent ?? 0} />
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <div>
            <p className="text-muted-foreground">Daily</p>
            <p className="font-semibold">{formatXnrt(stake.dailyProfit)} XNRT</p>
          </div>
          <div>
            <p className="text-muted-foreground">Accrued</p>
            <p className="font-semibold text-emerald-600">{formatXnrt(stake.totalProfit)} XNRT</p>
          </div>
          <div>
            <p className="text-muted-foreground">Projected</p>
            <p className="font-semibold">{formatXnrt(stake.projectedProfit)} XNRT</p>
          </div>
          <div>
            <p className="text-muted-foreground">Rate</p>
            <p className="font-semibold">{tier?.dailyRate ?? stake.dailyRate}% / day</p>
          </div>
        </div>

        {isTrustLoan && (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300">
            Trust Loan principal is virtual. Only generated profit becomes withdrawable after maturity.
          </div>
        )}

        <div className="rounded-xl bg-muted/50 p-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Ends {formatDate(stake.endDate)}</span>
            <StakingCountdown endDate={stake.endDate} />
          </div>
        </div>

        <Button
          className="w-full"
          disabled={!stake.canWithdraw || isWithdrawing}
          onClick={() => onWithdraw(stake)}
          data-testid={`button-withdraw-stake-${stake.id}`}
        >
          {stake.canWithdraw ? <Unlock className="mr-2 h-4 w-4" /> : <LockKeyhole className="mr-2 h-4 w-4" />}
          {stake.canWithdraw ? `Withdraw ${formatXnrt(stake.withdrawableAmount)} XNRT` : "Locked until maturity"}
        </Button>
      </CardContent>
    </Card>
  );
}
