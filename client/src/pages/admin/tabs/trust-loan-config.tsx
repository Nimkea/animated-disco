import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { HandCoins, Info, RefreshCw, Save, ShieldAlert, Users } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

const numberFields = [
  "amountXnrt",
  "dailyRate",
  "durationDays",
  "requiredReferrals",
  "requiredInvestingReferrals",
  "minInvestUsdtPerReferral",
] as const;

type NumberField = (typeof numberFields)[number];

type TrustLoanConfig = {
  id: string;
  enabled: boolean;
  title: string;
  description: string;
  terms: string;
  amountXnrt: number;
  dailyRate: number;
  durationDays: number;
  requiredReferrals: number;
  requiredInvestingReferrals: number;
  minInvestUsdtPerReferral: number;
  updatedBy?: string | null;
  updatedAt?: string | null;
};

type TrustLoanAdminResponse = {
  config: TrustLoanConfig;
  metrics?: {
    claimedCount?: number;
    activeCount?: number;
    completedCount?: number;
    withdrawnCount?: number;
    eligibleSampleCount?: number;
    eligibleSampleSize?: number;
    projectedProfitAtCurrentConfig?: number;
  };
  recentClaims?: Array<{
    id: string;
    userId: string;
    status: string;
    amount: string;
    totalProfit: string;
    createdAt: string;
    endDate: string;
  }>;
};

function formatNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toLocaleString(undefined, { maximumFractionDigits: 8 }) : "0";
}

function toEditableConfig(config?: TrustLoanConfig) {
  return {
    enabled: config?.enabled ?? true,
    title: config?.title ?? "Trust Loan",
    description: config?.description ?? "",
    terms: config?.terms ?? "",
    amountXnrt: String(config?.amountXnrt ?? 10000),
    dailyRate: String(config?.dailyRate ?? 1.3),
    durationDays: String(config?.durationDays ?? 30),
    requiredReferrals: String(config?.requiredReferrals ?? 3),
    requiredInvestingReferrals: String(config?.requiredInvestingReferrals ?? 2),
    minInvestUsdtPerReferral: String(config?.minInvestUsdtPerReferral ?? 100),
  };
}

export default function TrustLoanConfigTab() {
  const { toast } = useToast();
  const { data, isLoading, isError, refetch } = useQuery<TrustLoanAdminResponse>({
    queryKey: ["/api/admin/trust-loan/config"],
  });

  const [form, setForm] = React.useState(() => toEditableConfig());

  React.useEffect(() => {
    if (data?.config) setForm(toEditableConfig(data.config));
  }, [data?.config]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        enabled: form.enabled,
        title: form.title,
        description: form.description,
        terms: form.terms,
      };
      for (const key of numberFields) payload[key] = Number(form[key]);

      const response = await apiRequest("PATCH", "/api/admin/trust-loan/config", payload);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Trust Loan config saved", description: "Users will see the updated program settings." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/trust-loan/config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trust-loan/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stakes/summary"] });
    },
    onError: (error: Error) => {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    },
  });

  const setNumberField = (key: NumberField, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const projectedProfit = Number(form.amountXnrt || 0) * (Number(form.dailyRate || 0) / 100) * Number(form.durationDays || 0);

  if (isLoading) {
    return <div className="rounded-3xl border bg-card p-6 text-sm text-muted-foreground">Loading Trust Loan configuration…</div>;
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Could not load Trust Loan config</AlertTitle>
        <AlertDescription className="mt-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="mr-2 h-4 w-4" /> Retry</Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold">
            <HandCoins className="h-6 w-6 text-primary" /> Trust Loan Config
          </h2>
          <p className="text-sm text-muted-foreground">Control eligibility, virtual principal, reward rate, and public terms.</p>
        </div>
        <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
          <Save className="mr-2 h-4 w-4" /> {updateMutation.isPending ? "Saving…" : "Save Config"}
        </Button>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Important</AlertTitle>
        <AlertDescription>
          Trust Loan principal is virtual and not withdrawable. Users can withdraw only generated profit after maturity. Keep terms clear to avoid confusion.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Program</CardTitle></CardHeader><CardContent><Badge variant={form.enabled ? "default" : "secondary"}>{form.enabled ? "Enabled" : "Disabled"}</Badge></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Claimed</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatNumber(data?.metrics?.claimedCount)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Active</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatNumber(data?.metrics?.activeCount)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Projected Profit</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatNumber(projectedProfit)} XNRT</div></CardContent></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <Card>
          <CardHeader>
            <CardTitle>Program Settings</CardTitle>
            <CardDescription>These values affect new eligibility checks and future claims.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between rounded-2xl border p-4">
              <div>
                <Label className="text-base">Enable Trust Loan</Label>
                <p className="text-sm text-muted-foreground">Disabled programs cannot be claimed by users.</p>
              </div>
              <Switch checked={form.enabled} onCheckedChange={(enabled) => setForm((prev) => ({ ...prev, enabled }))} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Virtual Principal (XNRT)</Label><Input type="number" min="1" value={form.amountXnrt} onChange={(e) => setNumberField("amountXnrt", e.target.value)} /></div>
              <div className="space-y-2"><Label>Daily Rate (%)</Label><Input type="number" step="0.01" min="0" value={form.dailyRate} onChange={(e) => setNumberField("dailyRate", e.target.value)} /></div>
              <div className="space-y-2"><Label>Duration Days</Label><Input type="number" min="1" value={form.durationDays} onChange={(e) => setNumberField("durationDays", e.target.value)} /></div>
              <div className="space-y-2"><Label>Required Direct Referrals</Label><Input type="number" min="0" value={form.requiredReferrals} onChange={(e) => setNumberField("requiredReferrals", e.target.value)} /></div>
              <div className="space-y-2"><Label>Required Investing Referrals</Label><Input type="number" min="0" value={form.requiredInvestingReferrals} onChange={(e) => setNumberField("requiredInvestingReferrals", e.target.value)} /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Minimum Approved Deposit per Investing Referral (USDT)</Label><Input type="number" min="0" value={form.minInvestUsdtPerReferral} onChange={(e) => setNumberField("minInvestUsdtPerReferral", e.target.value)} /></div>
            </div>

            <div className="space-y-2"><Label>Description</Label><Textarea rows={4} value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Terms / Public Notice</Label><Textarea rows={5} value={form.terms} onChange={(e) => setForm((prev) => ({ ...prev, terms: e.target.value }))} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Recent Claims</CardTitle>
            <CardDescription>Latest Trust Loan stake records.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.recentClaims || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No Trust Loan claims yet.</p>
            ) : (
              (data?.recentClaims || []).map((claim) => (
                <div key={claim.id} className="rounded-2xl border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{claim.id.slice(0, 8)}…</span>
                    <Badge variant="outline">{claim.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">User: {claim.userId.slice(0, 8)}…</p>
                  <p className="mt-1 text-xs text-muted-foreground">Profit: {formatNumber(claim.totalProfit)} XNRT</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
