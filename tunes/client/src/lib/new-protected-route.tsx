/**
 * Protected Route Component - LocalQR Auth Model
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

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Redirect to="/auth" />;
  }

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

  const isSuperAdmin = user.username === 'yapral27';

  if (!requireAdmin && isSuperAdmin) {
    return <Redirect to="/admin/dashboard" />;
  }

  if (requireAdmin && !isSuperAdmin) {
    return <Redirect to="/dashboard" />;
  }

  return <Component />;
}

export default NewProtectedRoute;
