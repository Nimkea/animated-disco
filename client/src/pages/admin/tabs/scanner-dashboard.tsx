import { useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  FileWarning,
  Gauge,
  Loader2,
  PlayCircle,
  Radar,
  RefreshCw,
  SearchCheck,
  Server,
  ShieldAlert,
  WalletCards,
  XCircle,
} from "lucide-react";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminKpiCard } from "@/components/admin/admin-kpi-card";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface ScannerStatus {
  enabled: boolean;
  running: boolean;
  rpcConfigured: boolean;
  usdtConfigured?: boolean;
  treasuryConfigured?: boolean;
  xnrtTokenConfigured?: boolean;
  requiredConfirmations: number;
  scanBatch: number;
  watchedAddresses: number;
  pendingScannerDeposits: number;
  unmatchedDeposits: number;
  openReports: number;
  state?: {
    lastBlock: number;
    lastScanAt: string;
    updatedAt: string;
    errorCount: number;
    lastError?: string | null;
  } | null;
}

interface AdminAuditLog {
  id: string;
  entityType: string;
  entityId?: string | null;
  action: string;
  status: string;
  summary: string;
  metadata?: unknown;
  createdAt: string;
}

function formatDateTime(value?: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
}

function formatRelative(value?: string | null) {
  if (!value) return "No scan recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  return formatDistanceToNow(date, { addSuffix: true });
}

function getHealth(status?: ScannerStatus) {
  if (!status) {
    return {
      label: "Loading",
      accent: "default" as const,
      description: "Fetching scanner status",
      icon: Loader2,
    };
  }

  if (!status.enabled) {
    return {
      label: "Disabled",
      accent: "warning" as const,
      description: "AUTO_DEPOSIT is not enabled",
      icon: AlertTriangle,
    };
  }

  if (!status.rpcConfigured || !status.usdtConfigured) {
    return {
      label: "Misconfigured",
      accent: "danger" as const,
      description: "RPC or token configuration is missing",
      icon: ShieldAlert,
    };
  }

  if (status.state?.lastError) {
    return {
      label: "Needs review",
      accent: "warning" as const,
      description: "Last scan reported an error",
      icon: FileWarning,
    };
  }

  if (status.running) {
    return {
      label: "Running",
      accent: "info" as const,
      description: "Scanner is processing blocks",
      icon: Radar,
    };
  }

  return {
    label: "Healthy",
    accent: "success" as const,
    description: "Scanner is ready",
    icon: CheckCircle2,
  };
}

function ConfigCheck({ label, ok, detail }: { label: string; ok?: boolean; detail?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border bg-muted/30 p-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
      </div>
      {ok ? (
        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">Ready</Badge>
      ) : (
        <Badge variant="destructive">Missing</Badge>
      )}
    </div>
  );
}

