import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  Bell,
  BellRing,
  CheckCheck,
  Circle,
  Clock,
  ExternalLink,
  Inbox,
  RefreshCw,
  Settings,
  Volume2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";
import { NotificationPreferencesPanel } from "@/components/notification-preferences";
import type { Notification as AppNotification } from "@shared/schema";

interface NotificationStatusResponse {
  unreadCount: number;
  subscriptions: number;
  pendingPush: number;
  pushEnabled: boolean;
  vapidConfigured: boolean;
}

type NotificationFilter = "all" | "unread" | "wallet" | "rewards" | "system";

const getCategory = (type: string): NotificationFilter => {
  const normalized = type.toLowerCase();
  if (normalized.includes("deposit") || normalized.includes("withdrawal") || normalized.includes("wallet")) return "wallet";
  if (
    normalized.includes("reward") ||
    normalized.includes("achievement") ||
    normalized.includes("task") ||
    normalized.includes("mining") ||
    normalized.includes("staking") ||
    normalized.includes("commission")
  ) {
    return "rewards";
  }
  return "system";
};

const getNotificationIcon = (type: string) => {
  const category = getCategory(type);
  if (category === "wallet") return "💰";
  if (category === "rewards") {
    if (type.toLowerCase().includes("mining")) return "⛏️";
    if (type.toLowerCase().includes("staking")) return "💎";
    if (type.toLowerCase().includes("achievement")) return "🏆";
    return "🎁";
  }
  if (type.toLowerCase().includes("referral")) return "🎉";
  return "🔔";
};

const parseNotificationUrl = (notification: AppNotification) => {
  const metadata = notification.metadata;
  if (!metadata) return null;
  if (typeof metadata === "object" && metadata.url) return String(metadata.url);
  if (typeof metadata === "string") {
    try {
      const parsed = JSON.parse(metadata);
      return parsed?.url ? String(parsed.url) : null;
    } catch {
      return null;
    }
  }
  return null;
};

export default function NotificationsPage() {
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading, refetch, isFetching } = useQuery<AppNotification[]>({
    queryKey: ["/api/notifications?limit=100"],
    refetchInterval: 30000,
  });

  const { data: status } = useQuery<NotificationStatusResponse>({
    queryKey: ["/api/notifications/status"],
    refetchInterval: 30000,
  });

  const refreshNotifications = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    queryClient.invalidateQueries({ queryKey: ["/api/notifications?limit=100"] });
    queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    queryClient.invalidateQueries({ queryKey: ["/api/notifications/status"] });
  };

  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/notifications/${id}/read`),
    onSuccess: refreshNotifications,
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/notifications/mark-all-read"),
    onSuccess: refreshNotifications,
  });

  const counts = useMemo(() => {
    return notifications.reduce(
      (acc, notification) => {
        acc.all += 1;
        if (!notification.read) acc.unread += 1;
        const category = getCategory(notification.type);
        acc[category] += 1;
        return acc;
      },
      { all: 0, unread: 0, wallet: 0, rewards: 0, system: 0 } as Record<NotificationFilter, number>,
    );
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    return notifications.filter((notification) => {
      if (filter === "all") return true;
      if (filter === "unread") return !notification.read;
      return getCategory(notification.type) === filter;
    });
  }, [filter, notifications]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
              <BellRing className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
              <p className="text-muted-foreground">Manage in-app alerts, push status, and notification sounds.</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            onClick={() => markAllAsReadMutation.mutate()}
            disabled={markAllAsReadMutation.isPending || (status?.unreadCount || counts.unread) === 0}
          >
            <CheckCheck className="h-4 w-4 mr-2" />
            Mark all read
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unread</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{status?.unreadCount ?? counts.unread}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Push Devices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{status?.subscriptions ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Push</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{status?.pendingPush ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Push Config</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={status?.pushEnabled ? "default" : "secondary"}>
              {status?.pushEnabled ? "Ready" : status?.vapidConfigured ? "Disabled" : "Needs VAPID"}
            </Badge>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="overflow-hidden">
          <CardHeader className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Notification Inbox</CardTitle>
                <CardDescription>Latest wallet, mining, rewards, referral, and system updates.</CardDescription>
              </div>
              <Tabs value={filter} onValueChange={(value) => setFilter(value as NotificationFilter)}>
                <TabsList className="flex flex-wrap h-auto justify-start">
                  {(["all", "unread", "wallet", "rewards", "system"] as NotificationFilter[]).map((tab) => (
                    <TabsTrigger key={tab} value={tab} className="capitalize">
                      {tab}
                      <span className="ml-1 text-xs text-muted-foreground">{counts[tab]}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[620px]">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <RefreshCw className="h-8 w-8 animate-spin mb-3" />
                  Loading notifications...
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
                  <Inbox className="h-14 w-14 mb-4" />
                  <p className="font-medium text-foreground">No notifications found</p>
                  <p className="text-sm mt-1">Try another filter or check again later.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredNotifications.map((notification) => {
                    const url = parseNotificationUrl(notification);
                    return (
                      <div
                        key={notification.id}
                        className={`p-4 transition-colors ${!notification.read ? "bg-primary/5" : "hover:bg-muted/30"}`}
                      >
                        <div className="flex items-start gap-4">
                          <div className="text-3xl leading-none">{getNotificationIcon(notification.type)}</div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {!notification.read && <Circle className="h-2.5 w-2.5 fill-primary text-primary" />}
                              <h3 className="font-semibold leading-tight">{notification.title}</h3>
                              <Badge variant="outline" className="capitalize">
                                {getCategory(notification.type)}
                              </Badge>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">{notification.message}</p>
                            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" />
                                {notification.createdAt && formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                              </span>
                              <span>Type: {notification.type}</span>
                              {notification.pendingPush && <Badge variant="secondary">Push pending</Badge>}
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            {!notification.read && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => markAsReadMutation.mutate(notification.id)}
                                disabled={markAsReadMutation.isPending}
                              >
                                Read
                              </Button>
                            )}
                            {url && (
                              <Button size="sm" variant="ghost" asChild>
                                <Link href={url}>
                                  <ExternalLink className="h-4 w-4" />
                                </Link>
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <NotificationPreferencesPanel />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                Push Status
              </CardTitle>
              <CardDescription>Background alerts depend on browser permission and server VAPID keys.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Server configured</span>
                <Badge variant={status?.vapidConfigured ? "default" : "secondary"}>{status?.vapidConfigured ? "Yes" : "No"}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Push enabled</span>
                <Badge variant={status?.pushEnabled ? "default" : "secondary"}>{status?.pushEnabled ? "Yes" : "No"}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Device subscriptions</span>
                <span className="font-semibold">{status?.subscriptions ?? 0}</span>
              </div>
              <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                In-app custom sound works only when the app tab/PWA is open. Background push notification sound is controlled by the browser or OS.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Volume2 className="h-5 w-5 text-primary" />
                Sound Rules
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Wallet events use a success tone.</p>
              <p>Rewards, achievements, mining, staking, and referral commission events use a reward tone.</p>
              <p>Warnings or failed actions use a lower warning tone.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
