import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  Activity,
  Database,
  FileText,
  RefreshCw,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

function buildAuditQuery(limit: number, entityType: string) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (entityType !== "all") params.set("entityType", entityType);
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

export default function AuditLogsTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [entityType, setEntityType] = useState("all");
  const [limit, setLimit] = useState(100);

  const auditQuery = buildAuditQuery(limit, entityType);
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
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [logs, searchQuery]);

  const successCount = logs.filter((log) => String(log.status).toLowerCase() === "success").length;
  const failureCount = logs.filter((log) => String(log.status).toLowerCase() !== "success").length;
  const forceCount = logs.filter((log) => log.action.toLowerCase().includes("force")).length;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Admin control center"
        title="Audit Logs"
        description="Review high-risk admin actions like deposit approvals, forced overrides, withdrawal decisions, scanner runs, and manual matching."
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
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
          icon={Activity}
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Audit trail
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <AdminSearchToolbar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search summary, action, user ID, entity ID, IP..."
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
