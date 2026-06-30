import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  Activity,
  Database,
  Download,
  FileText,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminKpiCard } from "@/components/admin/admin-kpi-card";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminSearchToolbar } from "@/components/admin/admin-search-toolbar";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface AdminAuditLog {
  id: string;
  adminUserId?: string | null;
  targetUserId?: string | null;
  entityType: string;
  entityId?: string | null;
  action: string;
  status: string;
  summary: string;
  metadata?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
}

const ENTITY_OPTIONS = [
  { label: "All entities", value: "all" },
  { label: "Deposits", value: "deposit" },
  { label: "Withdrawals", value: "withdrawal" },
  { label: "Deposit reports", value: "deposit_report" },
  { label: "Unmatched deposits", value: "unmatched_deposit" },
  { label: "Scanner", value: "scanner" },
  { label: "Stakes", value: "stake" },
  { label: "Users", value: "user" },
];

const STATUS_OPTIONS = [
  { label: "All statuses", value: "all" },
  { label: "Success", value: "success" },
  { label: "Failed", value: "failed" },
  { label: "Blocked", value: "blocked" },
];

const ACTION_OPTIONS = [
  { label: "All actions", value: "all" },
  { label: "Deposit approve", value: "deposit_approve" },
  { label: "Deposit force approve", value: "deposit_force_approve" },
  { label: "Deposit reject", value: "deposit_reject" },
  { label: "Withdrawal approve", value: "withdrawal_approve" },
  { label: "Withdrawal reject", value: "withdrawal_reject" },
  { label: "Scanner manual run", value: "scanner_manual_run" },
  { label: "Unmatched deposit match", value: "unmatched_deposit_match" },
];

function buildAuditQuery(limit: number, entityType: string, status: string, action: string) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (entityType !== "all") params.set("entityType", entityType);
  if (status !== "all") params.set("status", status);
  if (action !== "all") params.set("action", action);
  return `/api/admin/audit-logs?${params.toString()}`;
}

function formatId(id?: string | null) {
  if (!id) return "—";
  if (id.length <= 14) return id;
  return `${id.slice(0, 8)}…${id.slice(-6)}`;
}

function formatAction(action: string) {
  return action.replace(/_/g, " ");
}

