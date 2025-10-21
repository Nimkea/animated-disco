import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { X, AlertCircle, Info, CheckCircle, AlertTriangle } from "lucide-react";
import { useState } from "react";

interface Announcement {
  id: string;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'success' | 'error';
  isActive: boolean;
  createdAt: string;
  expiresAt: string | null;
}

const TYPE_ICONS = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle,
  error: AlertCircle,
};

const TYPE_VARIANTS = {
  info: 'default',
  warning: 'default',
  success: 'default',
  error: 'destructive',
} as const;

export function AnnouncementBanner() {
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    const stored = localStorage.getItem('dismissedAnnouncements');
    return stored ? JSON.parse(stored) : [];
  });

  const { data: announcements } = useQuery<Announcement[]>({
    queryKey: ["/api/announcements"],
  });

  const handleDismiss = (id: string) => {
    const newDismissed = [...dismissedIds, id];
    setDismissedIds(newDismissed);
    localStorage.setItem('dismissedAnnouncements', JSON.stringify(newDismissed));
  };

  const activeAnnouncements = announcements?.filter(
    (announcement) => !dismissedIds.includes(announcement.id)
  );

  if (!activeAnnouncements || activeAnnouncements.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {activeAnnouncements.map((announcement) => {
        const Icon = TYPE_ICONS[announcement.type];
        return (
          <Alert
            key={announcement.id}
            variant={TYPE_VARIANTS[announcement.type]}
            className="relative pr-12"
            data-testid={`announcement-banner-${announcement.id}`}
          >
            <Icon className="h-4 w-4" />
            <AlertTitle>{announcement.title}</AlertTitle>
            <AlertDescription>{announcement.content}</AlertDescription>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 h-8 w-8"
              onClick={() => handleDismiss(announcement.id)}
              data-testid={`button-dismiss-${announcement.id}`}
            >
              <X className="h-4 w-4" />
            </Button>
          </Alert>
        );
      })}
    </div>
  );
}
