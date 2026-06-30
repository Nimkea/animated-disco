import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getNotificationSoundSettings,
  inferNotificationSound,
  playNotificationSound,
  saveNotificationSoundSettings,
  type NotificationSoundSettings,
} from "@/lib/notification-sound";
import type { Notification as AppNotification } from "@shared/schema";

export function useNotificationSoundSettings() {
  const [settings, setSettings] = useState<NotificationSoundSettings>(() =>
    getNotificationSoundSettings(),
  );

  useEffect(() => {
    const syncSettings = () => setSettings(getNotificationSoundSettings());
    const syncCustom = (event: Event) => {
      const next = (event as CustomEvent<NotificationSoundSettings>).detail;
      setSettings(next || getNotificationSoundSettings());
    };

    window.addEventListener("storage", syncSettings);
    window.addEventListener("xnrt-notification-sound-settings", syncCustom as EventListener);

    return () => {
      window.removeEventListener("storage", syncSettings);
      window.removeEventListener("xnrt-notification-sound-settings", syncCustom as EventListener);
    };
  }, []);

  const updateSettings = (patch: Partial<NotificationSoundSettings>) => {
    const next = { ...getNotificationSoundSettings(), ...patch };
    saveNotificationSoundSettings(next);
    setSettings(next);
  };

  return { settings, updateSettings };
}

export function useNotificationSoundListener(enabled = true) {
  const initializedRef = useRef(false);
  const lastUnreadRef = useRef(0);

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    enabled,
    refetchInterval: 15000,
  });

  const { data: notifications = [] } = useQuery<AppNotification[]>({
    queryKey: ["/api/notifications"],
    enabled,
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (!enabled || !unreadData) return;

    const currentCount = unreadData.count || 0;
    if (!initializedRef.current) {
      initializedRef.current = true;
      lastUnreadRef.current = currentCount;
      return;
    }

    if (currentCount > lastUnreadRef.current) {
      const newestUnread = notifications.find((item) => !item.read);
      void playNotificationSound(inferNotificationSound(newestUnread?.type));
    }

    lastUnreadRef.current = currentCount;
  }, [enabled, notifications, unreadData]);
}
