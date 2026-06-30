import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { AdminDepositTransaction, BulkDepositAction, ScannerStatus } from "./types";

export function useAdminDeposits() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDeposit, setSelectedDeposit] = useState<AdminDepositTransaction | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [forceApprove, setForceApprove] = useState(false);
  const [proofDialogOpen, setProofDialogOpen] = useState(false);
  const [selectedProofUrl, setSelectedProofUrl] = useState("");
  const [selectedDepositIds, setSelectedDepositIds] = useState<Set<string>>(new Set());
  const [bulkConfirmDialogOpen, setBulkConfirmDialogOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<BulkDepositAction | null>(null);
  const [bulkAdminNotes, setBulkAdminNotes] = useState("");
  const [bulkForceApprove, setBulkForceApprove] = useState(false);

  const pendingDepositsQuery = useQuery<AdminDepositTransaction[]>({
    queryKey: ["/api/admin/deposits/pending"],
  });

  const scannerStatusQuery = useQuery<ScannerStatus>({
    queryKey: ["/api/admin/scanner/status"],
  });

  const invalidateDepositQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/deposits/pending"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/scanner/status"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/audit-logs"] });
  };

  const runScannerMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/scanner/run", {});
      return response.json();
    },
    onSuccess: () => {
      invalidateDepositQueries();
      toast({ title: "Scanner run completed", description: "Deposit scanner status has been refreshed." });
    },
    onError: (error: Error) => {
      toast({ title: "Scanner run failed", description: error.message, variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, notes, force }: { id: string; notes?: string; force?: boolean }) => {
      return await apiRequest("POST", `/api/admin/deposits/${id}/approve`, { notes, force });
    },
    onSuccess: () => {
      invalidateDepositQueries();
      setSelectedDeposit(null);
      setAdminNotes("");
      setForceApprove(false);
      toast({ title: "Success", description: "Deposit approved successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Approval blocked", description: error.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      return await apiRequest("POST", `/api/admin/deposits/${id}/reject`, { notes });
    },
    onSuccess: () => {
      invalidateDepositQueries();
      setSelectedDeposit(null);
      setAdminNotes("");
      toast({ title: "Success", description: "Deposit rejected" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/admin/deposits/${id}/verify`, {});
      return response.json();
    },
    onSuccess: (data: { verified?: boolean; confirmations?: number; error?: string }) => {
      invalidateDepositQueries();
      if (data.verified) {
        toast({
          title: "Verification Successful",
          description: `Transaction verified on BSC with ${data.confirmations ?? 0} confirmations`,
        });
      } else {
        toast({
          title: "Verification Failed",
          description: data.error || "Could not verify transaction on blockchain",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const bulkApproveMutation = useMutation({
    mutationFn: async ({ depositIds, notes, force }: { depositIds: string[]; notes?: string; force?: boolean }) => {
      const response = await apiRequest("POST", "/api/admin/deposits/bulk-approve", { depositIds, notes, force });
      return response.json();
    },
    onSuccess: (data: { approved: number; failed: number; total: number }) => {
      invalidateDepositQueries();
      setSelectedDepositIds(new Set());
      setBulkConfirmDialogOpen(false);
      setBulkAdminNotes("");
      setBulkForceApprove(false);
      toast({
        title: data.failed > 0 ? "Partial Success" : "Success",
        description:
          data.failed > 0
            ? `Approved ${data.approved} of ${data.total} deposits. ${data.failed} failed.`
            : `Successfully approved ${data.approved} deposit${data.approved !== 1 ? "s" : ""}`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const bulkRejectMutation = useMutation({
    mutationFn: async ({ depositIds, notes }: { depositIds: string[]; notes?: string }) => {
      const response = await apiRequest("POST", "/api/admin/deposits/bulk-reject", { depositIds, notes });
      return response.json();
    },
    onSuccess: (data: { rejected: number; failed: number; total: number }) => {
      invalidateDepositQueries();
      setSelectedDepositIds(new Set());
      setBulkConfirmDialogOpen(false);
      setBulkAdminNotes("");
      toast({
        title: data.failed > 0 ? "Partial Success" : "Success",
        description:
          data.failed > 0
            ? `Rejected ${data.rejected} of ${data.total} deposits. ${data.failed} failed.`
            : `Successfully rejected ${data.rejected} deposit${data.rejected !== 1 ? "s" : ""}`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const filteredDeposits = useMemo(() => {
    const deposits = pendingDepositsQuery.data ?? [];
    if (!searchQuery.trim()) return deposits;
    const query = searchQuery.toLowerCase();
    return deposits.filter((deposit) => {
      return (
        deposit.transactionHash?.toLowerCase().includes(query) ||
        deposit.user?.email?.toLowerCase().includes(query) ||
        deposit.user?.username?.toLowerCase().includes(query) ||
        deposit.id.toLowerCase().includes(query)
      );
    });
  }, [pendingDepositsQuery.data, searchQuery]);

  const toggleDepositSelection = (depositId: string) => {
    setSelectedDepositIds((current) => {
      const next = new Set(current);
      if (next.has(depositId)) next.delete(depositId);
      else next.add(depositId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedDepositIds((current) => {
      if (current.size === filteredDeposits.length) return new Set();
      return new Set(filteredDeposits.map((deposit) => deposit.id));
    });
  };

  const viewProof = (url: string) => {
    setSelectedProofUrl(url);
    setProofDialogOpen(true);
  };

  const handleBulkAction = (action: BulkDepositAction) => {
    setBulkAction(action);
    setBulkForceApprove(false);
    setBulkConfirmDialogOpen(true);
  };

  const confirmBulkAction = () => {
    const depositIds = Array.from(selectedDepositIds);
    if (bulkAction === "approve") {
      bulkApproveMutation.mutate({ depositIds, notes: bulkAdminNotes || undefined, force: bulkForceApprove });
    } else if (bulkAction === "reject") {
      bulkRejectMutation.mutate({ depositIds, notes: bulkAdminNotes || undefined });
    }
  };

  const selectedDeposits = filteredDeposits.filter((deposit) => selectedDepositIds.has(deposit.id));
  const selectedUnverifiedCount = selectedDeposits.filter((deposit) => deposit.verified !== true).length;
  const totalXNRT = selectedDeposits.reduce((sum, deposit) => sum + Number(deposit.amount || 0), 0);

  return {
    searchQuery,
    setSearchQuery,
    selectedDeposit,
    setSelectedDeposit,
    adminNotes,
    setAdminNotes,
    forceApprove,
    setForceApprove,
    proofDialogOpen,
    setProofDialogOpen,
    selectedProofUrl,
    selectedDepositIds,
    setSelectedDepositIds,
    bulkConfirmDialogOpen,
    setBulkConfirmDialogOpen,
    bulkAction,
    bulkAdminNotes,
    setBulkAdminNotes,
    bulkForceApprove,
    setBulkForceApprove,
    pendingDepositsQuery,
    scannerStatusQuery,
    runScannerMutation,
    approveMutation,
    rejectMutation,
    verifyMutation,
    bulkApproveMutation,
    bulkRejectMutation,
    filteredDeposits,
    selectedDeposits,
    selectedUnverifiedCount,
    totalXNRT,
    toggleDepositSelection,
    toggleSelectAll,
    viewProof,
    handleBulkAction,
    confirmBulkAction,
  };
}
