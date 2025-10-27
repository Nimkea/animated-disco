/**
 * Safe number formatter that handles NaN and undefined values
 * @param n - Number or string to format
 * @param opts - Intl.NumberFormat options
 * @returns Formatted number string, defaults to "0" for invalid inputs
 */
export const nf = (n: number | string, opts?: Intl.NumberFormatOptions): string => {
  const num = typeof n === "string" ? Number(n.replace(/[^0-9.-]/g, "")) : Number(n);
  const safe = Number.isFinite(num) ? num : 0;
  return new Intl.NumberFormat(undefined, opts).format(safe);
};
