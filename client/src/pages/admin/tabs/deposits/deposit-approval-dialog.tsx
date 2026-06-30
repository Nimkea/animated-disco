import { AlertTriangle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { AdminDepositTransaction } from "./types";

interface DepositApprovalDialogProps {
  deposit: AdminDepositTransaction | null;
  adminNotes: string;
  forceApprove: boolean;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onNotesChange: (value: string) => void;
  onForceApproveChange: (value: boolean) => void;
  onConfirm: () => void;
}

export function DepositApprovalDialog({
  deposit,
  adminNotes,
  forceApprove,
  isPending,
  onOpenChange,
  onNotesChange,
  onForceApproveChange,
  onConfirm,
}: DepositApprovalDialogProps) {
  if (!deposit) return null;

  const needsForceApproval = deposit.verified !== true;

  return (
    <Dialog open={!!deposit} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-approve-deposit">
        <DialogHeader>
          <DialogTitle>Approve Deposit</DialogTitle>
          <DialogDescription>
            Approving this will credit {Number(deposit.amount).toLocaleString()} XNRT to the user's main balance.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          {needsForceApproval && (
            <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
                <div>
                  <p className="font-medium">On-chain verification is not confirmed.</p>
                  <p className="text-muted-foreground">Approve only if you have manually verified this deposit. This action will be saved in the admin audit log.</p>
                </div>
              </div>
              <label className="flex cursor-pointer items-center gap-2">
                <Checkbox checked={forceApprove} onCheckedChange={(checked) => onForceApproveChange(checked === true)} />
                <span>I confirm this is a manual force approval.</span>
              </label>
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm font-medium">Admin Notes (Optional)</label>
            <Textarea placeholder="Add any notes about this approval..." value={adminNotes} onChange={(event) => onNotesChange(event.target.value)} data-testid="textarea-admin-notes" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-approve">
              Cancel
            </Button>
            <Button onClick={onConfirm} disabled={isPending || (needsForceApproval && !forceApprove)} data-testid="button-confirm-approve">
              <CheckCircle className="mr-1 h-4 w-4" />
              Confirm Approval
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
