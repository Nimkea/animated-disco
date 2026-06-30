import { Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Stake } from "./types";
import { StakePositionCard } from "./stake-position-card";

export function StakingPositionsTab({
  stakes,
  isWithdrawing,
  onCreateStake,
  onWithdraw,
}: {
  stakes: Stake[];
  isWithdrawing: boolean;
  onCreateStake: () => void;
  onWithdraw: (stake: Stake) => void;
}) {
  if (stakes.length === 0) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <Coins className="mx-auto mb-4 h-14 w-14 text-muted-foreground" />
          <h3 className="text-lg font-semibold">No active stakes yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a stake to start tracking platform rewards and maturity countdowns.
          </p>
          <Button className="mt-4" onClick={onCreateStake}>Create Stake</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {stakes.map((stake) => (
        <StakePositionCard
          key={stake.id}
          stake={stake}
          isWithdrawing={isWithdrawing}
          onWithdraw={onWithdraw}
        />
      ))}
    </div>
  );
}
