import type { ComponentType } from "react";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Activity,
  BadgeCheck,
  Ban,
  Calendar,
  CheckCircle2,
  Copy,
  Crown,
  Edit3,
  KeyRound,
  Loader2,
  Mail,
  Network,
  Shield,
  ShieldOff,
  TrendingUp,
  UserCog,
  Users as UsersIcon,
  Wallet,
} from "lucide-react";

import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminKpiCard } from "@/components/admin/admin-kpi-card";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

type BalanceSummary = {
  xnrtBalance: string;
  stakingBalance: string;
  miningBalance: string;
  referralBalance: string;
  totalEarned: string;
};

type AdminUserListItem = {
  id: string;
  email: string;
  username: string;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
  referralCode: string;
  referredBy?: string | null;
  emailVerified: boolean;
  isAdmin: boolean;
  xp: number;
  level: number;
  streak: number;
  lastCheckIn?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  balance: BalanceSummary | null;
  stats: {
    activeStakes: number;
    totalStaked: string;
    referralsCount: number;
    depositCount: number;
    depositTotal?: string;
    withdrawalCount: number;
    withdrawalTotal?: string;
    activeSessions?: number;
  };
};

type TransactionRow = {
  id: string;
  type: string;
  amount: string;
  usdtAmount?: string | null;
  status: string;
  source?: string | null;
  walletAddress?: string | null;
  transactionHash?: string | null;
  createdAt: string;
};

type StakeRow = {
  id: string;
  tier: string;
  amount: string;
  totalProfit: string;
  status: string;
  startDate: string;
  endDate: string;
  loanProgram?: string | null;
};

type ActivityRow = {
  id: string;
  type: string;
  description: string;
  createdAt: string;
};

type SessionRow = {
  id: string;
  jwtId: string;
  createdAt: string;
  revokedAt?: string | null;
};

type ReferralGivenRow = {
  id: string;
  level: number;
  totalCommission: string;
  createdAt: string;
  referredUser: {
    id: string;
    username: string;
    email: string;
    createdAt: string;
    xp: number;
    level: number;
  };
};

type AdminUserDetail = {
  user: Omit<AdminUserListItem, "balance" | "stats">;
  balance: BalanceSummary | null;
  summaries: {
    deposits: { count: number; total: string };
    withdrawals: { count: number; total: string };
    referralCommissions: { count: number; total: string };
    activeSessions: number;
    completedTasks: number;
    achievementsUnlocked: number;
  };
  sessions: SessionRow[];
  stakes: StakeRow[];
  transactions: TransactionRow[];
  activities: ActivityRow[];
  referralsGiven: ReferralGivenRow[];
};

type BalanceSource = "main" | "staking" | "mining" | "referral";
type BalanceOperation = "increment" | "decrement" | "set";

const balanceLabels: Record<BalanceSource, string> = {
  main: "Available",
  staking: "Staking",
  mining: "Mining",
  referral: "Referral",
};

