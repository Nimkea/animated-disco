import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onLinked?: (address: string) => void;
};

export default function ManualLinkWalletDialog({ open, onOpenChange, onLinked }: Props) {
  const { toast } = useToast();
  const [address, setAddress] = useState("");
  const [challenge, setChallenge] = useState<{ message: string; nonce: string; issuedAt: string } | null>(null);
  const [signature, setSignature] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  const getChallenge = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/wallet/link/challenge?address=${address.trim().toLowerCase()}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (res.status === 401) throw new Error("Please log in in this browser first.");
      if (!res.ok) throw new Error((await res.json()).message || "Failed to get challenge");
      const data = await res.json();
      setChallenge(data);
      setStep(2);
      toast({ title: "Challenge created", description: "Copy the message and sign it in your wallet app." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const confirm = async () => {
    if (!challenge) return;
    try {
      setLoading(true);
      const res = await fetch("/api/wallet/link/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": (window as any).CSRF_TOKEN,
        },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({
          address: address.trim().toLowerCase(),
          signature: signature.trim(),
          nonce: challenge.nonce,
          issuedAt: challenge.issuedAt,
        }),
      });
      if (res.status === 401) throw new Error("Please log in in this browser first.");
      if (res.status === 403) throw new Error("Security token missing/invalid. Refresh and try again.");
      if (!res.ok) throw new Error((await res.json()).message || "Failed to link wallet");
      const data = await res.json();
      toast({ title: "✅ Wallet linked", description: `${data.address.slice(0, 6)}...${data.address.slice(-4)}` });
      onLinked?.(data.address);
      onOpenChange(false);
      // reset
      setAddress(""); setSignature(""); setChallenge(null); setStep(1);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Linking failed", description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (challenge?.message) {
      await navigator.clipboard.writeText(challenge.message);
      toast({ title: "Copied", description: "Challenge message copied to clipboard" });
    }
  };

  const disabledAddr = !/^0x[a-fA-F0-9]{40}$/.test(address.trim());

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!loading) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg" data-testid="dialog-manual-link-wallet">
        <DialogHeader>
          <DialogTitle>Link Wallet Manually</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-3">
            <label className="text-sm font-medium">Wallet Address (BSC)</label>
            <Input
              placeholder="0x..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              autoFocus
              data-testid="input-manual-wallet-address"
            />
            <p className="text-xs text-muted-foreground">
              We'll generate a challenge for you to sign in your wallet app.
            </p>
          </div>
        )}

        {step === 2 && challenge && (
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Challenge Message</label>
                <Button variant="outline" size="sm" onClick={copy} data-testid="button-copy-challenge">Copy</Button>
              </div>
              <Textarea value={challenge.message} readOnly rows={6} data-testid="textarea-challenge-message" />
              <p className="text-xs text-muted-foreground mt-1">
                Sign this exact message with the same address using
                <span className="font-medium"> personal_sign</span> (MetaMask/Trust Wallet → "Sign Message").
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">Signature</label>
              <Textarea
                placeholder="0x…"
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                rows={3}
                data-testid="textarea-signature"
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === 1 ? (
            <Button 
              onClick={getChallenge} 
              disabled={disabledAddr || loading}
              data-testid="button-get-challenge"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating…
                </>
              ) : (
                "Get Challenge"
              )}
            </Button>
          ) : (
            <>
              <Button 
                variant="outline" 
                onClick={() => setStep(1)} 
                disabled={loading}
                data-testid="button-back"
              >
                Back
              </Button>
              <Button 
                onClick={confirm} 
                disabled={!signature.trim() || loading}
                data-testid="button-confirm-link"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Linking…
                  </>
                ) : (
                  "Confirm Link"
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
