import { AlertTriangle, CheckCircle, Clock, ExternalLink, Eye, ShieldCheck, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import type { AdminDepositTransaction } from "./types";

interface PendingDepositsCardProps {
  deposits: AdminDepositTransaction[];
  isLoading: boolean;
  searchQuery: string;
  selectedDepositIds: Set<string>;
  isProcessing: boolean;
  isVerifying: boolean;
  onToggleSelectAll: () => void;
  onToggleSelection: (depositId: string) => void;
  onViewProof: (url: string) => void;
  onVerify: (depositId: string) => void;
  onApprove: (deposit: AdminDepositTransaction) => void;
  onReject: (depositId: string) => void;
}

function shortHash(hash?: string) {
  if (!hash) return "No hash";
  if (hash.length <= 32) return hash;
  return `${hash.slice(0, 20)}...${hash.slice(-10)}`;
}

function proofFallbackSvg() {
  return "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><rect width='80' height='80' fill='%23ddd'/><text x='50%' y='50%' text-anchor='middle' dy='.3em' fill='%23999'>No Image</text></svg>";
}

export function PendingDepositsCard({
  deposits,
  isLoading,
  searchQuery,
  selectedDepositIds,
  isProcessing,
  isVerifying,
  onToggleSelectAll,
  onToggleSelection,
  onViewProof,
  onVerify,
  onApprove,
  onReject,
}: PendingDepositsCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Pending Deposits</CardTitle>
            <CardDescription>Review, verify, approve, reject, and force-approve deposit requests.</CardDescription>
          </div>
          {deposits.length > 0 && (
            <div className="flex items-center gap-2">
              <Checkbox checked={selectedDepositIds.size === deposits.length && deposits.length > 0} onCheckedChange={onToggleSelectAll} data-testid="checkbox-select-all" />
              <button type="button" className="text-sm font-medium" onClick={onToggleSelectAll}>
                Select All
              </button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
          </div>
        ) : deposits.length > 0 ? (
          <div className="space-y-3">
            {deposits.map((deposit) => {
              const isSelected = selectedDepositIds.has(deposit.id);
              return (
                <div
                  key={deposit.id}
                  className={`flex flex-col gap-3 rounded-md border p-4 transition-all hover-elevate ${isSelected ? "border-primary bg-primary/5" : "border-border"}`}
                  data-testid={`deposit-${deposit.id}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-1 items-start gap-3">
                      <Checkbox checked={isSelected} onCheckedChange={() => onToggleSelection(deposit.id)} className="mt-1" data-testid={`checkbox-select-deposit-${deposit.id}`} />

                      {deposit.proofImageUrl && (
                        <button
                          type="button"
                          onClick={() => onViewProof(deposit.proofImageUrl!)}
                          className="group relative hidden h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border-2 border-border bg-muted transition-all hover:scale-105 hover:border-primary sm:block"
                          data-testid={`thumbnail-proof-${deposit.id}`}
                        >
                          <img
                            src={deposit.proofImageUrl}
                            alt="Proof thumbnail"
                            className="h-full w-full object-cover transition-opacity group-hover:opacity-80"
                            onError={(event) => {
                              (event.target as HTMLImageElement).src = proofFallbackSvg();
                            }}
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
                            <Eye className="h-5 w-5 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                          </div>
                        </button>
                      )}

                      <div className="flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-lg font-semibold">{Number(deposit.amount).toLocaleString()} XNRT</p>
                          <Badge variant="outline">{deposit.usdtAmount ?? "0"} USDT</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          User: {deposit.user?.email || "Unknown"} (@{deposit.user?.username || "Unknown"})
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-mono text-xs text-muted-foreground">{shortHash(deposit.transactionHash)}</p>
                          {deposit.transactionHash && (
                            <a href={`https://bscscan.com/tx/${deposit.transactionHash}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline" data-testid={`link-verify-tx-${deposit.id}`}>
                              Verify <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{new Date(deposit.createdAt).toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Badge variant="outline" className="bg-yellow-500/10">Pending</Badge>
                        {deposit.verified === true && (
                          <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400">
                            <ShieldCheck className="mr-1 h-3 w-3" />
                            Verified
                          </Badge>
                        )}
                        {deposit.verified === false && (
                          <Badge variant="outline" className="bg-red-500/10 text-red-700 dark:text-red-400">
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            Failed
                          </Badge>
                        )}
                      </div>
                      {deposit.confirmations !== undefined && deposit.confirmations >= 0 && (
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {deposit.confirmations} / 12 confirmations
                        </p>
                      )}
                      {deposit.proofImageUrl && (
                        <Button variant="ghost" size="sm" onClick={() => onViewProof(deposit.proofImageUrl!)} className="gap-1" data-testid={`button-view-proof-${deposit.id}`}>
                          <Eye className="h-4 w-4" />
                          View Proof
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 border-t border-border pt-2">
                    {deposit.transactionHash && (
                      <Button size="sm" variant="outline" onClick={() => onVerify(deposit.id)} disabled={isVerifying} className="gap-1" data-testid={`button-verify-deposit-${deposit.id}`}>
                        <ShieldCheck className="h-4 w-4" />
                        {isVerifying ? "Verifying..." : "Verify on BSC"}
                      </Button>
                    )}
                    <Button size="sm" variant="default" onClick={() => onApprove(deposit)} disabled={isProcessing} className="gap-1" data-testid={`button-approve-deposit-${deposit.id}`}>
                      <CheckCircle className="h-4 w-4" />
                      Approve
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => onReject(deposit.id)} disabled={isProcessing} className="gap-1" data-testid={`button-reject-deposit-${deposit.id}`}>
                      <XCircle className="h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="py-8 text-center text-muted-foreground">{searchQuery ? "No deposits match your search" : "No pending deposits"}</p>
        )}
      </CardContent>
    </Card>
  );
}