function numberValue(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatXnrt(value: string | number | null | undefined) {
  return numberValue(value).toLocaleString(undefined, {
    maximumFractionDigits: 4,
  });
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function getTotalBalance(user: Pick<AdminUserListItem, "balance">) {
  if (!user.balance) return 0;
  return (
    numberValue(user.balance.xnrtBalance) +
    numberValue(user.balance.stakingBalance) +
    numberValue(user.balance.miningBalance) +
    numberValue(user.balance.referralBalance)
  );
}

function parseError(error: unknown) {
  if (error instanceof Error) {
    try {
      const jsonStart = error.message.indexOf("{");
      if (jsonStart >= 0) {
        const parsed = JSON.parse(error.message.slice(jsonStart));
        return parsed.message || error.message;
      }
    } catch {
      return error.message;
    }
    return error.message;
  }
  return "Something went wrong";
}

export default function UsersTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const { toast } = useToast();
  const { data: users = [], isLoading } = useQuery<AdminUserListItem[]>({
    queryKey: ["/api/admin/users"],
  });

  const { data: selectedUser, isLoading: detailLoading } = useQuery<AdminUserDetail>({
    queryKey: selectedUserId ? ["/api/admin/users", selectedUserId] : ["/api/admin/users", "none"],
    enabled: !!selectedUserId,
  });

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return users;
    return users.filter((user) =>
      [
        user.email,
        user.username,
        user.firstName || "",
        user.lastName || "",
        user.referralCode,
        user.id,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [searchQuery, users]);

  const totals = useMemo(() => {
    return users.reduce(
      (acc, user) => {
        acc.totalBalance += getTotalBalance(user);
        acc.admins += user.isAdmin ? 1 : 0;
        acc.verified += user.emailVerified ? 1 : 0;
        acc.activeStakers += user.stats.activeStakes > 0 ? 1 : 0;
        acc.activeSessions += user.stats.activeSessions || 0;
        return acc;
      },
      { totalBalance: 0, admins: 0, verified: 0, activeStakers: 0, activeSessions: 0 },
    );
  }, [users]);

  const invalidateUsers = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] }),
      selectedUserId
        ? queryClient.invalidateQueries({ queryKey: ["/api/admin/users", selectedUserId] })
        : Promise.resolve(),
      queryClient.invalidateQueries({ queryKey: ["/api/admin/audit-logs"] }),
    ]);
  };

  const adminStatusMutation = useMutation({
    mutationFn: async ({ userId, isAdmin, reason }: { userId: string; isAdmin: boolean; reason?: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${userId}/admin-status`, { isAdmin, reason });
      return res.json();
    },
    onSuccess: async (_data, variables) => {
      await invalidateUsers();
      toast({
        title: variables.isAdmin ? "Admin access granted" : "Admin access removed",
        description: "User role was updated and audit logged.",
      });
    },
    onError: (error) => toast({ title: "Failed to update role", description: parseError(error), variant: "destructive" }),
  });

  const revokeSessionsMutation = useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason?: string }) => {
      const res = await apiRequest("POST", `/api/admin/users/${userId}/revoke-sessions`, { reason });
      return res.json() as Promise<{ revoked: number }>;
    },
    onSuccess: async (data) => {
      await invalidateUsers();
      toast({ title: "Sessions revoked", description: `${data.revoked} active session(s) revoked.` });
    },
    onError: (error) => toast({ title: "Failed to revoke sessions", description: parseError(error), variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="User Management"
        description="Search users, review account health, manage roles, revoke sessions, and apply audited wallet adjustments."
        actions={<Badge variant="outline">{filteredUsers.length} shown</Badge>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <AdminKpiCard title="Total Users" value={users.length.toLocaleString()} icon={UsersIcon} testId="stat-users-total" />
        <AdminKpiCard title="Verified Emails" value={totals.verified.toLocaleString()} icon={BadgeCheck} accent="success" />
        <AdminKpiCard title="Admins" value={totals.admins.toLocaleString()} icon={Crown} accent="warning" testId="stat-users-admin" />
        <AdminKpiCard title="Active Sessions" value={totals.activeSessions.toLocaleString()} icon={KeyRound} accent="info" />
        <AdminKpiCard title="Total Wallet Value" value={`${formatXnrt(totals.totalBalance)} XNRT`} icon={Wallet} />
      </div>

      <Card>
        <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Users</CardTitle>
            <CardDescription>Open a user to inspect wallet, referrals, staking, transactions, and audit-safe actions.</CardDescription>
          </div>
          <div className="relative w-full md:max-w-md">
            <Input
              placeholder="Search email, username, name, referral code, or user ID..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="pl-10"
              data-testid="input-search-users"
            />
            <UserCog className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <AdminEmptyState
              icon={UsersIcon}
              title="No users found"
              description="Try a different search query."
            />
          ) : (
            <div className="overflow-hidden rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Wallet</TableHead>
                    <TableHead>Engagement</TableHead>
                    <TableHead>Activity</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id} data-testid={`user-row-${user.id}`}>
                      <TableCell className="align-top">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">{user.username}</span>
                            {user.isAdmin && <Badge className="gap-1"><Crown className="h-3 w-3" /> Admin</Badge>}
                            {user.emailVerified ? (
                              <Badge variant="secondary" className="gap-1 text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="h-3 w-3" /> Verified</Badge>
                            ) : (
                              <Badge variant="outline">Unverified</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Mail className="h-3.5 w-3.5" />
                            <span>{user.email}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => navigator.clipboard?.writeText(user.referralCode)}
                            className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 font-mono text-xs text-muted-foreground hover:text-foreground"
                          >
                            {user.referralCode}
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="space-y-1 text-sm">
                          <BalanceLine label="Available" value={user.balance?.xnrtBalance} />
                          <BalanceLine label="Staking" value={user.balance?.stakingBalance} />
                          <BalanceLine label="Mining" value={user.balance?.miningBalance} />
                          <BalanceLine label="Referral" value={user.balance?.referralBalance} />
                          <Separator className="my-1" />
                          <BalanceLine label="Total" value={getTotalBalance(user)} strong />
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="space-y-1 text-sm text-muted-foreground">
                          <div className="flex flex-wrap gap-1">
                            <Badge variant="secondary">Lvl {user.level}</Badge>
                            <Badge variant="outline">{user.xp} XP</Badge>
                            <Badge variant="outline">🔥 {user.streak}</Badge>
                          </div>
                          <div>{user.stats.activeStakes} active stake(s)</div>
                          <div>{user.stats.referralsCount} referral(s)</div>
                          <div>{user.stats.activeSessions || 0} active session(s)</div>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="space-y-1 text-sm text-muted-foreground">
                          <div>Deposits: {user.stats.depositCount} · {formatXnrt(user.stats.depositTotal || "0")}</div>
                          <div>Withdrawals: {user.stats.withdrawalCount} · {formatXnrt(user.stats.withdrawalTotal || "0")}</div>
                          <div>Last check-in: {formatDate(user.lastCheckIn)}</div>
                        </div>
                      </TableCell>
                      <TableCell className="align-top text-sm text-muted-foreground">
                        {formatDate(user.createdAt)}
                      </TableCell>
                      <TableCell className="align-top text-right">
                        <Button size="sm" onClick={() => setSelectedUserId(user.id)} data-testid={`button-open-user-${user.id}`}>
                          Manage
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!selectedUserId} onOpenChange={(open) => !open && setSelectedUserId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
          <SheetHeader>
            <SheetTitle>{selectedUser?.user.username || "User Detail"}</SheetTitle>
            <SheetDescription>
              Full account inspection and audited admin actions.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            {detailLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : selectedUser ? (
              <UserDetailPanel
                detail={selectedUser}
                onPromote={(reason) => adminStatusMutation.mutate({ userId: selectedUser.user.id, isAdmin: true, reason })}
                onDemote={(reason) => adminStatusMutation.mutate({ userId: selectedUser.user.id, isAdmin: false, reason })}
                onRevoke={(reason) => revokeSessionsMutation.mutate({ userId: selectedUser.user.id, reason })}
                busy={adminStatusMutation.isPending || revokeSessionsMutation.isPending}
                onDone={invalidateUsers}
              />
            ) : (
              <AdminEmptyState icon={UsersIcon} title="No user selected" description="Select a user from the table." />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function BalanceLine({ label, value, strong = false }: { label: string; value: string | number | null | undefined; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-4", strong && "font-semibold text-foreground")}>
      <span className="text-muted-foreground">{label}</span>
      <span>{formatXnrt(value)}</span>
    </div>
  );
}

function UserDetailPanel({
  detail,
  onPromote,
  onDemote,
  onRevoke,
  busy,
  onDone,
}: {
  detail: AdminUserDetail;
  onPromote: (reason?: string) => void;
  onDemote: (reason?: string) => void;
  onRevoke: (reason?: string) => void;
  busy: boolean;
  onDone: () => Promise<void>;
}) {
  const [roleReason, setRoleReason] = useState("");
  const [revokeReason, setRevokeReason] = useState("");

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryTile icon={Wallet} label="Wallet total" value={`${formatXnrt(
          numberValue(detail.balance?.xnrtBalance) +
            numberValue(detail.balance?.stakingBalance) +
            numberValue(detail.balance?.miningBalance) +
            numberValue(detail.balance?.referralBalance),
        )} XNRT`} />
        <SummaryTile icon={TrendingUp} label="Deposits" value={`${detail.summaries.deposits.count} · ${formatXnrt(detail.summaries.deposits.total)}`} />
        <SummaryTile icon={Network} label="Referral earnings" value={`${formatXnrt(detail.summaries.referralCommissions.total)} XNRT`} />
        <SummaryTile icon={KeyRound} label="Active sessions" value={detail.summaries.activeSessions.toLocaleString()} />
      </div>

      <div className="rounded-2xl border bg-muted/30 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold">{detail.user.username}</h3>
              {detail.user.isAdmin && <Badge><Crown className="mr-1 h-3 w-3" /> Admin</Badge>}
              <AdminStatusBadge status={detail.user.emailVerified ? "verified" : "unverified"} />
            </div>
            <p className="text-sm text-muted-foreground">{detail.user.email}</p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">ID: {detail.user.id}</p>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <div>Joined {formatDate(detail.user.createdAt)}</div>
            <div>Updated {formatDate(detail.user.updatedAt)}</div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
          <TabsTrigger value="wallet">Wallet</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="referrals">Referrals</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Account summary</CardTitle>
              <CardDescription>Profile, reward progress, and recent platform activity.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Info label="Name" value={`${detail.user.firstName || ""} ${detail.user.lastName || ""}`.trim() || "—"} />
              <Info label="Referral code" value={detail.user.referralCode} mono />
              <Info label="Level / XP" value={`Level ${detail.user.level} · ${detail.user.xp} XP`} />
              <Info label="Streak" value={`${detail.user.streak} day(s)`} />
              <Info label="Completed tasks" value={detail.summaries.completedTasks.toLocaleString()} />
              <Info label="Achievements" value={detail.summaries.achievementsUnlocked.toLocaleString()} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent transactions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {detail.transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent transactions.</p>
              ) : (
                detail.transactions.slice(0, 8).map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm">
                    <div>
                      <div className="font-medium capitalize">{tx.type} · {tx.status}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(tx.createdAt)} {tx.source ? `· ${tx.source}` : ""}</div>
                    </div>
                    <div className="font-semibold">{formatXnrt(tx.amount)} XNRT</div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="actions" className="space-y-4">
          <ProfileEditor detail={detail} onDone={onDone} />

          <Card>
            <CardHeader>
              <CardTitle>Role and session controls</CardTitle>
              <CardDescription>Every action here is audit logged.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="role-reason">Role change reason</Label>
                <Textarea id="role-reason" value={roleReason} onChange={(event) => setRoleReason(event.target.value)} placeholder="Why are you changing this user's admin role?" />
              </div>
              <div className="flex flex-wrap gap-2">
                {detail.user.isAdmin ? (
                  <Button variant="destructive" disabled={busy} onClick={() => onDemote(roleReason || undefined)}>
                    <ShieldOff className="mr-2 h-4 w-4" /> Remove admin
                  </Button>
                ) : (
                  <Button disabled={busy} onClick={() => onPromote(roleReason || undefined)}>
                    <Shield className="mr-2 h-4 w-4" /> Make admin
                  </Button>
                )}
              </div>

              <Separator />

              <div className="grid gap-2">
                <Label htmlFor="revoke-reason">Force logout reason</Label>
                <Textarea id="revoke-reason" value={revokeReason} onChange={(event) => setRevokeReason(event.target.value)} placeholder="Example: suspicious login or account support request" />
              </div>
              <Button variant="outline" disabled={busy} onClick={() => onRevoke(revokeReason || undefined)}>
                <Ban className="mr-2 h-4 w-4" /> Revoke all active sessions
              </Button>
            </CardContent>
          </Card>

          <BalanceAdjustmentForm userId={detail.user.id} onDone={onDone} />
        </TabsContent>

        <TabsContent value="wallet" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Balance breakdown</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <BalancePanel label="Available" value={detail.balance?.xnrtBalance} />
              <BalancePanel label="Staking" value={detail.balance?.stakingBalance} />
              <BalancePanel label="Mining" value={detail.balance?.miningBalance} />
              <BalancePanel label="Referral" value={detail.balance?.referralBalance} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Staking positions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {detail.stakes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent staking positions.</p>
              ) : (
                detail.stakes.map((stake) => (
                  <div key={stake.id} className="rounded-xl border p-3 text-sm">
                    <div className="flex justify-between gap-3">
                      <div className="font-medium">{stake.tier}</div>
                      <Badge variant="outline">{stake.status}</Badge>
                    </div>
                    <div className="mt-1 text-muted-foreground">{formatXnrt(stake.amount)} XNRT · profit {formatXnrt(stake.totalProfit)} XNRT</div>
                    <div className="text-xs text-muted-foreground">{formatDate(stake.startDate)} → {formatDate(stake.endDate)}</div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active sessions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {detail.sessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No session records.</p>
              ) : (
                detail.sessions.map((session) => (
                  <div key={session.id} className="flex justify-between gap-3 rounded-xl border p-3 text-sm">
                    <div>
                      <div className="font-medium">{session.revokedAt ? "Revoked" : "Active"}</div>
                      <div className="text-xs text-muted-foreground">Created {formatDate(session.createdAt)}</div>
                    </div>
                    <AdminStatusBadge status={session.revokedAt ? "revoked" : "active"} />
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {detail.activities.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent activity.</p>
              ) : (
                detail.activities.map((activity) => (
                  <div key={activity.id} className="rounded-xl border p-3 text-sm">
                    <div className="font-medium">{activity.type}</div>
                    <div className="text-muted-foreground">{activity.description}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{formatDate(activity.createdAt)}</div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="referrals" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Direct/network referrals</CardTitle>
              <CardDescription>Latest referral relationships and commission totals.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {detail.referralsGiven.length === 0 ? (
                <p className="text-sm text-muted-foreground">No referral relationships yet.</p>
              ) : (
                detail.referralsGiven.map((referral) => (
                  <div key={referral.id} className="rounded-xl border p-3 text-sm">
                    <div className="flex flex-wrap justify-between gap-2">
                      <div>
                        <div className="font-medium">{referral.referredUser.username}</div>
                        <div className="text-xs text-muted-foreground">{referral.referredUser.email}</div>
                      </div>
                      <Badge variant="outline">L{referral.level}</Badge>
                    </div>
                    <div className="mt-2 text-muted-foreground">Commission: {formatXnrt(referral.totalCommission)} XNRT</div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryTile({ icon: Icon, label, value }: { icon: ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border bg-muted/30 p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("mt-1 font-medium", mono && "font-mono text-xs")}>{value}</div>
    </div>
  );
}

function BalancePanel({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-xl border bg-muted/30 p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold">{formatXnrt(value)}</div>
      <div className="text-xs text-muted-foreground">XNRT</div>
    </div>
  );
}

function ProfileEditor({ detail, onDone }: { detail: AdminUserDetail; onDone: () => Promise<void> }) {
  const { toast } = useToast();
  const [username, setUsername] = useState(detail.user.username);
  const [firstName, setFirstName] = useState(detail.user.firstName || "");
  const [lastName, setLastName] = useState(detail.user.lastName || "");
  const [profileImageUrl, setProfileImageUrl] = useState(detail.user.profileImageUrl || "");
  const [emailVerified, setEmailVerified] = useState(detail.user.emailVerified ? "true" : "false");

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/admin/users/${detail.user.id}/profile`, {
        username,
        firstName: firstName || null,
        lastName: lastName || null,
        profileImageUrl: profileImageUrl || null,
        emailVerified: emailVerified === "true",
      });
      return res.json();
    },
    onSuccess: async () => {
      await onDone();
      toast({ title: "Profile updated", description: "User profile changes were saved and audit logged." });
    },
    onError: (error) => toast({ title: "Failed to update profile", description: parseError(error), variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit profile</CardTitle>
        <CardDescription>Update user-facing profile details.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label>Username</Label>
          <Input value={username} onChange={(event) => setUsername(event.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label>Email verification</Label>
          <Select value={emailVerified} onValueChange={setEmailVerified}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Verified</SelectItem>
              <SelectItem value="false">Unverified</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>First name</Label>
          <Input value={firstName} onChange={(event) => setFirstName(event.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label>Last name</Label>
          <Input value={lastName} onChange={(event) => setLastName(event.target.value)} />
        </div>
        <div className="grid gap-2 md:col-span-2">
          <Label>Profile image URL</Label>
          <Input value={profileImageUrl} onChange={(event) => setProfileImageUrl(event.target.value)} placeholder="https://..." />
        </div>
        <div className="md:col-span-2">
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Edit3 className="mr-2 h-4 w-4" />}
            Save profile
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function BalanceAdjustmentForm({ userId, onDone }: { userId: string; onDone: () => Promise<void> }) {
  const { toast } = useToast();
  const [source, setSource] = useState<BalanceSource>("main");
  const [operation, setOperation] = useState<BalanceOperation>("increment");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/admin/users/${userId}/adjust-balance`, {
        source,
        operation,
        amount: Number(amount),
        reason,
      });
      return res.json();
    },
    onSuccess: async () => {
      await onDone();
      setAmount("");
      setReason("");
      setConfirmOpen(false);
      toast({ title: "Balance adjusted", description: "Wallet balance was updated and audit logged." });
    },
    onError: (error) => toast({ title: "Failed to adjust balance", description: parseError(error), variant: "destructive" }),
  });

  const canSubmit = Number(amount) > 0 && reason.trim().length >= 5;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manual balance adjustment</CardTitle>
        <CardDescription>Use only for support corrections. This creates activity, notification, and audit records.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label>Balance source</Label>
          <Select value={source} onValueChange={(value) => setSource(value as BalanceSource)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(balanceLabels) as BalanceSource[]).map((key) => <SelectItem key={key} value={key}>{balanceLabels[key]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Operation</Label>
          <Select value={operation} onValueChange={(value) => setOperation(value as BalanceOperation)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="increment">Add amount</SelectItem>
              <SelectItem value="decrement">Subtract amount</SelectItem>
              <SelectItem value="set">Set exact balance</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2 md:col-span-2">
          <Label>Amount XNRT</Label>
          <Input type="number" min="0" step="0.0001" value={amount} onChange={(event) => setAmount(event.target.value)} />
        </div>
        <div className="grid gap-2 md:col-span-2">
          <Label>Reason</Label>
          <Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Required: support ticket, correction reason, or manual audit note" />
        </div>
        <div className="md:col-span-2">
          <Button variant="destructive" disabled={!canSubmit} onClick={() => setConfirmOpen(true)}>
            Adjust balance
          </Button>
        </div>
      </CardContent>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm balance adjustment</DialogTitle>
            <DialogDescription>
              You are about to {operation} {formatXnrt(amount)} XNRT on the {balanceLabels[source]} balance. This action is audit logged and will notify the user.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border bg-muted/30 p-3 text-sm">
            <div><strong>Reason:</strong> {reason}</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
