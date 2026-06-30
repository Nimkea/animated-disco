import { prisma } from "../lib/db";

export type NotificationCategory =
  | "wallet"
  | "mining"
  | "staking"
  | "referral"
  | "achievement"
  | "task"
  | "admin_broadcast"
  | "system";

export type NotificationPreferencePayload = {
  pushEnabled?: boolean;
  inAppEnabled?: boolean;
  inAppSoundEnabled?: boolean;
  soundVolume?: number;
  soundType?: string;
  walletAlerts?: boolean;
  miningAlerts?: boolean;
  stakingAlerts?: boolean;
  referralAlerts?: boolean;
  achievementAlerts?: boolean;
  taskAlerts?: boolean;
  systemAlerts?: boolean;
  adminBroadcastAlerts?: boolean;
};

const SOUND_TYPES = new Set(["default", "success", "reward", "warning", "silent"]);

export const DEFAULT_NOTIFICATION_PREFERENCES = {
  pushEnabled: true,
  inAppEnabled: true,
  inAppSoundEnabled: true,
  soundVolume: 65,
  soundType: "default",
  walletAlerts: true,
  miningAlerts: true,
  stakingAlerts: true,
  referralAlerts: true,
  achievementAlerts: true,
  taskAlerts: true,
  systemAlerts: true,
  adminBroadcastAlerts: true,
};

function normalizeVolume(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_NOTIFICATION_PREFERENCES.soundVolume;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

export function normalizeNotificationPreferencePayload(payload: NotificationPreferencePayload) {
  const data: Record<string, boolean | number | string> = {};
  const booleanFields = [
    "pushEnabled",
    "inAppEnabled",
    "inAppSoundEnabled",
    "walletAlerts",
    "miningAlerts",
    "stakingAlerts",
    "referralAlerts",
    "achievementAlerts",
    "taskAlerts",
    "systemAlerts",
    "adminBroadcastAlerts",
  ] as const;

  for (const field of booleanFields) {
    if (typeof payload[field] === "boolean") data[field] = payload[field] as boolean;
  }

  if (payload.soundVolume !== undefined) data.soundVolume = normalizeVolume(payload.soundVolume);
  if (typeof payload.soundType === "string" && SOUND_TYPES.has(payload.soundType)) {
    data.soundType = payload.soundType;
  }

  return data;
}

export function getNotificationCategory(type?: string | null): NotificationCategory {
  const normalized = String(type || "").toLowerCase();
  if (normalized.includes("deposit") || normalized.includes("withdrawal") || normalized.includes("wallet")) return "wallet";
  if (normalized.includes("mining")) return "mining";
  if (normalized.includes("staking") || normalized.includes("stake")) return "staking";
  if (normalized.includes("referral") || normalized.includes("commission")) return "referral";
  if (normalized.includes("achievement")) return "achievement";
  if (normalized.includes("task")) return "task";
  if (normalized.includes("broadcast") || normalized.includes("announcement")) return "admin_broadcast";
  return "system";
}

function categoryField(category: NotificationCategory) {
  switch (category) {
    case "wallet":
      return "walletAlerts";
    case "mining":
      return "miningAlerts";
    case "staking":
      return "stakingAlerts";
    case "referral":
      return "referralAlerts";
    case "achievement":
      return "achievementAlerts";
    case "task":
      return "taskAlerts";
    case "admin_broadcast":
      return "adminBroadcastAlerts";
    case "system":
    default:
      return "systemAlerts";
  }
}

export async function getOrCreateNotificationPreference(userId: string) {
  return (prisma as any).notificationPreference.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      ...DEFAULT_NOTIFICATION_PREFERENCES,
    },
  });
}

export async function updateNotificationPreference(userId: string, payload: NotificationPreferencePayload) {
  const data = normalizeNotificationPreferencePayload(payload);
  return (prisma as any).notificationPreference.upsert({
    where: { userId },
    update: data,
    create: {
      userId,
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...data,
    },
  });
}

export async function shouldCreateInAppNotification(userId: string, type?: string | null) {
  const preference = await getOrCreateNotificationPreference(userId);
  const category = getNotificationCategory(type);
  const field = categoryField(category);
  return Boolean(preference.inAppEnabled && preference[field]);
}

export async function shouldSendPushNotification(userId: string, type?: string | null) {
  const preference = await getOrCreateNotificationPreference(userId);
  const category = getNotificationCategory(type);
  const field = categoryField(category);
  return Boolean(preference.pushEnabled && preference[field]);
}

export async function getNotificationPreferenceSummary(userId: string) {
  const preference = await getOrCreateNotificationPreference(userId);
  return {
    ...preference,
    categoryMap: {
      wallet: preference.walletAlerts,
      mining: preference.miningAlerts,
      staking: preference.stakingAlerts,
      referral: preference.referralAlerts,
      achievement: preference.achievementAlerts,
      task: preference.taskAlerts,
      system: preference.systemAlerts,
      admin_broadcast: preference.adminBroadcastAlerts,
    },
  };
}
