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
  Wallet
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
  source?: string;
  walletAddress?: string;
  status: string;
  adminNotes?: string;
  fee?: string;
  netAmount?: string;
  createdAt: string;
  user?: {
    email: string;
    username: string;
  };
}

export default function WithdrawalsTab() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<Transaction | null>(null);
  const [adminNotes, setAdminNotes] = useState("");

  const { data: pendingWithdrawals, isLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/admin/withdrawals/pending"],
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      return await apiRequest("POST", `/api/admin/withdrawals/${id}/approve`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/withdrawals/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setSelectedWithdrawal(null);
      setAdminNotes("");
      toast({
        title: "Success",
        description: "Withdrawal approved successfully",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      return await apiRequest("POST", `/api/admin/withdrawals/${id}/reject`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/withdrawals/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setSelectedWithdrawal(null);
      setAdminNotes("");
      toast({
        title: "Success",
        description: "Withdrawal rejected and balance refunded",
      });
    },
  });

  const filteredWithdrawals = pendingWithdrawals?.filter((withdrawal) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      withdrawal.walletAddress?.toLowerCase().includes(query) ||
      withdrawal.user?.email?.toLowerCase().includes(query) ||
      withdrawal.user?.username?.toLowerCase().includes(query) ||
      withdrawal.id.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by wallet address, email, or username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-withdrawals"
          />
        </div>
        <Button variant="outline" size="icon" data-testid="button-filter-withdrawals">
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending Withdrawals</CardTitle>
          <CardDescription>
            Review and approve withdrawal requests • 2% fee applied • BEP20 addresses only
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredWithdrawals && filteredWithdrawals.length > 0 ? (
            <div className="space-y-3">
              {filteredWithdrawals.map((withdrawal) => (
                <div
                  key={withdrawal.id}
                  className="flex flex-col gap-3 p-4 border border-border rounded-md hover-elevate"
                  data-testid={`withdrawal-${withdrawal.id}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-lg">
                          {parseFloat(withdrawal.amount).toLocaleString()} XNRT
                        </p>
                        <Badge variant={withdrawal.source === "referral" ? "secondary" : "default"}>
                          {withdrawal.source === "referral" ? "Referral Balance" : "Main Balance"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        User: {withdrawal.user?.email || "Unknown"} (@{withdrawal.user?.username || "Unknown"})
                      </p>
                      <div className="flex items-center gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Fee:</span>{" "}
                          <span className="font-medium">{parseFloat(withdrawal.fee || "0").toLocaleString()} XNRT</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Net:</span>{" "}
                          <span className="font-medium">{parseFloat(withdrawal.netAmount || "0").toLocaleString()} XNRT</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">USDT:</span>{" "}
                          <span className="font-medium">{withdrawal.usdtAmount}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <Wallet className="h-3 w-3 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground font-mono">
                          {withdrawal.walletAddress?.slice(0, 20)}...{withdrawal.walletAddress?.slice(-10)}
                        </p>
                        <a
                          href={`https://bscscan.com/address/${withdrawal.walletAddress}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                          data-testid={`link-verify-wallet-${withdrawal.id}`}
                        >
                          Verify <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(withdrawal.createdAt).toLocaleString()}
                      </p>
                    </div>

                    <Badge variant="outline" className="bg-yellow-500/10">Pending</Badge>
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-border">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => {
                        setSelectedWithdrawal(withdrawal);
                        setAdminNotes("");
                      }}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                      className="gap-1"
                      data-testid={`button-approve-withdrawal-${withdrawal.id}`}
                    >
                      <CheckCircle className="h-4 w-4" />
                      Approve & Pay
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => rejectMutation.mutate({ id: withdrawal.id })}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                      className="gap-1"
                      data-testid={`button-reject-withdrawal-${withdrawal.id}`}
                    >
                      <XCircle className="h-4 w-4" />
                      Reject & Refund
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground">
              {searchQuery ? "No withdrawals match your search" : "No pending withdrawals"}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Approve Dialog */}
      {selectedWithdrawal && (
        <Dialog open={!!selectedWithdrawal} onOpenChange={() => setSelectedWithdrawal(null)}>
          <DialogContent data-testid="dialog-approve-withdrawal">
            <DialogHeader>
              <DialogTitle>Approve Withdrawal</DialogTitle>
              <DialogDescription>
                Confirm you will send {selectedWithdrawal.usdtAmount} USDT to the user's wallet
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="bg-muted/50 p-3 rounded-md space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">User:</span>
                  <span className="font-medium">{selectedWithdrawal.user?.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Wallet (BEP20):</span>
                  <span className="font-mono text-xs">{selectedWithdrawal.walletAddress?.slice(0, 10)}...{selectedWithdrawal.walletAddress?.slice(-8)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount to Send:</span>
                  <span className="font-bold">{selectedWithdrawal.usdtAmount} USDT</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Admin Notes (Optional)</label>
                <Textarea
                  placeholder="Add transaction hash or notes about this approval..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  data-testid="textarea-admin-notes"
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setSelectedWithdrawal(null)}
                  data-testid="button-cancel-approve"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => approveMutation.mutate({ 
                    id: selectedWithdrawal.id, 
                    notes: adminNotes || undefined 
                  })}
                  disabled={approveMutation.isPending}
                  data-testid="button-confirm-approve"
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Confirm Payment
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
