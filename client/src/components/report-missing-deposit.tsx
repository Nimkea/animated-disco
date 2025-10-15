import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export function ReportMissingDeposit() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!txHash || !amount) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please provide transaction hash and amount",
      });
      return;
    }

    if (parseFloat(amount) <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid Amount",
        description: "Please enter a valid USDT amount",
      });
      return;
    }

    setLoading(true);

    try {
      await apiRequest("POST", "/api/wallet/report-deposit", {
        transactionHash: txHash.trim(),
        amount: parseFloat(amount),
        description: description.trim(),
      });

      toast({
        title: "✅ Report Submitted",
        description: "Admin will investigate and credit your deposit if valid",
      });

      setOpen(false);
      setTxHash("");
      setAmount("");
      setDescription("");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Submission Failed",
        description: error.message || "Failed to submit report",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full" data-testid="button-report-missing">
          <AlertCircle className="mr-2 h-4 w-4" />
          Report Missing Deposit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" data-testid="dialog-report-missing">
        <DialogHeader>
          <DialogTitle>Report Missing Deposit</DialogTitle>
          <DialogDescription>
            If you sent USDT from a linked wallet but didn't receive XNRT, report it here
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="reportTxHash">Transaction Hash</Label>
            <Input
              id="reportTxHash"
              placeholder="0x..."
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
              className="font-mono text-sm"
              data-testid="input-report-txhash"
            />
          </div>
          <div>
            <Label htmlFor="reportAmount">USDT Amount</Label>
            <Input
              id="reportAmount"
              type="number"
              placeholder="100"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              data-testid="input-report-amount"
            />
          </div>
          <div>
            <Label htmlFor="reportDescription">Additional Details (Optional)</Label>
            <Textarea
              id="reportDescription"
              placeholder="When did you send? Any other relevant info..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              data-testid="textarea-report-description"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
            data-testid="button-cancel-report"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !txHash || !amount}
            data-testid="button-submit-report"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Report"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
