import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowDownToLine, Copy, CheckCircle, Clock, XCircle, Info, Upload, X, QrCode } from "lucide-react";
import type { Transaction } from "@shared/schema";
import { isUnauthorizedError } from "@/lib/authUtils";
import { LinkWalletCard } from "@/components/link-wallet-card";
import { ReportMissingDeposit } from "@/components/report-missing-deposit";
import QRCode from "qrcode";

const COMPANY_WALLET = "0x715C32deC9534d2fB34e0B567288AF8d895efB59";
const USDT_TO_XNRT_RATE = 100;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export default function Deposit() {
  const { toast } = useToast();
  const [usdtAmount, setUsdtAmount] = useState("");
  const [transactionHash, setTransactionHash] = useState("");
  const [proofImageUrl, setProofImageUrl] = useState("");
  const [proofImageFile, setProofImageFile] = useState<File | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [showQR, setShowQR] = useState(false);

  const { data: deposits } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions/deposits"],
  });

  const { data: depositAddress, isLoading: isLoadingAddress } = useQuery<{ address: string }>({
    queryKey: ["/api/wallet/deposit-address"],
  });

  // Generate QR code when deposit address is loaded
  useEffect(() => {
    if (depositAddress?.address) {
      QRCode.toDataURL(depositAddress.address, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      })
        .then(url => setQrCodeUrl(url))
        .catch(err => console.error('QR Code generation failed:', err));
    }
  }, [depositAddress?.address]);

  const depositMutation = useMutation({
    mutationFn: async (data: { usdtAmount: string; transactionHash: string; proofImageUrl?: string }) => {
      return await apiRequest("POST", "/api/transactions/deposit", data);
    },
    onSuccess: () => {
      toast({
        title: "Deposit Submitted!",
        description: "Your deposit is pending admin approval",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions/deposits"] });
      setUsdtAmount("");
      setTransactionHash("");
      setProofImageUrl("");
      setProofImageFile(null);
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
        description: error.message || "Failed to submit deposit",
        variant: "destructive",
      });
    },
  });

  const copyWallet = (address: string) => {
    navigator.clipboard.writeText(address);
    toast({
      title: "Copied!",
      description: "Wallet address copied to clipboard",
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid File Type",
        description: "Please upload an image file (PNG, JPEG, or JPG)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "File Too Large",
        description: "Image size must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setProofImageUrl(base64String);
      setProofImageFile(file);
      toast({
        title: "Image Uploaded",
        description: "Proof of payment image ready to submit",
      });
    };
    reader.onerror = () => {
      toast({
        title: "Upload Failed",
        description: "Failed to process the image. Please try again.",
        variant: "destructive",
      });
    };
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setProofImageUrl("");
    setProofImageFile(null);
  };

  const handleSubmit = () => {
    if (!usdtAmount || !transactionHash) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (parseFloat(usdtAmount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid USDT amount",
        variant: "destructive",
      });
      return;
    }

    depositMutation.mutate({ 
      usdtAmount, 
      transactionHash,
      ...(proofImageUrl && { proofImageUrl })
    });
  };

  const xnrtAmount = usdtAmount ? parseFloat(usdtAmount) * USDT_TO_XNRT_RATE : 0;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
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
        <h1 className="text-3xl font-bold font-serif">Deposit</h1>
        <p className="text-muted-foreground">Deposit USDT to receive XNRT tokens</p>
      </div>

      <LinkWalletCard />

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle>Deposit Instructions</CardTitle>
            <CardDescription>Follow these steps to deposit</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0">
                  1
                </div>
                <div>
                  <p className="font-semibold">Send USDT to Your Deposit Address</p>
                  <p className="text-sm text-muted-foreground">Use any wallet or exchange via BEP20 network</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0">
                  2
                </div>
                <div>
                  <p className="font-semibold">Wait for Confirmations</p>
                  <p className="text-sm text-muted-foreground">12 BSC confirmations (~36 seconds)</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0">
                  3
                </div>
                <div>
                  <p className="font-semibold">Auto-Credit XNRT</p>
                  <p className="text-sm text-muted-foreground">Automatically credited to your balance</p>
                </div>
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-md space-y-2">
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  ✨ <strong>Easy Deposits:</strong> Send USDT directly from Binance, OKX, or any wallet to your personal deposit address below. 
                  No wallet linking, gas fees, or blockchain interaction required!
                </p>
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  💡 <strong>Auto-Detection:</strong> Your deposits are automatically detected and credited after 12 confirmations.
                </p>
              </div>
            </div>

            <div className="p-4 bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/30 rounded-md space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Info className="h-4 w-4 text-primary" />
                <span>Your Personal Deposit Address</span>
              </div>
              {isLoadingAddress ? (
                <div className="h-10 bg-muted/50 rounded-md animate-pulse" />
              ) : depositAddress?.address ? (
                <>
                  <div className="flex items-center gap-2">
                    <Input
                      value={depositAddress.address}
                      readOnly
                      className="font-mono text-xs bg-background"
                      data-testid="input-deposit-address"
                    />
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => copyWallet(depositAddress.address)}
                      data-testid="button-copy-deposit-address"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => setShowQR(!showQR)}
                      data-testid="button-toggle-qr"
                    >
                      <QrCode className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {showQR && qrCodeUrl && (
                    <div className="flex justify-center p-4 bg-white rounded-md">
                      <img 
                        src={qrCodeUrl} 
                        alt="Deposit Address QR Code" 
                        className="w-48 h-48"
                        data-testid="img-qr-code"
                      />
                    </div>
                  )}
                  
                  <p className="text-xs text-muted-foreground">Network: BEP20 (Binance Smart Chain)</p>
                  <p className="text-xs text-primary font-medium">⚡ This address is unique to you - deposits are auto-credited!</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Failed to load deposit address</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5">
          <CardHeader>
            <CardTitle>Manual Deposit Submission</CardTitle>
            <CardDescription>Optional: For deposits from unlinked wallets or troubleshooting</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="usdtAmount">USDT Amount</Label>
              <Input
                id="usdtAmount"
                type="number"
                placeholder="Enter USDT amount"
                value={usdtAmount}
                onChange={(e) => setUsdtAmount(e.target.value)}
                data-testid="input-usdt-amount"
              />
            </div>

            {usdtAmount && parseFloat(usdtAmount) > 0 && (
              <div className="p-4 bg-muted/50 rounded-md">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">You will receive:</span>
                  <span className="text-2xl font-bold text-primary" data-testid="text-xnrt-amount">
                    {xnrtAmount.toLocaleString()} XNRT
                  </span>
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="txHash">Transaction Hash</Label>
              <Textarea
                id="txHash"
                placeholder="Paste transaction hash from your wallet"
                value={transactionHash}
                onChange={(e) => setTransactionHash(e.target.value)}
                className="font-mono text-sm"
                data-testid="input-tx-hash"
              />
            </div>

            <div>
              <Label htmlFor="proofImage">Proof of Payment (Optional)</Label>
              <div className="space-y-3">
                {!proofImageUrl ? (
                  <div className="flex items-center gap-2">
                    <Input
                      id="proofImage"
                      type="file"
                      accept="image/png,image/jpeg,image/jpg"
                      onChange={handleImageUpload}
                      className="hidden"
                      data-testid="input-proof-image"
                    />
                    <label htmlFor="proofImage" className="flex-1">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => document.getElementById("proofImage")?.click()}
                        data-testid="button-upload-proof"
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Screenshot
                      </Button>
                    </label>
                  </div>
                ) : (
                  <div className="relative border-2 border-dashed border-primary/30 rounded-lg p-3 bg-muted/30">
                    <div className="flex items-start gap-3">
                      <img
                        src={proofImageUrl}
                        alt="Proof of payment"
                        className="w-24 h-24 object-cover rounded-md border border-border"
                        data-testid="img-proof-preview"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                          {proofImageFile?.name || "Proof image"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {proofImageFile ? `${(proofImageFile.size / 1024).toFixed(1)} KB` : "Ready to submit"}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={clearImage}
                        className="flex-shrink-0"
                        data-testid="button-clear-proof"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Upload a screenshot of your transaction (PNG, JPEG, JPG • Max 5MB)
                </p>
              </div>
            </div>

            <Button
              className="w-full"
              size="lg"
              disabled={!usdtAmount || !transactionHash || depositMutation.isPending}
              onClick={handleSubmit}
              data-testid="button-submit-deposit"
            >
              <ArrowDownToLine className="mr-2 h-5 w-5" />
              {depositMutation.isPending ? "Submitting..." : "Submit Deposit"}
            </Button>

            <div className="pt-3 border-t border-border">
              <ReportMissingDeposit />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Deposit History</CardTitle>
          <CardDescription>Your deposit transactions</CardDescription>
        </CardHeader>
        <CardContent>
          {!deposits || deposits.length === 0 ? (
            <div className="text-center py-12">
              <ArrowDownToLine className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No deposits yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {deposits.map((deposit) => (
                <div
                  key={deposit.id}
                  className="flex items-center justify-between p-4 border border-border rounded-md hover-elevate"
                  data-testid={`deposit-${deposit.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-md bg-primary/20 flex items-center justify-center">
                      <ArrowDownToLine className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">
                        {parseFloat(deposit.usdtAmount || "0").toLocaleString()} USDT → {parseFloat(deposit.amount).toLocaleString()} XNRT
                      </p>
                      <p className="text-sm text-muted-foreground font-mono">
                        {deposit.transactionHash?.substring(0, 16)}...
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {deposit.createdAt ? new Date(deposit.createdAt).toLocaleString() : 'N/A'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right space-y-2">
                    <Badge className={getStatusColor(deposit.status)} variant="outline">
                      {getStatusIcon(deposit.status)}
                      <span className="ml-2">{deposit.status}</span>
                    </Badge>
                    {deposit.adminNotes && deposit.status === "rejected" && (
                      <p className="text-xs text-destructive">{deposit.adminNotes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
