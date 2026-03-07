import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { User } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Trash2, 
  Lock, 
  ArrowLeft, 
  QrCode, 
  ExternalLink, 
  Users,
  Activity,
  Settings,
  Building2,
  Menu
} from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { cn } from "@/lib/utils";

// Schema for password reset
const passwordResetSchema = z.object({
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password must be less than 100 characters"),
  confirmPassword: z.string()
    .min(8, "Password must be at least 8 characters"),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type PasswordResetFormData = z.infer<typeof passwordResetSchema>;

export default function UserDetailPage() {
  const { userId } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  
  // Define sidebar items
  const sidebarItems = [
    { id: "analytics", label: "Analytics", icon: <Activity className="h-4 w-4" /> },
    { id: "users", label: "Users", icon: <Users className="h-4 w-4" /> },
    { id: "team", label: "Team", icon: <Building2 className="h-4 w-4" /> },
    { id: "system", label: "System", icon: <Settings className="h-4 w-4" /> },
  ];

  // Fetch user details with all related data
  const { data: userData, isLoading: isLoadingUser } = useQuery({
    queryKey: ['/api/admin/user', userId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/user/${userId}`);
      if (!res.ok) throw new Error('Failed to fetch user details');
      return res.json();
    },
  });
  
  // Extract data from the user details response
  const user = userData?.user;
  const activityData = userData?.activity;
  const isLoadingActivity = isLoadingUser;

  // Fetch team members for account manager dropdown
  const { data: teamData } = useQuery({
    queryKey: ['/api/admin/team'],
    queryFn: async () => {
      const res = await fetch('/api/admin/team');
      if (!res.ok) throw new Error('Failed to fetch team members');
      return res.json();
    }
  });

  // Form for password reset
  const passwordResetForm = useForm<PasswordResetFormData>({
    resolver: zodResolver(passwordResetSchema),
    defaultValues: {
      password: "",
      confirmPassword: ""
    }
  });

  // Reset password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async (data: { password: string }) => {
      const res = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to reset password');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Password Reset",
        description: "Password has been successfully reset.",
      });
      setIsResetPasswordOpen(false);
      passwordResetForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete user');
    },
    onSuccess: () => {
      toast({
        title: "User Deleted",
        description: "User has been successfully deleted.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      navigate('/admin/dashboard');
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Update account manager mutation
  const updateAccountManagerMutation = useMutation({
    mutationFn: async (accountManagerId: number | null) => {
      const res = await fetch(`/api/admin/users/${userId}/account-manager`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountManagerId })
      });
      if (!res.ok) throw new Error('Failed to update account manager');
    },
    onSuccess: () => {
      toast({
        title: "Account manager updated",
        description: "The account manager has been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users', userId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Resend verification email mutation
  const resendVerificationMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/users/${userId}/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to resend verification email');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Verification Email Sent",
        description: "The verification email has been successfully sent.",
      });
      // In development, show the verification link
      if (data.link) {
        console.log('Verification link (for development):', data.link);
      }
      // Refresh user data
      queryClient.invalidateQueries({ queryKey: ['/api/admin/user', userId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  if (isLoadingUser) {
    return (
      <div className="flex h-screen overflow-hidden">
        {/* Admin Sidebar */}
        <div className="bg-card border-r flex flex-col w-64">
          <div className="p-4 flex items-center justify-between border-b">
            <h2 className="font-semibold truncate">Admin Dashboard</h2>
            <div className="p-2 hover:bg-accent rounded-md">
              <Menu className="h-4 w-4" />
            </div>
          </div>
          <nav className="flex-1 p-2 space-y-1">
            {sidebarItems.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "w-full flex items-center space-x-2 px-3 py-2 rounded-md transition-colors",
                  item.id === "users"
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-accent"
                )}
              >
                {item.icon}
                <span>{item.label}</span>
              </div>
            ))}
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          <div className="container max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
            <Breadcrumb className="mb-6">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild><Link to="/admin/dashboard">Dashboard</Link></BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <Skeleton className="h-4 w-20" />
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            
            <div className="flex items-center gap-4 mb-6">
              <Skeleton className="h-8 w-40" />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen overflow-hidden">
        {/* Admin Sidebar */}
        <div className="bg-card border-r flex flex-col w-64">
          <div className="p-4 flex items-center justify-between border-b">
            <h2 className="font-semibold truncate">Admin Dashboard</h2>
            <div className="p-2 hover:bg-accent rounded-md">
              <Menu className="h-4 w-4" />
            </div>
          </div>
          <nav className="flex-1 p-2 space-y-1">
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                onClick={() => navigate(`/admin/dashboard`)}
                className={cn(
                  "w-full flex items-center space-x-2 px-3 py-2 rounded-md transition-colors",
                  item.id === "users"
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-accent"
                )}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          <div className="container max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
            <Breadcrumb className="mb-6">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild><Link to="/admin/dashboard">Dashboard</Link></BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink>User Not Found</BreadcrumbLink>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            
            <Card>
              <CardContent className="py-10">
                <div className="text-center">
                  <h2 className="text-xl font-semibold mb-2">User Not Found</h2>
                  <p className="text-muted-foreground mb-6">The requested user could not be found.</p>
                  <Button onClick={() => navigate('/admin/dashboard')}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Return to Dashboard
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Admin Sidebar */}
      <div
        className={cn(
          "bg-card border-r flex flex-col transition-all duration-300",
          sidebarCollapsed ? "w-16" : "w-64"
        )}
      >
        <div className="p-4 flex items-center justify-between border-b">
          <h2 className={cn("font-semibold truncate", sidebarCollapsed && "hidden")}>
            Admin Dashboard
          </h2>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 hover:bg-accent rounded-md"
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(`/admin/dashboard`)}
              className={cn(
                "w-full flex items-center space-x-2 px-3 py-2 rounded-md transition-colors",
                item.id === "users"
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-accent",
                sidebarCollapsed && "justify-center"
              )}
            >
              {item.icon}
              {!sidebarCollapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="container max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
          {/* Breadcrumb navigation */}
          <Breadcrumb className="mb-6">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild><Link to="/admin/dashboard">Dashboard</Link></BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink>User: {user.username}</BreadcrumbLink>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Title bar with actions */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{user.username}</h1>
                {user.username === 'yapral27' && (
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-primary/20 text-primary">
                    Super Admin
                  </span>
                )}
              </div>
              <p className="text-muted-foreground">{user.venueName}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate('/admin/dashboard')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Users
              </Button>
            </div>
          </div>

          {/* Main content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column - Basic info and actions */}
            <div className="space-y-6 lg:col-span-1">
              {/* Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="space-y-4">
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">Username</dt>
                      <dd className="text-sm">{user.username}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">Venue Name</dt>
                      <dd className="text-sm">{user.venueName}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">Guest URL</dt>
                      <dd className="text-sm font-mono flex items-center gap-2">
                        {user.guestUrl}
                        <a 
                          href={`/playlist/${user.guestUrl}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary hover:text-primary/80"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">QR Code</dt>
                      <dd className="text-sm">
                        <Button variant="outline" size="sm">
                          <QrCode className="h-4 w-4 mr-2" />
                          Show QR Code
                        </Button>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">Phone Number</dt>
                      <dd className="text-sm flex items-center gap-2">
                        {userData?.profile?.phoneNumber ? 
                          `+${userData.profile.countryCode || ''} ${userData.profile.phoneNumber}` : 
                          'Not provided'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">Email</dt>
                      <dd className="text-sm flex items-center gap-2">
                        {user.email || 'Not provided'}
                        {user.email && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${user.isEmailVerified ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                            {user.isEmailVerified ? 'Verified' : 'Not Verified'}
                          </span>
                        )}
                      </dd>
                      {user.email && !user.isEmailVerified && (
                        <div className="mt-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => resendVerificationMutation.mutate()}
                            disabled={resendVerificationMutation.isPending}
                          >
                            {resendVerificationMutation.isPending ? (
                              <>
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Processing...
                              </>
                            ) : (
                              'Resend Verification Email'
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">Account Manager</dt>
                      <dd className="text-sm">
                        <select
                          className="w-full border rounded px-2 py-1 bg-background text-foreground mt-1"
                          value={user.accountManagerId || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            updateAccountManagerMutation.mutate(value ? parseInt(value) : null);
                          }}
                          disabled={user.username === 'yapral27'}
                        >
                          <option value="">No Manager</option>
                          {teamData?.members?.map((member: any) => (
                            <option key={member.id} value={member.id}>
                              {member.name} - {member.role}
                            </option>
                          ))}
                        </select>
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>

              {/* Account Management */}
              <Card>
                <CardHeader>
                  <CardTitle>Account Management</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setIsResetPasswordOpen(true)}
                        disabled={user.username === 'yapral27'}
                      >
                        <Lock className="h-4 w-4 mr-2" />
                        Reset Password
                      </Button>
                      
                      {/* Password Reset Dialog */}
                      <Dialog open={isResetPasswordOpen} onOpenChange={setIsResetPasswordOpen}>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Reset Password</DialogTitle>
                            <DialogDescription>
                              Enter a new password for {user.username}.
                            </DialogDescription>
                          </DialogHeader>
                          
                          <Form {...passwordResetForm}>
                            <form onSubmit={passwordResetForm.handleSubmit((data) => {
                              resetPasswordMutation.mutate({ password: data.password });
                            })} className="space-y-4">
                              <FormField
                                control={passwordResetForm.control}
                                name="password"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>New Password</FormLabel>
                                    <FormControl>
                                      <Input type="password" placeholder="Enter new password" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              
                              <FormField
                                control={passwordResetForm.control}
                                name="confirmPassword"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Confirm Password</FormLabel>
                                    <FormControl>
                                      <Input type="password" placeholder="Confirm new password" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              
                              <DialogFooter>
                                <Button 
                                  type="button" 
                                  variant="outline" 
                                  onClick={() => setIsResetPasswordOpen(false)}
                                >
                                  Cancel
                                </Button>
                                <Button 
                                  type="submit" 
                                  disabled={resetPasswordMutation.isPending}
                                >
                                  {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
                                </Button>
                              </DialogFooter>
                            </form>
                          </Form>
                        </DialogContent>
                      </Dialog>
                    </div>
                    <div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="destructive" 
                            className="w-full"
                            disabled={user.username === 'yapral27'}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete User
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete User</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this user? This action cannot be undone and will permanently remove the user account and all associated data.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => deleteUserMutation.mutate()}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right column - Stats and activity */}
            <div className="space-y-6 lg:col-span-2">
              {/* Usage Statistics */}
              <Card>
                <CardHeader>
                  <CardTitle>Usage Statistics</CardTitle>
                  <CardDescription>
                    Overview of user activity and engagement
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingActivity ? (
                    <div className="space-y-4">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card className="border-dashed">
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <span className="text-3xl font-bold">
                              {activityData?.totalSongs || 0}
                            </span>
                            <p className="text-muted-foreground">Total Songs</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="border-dashed">
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <span className="text-3xl font-bold">
                              {activityData?.lastActive ? 
                                format(new Date(activityData.lastActive), 'MMM d, yyyy') : 'Never'}
                            </span>
                            <p className="text-muted-foreground">Last Active</p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Device Sessions */}
              <Card>
                <CardHeader>
                  <CardTitle>Device Sessions</CardTitle>
                  <CardDescription>
                    Active login sessions for this user
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {userData?.deviceSessions?.length > 0 ? (
                    <div className="space-y-4">
                      {userData.deviceSessions.map((session: any) => (
                        <div key={session.id} className="p-4 border rounded-md">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <span className="font-medium">{session.device.browser}</span>
                              {session.isActive && (
                                <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                                  Active
                                </span>
                              )}
                              {session.isCurrent && (
                                <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                                  Current
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(session.startTime), 'MMM d, yyyy HH:mm')}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">Device: </span>
                              {session.device.model} ({session.device.type})
                            </div>
                            <div>
                              <span className="text-muted-foreground">OS: </span>
                              {session.device.os}
                            </div>
                            <div>
                              <span className="text-muted-foreground">IP: </span>
                              {session.ipAddress}
                            </div>
                            <div>
                              <span className="text-muted-foreground">Location: </span>
                              {session.region ? `${session.region}, ${session.country || 'Unknown'}` : 'Unknown location'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">
                      No active sessions found
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Playlists */}
              <Card>
                <CardHeader>
                  <CardTitle>Playlists</CardTitle>
                  <CardDescription>
                    User created playlists
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <span className="text-3xl font-bold">{userData?.playlists || 0}</span>
                      <p className="text-muted-foreground">Total Playlists</p>
                    </div>
                    <Button variant="outline" size="sm" disabled>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View All
                    </Button>
                  </div>
                  <div className="border-t pt-4">
                    <p className="text-sm text-muted-foreground">
                      {userData?.playlists > 0 
                        ? "The user's playlists are stored in the system but aren't directly viewable here yet."
                        : "The user hasn't created any playlists yet."}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}