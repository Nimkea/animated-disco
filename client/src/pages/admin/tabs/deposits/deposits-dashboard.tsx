import { BulkActionDialog } from "./bulk-action-dialog";
import { BulkActionsBar } from "./bulk-actions-bar";
import { DepositApprovalDialog } from "./deposit-approval-dialog";
import { DepositsToolbar } from "./deposits-toolbar";
import { PendingDepositsCard } from "./pending-deposits-card";
import { ProofImageDialog } from "./proof-image-dialog";
import { ScannerStatusCard } from "./scanner-status-card";
import { useAdminDeposits } from "./use-admin-deposits";

export function DepositsDashboard() {
  const deposits = useAdminDeposits();
  const isProcessing = deposits.approveMutation.isPending || deposits.rejectMutation.isPending;
  const isBulkProcessing = deposits.bulkApproveMutation.isPending || deposits.bulkRejectMutation.isPending;

  return (
    <div className="space-y-6 pb-24">
      <ScannerStatusCard
        scannerStatus={deposits.scannerStatusQuery.data}
        runScannerMutation={deposits.runScannerMutation as any}
      />

      <DepositsToolbar searchQuery={deposits.searchQuery} onSearchChange={deposits.setSearchQuery} />

      <BulkActionsBar
        selectedCount={deposits.selectedDepositIds.size}
        totalXNRT={deposits.totalXNRT}
        isProcessing={isBulkProcessing}
        onAction={deposits.handleBulkAction}
        onClear={() => deposits.setSelectedDepositIds(new Set())}
      />

      <PendingDepositsCard
        deposits={deposits.filteredDeposits}
        isLoading={deposits.pendingDepositsQuery.isLoading}
        searchQuery={deposits.searchQuery}
        selectedDepositIds={deposits.selectedDepositIds}
        isProcessing={isProcessing}
        isVerifying={deposits.verifyMutation.isPending}
        onToggleSelectAll={deposits.toggleSelectAll}
        onToggleSelection={deposits.toggleDepositSelection}
        onViewProof={deposits.viewProof}
        onVerify={(depositId) => deposits.verifyMutation.mutate(depositId)}
        onApprove={(deposit) => {
          deposits.setSelectedDeposit(deposit);
          deposits.setAdminNotes("");
          deposits.setForceApprove(false);
        }}
        onReject={(depositId) => deposits.rejectMutation.mutate({ id: depositId })}
      />

      <DepositApprovalDialog
        deposit={deposits.selectedDeposit}
        adminNotes={deposits.adminNotes}
        forceApprove={deposits.forceApprove}
        isPending={deposits.approveMutation.isPending}
        onOpenChange={(open) => {
          if (!open) deposits.setSelectedDeposit(null);
        }}
        onNotesChange={deposits.setAdminNotes}
        onForceApproveChange={deposits.setForceApprove}
        onConfirm={() => {
          if (!deposits.selectedDeposit) return;
          deposits.approveMutation.mutate({
            id: deposits.selectedDeposit.id,
            notes: deposits.adminNotes || undefined,
            force: deposits.forceApprove,
          });
        }}
      />

      <ProofImageDialog
        open={deposits.proofDialogOpen}
        proofUrl={deposits.selectedProofUrl}
        onOpenChange={deposits.setProofDialogOpen}
      />

      <BulkActionDialog
        open={deposits.bulkConfirmDialogOpen}
        action={deposits.bulkAction}
        selectedCount={deposits.selectedDepositIds.size}
        totalXNRT={deposits.totalXNRT}
        selectedUnverifiedCount={deposits.selectedUnverifiedCount}
        notes={deposits.bulkAdminNotes}
        forceApprove={deposits.bulkForceApprove}
        isProcessing={isBulkProcessing}
        onOpenChange={(open) => {
          deposits.setBulkConfirmDialogOpen(open);
          if (!open) deposits.setBulkAdminNotes("");
        }}
        onNotesChange={deposits.setBulkAdminNotes}
        onForceApproveChange={deposits.setBulkForceApprove}
        onConfirm={deposits.confirmBulkAction}
      />
    </div>
  );
}
