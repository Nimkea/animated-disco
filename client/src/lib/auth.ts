export async function requireSession(): Promise<void> {
  const r = await fetch('/auth/me', { credentials: 'include', cache: 'no-store' });
  if (r.status === 401) {
    throw new Error('Please log in inside this browser (wallet webview) and try again.');
  }
  if (!r.ok) {
    throw new Error('Unable to verify session. Please refresh the page.');
  }
}
