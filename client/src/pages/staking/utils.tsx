import { useEffect, useState, type ComponentType } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { STAKING_TIERS, type StakingTier } from "@shared/schema";
import type { Stake, TierSummary } from "./types";

export const tierIcons: Record<string, string> = {
  royal_sapphire: "💎",
  legendary_emerald: "🟢",
  imperial_platinum: "⚪",
  mythic_diamond: "💠",
  trust_loan: "🤝",
};

export const tierAccent: Record<string, string> = {
  royal_sapphire: "from-blue-500/20 to-cyan-500/10 border-blue-500/25",
  legendary_emerald: "from-emerald-500/20 to-green-500/10 border-emerald-500/25",
  imperial_platinum: "from-slate-400/20 to-zinc-500/10 border-slate-400/25",
  mythic_diamond: "from-purple-500/20 to-pink-500/10 border-purple-500/25",
  trust_loan: "from-amber-500/20 to-orange-500/10 border-amber-500/25",
};

export function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatXnrt(value: unknown, decimals = 2) {
  return toNumber(value).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

export function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function getTierName(tier: string) {
  if (tier === "trust_loan") return "Trust Loan";
  const config = STAKING_TIERS[tier as StakingTier];
  if (config) return config.name;
  return tier
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function getTierConfig(tier: string) {
  return STAKING_TIERS[tier as StakingTier] ?? null;
}

export function buildTierSummaries(apiTiers?: TierSummary[]) {
  if (apiTiers?.length) return apiTiers;

  return Object.entries(STAKING_TIERS).map(([key, tier]) => ({
    key,
    ...tier,
    estimatedTotalProfitAtMin:
      (Number(tier.minAmount) * Number(tier.dailyRate) * Number(tier.duration)) / 100,
    riskLabel: "Simulated platform reward",
  }));
}

export function getStatusBadge(stake: Stake) {
  if (stake.status === "withdrawn") return <Badge variant="secondary">Withdrawn</Badge>;
  if (stake.canWithdraw || stake.status === "completed") {
    return <Badge className="bg-emerald-500/15 text-emerald-600">Matured</Badge>;
  }
  if (stake.isLoan) return <Badge className="bg-amber-500/15 text-amber-600">Trust Loan</Badge>;
  return <Badge className="bg-blue-500/15 text-blue-600">Active</Badge>;
}

export function StakingCountdown({ endDate }: { endDate: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const diff = Math.max(0, new Date(endDate).getTime() - now);
  if (diff <= 0) {
    return <span className="font-semibold text-emerald-600">Ready to withdraw</span>;
  }

  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff / (60 * 60 * 1000)) % 24);
  const minutes = Math.floor((diff / (60 * 1000)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  return (
    <span className="font-mono text-sm">
      {days > 0 ? `${days}d ` : ""}
      {String(hours).padStart(2, "0")}:{String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
    </span>
  );
}

export function StakingStatCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <div className="rounded-2xl bg-primary/10 p-3 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
