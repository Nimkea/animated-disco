import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellRing, Megaphone, Smartphone, Volume2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  playNotificationSound,
  saveNotificationSoundSettings,
  type NotificationSoundType,
} from "@/lib/notification-sound";

export interface NotificationPreference {
  id: string;
  userId: string;
  pushEnabled: boolean;
  inAppEnabled: boolean;
  inAppSoundEnabled: boolean;
  soundVolume: number;
  soundType: NotificationSoundType;
  walletAlerts: boolean;
  miningAlerts: boolean;
  stakingAlerts: boolean;
  referralAlerts: boolean;
  achievementAlerts: boolean;
  taskAlerts: boolean;
  systemAlerts: boolean;
  adminBroadcastAlerts: boolean;
}

type PreferenceKey = keyof Pick<
  NotificationPreference,
  | "walletAlerts"
  | "miningAlerts"
  | "stakingAlerts"
  | "referralAlerts"
  | "achievementAlerts"
  | "taskAlerts"
  | "systemAlerts"
  | "adminBroadcastAlerts"
>;

const categoryOptions: Array<{ key: PreferenceKey; label: string; description: string }> = [
  { key: "walletAlerts", label: "Wallet", description: "Deposits, withdrawals, and wallet activity" },
  { key: "miningAlerts", label: "Mining", description: "Mining completion and mining rewards" },
  { key: "stakingAlerts", label: "Staking", description: "Stake maturity, profit, and reward events" },
  { key: "referralAlerts", label: "Referrals", description: "New referrals and commission alerts" },
  { key: "achievementAlerts", label: "Achievements", description: "Achievement unlock and claim alerts" },
  { key: "taskAlerts", label: "Tasks", description: "Task completion and task reward alerts" },
  { key: "systemAlerts", label: "System", description: "Security, account, and platform alerts" },
  { key: "adminBroadcastAlerts", label: "Admin broadcasts", description: "Announcements sent by platform admins" },
];

const soundOptions: Array<{ value: NotificationSoundType; label: string }> = [
  { value: "default", label: "Default" },
  { value: "success", label: "Success" },
  { value: "reward", label: "Reward" },
  { value: "warning", label: "Warning" },
  { value: "silent", label: "Silent" },
];

export function NotificationPreferencesPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: preferences, isLoading } = useQuery<NotificationPreference>({
    queryKey: ["/api/notifications/preferences"],
  });

  useEffect(() => {
    if (!preferences) return;
    saveNotificationSoundSettings({
      enabled: preferences.inAppSoundEnabled,
      volume: preferences.soundVolume,
      sound: preferences.soundType,
    });
  }, [preferences]);

  const updateMutation = useMutation({
    mutationFn: async (patch: Partial<NotificationPreference>) => {
      const res = await apiRequest("PATCH", "/api/notifications/preferences", patch);
      return (await res.json()) as NotificationPreference;
    },
    onSuccess: (next) => {
      queryClient.setQueryData(["/api/notifications/preferences"], next);
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/status"] });
      saveNotificationSoundSettings({
        enabled: next.inAppSoundEnabled,
        volume: next.soundVolume,
        sound: next.soundType,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Could not update preferences",
        description: error.message,
      });
    },
  });

  const update = (patch: Partial<NotificationPreference>) => updateMutation.mutate(patch);

  const handleTestSound = async () => {
    const played = await playNotificationSound(preferences?.soundType || "default", {
      enabled: true,
      volume: preferences?.soundVolume ?? 65,
    });
    toast({
      title: played ? "Sound test played" : "Sound blocked",
      description: played
        ? "Foreground notification sound is working."
        : "Tap again or check browser audio permissions.",
      variant: played ? "default" : "destructive",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing className="h-5 w-5 text-primary" />
          Notification Preferences
        </CardTitle>
        <CardDescription>
          Choose which alerts you want in-app, by push, and with foreground sound.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading || !preferences ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Loading preferences…</div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border bg-muted/20 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 font-medium">
                      <Bell className="h-4 w-4 text-primary" /> In-app
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Store alerts in your inbox.</p>
                  </div>
                  <Switch checked={preferences.inAppEnabled} onCheckedChange={(value) => update({ inAppEnabled: value })} />
                </div>
              </div>
              <div className="rounded-xl border bg-muted/20 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 font-medium">
                      <Smartphone className="h-4 w-4 text-primary" /> Push
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Send background push alerts.</p>
                  </div>
                  <Switch checked={preferences.pushEnabled} onCheckedChange={(value) => update({ pushEnabled: value })} />
                </div>
              </div>
              <div className="rounded-xl border bg-muted/20 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 font-medium">
                      <Volume2 className="h-4 w-4 text-primary" /> Sound
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Play sound while app is open.</p>
                  </div>
                  <Switch checked={preferences.inAppSoundEnabled} onCheckedChange={(value) => update({ inAppSoundEnabled: value })} />
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Sound style</Label>
                <Select value={preferences.soundType} onValueChange={(value) => update({ soundType: value as NotificationSoundType })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select sound" />
                  </SelectTrigger>
                  <SelectContent>
                    {soundOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Sound volume</Label>
                  <span className="text-xs text-muted-foreground">{preferences.soundVolume}%</span>
                </div>
                <Slider
                  min={0}
                  max={100}
                  step={5}
                  value={[preferences.soundVolume]}
                  onValueChange={([soundVolume]) => update({ soundVolume })}
                  disabled={!preferences.inAppSoundEnabled || preferences.soundType === "silent"}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleTestSound}>
                <Volume2 className="mr-2 h-4 w-4" /> Test sound
              </Button>
              <Badge variant={preferences.inAppEnabled ? "default" : "secondary"}>In-app {preferences.inAppEnabled ? "on" : "off"}</Badge>
              <Badge variant={preferences.pushEnabled ? "default" : "secondary"}>Push {preferences.pushEnabled ? "on" : "off"}</Badge>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Megaphone className="h-4 w-4 text-primary" /> Alert categories
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {categoryOptions.map((option) => (
                  <div key={option.key} className="flex items-start justify-between gap-3 rounded-xl border p-3">
                    <div>
                      <p className="text-sm font-medium">{option.label}</p>
                      <p className="text-xs text-muted-foreground">{option.description}</p>
                    </div>
                    <Switch
                      checked={Boolean(preferences[option.key])}
                      onCheckedChange={(value) => update({ [option.key]: value } as Partial<NotificationPreference>)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
