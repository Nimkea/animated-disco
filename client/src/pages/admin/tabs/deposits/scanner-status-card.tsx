import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { UseMutationResult } from "@tanstack/react-query";
import type { ScannerStatus } from "./types";

interface ScannerStatusCardProps {
  scannerStatus?: ScannerStatus;
  runScannerMutation: UseMutationResult<unknown, Error, void, unknown>;
}

export function ScannerStatusCard({ scannerStatus, runScannerMutation }: ScannerStatusCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Deposit Scanner Status</CardTitle>
            <CardDescription>Auto-detection health, pending scanner items, and manual scanner run.</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => runScannerMutation.mutate()}
            disabled={runScannerMutation.isPending || scannerStatus?.running}
            data-testid="button-run-deposit-scanner"
          >
            {runScannerMutation.isPending || scannerStatus?.running ? "Running..." : "Run Scanner"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground">Status</p>
            <p className="font-semibold">{scannerStatus?.enabled ? "Enabled" : "Disabled"}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground">Watched</p>
            <p className="font-semibold">{scannerStatus?.watchedAddresses ?? 0} addresses</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground">Pending</p>
            <p className="font-semibold">{scannerStatus?.pendingScannerDeposits ?? 0}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground">Unmatched</p>
            <p className="font-semibold">{scannerStatus?.unmatchedDeposits ?? 0}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground">Open Reports</p>
            <p className="font-semibold">{scannerStatus?.openReports ?? 0}</p>
          </div>
        </div>
        {scannerStatus?.state?.lastError && (
          <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-400">
            Last scanner error: {scannerStatus.state.lastError}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
