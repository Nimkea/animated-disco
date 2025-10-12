import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Bell, CheckCheck, BellRing, BellOff, Smartphone } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import type { Notification } from "@shared/schema";

const ENABLE_PUSH_NOTIFICATIONS = true;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [permissionState, setPermissionState] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: notifications = [], isLoading: isLoadingNotifications } = useQuery<Notification[]>({
    queryKey: ['/api/notifications'],
    enabled: true,
  });

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ['/api/notifications/unread-count'],
    enabled: true,
  });

  const { data: vapidKey } = useQuery<{ publicKey: string }>({
    queryKey: ['/api/push/vapid-public-key'],
    enabled: ENABLE_PUSH_NOTIFICATIONS,
  });

  useEffect(() => {
    if ('Notification' in window) {
      setPermissionState(Notification.permission);
    }

    if ('serviceWorker' in navigator && ENABLE_PUSH_NOTIFICATIONS) {
      navigator.serviceWorker.ready.then(async (registration) => {
        const subscription = await registration.pushManager.getSubscription();
        setIsSubscribed(!!subscription);
      }).catch(() => {
        setIsSubscribed(false);
      });
    }
  }, []);

  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => apiRequest('PATCH', `/api/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/notifications/mark-all-read'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
    },
  });

  const subscribeMutation = useMutation({
    mutationFn: async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        throw new Error('Push notifications are not supported in this browser');
      }

      const permission = await Notification.requestPermission();
      setPermissionState(permission);

      if (permission !== 'granted') {
        throw new Error('Notification permission denied');
      }

      const registration = await navigator.serviceWorker.ready;

      if (!vapidKey?.publicKey) {
        throw new Error('VAPID public key not available');
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey.publicKey),
      });

      const p256dhKey = subscription.getKey('p256dh');
      const authKey = subscription.getKey('auth');

      const subscriptionData = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(p256dhKey!)))),
          auth: btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(authKey!)))),
        },
        expirationTime: subscription.expirationTime,
      };

      await apiRequest('POST', '/api/push/subscribe', subscriptionData);
      return subscription;
    },
    onSuccess: () => {
      setIsSubscribed(true);
      toast({
        title: "Push Notifications Enabled",
        description: "You'll now receive notifications on this device.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/push/subscriptions'] });
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
      if (!('serviceWorker' in navigator)) {
        throw new Error('Service workers are not supported');
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
        await apiRequest('DELETE', '/api/push/unsubscribe', {
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
      queryClient.invalidateQueries({ queryKey: ['/api/push/subscriptions'] });
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
      return await apiRequest('POST', '/api/admin/push/test', {
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

  const unreadCount = unreadData?.count || 0;

  const getNotificationIcon = (type: string) => {
    if (type === 'referral_commission') return '💰';
    if (type === 'new_referral') return '🎉';
    if (type === 'achievement_unlocked') return '🏆';
    return '🔔';
  };

  const handlePushToggle = (checked: boolean) => {
    if (checked) {
      subscribeMutation.mutate();
    } else {
      unsubscribeMutation.mutate();
    }
  };

  const getPushNotificationUI = () => {
    if (!ENABLE_PUSH_NOTIFICATIONS) return null;

    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      return null;
    }

    if (permissionState === 'denied') {
      return (
        <div className="px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-lg mb-2">
          <div className="flex items-start gap-2">
            <BellOff className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-500">Push notifications blocked</p>
              <p className="text-xs text-muted-foreground mt-1">
                Enable notifications in your browser settings to receive alerts
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="px-4 py-3 bg-primary/5 rounded-lg mb-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1">
            {isSubscribed ? (
              <BellRing className="h-4 w-4 text-primary" />
            ) : (
              <Bell className="h-4 w-4 text-muted-foreground" />
            )}
            <div className="flex-1">
              <p className="text-sm font-medium">Push Notifications</p>
              <p className="text-xs text-muted-foreground">
                {isSubscribed ? 'Enabled on this device' : 'Get notified instantly'}
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
            Send Test Notification
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
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
          {ENABLE_PUSH_NOTIFICATIONS && isSubscribed && (
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-background" 
              data-testid="indicator-push-enabled"
            />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-2">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllAsReadMutation.mutate()}
              disabled={markAllAsReadMutation.isPending}
              data-testid="button-mark-all-read"
            >
              <CheckCheck className="h-4 w-4 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        
        <div className="px-2 py-2">
          {getPushNotificationUI()}
        </div>

        {ENABLE_PUSH_NOTIFICATIONS && <DropdownMenuSeparator />}
        
        <ScrollArea className="h-96">
          {isLoadingNotifications ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="text-sm text-muted-foreground mt-2">Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Bell className="h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={`px-4 py-3 cursor-pointer ${
                  !notification.read ? 'bg-primary/5' : ''
                }`}
                onClick={() => {
                  if (!notification.read) {
                    markAsReadMutation.mutate(notification.id);
                  }
                }}
                data-testid={`notification-${notification.id}`}
              >
                <div className="flex items-start gap-3 w-full">
                  <span className="text-2xl mt-0.5">{getNotificationIcon(notification.type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="font-semibold text-sm">{notification.title}</p>
                      {!notification.read && (
                        <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {notification.createdAt && formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </DropdownMenuItem>
            ))
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
