import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

// Extend Navigator interface for Badging API
declare global {
  interface Navigator {
    setAppBadge?: (count?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  }
}

export function useNotificationBadge() {
  const { data: unreadCount } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  useEffect(() => {
    if (!navigator.setAppBadge || !navigator.clearAppBadge) {
      // Badging API not supported
      return;
    }

    const count = unreadCount?.count || 0;

    if (count > 0) {
      navigator.setAppBadge(count).catch((error) => {
        console.error("Failed to set app badge:", error);
      });
    } else {
      navigator.clearAppBadge().catch((error) => {
        console.error("Failed to clear app badge:", error);
      });
    }
  }, [unreadCount]);

  return {
    unreadCount: unreadCount?.count || 0,
    isSupported: 'setAppBadge' in navigator,
  };
}
