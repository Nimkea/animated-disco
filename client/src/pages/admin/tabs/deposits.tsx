import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  CheckCircle, 
  XCircle, 
  ExternalLink, 
  Search,
  Filter,
  Eye
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

      <Card>
        <CardHeader>
          <CardTitle>Pending Deposits</CardTitle>
          <CardDescription>
            Review and approve deposit requests • Company Wallet: 0x715C32deC9534d2fB34e0B567288AF8d895efB59 (BEP20)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredDeposits && filteredDeposits.length > 0 ? (
            <div className="space-y-3">
              {filteredDeposits.map((deposit) => (
                <div
                  key={deposit.id}
                  className="flex flex-col gap-3 p-4 border border-border rounded-md hover-elevate"
                  data-testid={`deposit-${deposit.id}`}
                >
                  <div className="flex items-start justify-between gap-4">
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
              ))}
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
    </div>
  );
}
