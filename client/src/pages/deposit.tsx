import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowDownToLine, CheckCircle, Clock, Copy, Info, QrCode, ShieldCheck, XCircle } from "lucide-react";
import type { Transaction } from "@shared/schema";
import { isUnauthorizedError } from "@/lib/authUtils";
import { ReportMissingDeposit } from "@/components/report-missing-deposit";
import QRCode from "qrcode";

interface DepositAddress {
  address: string;
  network: string;
  token: string;
  instructions: string[];
}

interface WalletRates {
  xnrtPerUsdt: number;
  confirmations: number;
  platformFeeBps: number;
  network: string;
  depositToken: string;
}

const formatNumber = (value?: number | string | null, digits = 2) =>
  Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: digits });

export default function Deposit() {
  const { toast } = useToast();
  const [usdtAmount, setUsdtAmount] = useState("");
  const [transactionHash, setTransactionHash] = useState("");
  const [notes, setNotes] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [showQR, setShowQR] = useState(true);

  const { data: deposits } = useQuery<Transaction[]>({ queryKey: ["/api/transactions/deposits"] });
  const { data: rates } = useQuery<WalletRates>({ queryKey: ["/api/wallet/rates"] });
  const { data: depositAddress, isLoading: isLoadingAddress } = useQuery<DepositAddress>({
    queryKey: ["/api/wallet/deposit-address"],
  });

  useEffect(() => {
    if (!depositAddress?.address) return;
    QRCode.toDataURL(depositAddress.address, {
      width: 256,
      margin: 2,
      color: { dark: "#000000", light: "#FFFFFF" },
    })
      .then((url) => setQrCodeUrl(url))
      .catch((err) => console.error("QR Code generation failed:", err));
  }, [depositAddress?.address]);

  const depositMutation = useMutation({
    mutationFn: async (data: { usdtAmount: string; transactionHash: string }) => {
      return await apiRequest("POST", "/api/transactions/deposit", data);
    },
    onSuccess: () => {
      toast({ title: "Deposit Submitted", description: "Your deposit is queued for verification/admin review." });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions/deposits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/summary"] });
      setUsdtAmount("");
      setTransactionHash("");
      setNotes("");
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "You are logged out. Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Error", description: error.message || "Failed to submit deposit", variant: "destructive" });
    },
  });

  const copyWallet = async (address: string) => {
    await navigator.clipboard.writeText(address);
    toast({ title: "Copied", description: "Deposit address copied to clipboard" });
  };

  const handleSubmit = () => {
    if (!usdtAmount || !transactionHash) {
      toast({ title: "Missing Information", description: "Enter amount and transaction hash.", variant: "destructive" });
      return;
    }
    if (Number(usdtAmount) <= 0 || !Number.isFinite(Number(usdtAmount))) {
      toast({ title: "Invalid Amount", description: "Enter a valid USDT amount.", variant: "destructive" });
      return;
    }
    if (!/^0x[a-fA-F0-9]{64}$/.test(transactionHash.trim())) {
      toast({ title: "Invalid Hash", description: "Enter a valid BSC transaction hash.", variant: "destructive" });
      return;
    }
    depositMutation.mutate({ usdtAmount, transactionHash: transactionHash.trim() });
  };

  const xnrtAmount = usdtAmount ? Number(usdtAmount) * (rates?.xnrtPerUsdt || 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold font-serif">Deposit</h1>
          <p className="text-muted-foreground">Send USDT BEP-20 to your personal address and receive XNRT credit.</p>
        </div>
        <Badge variant="outline" className="w-fit gap-2 border-primary/30 bg-primary/10 text-primary">
          <ShieldCheck className="h-4 w-4" /> Auto-detection enabled
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-card to-secondary/5">
          <CardHeader>
            <CardTitle>Your Personal Deposit Address</CardTitle>
            <CardDescription>Use only {depositAddress?.network || "BSC (BEP-20)"}. Send USDT, not native BNB.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingAddress ? (
              <div className="h-12 animate-pulse rounded-xl bg-muted" />
            ) : depositAddress?.address ? (
              <>
                <div className="flex items-center gap-2 rounded-xl border border-border bg-background/70 p-3">
                  <Input value={depositAddress.address} readOnly className="font-mono text-xs" data-testid="input-deposit-address" />
                  <Button size="icon" variant="outline" onClick={() => copyWallet(depositAddress.address)} data-testid="button-copy-deposit-address">
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="outline" onClick={() => setShowQR((v) => !v)} data-testid="button-toggle-qr">
                    <QrCode className="h-4 w-4" />
                  </Button>
                </div>
                {showQR && qrCodeUrl && (
                  <div className="flex justify-center rounded-xl bg-white p-4">
                    <img src={qrCodeUrl} alt="Deposit Address QR Code" className="h-48 w-48" data-testid="img-qr-code" />
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-destructive">Could not load deposit address.</p>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              <InfoBox label="Rate" value={`1 USDT = ${formatNumber(rates?.xnrtPerUsdt, 0)} XNRT`} />
              <InfoBox label="Confirmations" value={`${rates?.confirmations || 12} blocks`} />
              <InfoBox label="Network" value={rates?.network || "BSC BEP-20"} />
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
              <div className="flex gap-2">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <p>Auto-credit normally happens after confirmations. Use the manual form only when a valid transaction hash does not appear automatically.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Manual Deposit Report</CardTitle>
            <CardDescription>Submit a transaction hash for admin/chain verification.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="amount">USDT Amount</Label>
              <Input id="amount" type="number" placeholder="100" value={usdtAmount} onChange={(e) => setUsdtAmount(e.target.value)} data-testid="input-usdt-amount" />
            </div>
            <div>
              <Label htmlFor="txhash">Transaction Hash</Label>
              <Input id="txhash" placeholder="0x..." value={transactionHash} onChange={(e) => setTransactionHash(e.target.value)} className="font-mono text-xs" data-testid="input-transaction-hash" />
            </div>
            <div>
              <Label htmlFor="notes">Notes optional</Label>
              <Textarea id="notes" placeholder="Keep your own note here before submitting; admin can verify by hash." value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">Estimated credit</p>
              <p className="text-3xl font-bold font-mono">{formatNumber(xnrtAmount)} XNRT</p>
            </div>
            <Button className="w-full gap-2" onClick={handleSubmit} disabled={depositMutation.isPending} data-testid="button-submit-deposit">
              <ArrowDownToLine className="h-4 w-4" />
              {depositMutation.isPending ? "Submitting..." : "Submit Deposit"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <ReportMissingDeposit />

      <Card>
        <CardHeader>
          <CardTitle>Deposit History</CardTitle>
          <CardDescription>Your recent deposit requests and auto-credited transactions</CardDescription>
        </CardHeader>
        <CardContent>
          {!deposits || deposits.length === 0 ? (
            <div className="text-center py-12">
              <ArrowDownToLine className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No deposits yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {deposits.map((deposit) => <DepositItem key={deposit.id} deposit={deposit} />)}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function DepositItem({ deposit }: { deposit: Transaction }) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved": return <CheckCircle className="h-5 w-5 text-chart-2" />;
      case "pending": return <Clock className="h-5 w-5 text-chart-3" />;
      case "rejected": return <XCircle className="h-5 w-5 text-destructive" />;
      default: return null;
    }
  };
  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved": return "bg-chart-2/20 text-chart-2 border-chart-2/30";
      case "pending": return "bg-chart-3/20 text-chart-3 border-chart-3/30";
      case "rejected": return "bg-destructive/20 text-destructive border-destructive/30";
      default: return "";
    }
  };

  return (
    <div className="flex items-center justify-between rounded-xl border border-border p-4 hover-elevate" data-testid={`deposit-${deposit.id}`}>
      <div className="flex items-center gap-4">
        {getStatusIcon(deposit.status)}
        <div>
          <p className="font-semibold">{formatNumber(deposit.amount)} XNRT</p>
          <p className="text-sm text-muted-foreground">{deposit.usdtAmount ? `${formatNumber(deposit.usdtAmount)} USDT` : "USDT/XNRT deposit"}</p>
          <p className="text-xs text-muted-foreground">{deposit.createdAt ? new Date(deposit.createdAt).toLocaleString() : "N/A"}</p>
        </div>
      </div>
      <Badge className={getStatusColor(deposit.status)} variant="outline">{deposit.status}</Badge>
    </div>
  );
}
