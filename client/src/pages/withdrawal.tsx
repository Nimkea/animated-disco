import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowUpFromLine, Wallet, AlertCircle, CheckCircle, Clock, XCircle } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { Transaction, Balance } from "@shared/schema";
import { isUnauthorizedError } from "@/lib/authUtils";

const WITHDRAWAL_FEE_PERCENT = 2;
const MIN_REFERRAL_WITHDRAWAL = 5000;

export default function Withdrawal() {
  const { toast } = useToast();
  const [source, setSource] = useState<"main" | "referral">("main");
  const [amount, setAmount] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const { data: balance } = useQuery<Balance>({
    queryKey: ["/api/balance"],
  });

  const { data: withdrawals } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions/withdrawals"],
  });

  const withdrawMutation = useMutation({
    mutationFn: async (data: { source: string; amount: string; walletAddress: string }) => {
      return await apiRequest("POST", "/api/transactions/withdrawal", data);
    },
    onSuccess: () => {
      toast({
        title: "Withdrawal Requested!",
        description: "Your withdrawal is pending admin approval",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions/withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/balance"] });
      setAmount("");
      setWalletAddress("");
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to request withdrawal",
        variant: "destructive",
      });
    },
  });

  const handleWithdraw = () => {
    if (!amount || !walletAddress) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const withdrawAmount = parseFloat(amount);
    const availableBalance = source === "main" 
      ? parseFloat(balance?.xnrtBalance || "0")
      : parseFloat(balance?.referralBalance || "0");

    if (withdrawAmount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    if (withdrawAmount > availableBalance) {
      toast({
        title: "Insufficient Balance",
        description: "You don't have enough balance for this withdrawal",
        variant: "destructive",
      });
      return;
    }

    if (source === "referral" && withdrawAmount < MIN_REFERRAL_WITHDRAWAL) {
      toast({
        title: "Minimum Not Met",
        description: `Minimum withdrawal from referral balance is ${MIN_REFERRAL_WITHDRAWAL.toLocaleString()} XNRT`,
        variant: "destructive",
      });
      return;
    }

    setShowConfirmDialog(true);
  };

  const confirmWithdraw = () => {
    withdrawMutation.mutate({ source, amount, walletAddress });
  };

  const withdrawAmount = parseFloat(amount || "0");
  const fee = (withdrawAmount * WITHDRAWAL_FEE_PERCENT) / 100;
  const netAmount = withdrawAmount - fee;
  const usdtAmount = netAmount / 100;

  const availableBalance = source === "main" 
    ? parseFloat(balance?.xnrtBalance || "0")
    : parseFloat(balance?.referralBalance || "0");

  const canWithdraw = source === "main" || withdrawAmount >= MIN_REFERRAL_WITHDRAWAL;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
      case "paid":
        return <CheckCircle className="h-5 w-5 text-chart-2" />;
      case "pending":
        return <Clock className="h-5 w-5 text-chart-3" />;
      case "rejected":
        return <XCircle className="h-5 w-5 text-destructive" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
      case "paid":
        return "bg-chart-2/20 text-chart-2 border-chart-2/30";
      case "pending":
        return "bg-chart-3/20 text-chart-3 border-chart-3/30";
      case "rejected":
        return "bg-destructive/20 text-destructive border-destructive/30";
      default:
        return "";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-serif">Withdrawal</h1>
        <p className="text-muted-foreground">Convert XNRT to USDT and withdraw to your wallet</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className={source === "main" ? "border-primary ring-2 ring-primary/20" : ""}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Main Balance</p>
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            <p className="text-3xl font-bold font-mono" data-testid="text-main-balance">
              {availableBalance.toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground">XNRT</p>
          </CardContent>
        </Card>

        <Card className={source === "referral" ? "border-chart-2 ring-2 ring-chart-2/20" : ""}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Referral Balance</p>
              <Wallet className="h-5 w-5 text-chart-2" />
            </div>
            <p className="text-3xl font-bold font-mono" data-testid="text-referral-balance">
              {parseFloat(balance?.referralBalance || "0").toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground">XNRT (Min: {MIN_REFERRAL_WITHDRAWAL.toLocaleString()})</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Withdrawal Fee</p>
              <AlertCircle className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-3xl font-bold font-mono">{WITHDRAWAL_FEE_PERCENT}%</p>
            <p className="text-sm text-muted-foreground">Applied to all withdrawals</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5">
        <CardHeader>
          <CardTitle>Request Withdrawal</CardTitle>
          <CardDescription>Convert XNRT to USDT (1 USDT = 100 XNRT)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Source Balance</Label>
            <RadioGroup value={source} onValueChange={(v) => setSource(v as "main" | "referral")}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="main" id="main" data-testid="radio-main" />
                <Label htmlFor="main" className="cursor-pointer">
                  Main Balance ({parseFloat(balance?.xnrtBalance || "0").toLocaleString()} XNRT)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="referral" id="referral" data-testid="radio-referral" />
                <Label htmlFor="referral" className="cursor-pointer">
                  Referral Balance ({parseFloat(balance?.referralBalance || "0").toLocaleString()} XNRT)
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div>
            <Label htmlFor="amount">Withdrawal Amount (XNRT)</Label>
            <Input
              id="amount"
              type="number"
              placeholder={source === "referral" ? `Min: ${MIN_REFERRAL_WITHDRAWAL.toLocaleString()}` : "Enter amount"}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              data-testid="input-withdrawal-amount"
            />
          </div>

          {amount && withdrawAmount > 0 && (
            <div className="space-y-3 p-4 bg-muted/50 rounded-md">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Amount:</span>
                <span className="font-semibold">{withdrawAmount.toLocaleString()} XNRT</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Fee ({WITHDRAWAL_FEE_PERCENT}%):</span>
                <span className="font-semibold text-destructive">-{fee.toLocaleString()} XNRT</span>
              </div>
              <div className="border-t border-border pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Net Amount:</span>
                  <span className="font-bold text-primary">{netAmount.toLocaleString()} XNRT</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-sm text-muted-foreground">You'll Receive:</span>
                  <span className="font-bold text-chart-2 text-lg">{usdtAmount.toFixed(2)} USDT</span>
                </div>
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="wallet">BEP20 Wallet Address</Label>
            <Input
              id="wallet"
              placeholder="Enter your BEP20 wallet address"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              className="font-mono"
              data-testid="input-wallet-address"
            />
          </div>

          {!canWithdraw && source === "referral" && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-md text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>Minimum withdrawal from referral balance is {MIN_REFERRAL_WITHDRAWAL.toLocaleString()} XNRT</span>
            </div>
          )}

          <Button
            className="w-full"
            size="lg"
            disabled={!amount || !walletAddress || !canWithdraw || withdrawMutation.isPending}
            onClick={handleWithdraw}
            data-testid="button-request-withdrawal"
          >
            <ArrowUpFromLine className="mr-2 h-5 w-5" />
            {withdrawMutation.isPending ? "Requesting..." : "Request Withdrawal"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Withdrawal History</CardTitle>
          <CardDescription>Your withdrawal transactions</CardDescription>
        </CardHeader>
        <CardContent>
          {!withdrawals || withdrawals.length === 0 ? (
            <div className="text-center py-12">
              <ArrowUpFromLine className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No withdrawals yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {withdrawals.map((withdrawal) => (
                <div
                  key={withdrawal.id}
                  className="flex items-center justify-between p-4 border border-border rounded-md hover-elevate"
                  data-testid={`withdrawal-${withdrawal.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-md bg-chart-2/20 flex items-center justify-center">
                      <ArrowUpFromLine className="h-6 w-6 text-chart-2" />
                    </div>
                    <div>
                      <p className="font-semibold">
                        {parseFloat(withdrawal.amount).toLocaleString()} XNRT → {parseFloat(withdrawal.usdtAmount || "0").toFixed(2)} USDT
                      </p>
                      <p className="text-sm text-muted-foreground">
                        From: <span className="capitalize">{withdrawal.source}</span> Balance
                      </p>
                      <p className="text-sm text-muted-foreground font-mono">
                        {withdrawal.walletAddress?.substring(0, 16)}...
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {withdrawal.createdAt ? new Date(withdrawal.createdAt).toLocaleString() : 'N/A'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right space-y-2">
                    <Badge className={getStatusColor(withdrawal.status)} variant="outline">
                      {getStatusIcon(withdrawal.status)}
                      <span className="ml-2">{withdrawal.status}</span>
                    </Badge>
                    <div className="text-sm">
                      <p className="text-muted-foreground">Fee: {parseFloat(withdrawal.fee || "0").toLocaleString()} XNRT</p>
                      <p className="text-muted-foreground">Net: {parseFloat(withdrawal.netAmount || "0").toLocaleString()} XNRT</p>
                    </div>
                    {withdrawal.adminNotes && withdrawal.status === "rejected" && (
                      <p className="text-xs text-destructive">{withdrawal.adminNotes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        onConfirm={confirmWithdraw}
        title="Confirm Withdrawal"
        description={`You are withdrawing ${parseFloat(amount || "0").toLocaleString()} XNRT from your ${source} balance. After a ${WITHDRAWAL_FEE_PERCENT}% fee, you will receive ${(parseFloat(amount || "0") - (parseFloat(amount || "0") * WITHDRAWAL_FEE_PERCENT) / 100).toLocaleString()} XNRT. This action cannot be undone. Continue?`}
        confirmText="Confirm Withdrawal"
        variant="destructive"
      />
    </div>
  );
}
