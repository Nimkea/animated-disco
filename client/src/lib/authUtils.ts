// Referenced from Replit Auth blueprint
// Enhanced with robust status/code checking instead of fragile regex

export type ApiError = Error & {
  status?: number;
  code?: string;
};

export function isUnauthorizedError(error: unknown): boolean {
  const e = error as ApiError;
  
  // Check status code first (most reliable)
  if (typeof e?.status === 'number') {
    return e.status === 401;
  }
  
  // Check error code if available
  if (typeof e?.code === 'string') {
    return e.code === 'UNAUTHORIZED';
  }
  
  // Fallback to permissive message check (for backwards compatibility)
  const msg = (e?.message || '').toLowerCase();
  return msg.includes('401') || msg.includes('unauthorized');
}

// Helper function to handle unauthorized errors consistently
export function handleUnauthorized(toast: (options: any) => void) {
  toast({
    title: "Unauthorized",
    description: "You are logged out. Logging in again...",
    variant: "destructive",
  });
  
  // Give the toast a tick to render before redirect
  setTimeout(() => {
    window.location.href = "/api/login";
  }, 500);
}
