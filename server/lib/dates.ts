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