function metadataPreview(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return null;
  const entries = Object.entries(metadata as Record<string, unknown>).slice(0, 3);
  if (!entries.length) return null;
  return entries
    .map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`)
    .join(" • ");
}

export default function ScannerDashboardTab() {
  const { toast } = useToast();
  const { data: scannerStatus, isLoading, isFetching, refetch } = useQuery<ScannerStatus>({
    queryKey: ["/api/admin/scanner/status"],
  });

  const { data: scannerAuditLogs = [] } = useQuery<AdminAuditLog[]>({
    queryKey: ["/api/admin/audit-logs?entityType=scanner&limit=25"],
  });

  const runScannerMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/scanner/run", {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/scanner/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/deposits/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/audit-logs?entityType=scanner&limit=25"] });
      toast({
        title: "Scanner run completed",
        description: "Deposit scanner status and pending deposit queues were refreshed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Scanner run failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const health = useMemo(() => getHealth(scannerStatus), [scannerStatus]);
  const HealthIcon = health.icon;

  const canRunScanner = Boolean(scannerStatus?.enabled && scannerStatus?.rpcConfigured && scannerStatus?.usdtConfigured);
  const isRunning = runScannerMutation.isPending || Boolean(scannerStatus?.running);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Deposit operations"
        title="Scanner Dashboard"
        description="Monitor automatic deposit detection, watched wallet coverage, scanner health, unmatched deposits, and manual scanner runs."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => runScannerMutation.mutate()}
              disabled={!canRunScanner || isRunning}
              data-testid="button-run-scanner-dashboard"
            >
              {isRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
              {isRunning ? "Running..." : "Run Scanner"}
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminKpiCard
          title="Scanner health"
          value={health.label}
          description={health.description}
          icon={HealthIcon}
          accent={health.accent}
          testId="scanner-health"
        />
        <AdminKpiCard
          title="Watched addresses"
          value={isLoading ? "—" : (scannerStatus?.watchedAddresses ?? 0).toLocaleString()}
          description="Users with personal deposit addresses"
          icon={WalletCards}
          accent="info"
          testId="scanner-watched-addresses"
        />
        <AdminKpiCard
          title="Unmatched deposits"
          value={isLoading ? "—" : (scannerStatus?.unmatchedDeposits ?? 0).toLocaleString()}
          description="Blockchain deposits needing manual match"
          icon={SearchCheck}
          accent={(scannerStatus?.unmatchedDeposits ?? 0) > 0 ? "warning" : "default"}
          testId="scanner-unmatched-deposits"
        />
        <AdminKpiCard
          title="Open reports"
          value={isLoading ? "—" : (scannerStatus?.openReports ?? 0).toLocaleString()}
          description="User-submitted missing deposit reports"
          icon={FileWarning}
          accent={(scannerStatus?.openReports ?? 0) > 0 ? "warning" : "default"}
          testId="scanner-open-reports"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              Configuration checklist
            </CardTitle>
            <CardDescription>
              Scanner needs auto-deposit enabled, BSC RPC, token addresses, and watched user deposit addresses.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <ConfigCheck label="Auto deposit flag" ok={scannerStatus?.enabled} detail="AUTO_DEPOSIT / ENABLE_SCANNER should be enabled." />
            <ConfigCheck label="BSC RPC" ok={scannerStatus?.rpcConfigured} detail="Required for block/event scanning." />
            <ConfigCheck label="USDT token" ok={scannerStatus?.usdtConfigured} detail="Required for USDT BEP-20 deposit detection." />
            <ConfigCheck label="Treasury wallet" ok={scannerStatus?.treasuryConfigured} detail="Legacy treasury fallback support." />
            <ConfigCheck label="XNRT token" ok={scannerStatus?.xnrtTokenConfigured} detail="Optional XNRT inbound detection." />
            <ConfigCheck
              label="Watched addresses"
              ok={(scannerStatus?.watchedAddresses ?? 0) > 0}
              detail={`${scannerStatus?.watchedAddresses ?? 0} personal deposit addresses registered.`}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="h-5 w-5 text-primary" />
              Scan state
            </CardTitle>
            <CardDescription>Last processed block, scan batch size, confirmations, and recent error state.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Last block</p>
                <p className="text-xl font-bold">{scannerStatus?.state?.lastBlock?.toLocaleString() ?? "—"}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Required confirmations</p>
                <p className="text-xl font-bold">{scannerStatus?.requiredConfirmations ?? "—"}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Scan batch</p>
                <p className="text-xl font-bold">{scannerStatus?.scanBatch ?? "—"}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Error count</p>
                <p className="text-xl font-bold">{scannerStatus?.state?.errorCount ?? 0}</p>
              </div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="mb-1 flex items-center gap-2 text-sm font-medium">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Last scan
              </div>
              <p className="text-sm">{formatRelative(scannerStatus?.state?.lastScanAt)}</p>
              <p className="text-xs text-muted-foreground">{formatDateTime(scannerStatus?.state?.lastScanAt)}</p>
            </div>
            {scannerStatus?.state?.lastError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <div className="mb-1 flex items-center gap-2 font-semibold">
                  <XCircle className="h-4 w-4" />
                  Last scanner error
                </div>
                <p className="break-words">{scannerStatus.state.lastError}</p>
              </div>
            ) : (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="h-4 w-4" />
                  No latest scanner error recorded
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              Queue summary
            </CardTitle>
            <CardDescription>Operational queues that need admin attention after scanner runs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
              <div>
                <p className="font-medium">Pending scanner deposits</p>
                <p className="text-xs text-muted-foreground">Auto-detected deposits waiting for confirmations or review.</p>
              </div>
              <Badge variant="outline">{scannerStatus?.pendingScannerDeposits ?? 0}</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
              <div>
                <p className="font-medium">Unmatched deposits</p>
                <p className="text-xs text-muted-foreground">Deposits seen on-chain but not matched to a user.</p>
              </div>
              <Badge variant={(scannerStatus?.unmatchedDeposits ?? 0) > 0 ? "destructive" : "outline"}>
                {scannerStatus?.unmatchedDeposits ?? 0}
              </Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
              <div>
                <p className="font-medium">Open reports</p>
                <p className="text-xs text-muted-foreground">Missing deposit reports submitted by users.</p>
              </div>
              <Badge variant={(scannerStatus?.openReports ?? 0) > 0 ? "destructive" : "outline"}>
                {scannerStatus?.openReports ?? 0}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => (window.location.href = "/admin?tab=deposits")}>
                Review deposits
              </Button>
              <Button variant="outline" size="sm" onClick={() => (window.location.href = "/admin?tab=audit")}>
                View audit logs
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Radar className="h-5 w-5 text-primary" />
              Scanner audit trail
            </CardTitle>
            <CardDescription>Latest scanner manual runs, failures, and force-operation audit events.</CardDescription>
          </CardHeader>
          <CardContent>
            {scannerAuditLogs.length === 0 ? (
              <AdminEmptyState
                icon={Radar}
                title="No scanner audit events yet"
                description="Manual scanner runs and scanner failures will appear here after the first admin-triggered scan."
              />
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Summary</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scannerAuditLogs.map((log) => {
                      const preview = metadataPreview(log.metadata);
                      return (
                        <TableRow key={log.id}>
                          <TableCell className="min-w-[150px] text-sm">
                            <div className="font-medium">{formatRelative(log.createdAt)}</div>
                            <div className="text-xs text-muted-foreground">{formatDateTime(log.createdAt)}</div>
                          </TableCell>
                          <TableCell className="min-w-[180px]">
                            <Badge variant="outline" className="capitalize">
                              {log.action.replace(/_/g, " ")}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <AdminStatusBadge status={log.status} />
                          </TableCell>
                          <TableCell className="min-w-[280px] max-w-xl">
                            <p className="text-sm font-medium">{log.summary}</p>
                            {preview && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{preview}</p>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
