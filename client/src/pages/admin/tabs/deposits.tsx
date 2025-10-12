import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  CheckCircle, 
  XCircle, 
  ExternalLink, 
  Search,
  Filter,
  Eye,
  X
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Transaction {
  id: string;
  userId: string;
  type: string;
  amount: string;
  usdtAmount?: string;
  transactionHash?: string;
  proofImageUrl?: string;
  status: string;
  adminNotes?: string;
  createdAt: string;
  user?: {
    email: string;
    username: string;
  };
}

export default function DepositsTab() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDeposit, setSelectedDeposit] = useState<Transaction | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [proofDialogOpen, setProofDialogOpen] = useState(false);
  const [selectedProofUrl, setSelectedProofUrl] = useState("");
  
  // Bulk selection state
  const [selectedDepositIds, setSelectedDepositIds] = useState<Set<string>>(new Set());
  const [bulkConfirmDialogOpen, setBulkConfirmDialogOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<'approve' | 'reject' | null>(null);
  const [bulkAdminNotes, setBulkAdminNotes] = useState("");

  const { data: pendingDeposits, isLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/admin/deposits/pending"],
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      return await apiRequest("POST", `/api/admin/deposits/${id}/approve`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/deposits/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setSelectedDeposit(null);
      setAdminNotes("");
      toast({
        title: "Success",
        description: "Deposit approved successfully",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      return await apiRequest("POST", `/api/admin/deposits/${id}/reject`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/deposits/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setSelectedDeposit(null);
      setAdminNotes("");
      toast({
        title: "Success",
        description: "Deposit rejected",
      });
    },
  });

  // Bulk mutations
  const bulkApproveMutation = useMutation({
    mutationFn: async ({ depositIds, notes }: { depositIds: string[]; notes?: string }) => {
      return await apiRequest("POST", "/api/admin/deposits/bulk-approve", { depositIds, notes });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/deposits/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setSelectedDepositIds(new Set());
      setBulkConfirmDialogOpen(false);
      setBulkAdminNotes("");
      
      const { approved, failed, total } = data;
      if (failed > 0) {
        toast({
          title: "Partial Success",
          description: `Successfully approved ${approved} of ${total} deposits. ${failed} failed.`,
          variant: "default",
        });
      } else {
        toast({
          title: "Success",
          description: `Successfully approved ${approved} deposit${approved !== 1 ? 's' : ''}`,
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to approve deposits",
        variant: "destructive",
      });
    },
  });

  const bulkRejectMutation = useMutation({
    mutationFn: async ({ depositIds, notes }: { depositIds: string[]; notes?: string }) => {
      return await apiRequest("POST", "/api/admin/deposits/bulk-reject", { depositIds, notes });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/deposits/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setSelectedDepositIds(new Set());
      setBulkConfirmDialogOpen(false);
      setBulkAdminNotes("");
      
      const { rejected, failed, total } = data;
      if (failed > 0) {
        toast({
          title: "Partial Success",
          description: `Successfully rejected ${rejected} of ${total} deposits. ${failed} failed.`,
          variant: "default",
        });
      } else {
        toast({
          title: "Success",
          description: `Successfully rejected ${rejected} deposit${rejected !== 1 ? 's' : ''}`,
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to reject deposits",
        variant: "destructive",
      });
    },
  });

  const filteredDeposits = pendingDeposits?.filter((deposit) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      deposit.transactionHash?.toLowerCase().includes(query) ||
      deposit.user?.email?.toLowerCase().includes(query) ||
      deposit.user?.username?.toLowerCase().includes(query) ||
      deposit.id.toLowerCase().includes(query)
    );
  });

  const viewProof = (url: string) => {
    setSelectedProofUrl(url);
    setProofDialogOpen(true);
  };

  // Selection handlers
  const toggleDepositSelection = (depositId: string) => {
    const newSelected = new Set(selectedDepositIds);
    if (newSelected.has(depositId)) {
      newSelected.delete(depositId);
    } else {
      newSelected.add(depositId);
    }
    setSelectedDepositIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedDepositIds.size === filteredDeposits?.length) {
      setSelectedDepositIds(new Set());
    } else {
      setSelectedDepositIds(new Set(filteredDeposits?.map(d => d.id) || []));
    }
  };

  const clearSelection = () => {
    setSelectedDepositIds(new Set());
  };

  const handleBulkAction = (action: 'approve' | 'reject') => {
    setBulkAction(action);
    setBulkConfirmDialogOpen(true);
  };

  const confirmBulkAction = () => {
    const depositIds = Array.from(selectedDepositIds);
    if (bulkAction === 'approve') {
      bulkApproveMutation.mutate({ depositIds, notes: bulkAdminNotes || undefined });
    } else if (bulkAction === 'reject') {
      bulkRejectMutation.mutate({ depositIds, notes: bulkAdminNotes || undefined });
    }
  };

  // Calculate total XNRT for selected deposits
  const selectedDeposits = filteredDeposits?.filter(d => selectedDepositIds.has(d.id)) || [];
  const totalXNRT = selectedDeposits.reduce((sum, d) => sum + parseFloat(d.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by transaction hash, email, or username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-deposits"
          />
        </div>
        <Button variant="outline" size="icon" data-testid="button-filter-deposits">
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      {/* Bulk Actions Bar - Sticky at Bottom */}
      {selectedDepositIds.size > 0 && (
        <div 
          className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
          data-testid="bar-bulk-actions"
        >
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="text-base px-3 py-1" data-testid="text-selected-count">
                  {selectedDepositIds.size} deposit{selectedDepositIds.size !== 1 ? 's' : ''} selected
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Total: {totalXNRT.toLocaleString()} XNRT
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleBulkAction('approve')}
                  disabled={bulkApproveMutation.isPending || bulkRejectMutation.isPending}
                  className="gap-1"
                  data-testid="button-approve-selected"
                >
                  <CheckCircle className="h-4 w-4" />
                  Approve Selected
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleBulkAction('reject')}
                  disabled={bulkApproveMutation.isPending || bulkRejectMutation.isPending}
                  className="gap-1"
                  data-testid="button-reject-selected"
                >
                  <XCircle className="h-4 w-4" />
                  Reject Selected
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                  className="gap-1"
                  data-testid="button-clear-selection"
                >
                  <X className="h-4 w-4" />
                  Clear
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Pending Deposits</CardTitle>
              <CardDescription>
                Review and approve deposit requests • Company Wallet: 0x715C32deC9534d2fB34e0B567288AF8d895efB59 (BEP20)
              </CardDescription>
            </div>
            {filteredDeposits && filteredDeposits.length > 0 && (
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedDepositIds.size === filteredDeposits.length && filteredDeposits.length > 0}
                  onCheckedChange={toggleSelectAll}
                  data-testid="checkbox-select-all"
                />
                <label className="text-sm font-medium cursor-pointer" onClick={toggleSelectAll}>
                  Select All
                </label>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredDeposits && filteredDeposits.length > 0 ? (
            <div className="space-y-3">
              {filteredDeposits.map((deposit) => {
                const isSelected = selectedDepositIds.has(deposit.id);
                return (
                <div
                  key={deposit.id}
                  className={`flex flex-col gap-3 p-4 border rounded-md hover-elevate transition-all ${
                    isSelected ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                  data-testid={`deposit-${deposit.id}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      {/* Selection Checkbox */}
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleDepositSelection(deposit.id)}
                        className="mt-1"
                        data-testid={`checkbox-select-deposit-${deposit.id}`}
                      />
                      {/* Inline Thumbnail Preview */}
                      {deposit.proofImageUrl && (
                        <button
                          onClick={() => viewProof(deposit.proofImageUrl!)}
                          className="group relative w-20 h-20 flex-shrink-0 rounded-lg border-2 border-border overflow-hidden bg-muted hover:border-primary transition-all hover:scale-105 hidden sm:block"
                          data-testid={`thumbnail-proof-${deposit.id}`}
                        >
                          <img
                            src={deposit.proofImageUrl}
                            alt="Proof thumbnail"
                            className="w-full h-full object-cover transition-opacity group-hover:opacity-80"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="%23ddd"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="%23999">No Image</text></svg>';
                            }}
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                            <Eye className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </button>
                      )}
                      
                      {/* Transaction Details */}
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-lg">
                            {parseFloat(deposit.amount).toLocaleString()} XNRT
                          </p>
                          <Badge variant="outline">
                            {deposit.usdtAmount} USDT
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          User: {deposit.user?.email || "Unknown"} (@{deposit.user?.username || "Unknown"})
                        </p>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-muted-foreground font-mono">
                            {deposit.transactionHash?.slice(0, 20)}...{deposit.transactionHash?.slice(-10)}
                          </p>
                          {deposit.transactionHash && (
                            <a
                              href={`https://bscscan.com/tx/${deposit.transactionHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline flex items-center gap-1"
                              data-testid={`link-verify-tx-${deposit.id}`}
                            >
                              Verify <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(deposit.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <Badge variant="outline" className="bg-yellow-500/10">Pending</Badge>
                      {deposit.proofImageUrl && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => viewProof(deposit.proofImageUrl!)}
                          className="gap-1"
                          data-testid={`button-view-proof-${deposit.id}`}
                        >
                          <Eye className="h-4 w-4" />
                          View Proof
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-border">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => {
                        setSelectedDeposit(deposit);
                        setAdminNotes("");
                      }}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                      className="gap-1"
                      data-testid={`button-approve-deposit-${deposit.id}`}
                    >
                      <CheckCircle className="h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => rejectMutation.mutate({ id: deposit.id })}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                      className="gap-1"
                      data-testid={`button-reject-deposit-${deposit.id}`}
                    >
                      <XCircle className="h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground">
              {searchQuery ? "No deposits match your search" : "No pending deposits"}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Approve Dialog */}
      {selectedDeposit && (
        <Dialog open={!!selectedDeposit} onOpenChange={() => setSelectedDeposit(null)}>
          <DialogContent data-testid="dialog-approve-deposit">
            <DialogHeader>
              <DialogTitle>Approve Deposit</DialogTitle>
              <DialogDescription>
                Approving this will credit {parseFloat(selectedDeposit.amount).toLocaleString()} XNRT to user's main balance
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Admin Notes (Optional)</label>
                <Textarea
                  placeholder="Add any notes about this approval..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  data-testid="textarea-admin-notes"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setSelectedDeposit(null)}
                  data-testid="button-cancel-approve"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => approveMutation.mutate({ 
                    id: selectedDeposit.id, 
                    notes: adminNotes || undefined 
                  })}
                  disabled={approveMutation.isPending}
                  data-testid="button-confirm-approve"
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Confirm Approval
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Proof Image Dialog */}
      <Dialog open={proofDialogOpen} onOpenChange={setProofDialogOpen}>
        <DialogContent className="max-w-3xl" data-testid="dialog-proof-image">
          <DialogHeader>
            <DialogTitle>Transaction Proof</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center">
            <img 
              src={selectedProofUrl} 
              alt="Transaction proof" 
              className="max-w-full max-h-[70vh] object-contain rounded-md"
              data-testid="img-proof"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Action Confirmation Dialog */}
      <AlertDialog open={bulkConfirmDialogOpen} onOpenChange={setBulkConfirmDialogOpen}>
        <AlertDialogContent data-testid="dialog-bulk-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulkAction === 'approve' ? 'Approve Selected Deposits' : 'Reject Selected Deposits'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkAction === 'approve' 
                ? `You are about to approve ${selectedDepositIds.size} deposit${selectedDepositIds.size !== 1 ? 's' : ''} totaling ${totalXNRT.toLocaleString()} XNRT. This action will credit the respective amounts to users' main balances.`
                : `You are about to reject ${selectedDepositIds.size} deposit${selectedDepositIds.size !== 1 ? 's' : ''}. This action cannot be undone.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Admin Notes (Optional)</label>
              <Textarea
                placeholder={`Add notes about this ${bulkAction === 'approve' ? 'approval' : 'rejection'}...`}
                value={bulkAdminNotes}
                onChange={(e) => setBulkAdminNotes(e.target.value)}
                data-testid="textarea-bulk-admin-notes"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setBulkConfirmDialogOpen(false);
                setBulkAdminNotes("");
              }}
              data-testid="button-cancel-bulk-action"
            >
              Cancel
            </Button>
            <Button
              variant={bulkAction === 'approve' ? 'default' : 'destructive'}
              onClick={confirmBulkAction}
              disabled={bulkApproveMutation.isPending || bulkRejectMutation.isPending}
              data-testid="button-confirm-bulk-action"
            >
              {bulkApproveMutation.isPending || bulkRejectMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-1"></div>
                  Processing...
                </>
              ) : (
                <>
                  {bulkAction === 'approve' ? <CheckCircle className="h-4 w-4 mr-1" /> : <XCircle className="h-4 w-4 mr-1" />}
                  Confirm {bulkAction === 'approve' ? 'Approval' : 'Rejection'}
                </>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
