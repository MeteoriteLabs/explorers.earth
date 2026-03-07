import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import WebsiteTab from "./tabs/WebsiteTab";
import EmailTab from "./tabs/EmailTab";
import GuestApisTab from "./tabs/GuestApisTab";
import EmailApisTab from "./tabs/EmailApisTab";
import SeoTab from "./tabs/SeoTab";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Users,
  Activity,
  Settings,
  Building2,
  BarChart3,
  Shield,
  Trash2,
  MoreVertical,
  UserPlus,
  Globe2,
  Music,
  Clock,
  Timer,
  CreditCard,
  Code,
  Calculator,
  Copy,
  Lock,
  BookOpen,
  Mail,
  Pencil,
  Eye,
  CheckCircle,
  AlertCircle,
  Percent,
  RefreshCw,
  Loader2,
  Database,
  ChevronRight,
  Menu,
  Save,
  Search,
  Send,
} from "lucide-react";
import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { WorldMap } from "@/components/world-map";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { TeamMember, ApiToken as BaseApiToken } from "@shared/schema";
import { 
  Alert,
  AlertTitle,
  AlertDescription
} from "@/components/ui/alert";

// Define a complete ApiToken interface instead of extending BaseApiToken to avoid type conflicts
interface ApiToken {
  id: number;
  name: string;
  userId: number;
  token: string;
  description: string | null;
  scopes: string[];
  isAppWide: boolean;
  expiresAt: Date | null;
  expiresInDays: number | null;
  createdAt: Date;
  lastUsedAt: Date | null;
  isActive: boolean;
  fullToken?: string; // Only present when creating a new token
}
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";


interface DailyStat {
  date: string;
  count: number;
  endpoint_type: string;
}

interface YoutubeStats {
  total: number;
  daily: DailyStat[];
  weeklyAvg: number;
  monthlyTotal: number;
}

interface AnalyticsData {
  total: number;
  active: number;
  totalPlaylists: number;
  avgSongsPerHost: number;
  youtubeStats: YoutubeStats;
  totalGuests?: number;
  totalSongRequests?: number;
  peakHours?: string;
  avgSessionDuration?: string;
  regionalStats?: { 
    [region: string]: { 
      hostCount: number;
      guestCount?: number;
      songRequestCount?: number;
    } 
  };
}

const teamMemberSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  role: z.string().min(1, "Role is required"),
  regions: z.array(z.string()).min(1, "At least one region is required"),
});

const apiTokenSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
  expiresIn: z.number().int().min(-1).refine(val => val === -1 || val >= 1, {
    message: "Expiration must be at least 1 day or -1 for unlimited"
  }),
  userId: z.number().int().optional(),
  isUnlimited: z.boolean().optional(),
});

type TeamMemberFormData = z.infer<typeof teamMemberSchema>;

const ROLES = ["Account Manager", "Team Lead", "Regional Manager", "Support Specialist"];
const REGIONS = ["North America", "Europe", "Asia", "South America", "Africa", "Australia"];