function getMetadataPreview(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return null;
  const entries = Object.entries(metadata as Record<string, unknown>).slice(0, 4);
  if (!entries.length) return null;
  return entries
    .map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`)
    .join(" • ");
}

function csvEscape(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(logs: AdminAuditLog[]) {
  const header = [
    "createdAt",
    "status",
    "action",
    "entityType",
    "entityId",
    "adminUserId",
    "targetUserId",
    "summary",
    "ipAddress",
  ];
  const rows = logs.map((log) => [
    log.createdAt,
    log.status,
    log.action,
    log.entityType,
    log.entityId ?? "",
    log.adminUserId ?? "",
    log.targetUserId ?? "",
    log.summary,
    log.ipAddress ?? "",
  ]);
  const csv = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `admin-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function AuditLogsTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [entityType, setEntityType] = useState("all");
  const [status, setStatus] = useState("all");
  const [action, setAction] = useState("all");
  const [limit, setLimit] = useState(100);

  const auditQuery = buildAuditQuery(limit, entityType, status, action);
  const { data: logs = [], isLoading, refetch, isFetching } = useQuery<AdminAuditLog[]>({
    queryKey: [auditQuery],
  });

  const filteredLogs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return logs;
    return logs.filter((log) => {
      return [
        log.summary,
        log.action,
        log.status,
        log.entityType,
        log.entityId,
        log.adminUserId,
        log.targetUserId,
        log.ipAddress,
        getMetadataPreview(log.metadata),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [logs, searchQuery]);

  const successCount = logs.filter((log) => String(log.status).toLowerCase() === "success").length;
  const failureCount = logs.filter((log) => String(log.status).toLowerCase() !== "success").length;
  const forceCount = logs.filter((log) => log.action.toLowerCase().includes("force")).length;
  const scannerCount = logs.filter((log) => log.entityType === "scanner").length;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Admin control center"
        title="Audit Logs"
        description="Review high-risk admin actions like deposit approvals, forced overrides, withdrawal decisions, scanner runs, and manual matching."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => downloadCsv(filteredLogs)} disabled={filteredLogs.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <AdminKpiCard
          title="Loaded events"
          value={logs.length.toLocaleString()}
          description={`Showing latest ${limit}`}
          icon={FileText}
          accent="info"
          testId="audit-loaded-events"
        />
        <AdminKpiCard
          title="Success actions"
          value={successCount.toLocaleString()}
          description="Completed admin operations"
          icon={ShieldCheck}
          accent="success"
          testId="audit-success-count"
        />
        <AdminKpiCard
          title="Failed / blocked"
          value={failureCount.toLocaleString()}
          description="Needs review if non-zero"
          icon={ShieldAlert}
          accent={failureCount > 0 ? "danger" : "default"}
          testId="audit-failure-count"
        />
        <AdminKpiCard
          title="Force overrides"
          value={forceCount.toLocaleString()}
          description="Manual override actions"
          icon={UserCog}
          accent={forceCount > 0 ? "warning" : "default"}
          testId="audit-force-count"
        />
        <AdminKpiCard
          title="Scanner events"
          value={scannerCount.toLocaleString()}
          description="Manual scanner runs and failures"
          icon={Activity}
          accent="default"
          testId="audit-scanner-count"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Audit trail
          </CardTitle>
          <CardDescription>
            Server filters reduce data before loading. Search filters the loaded rows locally, including metadata previews.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <AdminSearchToolbar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search summary, action, user ID, entity ID, IP, metadata..."
            testId="input-search-audit-logs"
            actions={
              <>
                <Select value={entityType} onValueChange={setEntityType}>
                  <SelectTrigger className="w-full md:w-[190px]" data-testid="select-audit-entity">
                    <SelectValue placeholder="Entity type" />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTITY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="w-full md:w-[160px]" data-testid="select-audit-status">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={action} onValueChange={setAction}>
                  <SelectTrigger className="w-full md:w-[210px]" data-testid="select-audit-action">
                    <SelectValue placeholder="Action" />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={String(limit)} onValueChange={(value) => setLimit(Number(value))}>
                  <SelectTrigger className="w-full md:w-[140px]" data-testid="select-audit-limit">
                    <SelectValue placeholder="Limit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50">Latest 50</SelectItem>
                    <SelectItem value="100">Latest 100</SelectItem>
                    <SelectItem value="200">Latest 200</SelectItem>
                  </SelectContent>
                </Select>
              </>
            }
          />

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((item) => (
                <div key={item} className="h-16 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : filteredLogs.length === 0 ? (
            <AdminEmptyState
              icon={FileText}
              title="No audit logs found"
              description="Try a different search/filter. New admin actions will appear here after deposits, withdrawals, scanner runs, and manual matching."
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Admin / Target</TableHead>
                    <TableHead>Summary</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => {
                    const metadataPreview = getMetadataPreview(log.metadata);
                    return (
                      <TableRow key={log.id} data-testid={`audit-log-${log.id}`}>
                        <TableCell className="min-w-[150px] text-sm">
                          <div className="font-medium">
                            {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(log.createdAt).toLocaleString()}
                          </div>
                        </TableCell>
                        <TableCell className="min-w-[160px]">
                          <Badge variant="outline" className="capitalize">
                            {formatAction(log.action)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <AdminStatusBadge status={log.status} />
                        </TableCell>
                        <TableCell className="min-w-[160px] text-sm">
                          <div className="font-medium capitalize">{log.entityType.replace(/_/g, " ")}</div>
                          <div className="font-mono text-xs text-muted-foreground">{formatId(log.entityId)}</div>
                        </TableCell>
                        <TableCell className="min-w-[190px] text-xs">
                          <div>
                            <span className="text-muted-foreground">Admin:</span>{" "}
                            <span className="font-mono">{formatId(log.adminUserId)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Target:</span>{" "}
                            <span className="font-mono">{formatId(log.targetUserId)}</span>
                          </div>
                          {log.ipAddress && (
                            <div>
                              <span className="text-muted-foreground">IP:</span>{" "}
                              <span className="font-mono">{log.ipAddress}</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="min-w-[280px] max-w-xl">
                          <p className="text-sm font-medium">{log.summary}</p>
                          {metadataPreview && (
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                              {metadataPreview}
                            </p>
                          )}
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
  );
}
