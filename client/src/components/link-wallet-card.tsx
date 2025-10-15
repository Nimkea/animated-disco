import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, CheckCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function LinkWalletCard() {
  const [address, setAddress] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [linked, setLinked] = useState<string[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    // Fetch user's linked wallets
    fetch("/api/wallet/me", { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(wallets => setLinked(wallets))
      .catch(() => {});
  }, []);

  const linkWallet = async () => {
    // Check if MetaMask is installed
    if (!(window as any).ethereum) {
      toast({
        variant: "destructive",
        title: "MetaMask Not Detected",
        description: "Please install MetaMask or Trust Wallet to link your wallet.",
      });
      return;
    }

    setLoading(true);
    try {
      // Request account access
      const accounts = await (window as any).ethereum.request({ 
        method: "eth_requestAccounts" 
      });
      const account = String(accounts?.[0] || "").toLowerCase();
      setAddress(account);

      // Get challenge message and nonce
      const challengeRes = await fetch(
        `/api/wallet/link/challenge?address=${account}`, 
        { credentials: "include" }
      );
      
      if (!challengeRes.ok) {
        const error = await challengeRes.json();
        throw new Error(error.message || "Failed to get challenge");
      }

      const { message, nonce } = await challengeRes.json();

      // Request signature
      const signature = await (window as any).ethereum.request({
        method: "personal_sign",
        params: [message, account],
      });

      // Confirm link
      const confirmRes = await fetch("/api/wallet/link/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": (window as any).CSRF_TOKEN,
        },
        credentials: "include",
        body: JSON.stringify({ address: account, signature, nonce }),
      });

      if (!confirmRes.ok) {
        const error = await confirmRes.json();
        throw new Error(error.message || "Failed to link wallet");
      }

      const result = await confirmRes.json();
      
      toast({
        title: "✅ Wallet Linked",
        description: `${result.address.slice(0, 6)}...${result.address.slice(-4)} is now linked to your account`,
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
                Link with MetaMask
              </>
            )}
          </Button>

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
    </Card>
  );
}
