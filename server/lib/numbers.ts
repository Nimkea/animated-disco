export function decimalValueToNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const parsed = Number(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}
