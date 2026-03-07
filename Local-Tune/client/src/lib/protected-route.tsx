import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect } from "wouter";

interface ProtectedRouteProps {
  path: string;
  component: React.ComponentType;
  requireAdmin?: boolean;
}

export function ProtectedRoute({
  component: Component,
  requireAdmin = false,
}: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();

  // Early loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return <Redirect to="/auth" />;
  }

  // Check if user is super admin
  const isSuperAdmin = user.username === 'yapral27';

  // Regular routes - redirect admin to admin dashboard
  if (!requireAdmin && isSuperAdmin) {
    return <Redirect to="/admin/dashboard" />;
  }

  // Admin routes - only allow super admin
  if (requireAdmin && !isSuperAdmin) {
    return <Redirect to="/dashboard" />;
  }

  // Render the protected component
  return <Component />;
}

// Ensure null is not returned by wrapping in Fragment
export default ProtectedRoute;