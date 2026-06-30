import { AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { BulkDepositAction } from "./types";

interface BulkActionDialogProps {
  open: boolean;
  action: BulkDepositAction | null;
  selectedCount: number;
  totalXNRT: number;
  selectedUnverifiedCount: number;
  notes: string;
  forceApprove: boolean;
  isProcessing: boolean;
  onOpenChange: (open: boolean) => void;
  onNotesChange: (value: string) => void;
  onForceApproveChange: (value: boolean) => void;
  onConfirm: () => void;
}

export function BulkActionDialog({
  open,
  action,
  selectedCount,
  totalXNRT,
  selectedUnverifiedCount,
  notes,
  forceApprove,
  isProcessing,
  onOpenChange,
  onNotesChange,
  onForceApproveChange,
  onConfirm,
}: BulkActionDialogProps) {
  const isApprove = action === "approve";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="dialog-bulk-confirm">
        <AlertDialogHeader>
          <AlertDialogTitle>{isApprove ? "Approve Selected Deposits" : "Reject Selected Deposits"}</AlertDialogTitle>
          <AlertDialogDescription>
            {isApprove
              ? `You are about to approve ${selectedCount} deposit${selectedCount !== 1 ? "s" : ""} totaling ${totalXNRT.toLocaleString()} XNRT. This will credit user balances.`
              : `You are about to reject ${selectedCount} deposit${selectedCount !== 1 ? "s" : ""}. This action cannot be undone.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-4 py-4">
          {isApprove && selectedUnverifiedCount > 0 && (
            <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
                <div>
                  <p className="font-medium">{selectedUnverifiedCount} selected deposit{selectedUnverifiedCount !== 1 ? "s are" : " is"} not verified.</p>
                  <p className="text-muted-foreground">Bulk force approval should only be used after manual verification. Each action will be audited.</p>
                </div>
              </div>
              <label className="flex cursor-pointer items-center gap-2">
                <Checkbox checked={forceApprove} onCheckedChange={(checked) => onForceApproveChange(checked === true)} />
                <span>I confirm force approval for unverified selected deposits.</span>
              </label>
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm font-medium">Admin Notes (Optional)</label>
            <Textarea placeholder={`Add notes about this ${isApprove ? "approval" : "rejection"}...`} value={notes} onChange={(event) => onNotesChange(event.target.value)} data-testid="textarea-bulk-admin-notes" />
          </div>
        </div>
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-bulk-action">
            Cancel
          </Button>
          <Button variant={isApprove ? "default" : "destructive"} onClick={onConfirm} disabled={isProcessing || (isApprove && selectedUnverifiedCount > 0 && !forceApprove)} data-testid="button-confirm-bulk-action">
            {isProcessing ? (
              <>
                <div className="mr-1 h-4 w-4 animate-spin rounded-full border-b-2 border-current" />
                Processing...
              </>
            ) : (
              <>
                {isApprove ? <CheckCircle className="mr-1 h-4 w-4" /> : <XCircle className="mr-1 h-4 w-4" />}
                Confirm {isApprove ? "Approval" : "Rejection"}
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
