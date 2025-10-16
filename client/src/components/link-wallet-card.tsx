import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, CheckCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { EthereumProvider } from "@walletconnect/ethereum-provider";

export function LinkWalletCard() {
  const [address, setAddress] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [linked, setLinked] = useState<string[]>([]);
  const [wcProvider, setWcProvider] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Fetch user's linked wallets on mount
    fetch("/api/wallet/me", { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(wallets => setLinked(wallets))
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Cleanup WalletConnect on unmount
    return () => {
      if (wcProvider) {
        wcProvider.disconnect();
      }
    };
  }, [wcProvider]);

  const isMobile = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  const linkWallet = async () => {
    setLoading(true);
    let provider: any = null;
    let accounts: string[] = [];

    try {
      // Check if we should use WalletConnect (mobile without injected provider)
      const hasInjectedProvider = !!(window as any).ethereum;
      const shouldUseWalletConnect = isMobile() && !hasInjectedProvider;

      if (shouldUseWalletConnect) {
        // Initialize WalletConnect for mobile
        provider = await EthereumProvider.init({
          projectId: "3c3b6ad24c3e4e7e8f8f8f8f8f8f8f8f", // Public WalletConnect project ID
          chains: [56], // BSC Mainnet
          showQrModal: true,
          qrModalOptions: {
            themeMode: "dark",
            themeVariables: {
              "--wcm-z-index": "9999"
            }
          },
          metadata: {
            name: "XNRT",
            description: "XNRT - We Build the NextGen",
            url: window.location.origin,
            icons: [`${window.location.origin}/icon-192.png`]
          }
        });

        // Enable session (shows QR code modal)
        accounts = await provider.enable();
        setWcProvider(provider);
      } else if (hasInjectedProvider) {
        // Use injected provider (MetaMask/Trust Wallet in-app browser)
        provider = (window as any).ethereum;
        accounts = await provider.request({ 
          method: "eth_requestAccounts" 
        });
      } else {
        // No provider available at all
        toast({
          variant: "destructive",
          title: "Wallet Connection Required",
          description: "Please install MetaMask or Trust Wallet, or use WalletConnect to link your wallet.",
        });
        return;
      }

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

      // Request signature using the appropriate provider
      const signature = await provider.request({
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
                Connecting...
              </>
            ) : (
              <>
                <Wallet className="mr-2 h-4 w-4" />
                {isMobile() && !(window as any).ethereum ? "Connect Wallet" : "Link with MetaMask"}
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
