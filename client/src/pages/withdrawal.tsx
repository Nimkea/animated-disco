import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowUpFromLine, AlertCircle, CheckCircle, Clock, ShieldCheck, Wallet, XCircle } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { Balance, Transaction } from "@shared/schema";
import { isUnauthorizedError } from "@/lib/authUtils";

interface WalletRates {
  xnrtPerUsdt: number;
  usdtPerXnrt: number;
  withdrawalFeePercent: number;
  withdrawalToken: string;
  network: string;
  minReferralWithdrawal: number;
  minMiningWithdrawal: number;
}

type Source = "main" | "staking" | "mining" | "referral";

const formatNumber = (value?: number | string | null, digits = 2) =>
  Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: digits });

const sourceLabel: Record<Source, string> = {
  main: "Main Balance",
  staking: "Staking Balance",
  mining: "Mining Balance",
  referral: "Referral Balance",
};

export default function Withdrawal() {
  const { toast } = useToast();
  const [source, setSource] = useState<Source>("main");
  const [amount, setAmount] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const { data: balance } = useQuery<Balance>({ queryKey: ["/api/balance"] });
  const { data: rates } = useQuery<WalletRates>({ queryKey: ["/api/wallet/rates"] });
  const { data: withdrawals } = useQuery<Transaction[]>({ queryKey: ["/api/transactions/withdrawals"] });

  const withdrawMutation = useMutation({
    mutationFn: async (data: { source: string; amount: string; walletAddress: string }) =>
      await apiRequest("POST", "/api/transactions/withdrawal", data),
    onSuccess: () => {
      toast({ title: "Withdrawal Reserved", description: "Your balance has been reserved and the request is pending admin approval." });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions/withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/summary"] });
      setAmount("");
      setWalletAddress("");
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "You are logged out. Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Error", description: error.message || "Failed to request withdrawal", variant: "destructive" });
    },
  });

  const getAvailableBalance = (selected: Source) => {
    switch (selected) {
      case "staking": return Number(balance?.stakingBalance || 0);
      case "mining": return Number(balance?.miningBalance || 0);
      case "referral": return Number(balance?.referralBalance || 0);
      case "main":
      default: return Number(balance?.xnrtBalance || 0);
    }
  };

  const withdrawAmount = Number(amount || 0);
  const feePercent = rates?.withdrawalFeePercent ?? 2;
  const fee = (withdrawAmount * feePercent) / 100;
  const netAmount = Math.max(0, withdrawAmount - fee);
  const usdtValue = netAmount * (rates?.usdtPerXnrt ?? 0.01);
  const availableBalance = getAvailableBalance(source);
  const isValidAddress = /^0x[a-fA-F0-9]{40}$/.test(walletAddress.trim());

  const handleWithdraw = () => {
    if (!amount || !walletAddress) {
      toast({ title: "Missing Information", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    if (!Number.isFinite(withdrawAmount) || withdrawAmount <= 0) {
      toast({ title: "Invalid Amount", description: "Please enter a valid amount", variant: "destructive" });
      return;
    }
    if (!isValidAddress) {
      toast({ title: "Invalid Wallet", description: "Enter a valid BEP-20 wallet address starting with 0x", variant: "destructive" });
      return;
    }
    if (withdrawAmount > availableBalance) {
      toast({ title: "Insufficient Balance", description: "You don't have enough balance for this withdrawal", variant: "destructive" });
      return;
    }
    if (source === "referral" && withdrawAmount < (rates?.minReferralWithdrawal || 5000)) {
      toast({ title: "Minimum Not Met", description: `Minimum referral withdrawal is ${formatNumber(rates?.minReferralWithdrawal || 5000, 0)} XNRT`, variant: "destructive" });
      return;
    }
    if (source === "mining" && withdrawAmount < (rates?.minMiningWithdrawal || 5000)) {
      toast({ title: "Minimum Not Met", description: `Minimum mining withdrawal is ${formatNumber(rates?.minMiningWithdrawal || 5000, 0)} XNRT`, variant: "destructive" });
      return;
    }
    setShowConfirmDialog(true);
  };

  const confirmWithdraw = () => withdrawMutation.mutate({ source, amount, walletAddress: walletAddress.trim() });

  const sources: Array<{ key: Source; helper: string }> = [
    { key: "main", helper: "Flexible" },
    { key: "staking", helper: "Unlocked rewards" },
    { key: "mining", helper: `Min ${formatNumber(rates?.minMiningWithdrawal || 5000, 0)}` },
    { key: "referral", helper: `Min ${formatNumber(rates?.minReferralWithdrawal || 5000, 0)}` },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold font-serif">Withdrawal</h1>
          <p className="text-muted-foreground">Withdraw XNRT token to a BEP-20 wallet. Pending requests reserve balance immediately.</p>
        </div>
        <Badge variant="outline" className="w-fit gap-2 border-primary/30 bg-primary/10 text-primary">
          <ShieldCheck className="h-4 w-4" /> {rates?.withdrawalToken || "XNRT"} payout
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {sources.map((item) => (
          <Card key={item.key} className={`cursor-pointer transition-all ${source === item.key ? "border-primary ring-2 ring-primary/20" : "hover:border-primary/50"}`} onClick={() => setSource(item.key)}>
            <CardContent className="p-5">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{sourceLabel[item.key]}</p>
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <p className="text-3xl font-bold font-mono" data-testid={`text-${item.key}-balance`}>{formatNumber(getAvailableBalance(item.key))}</p>
              <p className="text-xs text-muted-foreground">XNRT · {item.helper}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>Withdrawal Request</CardTitle>
            <CardDescription>Selected source: {sourceLabel[source]}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="amount">Amount (XNRT)</Label>
              <Input id="amount" type="number" placeholder="5000" value={amount} onChange={(e) => setAmount(e.target.value)} data-testid="input-withdrawal-amount" />
            </div>
            <div>
              <Label htmlFor="wallet">Destination BEP-20 Wallet</Label>
              <Input id="wallet" placeholder="0x..." value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)} className="font-mono text-xs" data-testid="input-wallet-address" />
              {walletAddress && !isValidAddress && <p className="mt-1 text-xs text-destructive">Invalid BEP-20 address format.</p>}
            </div>

            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Requested</span><span>{formatNumber(withdrawAmount)} XNRT</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Fee ({formatNumber(feePercent)}%)</span><span>{formatNumber(fee)} XNRT</span></div>
              <div className="flex justify-between border-t border-border pt-2 font-semibold"><span>You receive</span><span>{formatNumber(netAmount)} XNRT</span></div>
              <p className="text-xs text-muted-foreground">Estimated value: {formatNumber(usdtValue)} USDT at current app rate.</p>
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
              <div className="flex gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>After submitting, the requested amount is reserved from your selected balance. Rejected withdrawals are refunded automatically.</p>
              </div>
            </div>

            <Button className="w-full gap-2" onClick={handleWithdraw} disabled={withdrawMutation.isPending} data-testid="button-request-withdrawal">
              <ArrowUpFromLine className="h-4 w-4" />
              {withdrawMutation.isPending ? "Submitting..." : "Request Withdrawal"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Withdrawal History</CardTitle>
            <CardDescription>Your pending, approved, and rejected withdrawals</CardDescription>
          </CardHeader>
          <CardContent>
            {!withdrawals || withdrawals.length === 0 ? (
              <div className="text-center py-12">
                <ArrowUpFromLine className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No withdrawals yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {withdrawals.map((withdrawal) => <WithdrawalItem key={withdrawal.id} withdrawal={withdrawal} />)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        onConfirm={confirmWithdraw}
        title="Confirm Withdrawal"
        description={`Reserve ${formatNumber(withdrawAmount)} XNRT from ${sourceLabel[source]}. Admin approval will send ${formatNumber(netAmount)} XNRT to ${walletAddress}.`}
        confirmText="Reserve & Submit"
      />
    </div>
  );
}

function WithdrawalItem({ withdrawal }: { withdrawal: Transaction }) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
      case "paid": return <CheckCircle className="h-5 w-5 text-chart-2" />;
      case "pending":
      case "processing": return <Clock className="h-5 w-5 text-chart-3" />;
      case "rejected": return <XCircle className="h-5 w-5 text-destructive" />;
      default: return null;
    }
  };
  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
      case "paid": return "bg-chart-2/20 text-chart-2 border-chart-2/30";
      case "processing": return "bg-primary/20 text-primary border-primary/30";
      case "pending": return "bg-chart-3/20 text-chart-3 border-chart-3/30";
      case "rejected": return "bg-destructive/20 text-destructive border-destructive/30";
      default: return "";
    }
  };

  return (
    <div className="rounded-xl border border-border p-4 hover-elevate" data-testid={`withdrawal-${withdrawal.id}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          {getStatusIcon(withdrawal.status)}
          <div>
            <p className="font-semibold">{formatNumber(withdrawal.amount)} XNRT</p>
            <p className="text-sm text-muted-foreground capitalize">From {withdrawal.source || "main"} balance</p>
            <p className="text-xs text-muted-foreground">{withdrawal.createdAt ? new Date(withdrawal.createdAt).toLocaleString() : "N/A"}</p>
            {withdrawal.walletAddress && <p className="mt-1 max-w-[280px] truncate font-mono text-xs text-muted-foreground">{withdrawal.walletAddress}</p>}
          </div>
        </div>
        <Badge className={getStatusColor(withdrawal.status)} variant="outline">{withdrawal.status}</Badge>
      </div>
      {withdrawal.fee && (
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span>Fee: {formatNumber(withdrawal.fee)} XNRT</span>
          <span>Net: {formatNumber(withdrawal.netAmount)} XNRT</span>
        </div>
      )}
    </div>
  );
}
