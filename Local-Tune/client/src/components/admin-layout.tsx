import React from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Settings, Users, BarChart2, ChevronRight, Home, Globe } from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
  isSuperAdmin?: boolean; // Optional prop for super admin status
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children, title, isSuperAdmin }) => {
  const [location] = useLocation();
  const { user, isLoading } = useAuth();

  // If isSuperAdmin prop is not provided, check based on username
  const isUserSuperAdmin = isSuperAdmin !== undefined ? isSuperAdmin : user?.username === 'yapral27';

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center space-x-4 mb-6">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-[250px]" />
            <Skeleton className="h-4 w-[200px]" />
          </div>
        </div>
        {/* Skeleton for the main content */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Skeleton className="h-[calc(100vh-200px)] w-full" />
          <div className="md:col-span-3 space-y-6">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-[calc(100vh-300px)] w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!isUserSuperAdmin) {
    return (
      <div className="container mx-auto py-8">
        <div className="bg-red-50 p-6 rounded-lg border border-red-200">
          <h2 className="text-2xl font-semibold text-red-800 mb-2">Access Denied</h2>
          <p className="text-red-700 mb-4">
            You don't have permission to access this area. This section is restricted to super administrators only.
          </p>
          <Link to="/dashboard">
            <a className="inline-flex items-center text-red-800 hover:text-red-900 underline">
              Return to dashboard <ChevronRight className="h-4 w-4 ml-1" />
            </a>
          </Link>
        </div>
      </div>
    );
  }

  const isActive = (path: string) => {
    return location === path;
  };

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">{title}</h1>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">
              Logged in as <span className="font-semibold">{user?.username}</span>
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-2 mt-2">
          <Link href="/dashboard">
            <a className="text-sm text-muted-foreground hover:text-primary">Dashboard</a>
          </Link>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          <span className="text-sm">Admin</span>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          <span className="text-sm font-medium">{title}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="bg-card rounded-lg border p-4">
          <nav className="space-y-2">
            <h3 className="font-medium text-sm mb-4 text-muted-foreground uppercase tracking-wider">
              Admin Navigation
            </h3>
            <Link href="/admin/dashboard">
              <a className={`flex items-center space-x-3 px-3 py-2 rounded-md ${isActive('/admin/dashboard') ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}>
                <BarChart2 className="h-5 w-5" />
                <span>Dashboard</span>
              </a>
            </Link>
            <Link href="/admin/seo">
              <a className={`flex items-center space-x-3 px-3 py-2 rounded-md ${isActive('/admin/seo') ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}>
                <Globe className="h-5 w-5" />
                <span>SEO Settings</span>
              </a>
            </Link>
            <div className="pt-4 mt-4 border-t">
              <Link href="/dashboard">
                <a className="flex items-center space-x-3 px-3 py-2 rounded-md hover:bg-muted">
                  <Home className="h-5 w-5" />
                  <span>Back to App</span>
                </a>
              </Link>
            </div>
          </nav>
        </div>

        {/* Main content */}
        <div className="md:col-span-3">
          {children}
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;