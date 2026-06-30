export type NotificationSoundType = "default" | "success" | "reward" | "warning" | "silent";

export interface NotificationSoundSettings {
  enabled: boolean;
  volume: number;
  sound: NotificationSoundType;
}

const STORAGE_KEY = "xnrt_notification_sound_settings_v1";

export const DEFAULT_NOTIFICATION_SOUND_SETTINGS: NotificationSoundSettings = {
  enabled: true,
  volume: 65,
  sound: "default",
};

const clampVolume = (volume: unknown) => {
  const numeric = Number(volume);
  if (!Number.isFinite(numeric)) return DEFAULT_NOTIFICATION_SOUND_SETTINGS.volume;
  return Math.min(100, Math.max(0, Math.round(numeric)));
};

export function getNotificationSoundSettings(): NotificationSoundSettings {
  if (typeof window === "undefined") return DEFAULT_NOTIFICATION_SOUND_SETTINGS;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_NOTIFICATION_SOUND_SETTINGS;

    const parsed = JSON.parse(raw) as Partial<NotificationSoundSettings>;
    const sound = parsed.sound || DEFAULT_NOTIFICATION_SOUND_SETTINGS.sound;

    return {
      enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : true,
      volume: clampVolume(parsed.volume),
      sound: ["default", "success", "reward", "warning", "silent"].includes(sound)
        ? sound
        : DEFAULT_NOTIFICATION_SOUND_SETTINGS.sound,
    };
  } catch {
    return DEFAULT_NOTIFICATION_SOUND_SETTINGS;
  }
}

export function saveNotificationSoundSettings(next: NotificationSoundSettings) {
  if (typeof window === "undefined") return;

  const normalized: NotificationSoundSettings = {
    enabled: Boolean(next.enabled),
    volume: clampVolume(next.volume),
    sound: next.sound,
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent("xnrt-notification-sound-settings", { detail: normalized }));
}

function getSoundPattern(type: NotificationSoundType) {
  switch (type) {
    case "success":
      return [
        { frequency: 523.25, duration: 0.09, delay: 0 },
        { frequency: 659.25, duration: 0.11, delay: 0.1 },
      ];
    case "reward":
      return [
        { frequency: 659.25, duration: 0.08, delay: 0 },
        { frequency: 783.99, duration: 0.08, delay: 0.09 },
        { frequency: 1046.5, duration: 0.12, delay: 0.18 },
      ];
    case "warning":
      return [
        { frequency: 392, duration: 0.12, delay: 0 },
        { frequency: 329.63, duration: 0.14, delay: 0.13 },
      ];
    case "silent":
      return [];
    case "default":
    default:
      return [
        { frequency: 587.33, duration: 0.08, delay: 0 },
        { frequency: 880, duration: 0.1, delay: 0.09 },
      ];
  }
}

export async function playNotificationSound(
  requestedType?: NotificationSoundType,
  override?: Partial<NotificationSoundSettings>,
) {
  if (typeof window === "undefined") return false;

  const settings = { ...getNotificationSoundSettings(), ...override };
  const type = requestedType || settings.sound;

  if (!settings.enabled || type === "silent" || settings.volume <= 0) return false;

  const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextCtor) return false;

  try {
    const context = new AudioContextCtor();
    if (context.state === "suspended") {
      await context.resume();
    }

    const masterGain = context.createGain();
    masterGain.gain.value = Math.min(1, Math.max(0, settings.volume / 100));
    masterGain.connect(context.destination);

    const now = context.currentTime;
    const pattern = getSoundPattern(type);

    pattern.forEach((note) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const startAt = now + note.delay;
      const endAt = startAt + note.duration;

      oscillator.type = type === "warning" ? "square" : "sine";
      oscillator.frequency.value = note.frequency;
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.7, startAt + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

      oscillator.connect(gain);
      gain.connect(masterGain);
      oscillator.start(startAt);
      oscillator.stop(endAt + 0.02);
    });

    window.setTimeout(() => {
      context.close().catch(() => undefined);
    }, 900);

    return true;
  } catch (error) {
    console.warn("Notification sound could not be played:", error);
    return false;
  }
}

export function inferNotificationSound(type?: string): NotificationSoundType {
  const normalized = String(type || "").toLowerCase();
  if (normalized.includes("deposit") || normalized.includes("withdrawal") || normalized.includes("wallet")) return "success";
  if (normalized.includes("reward") || normalized.includes("achievement") || normalized.includes("commission")) return "reward";
  if (normalized.includes("failed") || normalized.includes("rejected") || normalized.includes("warning")) return "warning";
  return "default";
}
