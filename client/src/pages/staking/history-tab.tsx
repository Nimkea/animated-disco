import { History } from "lucide-react";
import { STAKING_TIERS } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Stake } from "./types";
import { formatDate, formatXnrt, getTierName, tierIcons } from "./utils";

export function StakingHistoryTab({
  stakes,
  historyFilter,
  onHistoryFilterChange,
}: {
  stakes: Stake[];
  historyFilter: string;
  onHistoryFilterChange: (value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Withdrawn stake history</h2>
          <p className="text-sm text-muted-foreground">
            Completed withdrawals and realized platform rewards.
          </p>
        </div>
        <Select value={historyFilter} onValueChange={onHistoryFilterChange}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="Filter by tier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tiers</SelectItem>
            {Object.entries(STAKING_TIERS).map(([key, tier]) => (
              <SelectItem key={key} value={key}>{tier.name}</SelectItem>
            ))}
            <SelectItem value="trust_loan">Trust Loan</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {stakes.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <History className="mx-auto mb-4 h-14 w-14 text-muted-foreground" />
            <h3 className="text-lg font-semibold">No withdrawal history yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Matured and withdrawn stakes will appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {stakes.map((stake) => (
            <Card key={stake.id}>
              <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-primary/10 p-3 text-xl">{tierIcons[stake.tier] ?? "💰"}</div>
                  <div>
                    <p className="font-semibold">{getTierName(stake.tier)}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(stake.startDate)} → {formatDate(stake.endDate)}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 text-right text-sm">
                  <div>
                    <p className="text-muted-foreground">Principal</p>
                    <p className="font-semibold">{formatXnrt(stake.withdrawablePrincipal ?? stake.amount)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Profit</p>
                    <p className="font-semibold text-emerald-600">+{formatXnrt(stake.totalProfit)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total</p>
                    <p className="font-semibold">{formatXnrt(stake.withdrawableAmount)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
