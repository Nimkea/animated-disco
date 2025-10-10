import { useQuery } from "@tanstack/react-query";

export function useAuth() {
  const { data: user, isLoading } = useQuery({
    queryKey: ["/auth/me"],
    retry: false,
    queryFn: async () => {
      const res = await fetch("/auth/me", {
        credentials: "include",
      });
      
      if (res.status === 401) {
        return null;
      }
      
      if (!res.ok) {
        throw new Error("Failed to fetch user");
      }
      
      return res.json();
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}
