import { CheckCircle, X, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BulkDepositAction } from "./types";

interface BulkActionsBarProps {
  selectedCount: number;
  totalXNRT: number;
  isProcessing: boolean;
  onAction: (action: BulkDepositAction) => void;
  onClear: () => void;
}

export function BulkActionsBar({ selectedCount, totalXNRT, isProcessing, onAction, onClear }: BulkActionsBarProps) {
  if (selectedCount <= 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60" data-testid="bar-bulk-actions">
      <div className="container mx-auto px-4 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary" className="px-3 py-1 text-base" data-testid="text-selected-count">
              {selectedCount} deposit{selectedCount !== 1 ? "s" : ""} selected
            </Badge>
            <span className="text-sm text-muted-foreground">Total: {totalXNRT.toLocaleString()} XNRT</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="default" size="sm" onClick={() => onAction("approve")} disabled={isProcessing} className="gap-1" data-testid="button-approve-selected">
              <CheckCircle className="h-4 w-4" />
              Approve Selected
            </Button>
            <Button variant="destructive" size="sm" onClick={() => onAction("reject")} disabled={isProcessing} className="gap-1" data-testid="button-reject-selected">
              <XCircle className="h-4 w-4" />
              Reject Selected
            </Button>
            <Button variant="ghost" size="sm" onClick={onClear} className="gap-1" data-testid="button-clear-selection">
              <X className="h-4 w-4" />
              Clear
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
