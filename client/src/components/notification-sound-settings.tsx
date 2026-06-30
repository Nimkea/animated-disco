import { BellRing, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { playNotificationSound, type NotificationSoundType } from "@/lib/notification-sound";
import { useNotificationSoundSettings } from "@/hooks/use-notification-sound";

interface NotificationSoundSettingsProps {
  compact?: boolean;
}

const soundOptions: Array<{ value: NotificationSoundType; label: string; description: string }> = [
  { value: "default", label: "Default", description: "Clean two-tone alert" },
  { value: "success", label: "Success", description: "Soft confirmation tone" },
  { value: "reward", label: "Reward", description: "Bright reward chime" },
  { value: "warning", label: "Warning", description: "Lower attention tone" },
  { value: "silent", label: "Silent", description: "No in-app sound" },
];

export function NotificationSoundSettings({ compact = false }: NotificationSoundSettingsProps) {
  const { settings, updateSettings } = useNotificationSoundSettings();
  const { toast } = useToast();

  const handleTestSound = async () => {
    const played = await playNotificationSound(settings.sound, {
      enabled: true,
      volume: settings.volume,
    });

    toast({
      title: played ? "Sound test played" : "Sound blocked",
      description: played
        ? "Foreground notification sound is working on this device."
        : "Tap again or check browser audio permissions if the tone did not play.",
      variant: played ? "default" : "destructive",
    });
  };

  return (
    <div className={compact ? "space-y-3" : "rounded-2xl border border-border bg-card p-5 shadow-sm space-y-5"}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Notification Sound</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Plays while the app tab or installed PWA is open. Background push uses browser/OS sound.
          </p>
        </div>
        <Switch
          checked={settings.enabled}
          onCheckedChange={(enabled) => updateSettings({ enabled })}
          data-testid="switch-notification-sound"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Sound style</Label>
          <Select
            value={settings.sound}
            onValueChange={(value) => updateSettings({ sound: value as NotificationSoundType })}
          >
            <SelectTrigger data-testid="select-notification-sound">
              <SelectValue placeholder="Select sound" />
            </SelectTrigger>
            <SelectContent>
              {soundOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex flex-col">
                    <span>{option.label}</span>
                    <span className="text-xs text-muted-foreground">{option.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Volume</Label>
            <span className="text-xs font-medium text-muted-foreground">{settings.volume}%</span>
          </div>
          <Slider
            min={0}
            max={100}
            step={5}
            value={[settings.volume]}
            onValueChange={([volume]) => updateSettings({ volume })}
            disabled={!settings.enabled || settings.sound === "silent"}
            data-testid="slider-notification-volume"
          />
        </div>
      </div>

      <Button
        variant="outline"
        size={compact ? "sm" : "default"}
        className={compact ? "w-full" : ""}
        onClick={handleTestSound}
        data-testid="button-test-notification-sound"
      >
        <BellRing className="h-4 w-4 mr-2" />
        Test Sound
      </Button>
    </div>
  );
}
