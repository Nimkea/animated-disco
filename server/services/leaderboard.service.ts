export function normalizeLeaderboardPeriodParam(period: unknown) {
  const value = typeof period === "string" ? period : "all-time";
  return ["daily", "weekly", "monthly", "all-time"].includes(value)
    ? value
    : "all-time";
}

export function getLeaderboardDateFilter(period: string): Date | null {
  const now = new Date();

  if (period === "daily") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  if (period === "weekly") {
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    return start;
  }

  if (period === "monthly") {
    const start = new Date(now);
    start.setDate(start.getDate() - 30);
    return start;
  }

  return null;
}

export function clampLeaderboardLimit(value: unknown, fallback = 50) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.floor(parsed), 1), 100);
}

export function toLeaderboardNumber(value: unknown): number {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  if (value === null || value === undefined) return 0;
  const parsed = Number(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}
