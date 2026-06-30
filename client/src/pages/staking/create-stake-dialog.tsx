import { AlertCircle } from "lucide-react";
import { STAKING_TIERS, type StakingTier } from "@shared/schema";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatXnrt } from "./utils";

export function CreateStakeDialog({
  open,
  onOpenChange,
  selectedTier,
  onSelectedTierChange,
  amount,
  onAmountChange,
  availableBalance,
  dailyProfit,
  projectedProfit,
  canCreateStake,
  isCreating,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTier: StakingTier;
  onSelectedTierChange: (tier: StakingTier) => void;
  amount: string;
  onAmountChange: (amount: string) => void;
  availableBalance: unknown;
  dailyProfit: number;
  projectedProfit: number;
  canCreateStake: boolean;
  isCreating: boolean;
  onCreate: () => void;
}) {
  const selectedTierConfig = STAKING_TIERS[selectedTier];
  const enteredAmount = Number(amount || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Create staking position</DialogTitle>
          <DialogDescription>Select a reward tier and lock available XNRT until maturity.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <Alert className="border-amber-500/30 bg-amber-500/5">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Simulated platform rewards</AlertTitle>
            <AlertDescription>
              Daily rates are app reward mechanics. They are not guaranteed financial returns and may change by platform policy.
            </AlertDescription>
          </Alert>

          <div className="grid gap-2">
            <Label>Tier</Label>
            <Select value={selectedTier} onValueChange={(value) => onSelectedTierChange(value as StakingTier)}>
              <SelectTrigger data-testid="select-staking-tier">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STAKING_TIERS).map(([key, tier]) => (
                  <SelectItem key={key} value={key}>{tier.name} · {tier.duration}d · {tier.dailyRate}% daily</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="stake-amount">Amount</Label>
            <Input
              id="stake-amount"
              inputMode="decimal"
              value={amount}
              onChange={(event) => onAmountChange(event.target.value)}
              placeholder={`Min ${selectedTierConfig.minAmount.toLocaleString()} XNRT`}
              data-testid="input-stake-amount"
            />
            <p className="text-xs text-muted-foreground">Available: {formatXnrt(availableBalance)} XNRT</p>
          </div>

          <div className="rounded-2xl border bg-muted/30 p-4">
            <div className="grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <p className="text-muted-foreground">Daily reward</p>
                <p className="font-semibold">{formatXnrt(dailyProfit)} XNRT</p>
              </div>
              <div>
                <p className="text-muted-foreground">Projected total</p>
                <p className="font-semibold">{formatXnrt(projectedProfit)} XNRT</p>
              </div>
              <div>
                <p className="text-muted-foreground">Unlocks after</p>
                <p className="font-semibold">{selectedTierConfig.duration} days</p>
              </div>
            </div>
          </div>

          {enteredAmount > 0 && !canCreateStake && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Cannot create stake</AlertTitle>
              <AlertDescription>
                Check minimum/maximum tier limits and make sure your available balance is enough.
              </AlertDescription>
            </Alert>
          )}

          <Button
            className="w-full"
            onClick={onCreate}
            disabled={!canCreateStake || isCreating}
            data-testid="button-create-stake"
          >
            {isCreating ? "Creating..." : "Create Stake"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
