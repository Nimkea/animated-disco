import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, CheckCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ensureCsrf } from "@/lib/csrf";
import { requireSession } from "@/lib/auth";
import ManualLinkWalletDialog from "./manual-link-wallet-dialog";

export function LinkWalletCard() {
  const [address, setAddress] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [linked, setLinked] = useState<string[]>([]);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Fetch user's linked wallets on mount
    fetch("/api/wallet/me", { credentials: "include", cache: "no-store" })
      .then(r => r.ok ? r.json() : [])
      .then(wallets => setLinked(wallets))
      .catch(() => {});
  }, []);

  const isMobile = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  const linkWallet = async () => {
    setLoading(true);
    let provider: any = null;
    let accounts: string[] = [];

    try {
      // 1) Must be authenticated in THIS webview/browser
      await requireSession();

      // 2) CSRF token guaranteed
      const csrf = await ensureCsrf();

      // 3) Check for injected provider (prioritize this over WalletConnect)
      const hasInjectedProvider = !!(window as any).ethereum;

      if (hasInjectedProvider) {
        // Use injected provider (MetaMask/Trust Wallet in-app browser or extension)
        provider = (window as any).ethereum;
        accounts = await provider.request({ 
          method: "eth_requestAccounts" 
        });
      } else {
        // No injected provider - user needs to install a wallet or use wallet browser
        toast({
          variant: "destructive",
          title: "No Wallet Found",
          description: isMobile() 
            ? "Please open this page in MetaMask or Trust Wallet browser."
            : "Please install MetaMask extension to link your wallet.",
        });
        return;
      }

      const account = String(accounts?.[0] || "").toLowerCase();
      setAddress(account);

      // 4) Get challenge (no-store to bypass service worker cache)
      const challengeRes = await fetch(
        `/api/wallet/link/challenge?address=${account}`, 
        { 
          credentials: "include",
          cache: "no-store",
          headers: { "x-csrf-token": csrf }
        }
      );
      
      if (challengeRes.status === 401) {
        throw new Error("Please log in inside this browser and try again.");
      }
      if (challengeRes.status === 403) {
        throw new Error("Security token missing/invalid. Refresh the page and try again.");
      }
      if (!challengeRes.ok) {
        const error = await challengeRes.json().catch(() => ({}));
        throw new Error(error.message || "Failed to get challenge");
      }

      const { message, nonce, issuedAt } = await challengeRes.json();

      // 5) Sign message
      const signature = await provider.request({
        method: "personal_sign",
        params: [message, account],
      });

      // 6) Confirm link (CSRF + no-store)
      const confirmRes = await fetch("/api/wallet/link/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrf,
        },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ address: account, signature, nonce, issuedAt }),
      });

      if (confirmRes.status === 401) {
        throw new Error("Your session expired. Log in again and retry.");
      }
      if (confirmRes.status === 403) {
        throw new Error("Security token invalid. Refresh and try again.");
      }
      if (!confirmRes.ok) {
        const error = await confirmRes.json().catch(() => ({}));
        throw new Error(error.message || "Failed to link wallet");
      }

      const result = await confirmRes.json();
      
      toast({
        title: "✅ Wallet Linked",
        description: `${result.address.slice(0, 6)}...${result.address.slice(-4)} is now linked`,
      });

      if (!linked.includes(result.address)) {
        setLinked(prev => [result.address, ...prev]);
      }
    } catch (error: any) {
      console.error("Wallet linking error:", error);
      toast({
        variant: "destructive",
        title: "Linking Failed",
        description: error.message || "Failed to link wallet. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20" data-testid="card-link-wallet">
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-xl bg-amber-500/10">
          <Wallet className="h-6 w-6 text-amber-500" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold mb-1" data-testid="text-link-wallet-title">Step 0: Link Your BSC Wallet</h3>
          <p className="text-sm text-muted-foreground mb-4" data-testid="text-link-wallet-description">
            Connect your MetaMask or Trust Wallet. Deposits from linked wallets auto-credit after confirmations.
          </p>

          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={linkWallet} 
              disabled={loading}
              className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
              data-testid="button-link-wallet"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Linking...
                </>
              ) : (
                <>
                  <Wallet className="mr-2 h-4 w-4" />
                  Link Wallet
                </>
              )}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setManualDialogOpen(true)}
              disabled={loading}
              data-testid="button-manual-link"
            >
              Having trouble?
            </Button>
          </div>

          {linked.length > 0 && (
            <div className="mt-4 space-y-2" data-testid="container-linked-wallets">
              <div className="text-sm font-medium text-muted-foreground">Linked Wallets:</div>
              <div className="space-y-1">
                {linked.map((addr, i) => (
                  <div 
                    key={i} 
                    className="flex items-center gap-2 text-sm font-mono bg-background/50 px-3 py-1.5 rounded-lg"
                    data-testid={`text-linked-wallet-${i}`}
                  >
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>{addr.slice(0, 6)}...{addr.slice(-4)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <ManualLinkWalletDialog
        open={manualDialogOpen}
        onOpenChange={setManualDialogOpen}
        onLinked={(addr) => {
          if (!linked.includes(addr)) {
            setLinked(prev => [addr, ...prev]);
          }
        }}
      />
    </Card>
  );
}
