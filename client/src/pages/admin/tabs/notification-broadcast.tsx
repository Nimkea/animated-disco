import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Megaphone, Send, Users, User, ShieldCheck, AlertTriangle } from "lucide-react";
import { AdminKpiCard } from "@/components/admin/admin-kpi-card";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface BroadcastSummary {
  totalUsers: number;
  pushEnabledUsers: number;
  inAppEnabledUsers: number;
  adminBroadcastEnabledUsers: number;
  maxBatchSize: number;
}

interface BroadcastResult {
  message: string;
  broadcastId: string;
  attempted: number;
  sent: number;
  skipped: number;
  failed: number;
  failures?: Array<{ userId: string; reason: string }>;
}

interface AdminUserOption {
  id: string;
  email: string;
  username: string;
}

const typeOptions = [
  { value: "admin_broadcast", label: "General Broadcast" },
  { value: "system_announcement", label: "System Announcement" },
  { value: "wallet_notice", label: "Wallet Notice" },
  { value: "staking_notice", label: "Staking Notice" },
  { value: "mining_notice", label: "Mining Notice" },
  { value: "referral_notice", label: "Referral Notice" },
];

export default function NotificationBroadcastTab() {
  const [target, setTarget] = useState<"all" | "user">("all");
  const [userId, setUserId] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("admin_broadcast");
  const [url, setUrl] = useState("/notifications");
  const [lastResult, setLastResult] = useState<BroadcastResult | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: summary } = useQuery<BroadcastSummary>({
    queryKey: ["/api/admin/notifications/broadcast/summary"],
  });

  const { data: users = [] } = useQuery<AdminUserOption[]>({
    queryKey: ["/api/admin/users"],
    enabled: target === "user",
  });

  const selectedUser = useMemo(() => users.find((user) => user.id === userId), [users, userId]);
  const canSend = title.trim().length >= 3 && message.trim().length >= 5 && (target === "all" || Boolean(userId));

  const broadcastMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/notifications/broadcast", {
        target,
        userId: target === "user" ? userId : undefined,
        title: title.trim(),
        message: message.trim(),
        type,
        url: url.trim() || "/notifications",
      });
      return (await res.json()) as BroadcastResult;
    },
    onSuccess: (result) => {
      setLastResult(result);
      toast({
        title: "Broadcast processed",
        description: `Sent to ${result.sent}/${result.attempted} users.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/audit-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/notifications/broadcast/summary"] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Broadcast failed",
        description: error.message,
      });
    },
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Notification control"
        title="Admin Broadcast"
        description="Send platform notifications to all users or a selected user. Delivery respects user notification preferences."
        actions={
          <Button onClick={() => broadcastMutation.mutate()} disabled={!canSend || broadcastMutation.isPending}>
            <Send className="mr-2 h-4 w-4" />
            {broadcastMutation.isPending ? "Sending…" : "Send Broadcast"}
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminKpiCard title="Total users" value={(summary?.totalUsers ?? 0).toLocaleString()} description="Broadcast audience size" icon={Users} accent="info" />
        <AdminKpiCard title="In-app enabled" value={(summary?.inAppEnabledUsers ?? 0).toLocaleString()} description="Users with inbox enabled" icon={BellRing} accent="success" />
        <AdminKpiCard title="Push enabled" value={(summary?.pushEnabledUsers ?? 0).toLocaleString()} description="Users allowing push alerts" icon={Megaphone} accent="default" />
        <AdminKpiCard title="Broadcast enabled" value={(summary?.adminBroadcastEnabledUsers ?? 0).toLocaleString()} description="Users allowing admin broadcasts" icon={ShieldCheck} accent="warning" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Compose broadcast</CardTitle>
            <CardDescription>Keep the message short and action-oriented. A matching audit log will be recorded.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3">
              <Label>Audience</Label>
              <RadioGroup value={target} onValueChange={(value) => setTarget(value as "all" | "user")} className="grid gap-3 sm:grid-cols-2">
                <Label className="flex cursor-pointer items-start gap-3 rounded-xl border p-4 hover:bg-muted/40">
                  <RadioGroupItem value="all" className="mt-1" />
                  <div>
                    <p className="font-medium">All users</p>
                    <p className="text-xs text-muted-foreground">Send to the latest active user list, capped by server batch size.</p>
                  </div>
                </Label>
                <Label className="flex cursor-pointer items-start gap-3 rounded-xl border p-4 hover:bg-muted/40">
                  <RadioGroupItem value="user" className="mt-1" />
                  <div>
                    <p className="font-medium">Single user</p>
                    <p className="text-xs text-muted-foreground">Use this for support or account-specific notices.</p>
                  </div>
                </Label>
              </RadioGroup>
            </div>

            {target === "user" && (
              <div className="space-y-2">
                <Label>Target user</Label>
                <Select value={userId} onValueChange={setUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a user" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.username || user.email} — {user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedUser && <p className="text-xs text-muted-foreground">Target: {selectedUser.username} / {selectedUser.email}</p>}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Notification type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {typeOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Open URL</Label>
                <Input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="/notifications" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Important platform update" maxLength={120} />
              <p className="text-xs text-muted-foreground">{title.length}/120 characters</p>
            </div>

            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write the notification message…" rows={5} maxLength={1000} />
              <p className="text-xs text-muted-foreground">{message.length}/1000 characters</p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><User className="h-5 w-5 text-primary" /> Delivery rules</CardTitle>
              <CardDescription>Broadcasts use the same notification pipeline as wallet, mining, and reward alerts.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="rounded-lg bg-muted/40 p-3">User category preferences are respected for admin broadcasts.</div>
              <div className="rounded-lg bg-muted/40 p-3">Foreground sound plays only when the app/PWA is open.</div>
              <div className="rounded-lg bg-muted/40 p-3">Every broadcast creates an admin audit log.</div>
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-700 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-4 w-4" />
                <span>Do not send sensitive personal information in broadcast notifications.</span>
              </div>
            </CardContent>
          </Card>

          {lastResult && (
            <Card>
              <CardHeader>
                <CardTitle>Last result</CardTitle>
                <CardDescription>ID: {lastResult.broadcastId}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Attempted</span><strong>{lastResult.attempted}</strong></div>
                <div className="flex justify-between"><span>Sent</span><strong>{lastResult.sent}</strong></div>
                <div className="flex justify-between"><span>Skipped</span><strong>{lastResult.skipped}</strong></div>
                <div className="flex justify-between"><span>Failed</span><strong>{lastResult.failed}</strong></div>
                <Badge variant={lastResult.failed ? "destructive" : "default"}>{lastResult.failed ? "Partial" : "Success"}</Badge>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