function AnalyticsTab() {
  const { data: analyticsData, isLoading } = useQuery<AnalyticsData>({
    queryKey: ['/api/admin/stats'],
    queryFn: async () => {
      const res = await fetch('/api/admin/stats');
      if (!res.ok) throw new Error('Failed to fetch analytics data');
      return res.json();
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin">
          <BarChart3 className="h-8 w-8 text-muted-foreground" />
        </div>
      </div>
    );
  }

  const youtubeStats = analyticsData?.youtubeStats || { 
    total: 0, 
    weeklyAvg: 0, 
    monthlyTotal: 0, 
    daily: [] 
  };

  return (
    <div className="space-y-6">
      {/* Host Analytics */}
      <Card>
        <CardHeader>
          <CardTitle>Host Analytics</CardTitle>
          <CardDescription>Performance metrics for venue hosts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Hosts</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analyticsData?.total || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Registered venues
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Hosts</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analyticsData?.active || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Active in last 30 days
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Playlists</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analyticsData?.totalPlaylists || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Created playlists
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg. Songs/Host</CardTitle>
                <Music className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analyticsData?.avgSongsPerHost || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Average songs per host
                </p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* YouTube API Usage */}
      <Card>
        <CardHeader>
          <CardTitle>YouTube API Usage</CardTitle>
          <CardDescription>
            Track API usage and quota consumption
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total API Calls</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {youtubeStats.total || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  API requests made
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Daily Usage</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {youtubeStats.daily?.[0]?.count || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Requests today
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Weekly Average</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {youtubeStats.weeklyAvg || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Average requests per week
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Monthly Total</CardTitle>
                <Calculator className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {youtubeStats.monthlyTotal || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Total requests this month
                </p>
              </CardContent>
            </Card>
          </div>

          {youtubeStats.daily && youtubeStats.daily.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold mb-4">Daily Usage Trends</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Requests</TableHead>
                    <TableHead>Endpoint Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {youtubeStats.daily.map((stat: DailyStat) => (
                    <TableRow key={`${stat.date}-${stat.endpoint_type}`}>
                      <TableCell>{format(new Date(stat.date), 'PP')}</TableCell>
                      <TableCell>{stat.count}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{stat.endpoint_type}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Guest Analytics */}
      <Card>
        <CardHeader>
          <CardTitle>Guest Engagement</CardTitle>
          <CardDescription>Guest interaction metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Guests</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analyticsData?.totalGuests || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Unique guest visits
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Song Requests</CardTitle>
                <Music className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analyticsData?.totalSongRequests || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Total song requests
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Peak Hours</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analyticsData?.peakHours || "9PM-11PM"}</div>
                <p className="text-xs text-muted-foreground">
                  Most active time period
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg. Session</CardTitle>
                <Timer className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analyticsData?.avgSessionDuration || "25m"}</div>
                <p className="text-xs text-muted-foreground">
                  Average guest session
                </p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Regional Distribution */}
      <WorldMap 
        regionalStats={analyticsData?.regionalStats || {}} 
        isLoading={isLoading} 
      />
    </div>
  );
}

function UsersTab() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  
  // Setup debouncing for search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500); // 500ms delay
    
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data: teamData } = useQuery({
    queryKey: ['/api/admin/team'],
    queryFn: async () => {
      const res = await fetch('/api/admin/team');
      if (!res.ok) throw new Error('Failed to fetch team members');
      return res.json();
    }
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['/api/admin/users', page, limit, debouncedSearchTerm],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users?page=${page}&limit=${limit}${debouncedSearchTerm ? `&search=${encodeURIComponent(debouncedSearchTerm)}` : ''}`);
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete user');
    },
    onSuccess: () => {
      toast({
        title: "User deleted",
        description: "The user has been successfully deleted.",
      });
      refetch();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const updateAccountManagerMutation = useMutation({
    mutationFn: async ({ userId, accountManagerId }: { userId: number; accountManagerId: number | null }) => {
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
      refetch();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // No longer need modal state as we use the user detail page

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin">
          <Users className="h-8 w-8 text-muted-foreground" />
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(data?.total / limit);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Users
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              Registered accounts
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Users
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.stats?.active || 0}</div>
            <p className="text-xs text-muted-foreground">
              Active in last 30 days
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>
            View and manage registered users
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="flex items-center gap-2">
              <div className="relative max-w-sm">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search users..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 w-full"
                />
              </div>
              {/* Search button removed as we now search automatically with debounce */}
              {searchTerm && (
                <Button 
                  variant="ghost" 
                  onClick={() => {
                    setSearchTerm("");
                    setDebouncedSearchTerm("");
                    setPage(1);
                    refetch();
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Venue Name</TableHead>
                <TableHead>Guest URL</TableHead>
                <TableHead>Account Manager</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.users?.map((user: any) => (
                <TableRow
                  key={user.id}
                  className="hover:bg-muted/50"
                >
                  <TableCell
                    className="cursor-pointer hover:underline"
                  >
                    <div className="flex items-center gap-2">
                      <Link to={`/admin/users/${user.id}`}>
                        {user.username}
                      </Link>
                      {user.username === 'yapral27' && (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-primary/20 text-primary">
                          Super Admin
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{user.venueName}</TableCell>
                  <TableCell className="font-mono text-sm">
                    <a
                      href={`/playlist/${user.guestUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {user.guestUrl}
                    </a>
                  </TableCell>
                  <TableCell>
                    <select
                      className="w-full border rounded px-2 py-1 bg-background text-foreground"
                      value={user.accountManagerId || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        updateAccountManagerMutation.mutate({
                          userId: user.id,
                          accountManagerId: value ? parseInt(value) : null
                        });
                      }}
                      onClick={(e) => e.stopPropagation()}
                      disabled={user.username === 'yapral27'}
                    >
                      <option value="">No Manager</option>
                      {teamData?.members?.map((member: any) => (
                        <option key={member.id} value={member.id}>
                          {member.name} - {member.role}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-destructive"
                          disabled={user.username === 'yapral27'}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm('Are you sure you want to delete this user?')) {
                              deleteMutation.mutate(user.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete User
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* User details are now shown on a dedicated page */}

          <div className="flex items-center justify-between space-x-2 py-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// UserDetailsDialog has been replaced by the dedicated user-detail-page component

function TeamTab() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMemberFormData | null>(null);

  const { data: teamData, isLoading: isTeamLoading, refetch: refetchTeam } = useQuery({
    queryKey: ['/api/admin/team'],
    queryFn: async () => {
      const res = await fetch('/api/admin/team');
      if (!res.ok) throw new Error('Failed to fetch team members');
      return res.json();
    }
  });

  const addTeamMemberMutation = useMutation({
    mutationFn: async (data: TeamMemberFormData) => {
      const res = await fetch('/api/admin/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to add team member');
    },
    onSuccess: () => {
      toast({
        title: "Team member added",
        description: "New team member has been added successfully.",
      });
      setDialogOpen(false);
      refetchTeam();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const updateTeamMemberMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: TeamMemberFormData }) => {
      const res = await fetch(`/api/admin/team/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to update team member');
    },
    onSuccess: () => {
      toast({
        title: "Team member updated",
        description: "Team member has been updated successfully.",
      });
      setDialogOpen(false);
      setEditingMember(null);
      refetchTeam();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const deleteTeamMemberMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/team/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete team member');
    },
    onSuccess: () => {
      toast({
        title: "Team member deleted",
        description: "Team member has been removed successfully.",
      });
      refetchTeam();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (data: TeamMemberFormData) => {
    if (editingMember) {
      updateTeamMemberMutation.mutate({
        id: (editingMember as any).id,
        data
      });
    } else {
      addTeamMemberMutation.mutate(data);
    }
  };

  if (isTeamLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin">
          <Users className="h-8 w-8 text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Team Management</CardTitle>
          <CardDescription>
            Manage team members and their responsibilities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <Button
              onClick={() => {
                setEditingMember(null);
                setDialogOpen(true);
              }}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Add Team Member
            </Button>
          </div>

          <TeamMemberDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            initialData={editingMember || undefined}
            onSubmit={handleSubmit}
          />

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Regions</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamData?.members?.map((member: any) => (
                <TableRow key={member.id}>
                  <TableCell>{member.name}</TableCell>
                  <TableCell>{member.role}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {member.regions.map((region: string) => (
                        <span
                                                    key={region}
                          className="px-2 py-1 bg-muted rounded-md text-xs flex items-center gap-1"
                        >
                          <Globe2 className="h-3 w-3" />
                          {region}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingMember(member);
                            setDialogOpen(true);
                          }}
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => {
                            if (window.confirm('Are you sure you want to remove this team member?')) {
                              deleteTeamMemberMutation.mutate(member.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// Define schema for the application URL form
const appUrlSettingsSchema = z.object({
  app_url: z.string().url("Please enter a valid URL").min(1, "URL is required"),
});

type AppUrlSettingsFormData = z.infer<typeof appUrlSettingsSchema>;

// Form component for managing application URL
function AppUrlSettingsForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: appUrlSetting, isLoading: isLoadingAppUrl } = useQuery({
    queryKey: ['/api/system-settings/app_url'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/system-settings/app_url');
        if (res.status === 404) {
          // Setting doesn't exist yet
          return { value: '' };
        }
        if (!res.ok) throw new Error('Failed to fetch application URL setting');
        return res.json();
      } catch (error) {
        console.error('Error fetching app URL:', error);
        return { value: '' };
      }
    }
  });
  
  const updateAppUrlMutation = useMutation({
    mutationFn: async (data: AppUrlSettingsFormData) => {
      // Use PUT endpoint for updating existing setting
      const res = await fetch('/api/admin/system-settings/app_url', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          value: data.app_url
        })
      });
      
      // Get the response data for better error details
      const responseData = await res.json();
      
      if (!res.ok) {
        const errorMessage = responseData?.message || `Failed to update application URL (HTTP ${res.status})`;
        console.error("API Error:", { 
          status: res.status, 
          statusText: res.statusText,
          data: responseData
        });
        throw new Error(errorMessage);
      }
      
      return responseData;
    },
    onSuccess: () => {
      toast({
        title: "URL updated",
        description: "Application URL has been updated successfully. Email verification links will now use this URL.",
      });
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['/api/system-settings/app_url'] });
    },
    onError: (error: Error) => {
      console.error("Mutation error:", error);
      toast({
        title: "Error updating URL",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  const form = useForm<AppUrlSettingsFormData>({
    resolver: zodResolver(appUrlSettingsSchema),
    defaultValues: {
      app_url: '',
    },
  });
  
  // Update form when data is loaded
  useEffect(() => {
    if (appUrlSetting?.value) {
      form.setValue('app_url', appUrlSetting.value);
    }
  }, [appUrlSetting, form]);
  
  function onSubmit(data: AppUrlSettingsFormData) {
    updateAppUrlMutation.mutate(data);
  }
  
  if (isLoadingAppUrl) {
    return (
      <div className="flex items-center space-x-2">
        <Loader2 className="animate-spin h-4 w-4" />
        <span>Loading URL configuration...</span>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted-foreground mb-4">
          Set the application's base URL that will be used for email verification links and other external references. 
          This should include the protocol (https://) and domain without trailing slash.
        </p>
        <div className="p-3 rounded-md border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-950/20 mb-4">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            <strong>Important:</strong> This URL is critical for email verification. Users will receive verification links 
            containing this URL. If deployed to a different domain, make sure to update this setting.
          </p>
        </div>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="app_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Application URL</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="https://example.com" 
                      {...field} 
                      className="font-mono"
                    />
                  </FormControl>
                  <FormDescription>
                    Example: https://myapp.example.com
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex items-center space-x-4">
              <Button 
                type="submit" 
                disabled={updateAppUrlMutation.isPending || !form.formState.isDirty}
              >
                {updateAppUrlMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save URL
              </Button>
              
              {appUrlSetting?.value && (
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(appUrlSetting.value);
                    toast({
                      title: "URL copied",
                      description: "Application URL has been copied to your clipboard.",
                    });
                  }}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy URL
                </Button>
              )}
            </div>
          </form>
        </Form>
      </div>
      
      <Separator />
      
      <div>
        <h3 className="text-md font-medium mb-2">Current Environment</h3>
        <div className="p-4 rounded-md border bg-muted/40">
          <p className="text-sm mb-1"><span className="font-semibold">Current URL:</span> {appUrlSetting?.value || 'Not set'}</p>
          <p className="text-sm mb-1"><span className="font-semibold">Environment:</span> {process.env.NODE_ENV || 'development'}</p>
          <p className="text-sm text-muted-foreground mt-2">
            Note: Changes to this URL will affect all email verification links and other external references.
          </p>
        </div>
      </div>
    </div>
  );
}

function SystemTab() {
  const { data: systemData, isLoading } = useQuery({
    queryKey: ['/api/admin/system'],
    queryFn: async () => {
      const res = await fetch('/api/admin/system');
      if (!res.ok) throw new Error('Failed to fetch system metrics');
      return res.json();
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin">
          <Settings className="h-8 w-8 text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>System Health</CardTitle>
          <CardDescription>
            Monitor system performance and health metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Server Uptime</CardTitle>
                <Timer className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{systemData?.uptime || "00:00:00"}</div>
                <p className="text-xs text-muted-foreground">
                  Since last restart
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Response Time</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{systemData?.avgResponseTime || "0"}ms</div>
                <p className="text-xs text-muted-foreground">
                  Average response time
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{systemData?.memoryUsage || "0"}%</div>
                <p className="text-xs text-muted-foreground">
                  System memory utilization
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">CPU Load</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{systemData?.cpuLoad || "0"}%</div>
                <p className="text-xs text-muted-foreground">
                  Average CPU utilization
                </p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Database Health</CardTitle>
          <CardDescription>Database performance metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Connections</CardTitle>
                <Users className="h-4 w-4 textmuted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{systemData?.dbConnections || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Current database connections
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Query Time</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{systemData?.avgQueryTime || "0"}ms</div>
                <p className="text-xs text-muted-foreground">
                  Average query execution time
                </p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Error Tracking</CardTitle>
          <CardDescription>Monitor system errors and warnings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium">Error Rate (24h)</h3>
                <p className="text-xs text-muted-foreground">Errors per minute</p>
              </div>
              <div className="text-2xl font-bold">{systemData?.errorRate || "0.00"}</div>
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Recent Errors</h4>
              <div className="rounded-md border">
                {(systemData?.recentErrors || []).map((error: any, index: number) => (
                  <div
                    key={index}
                    className={cn(
                      "flex items-center justify-between p-4",
                      index !== 0 && "border-t"
                    )}
                  >
                    <div>
                      <p className="text-sm font-medium">{error.message}</p>
                      <p className="text-xs text-muted-foreground">{error.timestamp}</p>
                    </div>
                    <Badge variant={error.severity === 'high' ? 'destructive' : 'secondary'}>
                      {error.severity}
                    </Badge>
                  </div>
                ))}
                {(!systemData?.recentErrors || systemData.recentErrors.length === 0) && (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No recent errors
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System Controls</CardTitle>
          <CardDescription>Manage system settings and configurations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between space-x-2">
              <div>
                <Label>Rate Limiting</Label>
                <p className="text-sm text-muted-foreground">
                  Maximum requests per minute per IP
                </p>
              </div>
              <Input
                type="number"
                className="w-24"
                value={systemData?.rateLimit || 60}
                onChange={() => {}}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between space-x-2">
              <div>
                <Label>Debug Mode</Label>
                <p className="text-sm text-muted-foreground">
                  Enable detailed error logging
                </p>
              </div>
              <Switch
                checked={systemData?.debugMode || false}
                onCheckedChange={() => {}}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between space-x-2">
              <div>
                <Label>Maintenance Mode</Label>
                <p className="text-sm text-muted-foreground">
                  Temporarily disable non-admin access
                </p>
              </div>
              <Switch
                checked={systemData?.maintenanceMode || false}
                onCheckedChange={() => {}}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Deployment Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle>Deployment Configuration</CardTitle>
          <CardDescription>Configure application URL and deployment settings</CardDescription>
        </CardHeader>
        <CardContent>
          <AppUrlSettingsForm />
        </CardContent>
      </Card>
    </div>
  );
}

function TeamMemberDialog({
  open,
  onOpenChange,
  initialData,
  onSubmit
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: { name: string; role: string; regions: string[] };
  onSubmit: (data: TeamMemberFormData) => void;
}) {
  const form = useForm<TeamMemberFormData>({
    resolver: zodResolver(teamMemberSchema),
    defaultValues: initialData || {
      name: "",
      role: "",
      regions: [],
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initialData ? "Edit Team Member" : "Add Team Member"}</DialogTitle>
          <DialogDescription>
            {initialData ? "Update team member details" : "Add a new team member to the system"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="regions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Regions</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      const currentRegions = field.value || [];
                      if (currentRegions.includes(value)) {
                        field.onChange(currentRegions.filter((r) => r !== value));
                      } else {
                        field.onChange([...currentRegions, value]);
                      }
                    }}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select regions" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {REGIONS.map((region) => (
                        <SelectItem key={region} value={region}>
                          {region}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Selected regions: {field.value?.join(", ") || "None"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full">
              {initialData ? "Update Team Member" : "Add Team Member"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

type ApiTokenFormData = z.infer<typeof apiTokenSchema>;

// Use the schema definitions from above

function ApiTokensTab() {
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  // Get all users for the dropdown
  const { data: userData } = useQuery({
    queryKey: ['/api/admin/users', 1, 100], // Get a large number of users for the dropdown
    queryFn: async () => {
      const res = await fetch(`/api/admin/users?page=1&limit=100`);
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    }
  });

  // Get all API tokens
  const { data: tokens, isLoading, refetch } = useQuery<ApiToken[]>({
    queryKey: ['/api/admin/tokens'],
    queryFn: async () => {
      const res = await fetch('/api/admin/tokens');
      if (!res.ok) throw new Error('Failed to fetch API tokens');
      return res.json();
    }
  });

  // Create a new token
  const [newToken, setNewToken] = useState<string | null>(null);
  const [showTokenDialog, setShowTokenDialog] = useState(false);
  
  const createTokenMutation = useMutation({
    mutationFn: async (data: ApiTokenFormData) => {
      const res = await fetch('/api/admin/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to create token');
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Token created",
        description: "Your API token has been created successfully.",
      });
      
      // Save the full token and show the dialog to copy it
      if (data.fullToken) {
        setNewToken(data.fullToken);
        setShowTokenDialog(true);
      }
      
      setIsCreating(false);
      refetch();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Deactivate a token
  const deactivateTokenMutation = useMutation({
    mutationFn: async (tokenId: number) => {
      const res = await fetch(`/api/admin/tokens/${tokenId}/deactivate`, {
        method: 'PATCH'
      });
      if (!res.ok) throw new Error('Failed to deactivate token');
    },
    onSuccess: () => {
      toast({
        title: "Token deactivated",
        description: "The API token has been successfully deactivated.",
      });
      refetch();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Delete a token
  const deleteTokenMutation = useMutation({
    mutationFn: async (tokenId: number) => {
      const res = await fetch(`/api/admin/tokens/${tokenId}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete token');
    },
    onSuccess: () => {
      toast({
        title: "Token deleted",
        description: "The API token has been successfully deleted.",
      });
      refetch();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const form = useForm<ApiTokenFormData>({
    resolver: zodResolver(apiTokenSchema),
    defaultValues: {
      name: "",
      description: "",
      expiresIn: 30,
      userId: undefined,
      isUnlimited: false,
    },
  });

  const handleSubmit = (data: ApiTokenFormData) => {
    // If user selected, add the user ID to the data
    if (selectedUserId) {
      data.userId = selectedUserId;
    }
    
    // Handle unlimited expiry
    if (data.isUnlimited) {
      data.expiresIn = -1;
    }
    
    createTokenMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin">
          <Lock className="h-8 w-8 text-muted-foreground" />
        </div>
      </div>
    );
  }

  const formattedDate = (date: string) => {
    return format(new Date(date), 'PPP p');
  };

  const getExpirationStatus = (createdAt: string, expiresAt: Date | null | undefined) => {
    // Handle unlimited tokens (no expiration date)
    if (!expiresAt) {
      return <Badge variant="outline">Never expires</Badge>;
    }
    
    const now = new Date();
    const expirationDate = new Date(expiresAt);
    
    if (now > expirationDate) {
      return <Badge variant="destructive">Expired</Badge>;
    }
    
    // Calculate days remaining
    const daysRemaining = Math.ceil((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysRemaining <= 7) {
      return <Badge variant="warning">Expires in {daysRemaining} days</Badge>;
    }
    
    return <Badge variant="outline">Active</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>API Tokens</CardTitle>
              <CardDescription>
                Manage API tokens for external application integrations
              </CardDescription>
            </div>
            <Button onClick={() => setIsCreating(true)}>
              <Lock className="mr-2 h-4 w-4" />
              Generate Token
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {tokens && tokens.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tokens.map((token) => (
                  <TableRow key={token.id}>
                    <TableCell className="font-medium">
                      <div>
                        <div>{token.name}</div>
                        {token.description && (
                          <div className="text-sm text-muted-foreground">{token.description}</div>
                        )}
                        <div className="text-xs text-muted-foreground font-mono mt-1">
                          {token.token}
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-5 w-5 ml-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(token.token);
                              toast({
                                title: "Token copied",
                                description: "The masked API token has been copied to your clipboard.",
                              });
                            }}
                          >
                            <Copy className="h-3 w-3" />
                            <span className="sr-only">Copy token</span>
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{formattedDate(token.createdAt.toString())}</TableCell>
                    <TableCell>
                      {token.expiresAt ? formattedDate(token.expiresAt.toString()) : 'Never expires'}
                    </TableCell>
                    <TableCell>
                      {token.isActive ? (
                        getExpirationStatus(token.createdAt.toString(), token.expiresAt)
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {token.userId ? (
                        <Link to={`/admin/users/${token.userId}`} className="text-primary hover:underline">
                          User #{token.userId}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">Global</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {token.isActive && (
                            <DropdownMenuItem onClick={() => deactivateTokenMutation.mutate(token.id)}>
                              <Lock className="mr-2 h-4 w-4" />
                              <span>Deactivate</span>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => deleteTokenMutation.mutate(token.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            <span>Delete</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <Lock className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No API Tokens</h3>
              <p className="text-muted-foreground mb-4">
                Create API tokens to allow external applications to access your API
              </p>
              <Button onClick={() => setIsCreating(true)}>Generate Token</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Token creation form */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create API Token</DialogTitle>
            <DialogDescription>
              Generate a new API token for external application access.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Token Name</FormLabel>
                    <FormControl>
                      <Input placeholder="My Application" {...field} />
                    </FormControl>
                    <FormDescription>
                      A descriptive name for this token.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Used for..." {...field} />
                    </FormControl>
                    <FormDescription>
                      What this token will be used for.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Hidden field for isUnlimited */}
              <FormField
                control={form.control}
                name="isUnlimited"
                render={({ field }) => (
                  <input 
                    type="hidden" 
                    name={field.name}
                    value={field.value ? "true" : "false"}
                    ref={field.ref}
                  />
                )}
              />
              
              <FormField
                control={form.control}
                name="expiresIn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiration (days)</FormLabel>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="unlimitedExpiry" 
                          checked={field.value === -1} 
                          onCheckedChange={(checked) => {
                            if (checked) {
                              field.onChange(-1);
                              form.setValue('isUnlimited', true);
                            } else {
                              field.onChange(30); // Default to 30 days
                              form.setValue('isUnlimited', false);
                            }
                          }}
                        />
                        <label 
                          htmlFor="unlimitedExpiry" 
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          No expiration (unlimited)
                        </label>
                      </div>
                      {field.value !== -1 && (
                        <FormControl>
                          <Input 
                            type="number" 
                            min={1} 
                            {...field} 
                            onChange={e => field.onChange(parseInt(e.target.value))}
                            disabled={field.value === -1}
                          />
                        </FormControl>
                      )}
                    </div>
                    <FormDescription>
                      {field.value === -1 
                        ? "This token will never expire unless manually deactivated." 
                        : "Number of days before this token expires."}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div>
                <Label>User Assignment (Optional)</Label>
                <Select 
                  onValueChange={(value) => setSelectedUserId(value === "global" ? null : parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Global token (all users)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Global token (all users)</SelectItem>
                    {userData?.users?.map((user: any) => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.username} - {user.venueName || 'No venue name'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground mt-1">
                  If assigned to a user, the token will only have access to that user's data.
                </p>
              </div>
              <DialogFooter className="sm:justify-start">
                <Button
                  type="submit"
                  disabled={createTokenMutation.isPending}
                >
                  {createTokenMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Generate Token
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreating(false)}
                >
                  Cancel
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Token display dialog */}
      <Dialog open={showTokenDialog} onOpenChange={setShowTokenDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>API Token Created</DialogTitle>
            <DialogDescription>
              Your API token has been created successfully. Please copy it now as you won't be able to see it again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-md overflow-x-auto">
              <code className="text-sm break-all">{newToken}</code>
            </div>
            <p className="text-sm text-muted-foreground">
              Make sure to store this token securely. For security reasons, it cannot be retrieved again.
            </p>
          </div>
          <DialogFooter className="sm:justify-start mt-4">
            <Button
              onClick={() => {
                if (newToken) {
                  navigator.clipboard.writeText(newToken);
                  toast({
                    title: "Token copied",
                    description: "The API token has been copied to your clipboard.",
                  });
                }
              }}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy to Clipboard
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowTokenDialog(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* API Documentation */}
      <Card>
        <CardHeader>
          <CardTitle>API Documentation</CardTitle>
          <CardDescription>
            How to use the API tokens for integration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium mb-2">Authentication</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Include your API token in the Authorization header of your requests:
              </p>
              <pre className="bg-muted p-4 rounded-md overflow-x-auto">
                <code>Authorization: Bearer YOUR_API_TOKEN</code>
              </pre>
            </div>
            <div>
              <h3 className="font-medium mb-2">Endpoint Examples</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Method</TableHead>
                    <TableHead>Endpoint</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>GET</TableCell>
                    <TableCell>/api/playlists</TableCell>
                    <TableCell>Get all playlists for the authorized user</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>POST</TableCell>
                    <TableCell>/api/playlists</TableCell>
                    <TableCell>Create a new playlist</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>GET</TableCell>
                    <TableCell>/api/playlists/:id</TableCell>
                    <TableCell>Get a specific playlist by ID</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>GET</TableCell>
                    <TableCell>/api/user</TableCell>
                    <TableCell>Get the current user's profile information</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            <Button variant="outline" className="w-full">
              View Full API Documentation
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [location] = useLocation();
  const queryParams = new URLSearchParams(location.split('?')[1] || '');
  const tabParam = queryParams.get('tab');
  const [selectedTab, setSelectedTab] = useState(tabParam || "analytics");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Check if user is authenticated
  if (!user) return null;

  // Main sidebar items
  const mainSidebarItems = [
    { id: "analytics", label: "Analytics", icon: <BarChart3 className="h-4 w-4" /> },
    { id: "users", label: "Users", icon: <Users className="h-4 w-4" /> },
    { id: "team", label: "Team", icon: <Shield className="h-4 w-4" /> },
    { id: "website", label: "Website", icon: <Globe2 className="h-4 w-4" /> },
    { id: "seo", label: "SEO", icon: <Globe2 className="h-4 w-4" /> },
    { id: "system", label: "System", icon: <Settings className="h-4 w-4" /> },
  ];
  
  // API related sidebar items grouped together
  const apiSidebarItems = [
    { id: "email", label: "Email", icon: <Mail className="h-4 w-4" /> },
    { id: "apitokens", label: "API Tokens", icon: <Lock className="h-4 w-4" /> },
    { id: "guestapis", label: "Guest APIs", icon: <Code className="h-4 w-4" /> },
    { id: "emailapis", label: "Email APIs", icon: <BookOpen className="h-4 w-4" /> },
  ];

  const renderContent = () => {
    switch (selectedTab) {
      case "analytics":
        return <AnalyticsTab />;
      case "users":
        return <UsersTab />;
      case "team":
        return <TeamTab />;
      case "website":
        return <WebsiteTab />;
      case "seo":
        return <SeoTab />;
      case "system":
        return <SystemTab />;
      case "apitokens":
        return <ApiTokensTab />;
      case "guestapis":
        return <GuestApisTab />;
      case "email":
        return <EmailTab />;
      case "emailapis":
        return <EmailApisTab />;
      default:
        return <AnalyticsTab />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
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
        </div>
        
        {/* Collapse button moved below header */}
        <div className="p-2 border-b">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full p-2 hover:bg-accent rounded-md flex items-center justify-center"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Menu className="h-4 w-4 mr-2" />
            {!sidebarCollapsed && <span className="text-sm">Toggle Sidebar</span>}
          </button>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {/* Main navigation items */}
          {mainSidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedTab(item.id)}
              className={cn(
                "w-full flex items-center space-x-2 px-3 py-2 rounded-md transition-colors",
                selectedTab === item.id
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-accent",
                sidebarCollapsed && "justify-center"
              )}
            >
              {item.icon}
              {!sidebarCollapsed && <span>{item.label}</span>}
            </button>
          ))}
          
          {/* API-related items in accordion */}
          {!sidebarCollapsed && (
            <Accordion type="single" collapsible className="mt-2">
              <AccordionItem value="apis" className="border-none">
                <AccordionTrigger className="px-3 py-2 hover:bg-accent rounded-md text-sm font-medium">
                  <div className="flex items-center space-x-2">
                    <Code className="h-4 w-4" />
                    <span>APIs</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-1 pb-0">
                  {apiSidebarItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setSelectedTab(item.id)}
                      className={cn(
                        "w-full flex items-center space-x-2 px-3 py-2 rounded-md transition-colors ml-2",
                        selectedTab === item.id
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-accent"
                      )}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </button>
                  ))}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
          
          {/* Display API items as regular buttons when sidebar is collapsed */}
          {sidebarCollapsed && apiSidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedTab(item.id)}
              className={cn(
                "w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-md transition-colors",
                selectedTab === item.id
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-accent"
              )}
            >
              {item.icon}
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="container max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                {[...mainSidebarItems, ...apiSidebarItems].find((item) => item.id === selectedTab)?.label || "Dashboard"}
              </h1>
              <p className="text-muted-foreground">
                Manage and monitor your platform
              </p>
            </div>
          </div>
          
          <div className="pb-6">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
}

