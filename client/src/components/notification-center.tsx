import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Bell, BellOff, BellRing, CheckCheck, Settings, Smartphone, Volume2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { NotificationSoundSettings } from "@/components/notification-sound-settings";
import { playNotificationSound } from "@/lib/notification-sound";
import type { Notification as AppNotification } from "@shared/schema";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

interface PushKeyResponse {
  publicKey: string;
  enabled?: boolean;
  configured?: boolean;
}

interface NotificationStatusResponse {
  unreadCount: number;
  subscriptions: number;
  pendingPush: number;
  pushEnabled: boolean;
  vapidConfigured: boolean;
}

const getNotificationIcon = (type: string) => {
  const normalized = type.toLowerCase();
  if (normalized.includes("commission") || normalized.includes("deposit") || normalized.includes("wallet")) return "💰";
  if (normalized.includes("referral")) return "🎉";
  if (normalized.includes("achievement")) return "🏆";
  if (normalized.includes("task")) return "✅";
  if (normalized.includes("mining")) return "⛏️";
  if (normalized.includes("staking")) return "💎";
  return "🔔";
};

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [permissionState, setPermissionState] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: notifications = [], isLoading: isLoadingNotifications } = useQuery<AppNotification[]>({
    queryKey: ["/api/notifications"],
    enabled: true,
    refetchInterval: 30000,
  });

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    enabled: true,
    refetchInterval: 15000,
  });

  const { data: vapidKey } = useQuery<PushKeyResponse>({
    queryKey: ["/api/push/vapid-public-key"],
  });

  const { data: status } = useQuery<NotificationStatusResponse>({
    queryKey: ["/api/notifications/status"],
    refetchInterval: 30000,
  });

  useEffect(() => {
    if ("Notification" in window) {
      setPermissionState(Notification.permission);
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready
        .then(async (registration) => {
          const subscription = await registration.pushManager.getSubscription();
          setIsSubscribed(!!subscription);
        })
        .catch(() => setIsSubscribed(false));
    }
  }, []);

  const refreshNotifications = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
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

  const subscribeMutation = useMutation({
    mutationFn: async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        throw new Error("Push notifications are not supported in this browser");
      }

      const permission = await Notification.requestPermission();
      setPermissionState(permission);

      if (permission !== "granted") {
        throw new Error("Notification permission denied");
      }

      if (!vapidKey?.publicKey || vapidKey.enabled === false || vapidKey.configured === false) {
        throw new Error("Push notifications are not configured on the server");
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey.publicKey),
      });

      const p256dhKey = subscription.getKey("p256dh");
      const authKey = subscription.getKey("auth");

      const subscriptionData = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(p256dhKey!)))),
          auth: btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(authKey!)))),
        },
        expirationTime: subscription.expirationTime,
      };

      await apiRequest("POST", "/api/push/subscribe", subscriptionData);
      return subscription;
    },
    onSuccess: () => {
      setIsSubscribed(true);
      toast({
        title: "Push Notifications Enabled",
        description: "You'll now receive notifications on this device.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/push/subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/status"] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to enable notifications",
        description: error.message,
      });
    },
  });

  const unsubscribeMutation = useMutation({
    mutationFn: async () => {
      if (!("serviceWorker" in navigator)) {
        throw new Error("Service workers are not supported");
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
        await apiRequest("DELETE", "/api/push/unsubscribe", {
          endpoint: subscription.endpoint,
        });
      }
    },
    onSuccess: () => {
      setIsSubscribed(false);
      toast({
        title: "Push Notifications Disabled",
        description: "You won't receive notifications on this device.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/push/subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/status"] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to disable notifications",
        description: error.message,
      });
    },
  });

  const testNotificationMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/admin/push/test", {
        userId: user?.id,
        title: "Test Notification",
        body: "This is a test push notification from XNRT!",
      });
    },
    onSuccess: () => {
      toast({
        title: "Test notification sent",
        description: "Check your device for the notification.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Failed to send test notification",
        description: "Please try again later.",
      });
    },
  });

  const unreadCount = unreadData?.count || status?.unreadCount || 0;
  const pushConfigured = Boolean(vapidKey?.publicKey) && vapidKey?.enabled !== false && status?.pushEnabled !== false;

  const handlePushToggle = (checked: boolean) => {
    if (checked) subscribeMutation.mutate();
    else unsubscribeMutation.mutate();
  };

  const getPushNotificationUI = () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return null;

    if (!pushConfigured) {
      return (
        <div className="px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-lg mb-2">
          <div className="flex items-start gap-2">
            <BellOff className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-500">Push not configured</p>
              <p className="text-xs text-muted-foreground mt-1">Add VAPID keys on the server to enable background push alerts.</p>
            </div>
          </div>
        </div>
      );
    }

    if (permissionState === "denied") {
      return (
        <div className="px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-lg mb-2">
          <div className="flex items-start gap-2">
            <BellOff className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-500">Push notifications blocked</p>
              <p className="text-xs text-muted-foreground mt-1">Enable notifications in browser settings to receive background alerts.</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="px-4 py-3 bg-primary/5 rounded-lg mb-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1">
            {isSubscribed ? <BellRing className="h-4 w-4 text-primary" /> : <Bell className="h-4 w-4 text-muted-foreground" />}
            <div className="flex-1">
              <p className="text-sm font-medium">Push Notifications</p>
              <p className="text-xs text-muted-foreground">
                {isSubscribed ? "Enabled on this device" : "Get browser/PWA alerts"}
              </p>
            </div>
          </div>
          <Switch
            checked={isSubscribed}
            onCheckedChange={handlePushToggle}
            disabled={subscribeMutation.isPending || unsubscribeMutation.isPending}
            data-testid="switch-push-notifications"
          />
        </div>
        {user?.isAdmin && isSubscribed && (
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-2"
            onClick={() => testNotificationMutation.mutate()}
            disabled={testNotificationMutation.isPending}
            data-testid="button-test-notification"
          >
            <Smartphone className="h-3 w-3 mr-2" />
            Send Test Push
          </Button>
        )}
      </div>
    );
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" data-testid="button-notifications">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px]"
              data-testid="badge-unread-count"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
          {pushConfigured && isSubscribed && (
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-background" data-testid="indicator-push-enabled" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-2">
          <h3 className="font-semibold">Notifications</h3>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSettingsOpen((value) => !value)}
              data-testid="button-notification-sound-settings"
              title="Sound settings"
            >
              <Volume2 className="h-4 w-4" />
            </Button>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => markAllAsReadMutation.mutate()}
                disabled={markAllAsReadMutation.isPending}
                data-testid="button-mark-all-read"
              >
                <CheckCheck className="h-4 w-4 mr-1" />
                Read
              </Button>
            )}
          </div>
        </div>
        <DropdownMenuSeparator />

        <div className="px-2 py-2 space-y-2">
          {getPushNotificationUI()}
          {settingsOpen && (
            <div className="rounded-lg border border-border p-3 bg-muted/20">
              <NotificationSoundSettings compact />
            </div>
          )}
        </div>

        <DropdownMenuSeparator />

        <ScrollArea className="h-96">
          {isLoadingNotifications ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              <p className="text-sm text-muted-foreground mt-2">Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Bell className="h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            notifications.slice(0, 20).map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={`px-4 py-3 cursor-pointer ${!notification.read ? "bg-primary/5" : ""}`}
                onClick={() => {
                  if (!notification.read) markAsReadMutation.mutate(notification.id);
                }}
                data-testid={`notification-${notification.id}`}
              >
                <div className="flex items-start gap-3 w-full">
                  <span className="text-2xl mt-0.5">{getNotificationIcon(notification.type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="font-semibold text-sm">{notification.title}</p>
                      {!notification.read && <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1" />}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{notification.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {notification.createdAt && formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </DropdownMenuItem>
            ))
          )}
        </ScrollArea>

        <DropdownMenuSeparator />
        <div className="p-2 grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" asChild onClick={() => setOpen(false)}>
            <Link href="/notifications">
              <Settings className="h-4 w-4 mr-1" />
              Manage
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void playNotificationSound()}
            data-testid="button-quick-test-sound"
          >
            <Volume2 className="h-4 w-4 mr-1" />
            Sound
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
