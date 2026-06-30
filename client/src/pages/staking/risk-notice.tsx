import { ShieldAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function StakingRiskNotice({ disclaimer }: { disclaimer?: string }) {
  return (
    <Alert className="border-amber-500/30 bg-amber-500/5">
      <ShieldAlert className="h-4 w-4" />
      <AlertTitle>Important reward notice</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>
          {disclaimer ??
            "Staking rewards are simulated in-app platform rewards and not guaranteed investment returns."}
        </p>
        <p className="text-xs text-muted-foreground">
          Reward rates shown in this demo can be changed by platform rules. This screen is not financial advice, and displayed APY/daily rates should be treated as app reward mechanics, not guaranteed market yield.
        </p>
      </AlertDescription>
    </Alert>
  );
}
