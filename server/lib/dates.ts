export function isSameLocalDay(
  a: Date | string | null | undefined,
  b: Date = new Date()
) {
  if (!a) return false;
  const date = new Date(a);
  return (
    date.getFullYear() === b.getFullYear() &&
    date.getMonth() === b.getMonth() &&
    date.getDate() === b.getDate()
  );
}

export function startOfUtcDay(date: Date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addUtcDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function getUtcDateKey(date: Date | string | null | undefined = new Date()) {
  const parsed = date ? new Date(date) : new Date();
  if (Number.isNaN(parsed.getTime())) return getUtcDateKey(new Date());
  return parsed.toISOString().slice(0, 10);
}

export function isSameUtcDay(
  a: Date | string | null | undefined,
  b: Date | string | null | undefined = new Date()
) {
  if (!a || !b) return false;
  return getUtcDateKey(a) === getUtcDateKey(b);
}

export function getNextUtcDayStart(date: Date = new Date()) {
  return addUtcDays(startOfUtcDay(date), 1);
}

export function getUtcMonthDateKeyRange(year: number, zeroBasedMonth: number) {
  const start = new Date(Date.UTC(year, zeroBasedMonth, 1));
  const end = new Date(Date.UTC(year, zeroBasedMonth + 1, 1));
  return {
    startKey: getUtcDateKey(start),
    endKey: getUtcDateKey(end),
  };
}
