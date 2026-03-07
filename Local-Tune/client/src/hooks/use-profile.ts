import { useQuery, UseQueryResult } from "@tanstack/react-query";
import type { UserProfile } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";

export function useProfile() {
  const { user } = useAuth();

  return useQuery<UserProfile>({
    queryKey: [user?.username ? `/api/user/profile?username=${user.username}` : "/api/user/profile"],
    enabled: !!user?.username, // Only run query if user has username
    retry: (failureCount, error) => {
      // Don't retry on authentication errors
      if (error instanceof Error && (error.message === "Unauthorized" || (error as any).status === 401)) {
        return false;
      }
      return failureCount < 2;
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}