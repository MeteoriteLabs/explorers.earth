/**
 * Protected Route Component - explorers.earth Auth Model
 * Handles route protection with Zustand auth state
 */

import { useAuthStore } from '@/stores/authStore';
import { Loader2 } from 'lucide-react';
import { Redirect } from 'wouter';
import { useEffect, useState } from 'react';

interface ProtectedRouteProps {
  path: string;
  component: React.ComponentType;
  requireAdmin?: boolean;
}

export function NewProtectedRoute({
  component: Component,
  requireAdmin = false,
}: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);

  // Check if user data is loaded from localStorage
  useEffect(() => {
    // Give a brief moment for the store to hydrate from localStorage
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated || !user) {
    return <Redirect to="/auth" />;
  }

  // Check if user is blocked
  if (user.blocked) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-destructive">Account Blocked</h1>
          <p className="text-muted-foreground">
            Your account has been blocked. Please contact support for assistance.
          </p>
        </div>
      </div>
    );
  }

  // Check if user is super admin (if needed)
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

export default NewProtectedRoute;
