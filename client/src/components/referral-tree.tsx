import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, ArrowDown, CheckCircle2, Clock } from "lucide-react";
import type { Referral } from "@shared/schema";

interface ReferralTreeProps {
  referrals: Referral[];
  isLoading?: boolean;
}

function formatXnrt(value?: string | null) {
  return Number.parseFloat(value || "0").toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}

function levelMeta(level: number) {
  if (level === 1) return { rate: "6%", className: "bg-chart-1/5 border-chart-1/20", text: "text-chart-1" };
  if (level === 2) return { rate: "3%", className: "bg-chart-2/5 border-chart-2/20", text: "text-chart-2" };
  return { rate: "1%", className: "bg-chart-3/5 border-chart-3/20", text: "text-chart-3" };
}

function ReferralNode({ referral, idx }: { referral: Referral; idx: number }) {
  const meta = levelMeta(referral.level);
  return (
    <div
      className={`p-3 border rounded-md text-center space-y-2 ${meta.className}`}
      data-testid={`tree-node-l${referral.level}-${idx}`}
    >
      <Users className={`h-4 w-4 mx-auto ${meta.text}`} />
      <p className="text-xs font-semibold truncate">
        {referral.displayName || `Referral #${idx + 1}`}
      </p>
      <div className="flex items-center justify-center gap-1">
        {referral.hasDeposited ? (
          <Badge variant="secondary" className="gap-1 text-[10px]">
            <CheckCircle2 className="h-3 w-3" /> Active
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1 text-[10px]">
            <Clock className="h-3 w-3" /> Joined
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {formatXnrt(referral.totalCommission)} XNRT earned
      </p>
      {referral.hasDeposited && (
        <p className="text-[11px] text-muted-foreground">
          {referral.depositCount || 0} deposit{(referral.depositCount || 0) === 1 ? "" : "s"}
        </p>
      )}
    </div>
  );
}

export function ReferralTree({ referrals, isLoading }: ReferralTreeProps) {
  const level1Referrals = referrals.filter((r) => r.level === 1);
  const level2Referrals = referrals.filter((r) => r.level === 2);
  const level3Referrals = referrals.filter((r) => r.level === 3);

  if (isLoading) {
    return (
      <Card data-testid="card-referral-tree">
        <CardHeader>
          <CardTitle>Referral Network Tree</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="text-muted-foreground mt-4">Loading referral network...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (referrals.length === 0) {
    return (
      <Card data-testid="card-referral-tree">
        <CardHeader>
          <CardTitle>Referral Network</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No referrals yet. Start sharing your code!</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const renderLevel = (level: number, items: Referral[]) => {
    if (items.length === 0) return null;
    const meta = levelMeta(level);
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center gap-2">
          <Badge variant="secondary" className={`${meta.text} border-current/30`}>
            Level {level} - {meta.rate} Commission
          </Badge>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {items.slice(0, 8).map((ref, idx) => (
            <ReferralNode key={ref.id} referral={ref} idx={idx} />
          ))}
          {items.length > 8 && (
            <div className="p-3 bg-muted/50 border border-border rounded-md text-center flex items-center justify-center">
              <p className="text-xs font-medium text-muted-foreground">+{items.length - 8} more</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card data-testid="card-referral-tree">
      <CardHeader>
        <CardTitle>Referral Network Tree</CardTitle>
        <p className="text-sm text-muted-foreground">
          Privacy-safe 3-level network with deposit status and earned commission.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex justify-center">
          <div className="relative">
            <div className="px-6 py-3 bg-gradient-to-br from-primary/20 to-primary/10 border-2 border-primary rounded-lg">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <span className="font-bold">You</span>
              </div>
            </div>
            {level1Referrals.length > 0 && (
              <div className="absolute left-1/2 transform -translate-x-1/2 top-full">
                <ArrowDown className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
          </div>
        </div>

        {renderLevel(1, level1Referrals)}
        {renderLevel(2, level2Referrals)}
        {renderLevel(3, level3Referrals)}
      </CardContent>
    </Card>
  );
}
