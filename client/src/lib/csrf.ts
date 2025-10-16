export async function ensureCsrf(): Promise<string> {
  const w = window as any;
  if (w.CSRF_TOKEN) return w.CSRF_TOKEN;

  const res = await fetch('/auth/csrf', { credentials: 'include', cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch CSRF token');

  const { csrfToken } = await res.json();
  w.CSRF_TOKEN = csrfToken;
  return csrfToken;
}
