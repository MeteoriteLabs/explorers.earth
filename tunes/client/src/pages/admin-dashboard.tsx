import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import WebsiteTab from "./website-tab";
import TeamTab from "./tabs/TeamTab";
import SystemTab from "./tabs/SystemTab";
import ApiTokensTab from "./tabs/ApiTokensTab";
import { SeoSettings } from "@shared/schema";
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
import { 
  Alert,
  AlertTitle,
  AlertDescription
} from "@/components/ui/alert";

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

const emailTemplateSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  subject: z.string().min(2, "Subject must be at least 2 characters"),
  html_content: z.string().min(10, "HTML content must be at least 10 characters"),
  text_content: z.string().min(10, "Text content must be at least 10 characters"),
  description: z.string().optional(),
});

const emailVerificationSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

const testEmailSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  templateId: z.number().min(1, "Please select a template"),
  testData: z.string().default("{}").refine(
    (val) => {
      try {
        JSON.parse(val);
        return true;
      } catch (e) {
        return false;
      }
    },
    { message: "Please enter valid JSON data" }
  ),
});

type TestEmailFormData = z.infer<typeof testEmailSchema>;
type EmailTemplateFormData = z.infer<typeof emailTemplateSchema>;
type EmailVerificationFormData = z.infer<typeof emailVerificationSchema>;

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

function EmailTab() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("templates");
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [showVerifyDialog, setShowVerifyDialog] = useState(false);
  const [selectedLogId, setSelectedLogId] = useState<number | null>(null);
  const [logDetailsOpen, setLogDetailsOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  // Initialize form for email templates
  const templateForm = useForm<EmailTemplateFormData>({
    resolver: zodResolver(emailTemplateSchema),
    defaultValues: {
      name: "",
      subject: "",
      html_content: "",
      text_content: "",
      description: ""
    }
  });

  // Initialize form for email verification
  const verificationForm = useForm<EmailVerificationFormData>({
    resolver: zodResolver(emailVerificationSchema),
    defaultValues: {
      email: ""
    }
  });
  
  // Initialize form for test email
  const testEmailForm = useForm<TestEmailFormData>({
    resolver: zodResolver(testEmailSchema),
    defaultValues: {
      email: "",
      templateId: 1,
      testData: "{}"
    }
  });

  // Fetch email templates
  const { data: templates, isLoading: templatesLoading, refetch: refetchTemplates } = useQuery({
    queryKey: ['/api/admin/email/templates'],
    queryFn: async () => {
      const res = await fetch('/api/admin/email/templates');
      if (!res.ok) throw new Error('Failed to fetch email templates');
      return res.json();
    }
  });

  // Fetch email logs
  const { data: logs, isLoading: logsLoading, refetch: refetchLogs } = useQuery({
    queryKey: ['/api/admin/email/logs', page, limit],
    queryFn: async () => {
      const res = await fetch(`/api/admin/email/logs?page=${page}&limit=${limit}`);
      if (!res.ok) throw new Error('Failed to fetch email logs');
      return res.json();
    }
  });
  
  // Fetch specific log details when a log is selected
  const { data: selectedLog, isLoading: logDetailsLoading } = useQuery({
    queryKey: ['/api/admin/email/logs', selectedLogId],
    queryFn: async () => {
      if (!selectedLogId) return null;
      const res = await fetch(`/api/admin/email/logs/${selectedLogId}`);
      if (!res.ok) throw new Error('Failed to fetch log details');
      return res.json();
    },
    enabled: !!selectedLogId && logDetailsOpen
  });

  // Fetch email stats (for the dashboard)
  const { data: emailStats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/admin/email/stats'],
    queryFn: async () => {
      const res = await fetch('/api/admin/email/stats');
      if (!res.ok) throw new Error('Failed to fetch email statistics');
      return res.json();
    }
  });

  // Create email template
  const createTemplateMutation = useMutation({
    mutationFn: async (data: EmailTemplateFormData) => {
      const res = await fetch('/api/admin/email/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to create email template');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Template created",
        description: "The email template has been created successfully.",
      });
      setIsCreatingTemplate(false);
      templateForm.reset();
      refetchTemplates();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Update email template
  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: EmailTemplateFormData }) => {
      const res = await fetch(`/api/admin/email/templates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to update email template');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Template updated",
        description: "The email template has been updated successfully.",
      });
      setIsCreatingTemplate(false);
      setSelectedTemplateId(null);
      templateForm.reset();
      refetchTemplates();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Delete email template
  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/email/templates/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete email template');
    },
    onSuccess: () => {
      toast({
        title: "Template deleted",
        description: "The email template has been deleted successfully.",
      });
      refetchTemplates();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Verify email address
  const verifyEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await fetch('/api/admin/email/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to verify email address');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Verification sent",
        description: "A verification email has been sent to the address.",
      });
      setShowVerifyDialog(false);
      verificationForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Send test email
  const sendTestEmailMutation = useMutation({
    mutationFn: async (data: TestEmailFormData) => {
      const res = await fetch('/api/admin/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: data.email,
          templateId: data.templateId,
          testData: JSON.parse(data.testData)
        })
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to send test email');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Test email sent",
        description: "The test email has been sent successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Get email sending quota
  const { data: quotaData, isLoading: quotaLoading, refetch: refetchQuota } = useQuery({
    queryKey: ['/api/admin/email/quota'],
    queryFn: async () => {
      const res = await fetch('/api/admin/email/quota');
      if (!res.ok) throw new Error('Failed to fetch quota information');
      return res.json();
    }
  });

  const handleTemplateSubmit = (data: EmailTemplateFormData) => {
    if (selectedTemplateId) {
      updateTemplateMutation.mutate({ id: selectedTemplateId, data });
    } else {
      createTemplateMutation.mutate(data);
    }
  };

  const handleVerifyEmail = (data: EmailVerificationFormData) => {
    verifyEmailMutation.mutate(data.email);
  };

  const handleEditTemplate = (template: any) => {
    setSelectedTemplateId(template.id);
    templateForm.reset({
      name: template.name,
      subject: template.subject,
      html_content: template.html_content,
      text_content: template.text_content,
      description: template.description || ""
    });
    setIsCreatingTemplate(true);
  };

  const formattedDate = (date: string) => {
    return format(new Date(date), 'PPP p');
  };
  
  // Helper function to display status badges with appropriate colors
  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'sent':
        return <Badge variant="outline" className="bg-blue-50">Sent</Badge>;
      case 'delivered':
        return <Badge variant="outline" className="bg-green-50 text-green-600">Delivered</Badge>;
      case 'failed':
        return <Badge variant="outline" className="bg-red-50 text-red-600">Failed</Badge>;
      case 'bounced':
        return <Badge variant="outline" className="bg-orange-50 text-orange-600">Bounced</Badge>;
      case 'queued':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-600">Queued</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  // Handle test email submission
  const handleTestEmailSubmit = (data: TestEmailFormData) => {
    sendTestEmailMutation.mutate(data);
  };

  // Render test email tab content
  const renderTestEmailTab = () => {
    if (templatesLoading) {
      return (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin">
            <Mail className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle>Send Test Email</CardTitle>
          <CardDescription>
            Test your email templates with real data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...testEmailForm}>
            <form onSubmit={testEmailForm.handleSubmit(handleTestEmailSubmit)} className="space-y-6">
              <FormField
                control={testEmailForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recipient Email</FormLabel>
                    <FormControl>
                      <Input placeholder="test@example.com" {...field} />
                    </FormControl>
                    <FormDescription>
                      Email must be verified in SES if in sandbox mode
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={testEmailForm.control}
                name="templateId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Template</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      defaultValue={field.value.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a template" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {templates && templates.length > 0 ? (
                          templates.map((template: any) => (
                            <SelectItem key={template.id} value={template.id.toString()}>
                              {template.name}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="0" disabled>
                            No templates available
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Choose the template you want to test
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={testEmailForm.control}
                name="testData"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Test Data (JSON)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder='{"name": "John Doe", "verificationCode": "12345"}'
                        className="h-40 font-mono"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      JSON object with test variables to use in the template
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex justify-between items-center">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    testEmailForm.reset({
                      email: "",
                      templateId: 1,
                      testData: "{}"
                    });
                  }}
                >
                  Reset
                </Button>
                <Button 
                  type="submit"
                  disabled={sendTestEmailMutation.isPending}
                >
                  {sendTestEmailMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Send Test Email
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    );
  };

  // Render template tab content
  const renderTemplatesTab = () => {
    if (templatesLoading) {
      return (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin">
            <Mail className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>
      );
    }

    return (
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Email Templates</CardTitle>
              <CardDescription>
                Manage email templates for marketing and notifications
              </CardDescription>
            </div>
            <Button onClick={() => {
              setSelectedTemplateId(null);
              templateForm.reset({
                name: "",
                subject: "",
                html_content: "",
                text_content: "",
                description: ""
              });
              setIsCreatingTemplate(true);
            }}>
              <Mail className="mr-2 h-4 w-4" />
              Create Template
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {templates && templates.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template: any) => (
                  <TableRow key={template.id}>
                    <TableCell className="font-medium">
                      <div>
                        <div>{template.name}</div>
                        {template.description && (
                          <div className="text-sm text-muted-foreground">{template.description}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{template.subject}</TableCell>
                    <TableCell>{formattedDate(template.createdAt.toString())}</TableCell>
                    <TableCell>
                      {template.isActive ? (
                        <Badge variant="outline">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
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
                          <DropdownMenuItem onClick={() => handleEditTemplate(template)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            <span>Edit</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => deleteTemplateMutation.mutate(template.id)}
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
              <Mail className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Email Templates</h3>
              <p className="text-muted-foreground mb-4">
                Create email templates to send communications through your API
              </p>
              <Button onClick={() => setIsCreatingTemplate(true)}>Create Template</Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // Render logs tab content
  const renderLogsTab = () => {
    if (logsLoading) {
      return (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin">
            <Mail className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle>Email Logs</CardTitle>
          <CardDescription>
            Track emails sent through your platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          {logs && logs.logs && logs.logs.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.logs.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell>{log.recipient}</TableCell>
                      <TableCell>{log.templateName || 'Custom'}</TableCell>
                      <TableCell>{formattedDate(log.createdAt.toString())}</TableCell>
                      <TableCell>{getStatusBadge(log.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => {
                            setSelectedLogId(log.id);
                            setLogDetailsOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                          <span className="sr-only">View details</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {logs.total > limit && (
                <div className="flex items-center justify-center space-x-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {Math.ceil(logs.total / limit)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => (p * limit < logs.total ? p + 1 : p))}
                    disabled={page * limit >= logs.total}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <Mail className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Email Logs</h3>
              <p className="text-muted-foreground mb-4">
                Email logs will appear here once emails are sent through your API
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // Render stats tab content
  const renderStatsTab = () => {
    if (statsLoading || quotaLoading) {
      return (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin">
            <BarChart3 className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>
      );
    }

    const stats = emailStats || { total: 0, sent: 0, delivered: 0, failed: 0, daily: [] };
    const quota = quotaData || { max24HourSend: 0, sentLast24Hours: 0, maxSendRate: 0 };

    // Calculate quota usage percentage
    const quotaPercentage = quota.max24HourSend > 0 
      ? Math.round((quota.sentLast24Hours / quota.max24HourSend) * 100) 
      : 0;

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Email Statistics</CardTitle>
            <CardDescription>
              Metrics for your email service usage
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Emails</CardTitle>
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.total || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    Emails sent through platform
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Delivered</CardTitle>
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.delivered || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    Successfully delivered emails
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Failed</CardTitle>
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.failed || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    Failed email deliveries
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                  <Percent className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.total > 0 ? Math.round((stats.delivered / stats.total) * 100) : 0}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Delivery success rate
                  </p>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>AWS SES Quota</CardTitle>
                <CardDescription>
                  Amazon SES sending limits and usage
                </CardDescription>
              </div>
              <Button variant="outline" onClick={() => refetchQuota()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium">24-Hour Quota Usage</span>
                  <span className="text-sm font-medium">{quota.sentLast24Hours} / {quota.max24HourSend}</span>
                </div>
                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary" 
                    style={{ width: `${quotaPercentage}%` }}
                  ></div>
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {quotaPercentage}% of daily sending quota used
                </div>
              </div>

              <div className="grid gap-4 grid-cols-2">
                <Card>
                  <CardHeader className="py-2">
                    <CardTitle className="text-sm">Maximum Send Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{quota.maxSendRate || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      Emails per second
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="py-2">
                    <CardTitle className="text-sm">Email Verification</CardTitle>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between">
                    <p className="text-sm">Verify new recipient addresses</p>
                    <Button 
                      size="sm" 
                      variant="secondary"
                      onClick={() => setShowVerifyDialog(true)}
                    >
                      Verify
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // Tab navigation
  return (
    <div className="space-y-6">
      <Tabs defaultValue="templates" value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
          <TabsTrigger value="test">Test Email</TabsTrigger>
        </TabsList>
        <div className="mt-4">
          {activeTab === "templates" && renderTemplatesTab()}
          {activeTab === "logs" && renderLogsTab()}
          {activeTab === "stats" && renderStatsTab()}
          {activeTab === "test" && renderTestEmailTab()}
        </div>
      </Tabs>

      {/* Template Creation/Edit Dialog */}
      <Dialog open={isCreatingTemplate} onOpenChange={setIsCreatingTemplate}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedTemplateId ? "Edit Email Template" : "Create Email Template"}</DialogTitle>
            <DialogDescription>
              {selectedTemplateId 
                ? "Update this email template for your marketing and notification emails."
                : "Create a new email template for your marketing and notification emails."}
            </DialogDescription>
          </DialogHeader>
          <Form {...templateForm}>
            <form onSubmit={templateForm.handleSubmit(handleTemplateSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={templateForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Template Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Welcome Email" {...field} />
                      </FormControl>
                      <FormDescription>
                        Internal name for this template
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={templateForm.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Subject</FormLabel>
                      <FormControl>
                        <Input placeholder="Welcome to Our Platform" {...field} />
                      </FormControl>
                      <FormDescription>
                        Subject line for the email
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={templateForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Sent to new users upon registration" {...field} />
                    </FormControl>
                    <FormDescription>
                      Internal description of this template's purpose
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={templateForm.control}
                name="html_content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>HTML Content</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="<h1>Welcome!</h1><p>Thanks for joining us, {{name}}.</p>"
                        className="h-40 font-mono"
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      HTML content with optional variables like &#123;&#123;name&#125;&#125;, &#123;&#123;email&#125;&#125;, etc.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={templateForm.control}
                name="text_content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plain Text Content</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Welcome! Thanks for joining us, &#123;&#123;name&#125;&#125;."
                        className="h-40 font-mono"
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Plain text version for email clients that don't support HTML
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsCreatingTemplate(false);
                    setSelectedTemplateId(null);
                    templateForm.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  {selectedTemplateId ? "Update Template" : "Create Template"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Email Verification Dialog */}
      <Dialog open={showVerifyDialog} onOpenChange={setShowVerifyDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Verify Email Address</DialogTitle>
            <DialogDescription>
              Amazon SES requires verification of email addresses before sending emails to them.
              This is especially important when in sandbox mode.
            </DialogDescription>
          </DialogHeader>
          <Form {...verificationForm}>
            <form onSubmit={verificationForm.handleSubmit(handleVerifyEmail)} className="space-y-4">
              <FormField
                control={verificationForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input placeholder="user@example.com" {...field} />
                    </FormControl>
                    <FormDescription>
                      A verification link will be sent to this address
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowVerifyDialog(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  Send Verification
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Email Log Details Dialog */}
      {selectedLogId && (
        <Dialog 
          open={logDetailsOpen} 
          onOpenChange={(open) => {
            setLogDetailsOpen(open);
            if (!open) {
              setSelectedLogId(null);
            }
          }}
        >
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Email Log Details</DialogTitle>
              <DialogDescription>
                Detailed information about this email
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {logDetailsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : selectedLog ? (
                <div className="border rounded-md p-4 space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-sm font-medium">Recipient</p>
                      <p className="text-sm text-muted-foreground">{selectedLog.recipient}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Template</p>
                      <p className="text-sm text-muted-foreground">{selectedLog.templateName || 'Custom'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Status</p>
                      {getStatusBadge(selectedLog.status)}
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium">Subject</p>
                    <p className="text-sm">{selectedLog.subject || 'N/A'}</p>
                  </div>
                  {selectedLog.messageId && (
                    <div>
                      <p className="text-sm font-medium">Message ID</p>
                      <p className="text-sm font-mono text-xs text-muted-foreground">
                        {selectedLog.messageId}
                      </p>
                    </div>
                  )}
                  {selectedLog.errorMessage && (
                    <div>
                      <p className="text-sm font-medium text-destructive">Error Message</p>
                      <p className="text-sm text-destructive">{selectedLog.errorMessage}</p>
                    </div>
                  )}
                  <div className="pt-2">
                    <p className="text-sm font-medium">Request Timestamp</p>
                    <p className="text-sm text-muted-foreground">
                      {formattedDate(selectedLog.createdAt.toString())}
                    </p>
                  </div>
                  {selectedLog.updatedAt && selectedLog.updatedAt !== selectedLog.createdAt && (
                    <div>
                      <p className="text-sm font-medium">Last Updated</p>
                      <p className="text-sm text-muted-foreground">
                        {formattedDate(selectedLog.updatedAt.toString())}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">No log details available</p>
                </div>
              )}
              <DialogFooter>
                <Button 
                  onClick={() => {
                    setLogDetailsOpen(false);
                    setSelectedLogId(null);
                  }}
                >
                  Close
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function GuestApisTab() {
  const [selectedApi, setSelectedApi] = useState<string | null>(null);

  // Define proper types for API documentation
  type ApiParameter = {
    name: string;
    type: string;
    description: string;
  };

  type ApiEvent = {
    name: string;
    description: string;
  };

  type ApiEndpoint = {
    method: string;
    path: string;
    description: string;
    parameters: ApiParameter[];
    responseExample: string;
    requestExample?: string;
    events?: ApiEvent[];
    messageExample?: string;
  };

  type ApiCategory = {
    id: string;
    name: string;
    description: string;
    endpoints: ApiEndpoint[];
  };
  
  const guestApis: ApiCategory[] = [
    {
      id: "playlist",
      name: "Playlist APIs",
      description: "Endpoints for viewing and interacting with playlists",
      endpoints: [
        {
          method: "GET",
          path: "/api/playlist/:guestUrl",
          description: "Get playlist details with songs for guest view",
          parameters: [
            { name: "guestUrl", type: "string", description: "The unique guest URL identifier" }
          ],
          responseExample: `{
  "songs": [
    {
      "id": 123,
      "title": "Song Title",
      "artist": "Artist Name",
      "youtubeId": "dQw4w9WgXcQ",
      "thumbnailUrl": "https://example.com/thumbnail.jpg",
      "position": 1
    }
  ],
  "user": {
    "id": 456,
    "username": "venue_name",
    "venueType": "restaurant",
    "guestUrl": "unique-url-string",
    "allowSongRequests": true,
    "allowPlaylistSharing": true,
    "theme": { "primary": "#6E56CF", "radius": 0.5 }
  },
  "currentlyPlaying": {
    "id": 123,
    "title": "Currently Playing Song",
    "artist": "Artist Name",
    "youtubeId": "dQw4w9WgXcQ",
    "thumbnailUrl": "https://example.com/thumbnail.jpg"
  },
  "playedSongs": [],
  "allowGuestPlayOnDevice": true,
  "playlists": [...]
}`
        },
        {
          method: "POST",
          path: "/api/playlist/:guestUrl/request",
          description: "Submit a song request as a guest",
          parameters: [
            { name: "guestUrl", type: "string", description: "The unique guest URL identifier" },
            { name: "title", type: "string", description: "Song title" },
            { name: "artist", type: "string", description: "Artist name" },
            { name: "youtubeId", type: "string", description: "YouTube video ID" },
            { name: "thumbnailUrl", type: "string", description: "URL to song thumbnail" }
          ],
          requestExample: `{
  "title": "Song Title",
  "artist": "Artist Name",
  "youtubeId": "dQw4w9WgXcQ",
  "thumbnailUrl": "https://example.com/thumbnail.jpg"
}`,
          responseExample: `{
  "id": 789,
  "title": "Song Title",
  "artist": "Artist Name",
  "youtubeId": "dQw4w9WgXcQ",
  "thumbnailUrl": "https://example.com/thumbnail.jpg",
  "position": 3,
  "status": "queued"
}`
        }
      ]
    },
    {
      id: "search",
      name: "Search APIs",
      description: "Endpoints for searching songs from YouTube",
      endpoints: [
        {
          method: "GET",
          path: "/api/search",
          description: "Search for songs on YouTube",
          parameters: [
            { name: "q", type: "string", description: "Search query" },
            { name: "guestUrl", type: "string", description: "Optional guest URL for tracking" }
          ],
          responseExample: `[
  {
    "id": { "videoId": "dQw4w9WgXcQ" },
    "snippet": {
      "title": "Song Title",
      "channelTitle": "Artist Name",
      "thumbnails": {
        "default": { "url": "https://example.com/thumbnail.jpg" }
      }
    }
  }
]`
        },
        {
          method: "GET",
          path: "/api/search/video/:videoId",
          description: "Get detailed information about a specific YouTube video",
          parameters: [
            { name: "videoId", type: "string", description: "YouTube video ID" }
          ],
          responseExample: `{
  "title": "Song Title",
  "artist": "Artist Name",
  "youtubeId": "dQw4w9WgXcQ",
  "thumbnailUrl": "https://example.com/thumbnail.jpg",
  "duration": "3:32"
}`
        }
      ]
    },
    {
      id: "interaction",
      name: "Guest Interaction APIs",
      description: "Endpoints for tracking and managing guest interactions",
      endpoints: [
        {
          method: "POST",
          path: "/api/guest/interaction",
          description: "Record a guest interaction event",
          parameters: [
            { name: "guestUrl", type: "string", description: "The unique guest URL identifier" },
            { name: "interactionType", type: "string", description: "Type of interaction (view, request, play)" },
            { name: "songId", type: "number", description: "Optional song ID for song-related interactions" },
            { name: "metadata", type: "object", description: "Additional interaction metadata" }
          ],
          requestExample: `{
  "guestUrl": "unique-url-string",
  "interactionType": "song_request",
  "songId": 123,
  "metadata": {
    "deviceType": "mobile",
    "browser": "Chrome"
  }
}`,
          responseExample: `{
  "success": true,
  "interactionId": 456
}`
        }
      ]
    },
    {
      id: "websocket",
      name: "WebSocket API",
      description: "Real-time communication for playlist updates",
      endpoints: [
        {
          method: "WS",
          path: "/socket.io",
          description: "WebSocket connection for real-time updates",
          parameters: [
            { name: "guestUrl", type: "string", description: "The unique guest URL identifier (via query param)" }
          ],
          events: [
            { name: "connect", description: "Connection established with the WebSocket server" },
            { name: "message", description: "Receive messages about playlist and playback changes" },
            { name: "player_state", description: "Current player state updates (playing, paused, etc.)" },
            { name: "PLAYLIST_UPDATE", description: "Updates when playlist content changes" },
            { name: "SONG_REQUESTS_TOGGLE", description: "Updates when song requests are enabled/disabled" },
            { name: "GUEST_PLAY_TOGGLE", description: "Updates when guest play on device is enabled/disabled" },
            { name: "PLAYLIST_SHARING_TOGGLE", description: "Updates when playlist sharing is enabled/disabled" },
            { name: "THEME_UPDATE", description: "Updates when venue changes their theme" }
          ],
          responseExample: `// WebSocket connection response
{
  "status": "connected",
  "sessionId": "socket_12345"
}`,
          messageExample: `// Example incoming message
{
  "type": "PLAYLIST_UPDATE",
  "payload": {
    "songs": [...],
    "currentlyPlaying": {...}
  }
}

// Example outgoing message
{
  "type": "player_state",
  "playing": true,
  "currentTime": 65.4
}`
        }
      ]
    }
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Guest APIs Documentation</CardTitle>
          <CardDescription>
            Comprehensive documentation for all APIs available to guest interfaces
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="md:col-span-1 space-y-4">
              <div className="font-medium">API Categories</div>
              <div className="space-y-2">
                {guestApis.map((api) => (
                  <Button
                    key={api.id}
                    variant={selectedApi === api.id ? "default" : "outline"}
                    className="w-full justify-start"
                    onClick={() => setSelectedApi(api.id)}
                  >
                    {api.name}
                  </Button>
                ))}
              </div>
            </div>
            
            <div className="md:col-span-2">
              {selectedApi ? (
                <div className="space-y-6">
                  {guestApis.find(api => api.id === selectedApi)?.endpoints.map((endpoint, index) => (
                    <Card key={index}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <Badge variant={
                            endpoint.method === "GET" ? "secondary" : 
                            endpoint.method === "POST" ? "default" : 
                            endpoint.method === "WS" ? "outline" : "destructive"
                          }>
                            {endpoint.method}
                          </Badge>
                          <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                            {endpoint.path}
                          </span>
                        </div>
                        <CardDescription className="mt-2">{endpoint.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {endpoint.parameters && endpoint.parameters.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold mb-2">Parameters</h4>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Name</TableHead>
                                  <TableHead>Type</TableHead>
                                  <TableHead>Description</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {endpoint.parameters.map((param, paramIndex) => (
                                  <TableRow key={paramIndex}>
                                    <TableCell className="font-mono text-xs">{param.name}</TableCell>
                                    <TableCell>{param.type}</TableCell>
                                    <TableCell>{param.description}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                        
                        {endpoint.events && endpoint.events.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold mb-2">WebSocket Events</h4>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Event Name</TableHead>
                                  <TableHead>Description</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {endpoint.events.map((event, eventIndex) => (
                                  <TableRow key={eventIndex}>
                                    <TableCell className="font-mono text-xs">{event.name}</TableCell>
                                    <TableCell>{event.description}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                        
                        {endpoint.requestExample && (
                          <div>
                            <h4 className="text-sm font-semibold mb-2">Request Example</h4>
                            <pre className="bg-muted p-4 rounded-md overflow-x-auto text-xs">
                              {endpoint.requestExample}
                            </pre>
                          </div>
                        )}
                        
                        {endpoint.responseExample && (
                          <div>
                            <h4 className="text-sm font-semibold mb-2">Response Example</h4>
                            <pre className="bg-muted p-4 rounded-md overflow-x-auto text-xs">
                              {endpoint.responseExample}
                            </pre>
                          </div>
                        )}
                        
                        {endpoint.messageExample && (
                          <div>
                            <h4 className="text-sm font-semibold mb-2">Message Examples</h4>
                            <pre className="bg-muted p-4 rounded-md overflow-x-auto text-xs">
                              {endpoint.messageExample}
                            </pre>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full p-12 border rounded-lg border-dashed text-muted-foreground">
                  <Code className="h-10 w-10 mb-2" />
                  <h3 className="font-medium">Select an API Category</h3>
                  <p className="text-sm text-center mt-1">
                    Choose an API category from the list to view detailed documentation
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Email APIs Tab Component - Placed before AdminDashboard to ensure proper referencing
function EmailApisTab() {
  const [selectedApi, setSelectedApi] = useState<string | null>(null);
  
  const emailApis = [
    {
      id: "templates",
      name: "Email Templates API",
      description: "Endpoints for managing email templates",
      endpoints: [
        {
          method: "GET",
          path: "/api/admin/email/templates",
          description: "Get all email templates",
          parameters: [
            { name: "api_token", type: "string", description: "API token with admin permissions (in Authorization header)" }
          ],
          responseExample: `{
  "templates": [
    {
      "id": 1,
      "name": "Welcome Email",
      "subject": "Welcome to Cosmic",
      "description": "Sent to new users after registration",
      "htmlContent": "<h1>Welcome!</h1><p>Thanks for joining us, {{name}}.</p>",
      "textContent": "Welcome! Thanks for joining us, {{name}}.",
      "variables": ["name"],
      "createdAt": "2025-03-22T12:00:00Z",
      "updatedAt": "2025-03-22T12:00:00Z",
      "isActive": true
    }
  ]
}`
        },
        {
          method: "GET",
          path: "/api/admin/email/templates/:id",
          description: "Get a specific email template by ID",
          parameters: [
            { name: "api_token", type: "string", description: "API token with admin permissions (in Authorization header)" },
            { name: "id", type: "number", description: "Template ID" }
          ],
          responseExample: `{
  "template": {
    "id": 1,
    "name": "Welcome Email",
    "subject": "Welcome to Cosmic",
    "description": "Sent to new users after registration",
    "htmlContent": "<h1>Welcome!</h1><p>Thanks for joining us, {{name}}.</p>",
    "textContent": "Welcome! Thanks for joining us, {{name}}.",
    "variables": ["name"],
    "createdAt": "2025-03-22T12:00:00Z",
    "updatedAt": "2025-03-22T12:00:00Z",
    "isActive": true
  }
}`
        },
        {
          method: "POST",
          path: "/api/admin/email/templates",
          description: "Create a new email template",
          parameters: [
            { name: "api_token", type: "string", description: "API token with admin permissions (in Authorization header)" },
            { name: "name", type: "string", description: "Template name" },
            { name: "subject", type: "string", description: "Email subject line" },
            { name: "htmlContent", type: "string", description: "HTML content with {{variable}} placeholders" },
            { name: "textContent", type: "string", description: "Plain text content with {{variable}} placeholders" },
            { name: "description", type: "string", description: "Optional template description" }
          ],
          requestExample: `{
  "name": "Welcome Email",
  "subject": "Welcome to Cosmic",
  "description": "Sent to new users after registration",
  "htmlContent": "<h1>Welcome!</h1><p>Thanks for joining us, {{name}}.</p>",
  "textContent": "Welcome! Thanks for joining us, {{name}}."
}`,
          responseExample: `{
  "success": true,
  "template": {
    "id": 1,
    "name": "Welcome Email",
    "subject": "Welcome to Cosmic",
    "description": "Sent to new users after registration",
    "htmlContent": "<h1>Welcome!</h1><p>Thanks for joining us, {{name}}.</p>",
    "textContent": "Welcome! Thanks for joining us, {{name}}.",
    "variables": ["name"],
    "createdAt": "2025-03-22T12:00:00Z",
    "updatedAt": "2025-03-22T12:00:00Z",
    "isActive": true
  }
}`
        },
        {
          method: "PUT",
          path: "/api/admin/email/templates/:id",
          description: "Update an existing email template",
          parameters: [
            { name: "api_token", type: "string", description: "API token with admin permissions (in Authorization header)" },
            { name: "id", type: "number", description: "Template ID" },
            { name: "name", type: "string", description: "Template name (optional)" },
            { name: "subject", type: "string", description: "Email subject line (optional)" },
            { name: "htmlContent", type: "string", description: "HTML content with {{variable}} placeholders (optional)" },
            { name: "textContent", type: "string", description: "Plain text content with {{variable}} placeholders (optional)" },
            { name: "description", type: "string", description: "Template description (optional)" },
            { name: "isActive", type: "boolean", description: "Active status (optional)" }
          ],
          requestExample: `{
  "name": "Updated Welcome Email",
  "subject": "Welcome to Cosmic - Updated",
  "htmlContent": "<h1>Welcome!</h1><p>Thanks for joining us, {{name}}. We're glad to have you!</p>"
}`,
          responseExample: `{
  "success": true,
  "template": {
    "id": 1,
    "name": "Updated Welcome Email",
    "subject": "Welcome to Cosmic - Updated",
    "description": "Sent to new users after registration",
    "htmlContent": "<h1>Welcome!</h1><p>Thanks for joining us, {{name}}. We're glad to have you!</p>",
    "textContent": "Welcome! Thanks for joining us, {{name}}.",
    "variables": ["name"],
    "updatedAt": "2025-03-22T14:30:00Z",
    "isActive": true
  }
}`
        },
        {
          method: "DELETE",
          path: "/api/admin/email/templates/:id",
          description: "Delete an email template",
          parameters: [
            { name: "api_token", type: "string", description: "API token with admin permissions (in Authorization header)" },
            { name: "id", type: "number", description: "Template ID" }
          ],
          responseExample: `{
  "success": true,
  "message": "Template deleted successfully"
}`
        }
      ]
    },
    {
      id: "send",
      name: "Send Email API",
      description: "Endpoints for sending emails",
      endpoints: [
        {
          method: "POST",
          path: "/api/admin/email/send",
          description: "Send an email using a template",
          parameters: [
            { name: "api_token", type: "string", description: "API token with admin permissions (in Authorization header)" },
            { name: "templateId", type: "number", description: "ID of the template to use" },
            { name: "to", type: "string", description: "Recipient email address" },
            { name: "variables", type: "object", description: "Object containing variables to replace in the template" },
            { name: "replyTo", type: "string", description: "Reply-to email address (optional)" }
          ],
          requestExample: `{
  "templateId": 1,
  "to": "user@example.com",
  "variables": {
    "name": "John Doe",
    "venue": "Music Café",
    "event_date": "March 30, 2025"
  },
  "replyTo": "support@yourvenue.com"
}`,
          responseExample: `{
  "success": true,
  "messageId": "0102018c0ab1c496-7e742350-a315-4b09-a19a-7b44c0e1427b-000000",
  "emailLogId": 123
}`
        }
      ]
    },
    {
      id: "logs",
      name: "Email Logs API",
      description: "Endpoints for accessing email sending logs",
      endpoints: [
        {
          method: "GET",
          path: "/api/admin/email/logs",
          description: "Get email sending logs with pagination",
          parameters: [
            { name: "api_token", type: "string", description: "API token with admin permissions (in Authorization header)" },
            { name: "page", type: "number", description: "Page number (optional, default: 1)" },
            { name: "limit", type: "number", description: "Results per page (optional, default: 20)" },
            { name: "status", type: "string", description: "Filter by status (optional): 'sent', 'delivered', 'failed'" },
            { name: "recipient", type: "string", description: "Filter by recipient email (optional)" }
          ],
          responseExample: `{
  "logs": [
    {
      "id": 123,
      "templateId": 1,
      "templateName": "Welcome Email",
      "recipient": "user@example.com",
      "subject": "Welcome to Cosmic",
      "status": "delivered",
      "sentAt": "2025-03-22T14:35:00Z",
      "deliveredAt": "2025-03-22T14:35:05Z",
      "messageId": "0102018c0ab1c496-7e742350-a315-4b09-a19a-7b44c0e1427b-000000",
      "errorMessage": null,
      "apiTokenId": 5,
      "apiTokenName": "Marketing API"
    }
  ],
  "total": 45,
  "page": 1,
  "limit": 20,
  "totalPages": 3
}`
        },
        {
          method: "GET",
          path: "/api/admin/email/logs/:id",
          description: "Get a specific email log by ID",
          parameters: [
            { name: "api_token", type: "string", description: "API token with admin permissions (in Authorization header)" },
            { name: "id", type: "number", description: "Email log ID" }
          ],
          responseExample: `{
  "log": {
    "id": 123,
    "templateId": 1,
    "templateName": "Welcome Email",
    "recipient": "user@example.com",
    "subject": "Welcome to Cosmic",
    "status": "delivered",
    "sentAt": "2025-03-22T14:35:00Z",
    "deliveredAt": "2025-03-22T14:35:05Z",
    "messageId": "0102018c0ab1c496-7e742350-a315-4b09-a19a-7b44c0e1427b-000000",
    "errorMessage": null,
    "apiTokenId": 5,
    "apiTokenName": "Marketing API",
    "variables": {
      "name": "John Doe",
      "venue": "Music Café"
    }
  }
}`
        }
      ]
    },
    {
      id: "stats",
      name: "Email Statistics API",
      description: "Endpoints for email usage statistics",
      endpoints: [
        {
          method: "GET",
          path: "/api/admin/email/stats",
          description: "Get email sending statistics",
          parameters: [
            { name: "api_token", type: "string", description: "API token with admin permissions (in Authorization header)" }
          ],
          responseExample: `{
  "total": 1250,
  "sent": 1240,
  "delivered": 1210,
  "failed": 40,
  "daily": [
    {
      "date": "2025-03-21",
      "count": 126,
      "status": "sent"
    },
    {
      "date": "2025-03-21",
      "count": 122,
      "status": "delivered"
    },
    {
      "date": "2025-03-21",
      "count": 4,
      "status": "failed"
    },
    {
      "date": "2025-03-22",
      "count": 143,
      "status": "sent"
    },
    {
      "date": "2025-03-22",
      "count": 139,
      "status": "delivered"
    },
    {
      "date": "2025-03-22",
      "count": 4,
      "status": "failed"
    }
  ],
  "byTemplate": [
    {
      "templateId": 1,
      "templateName": "Welcome Email",
      "count": 450,
      "delivered": 442,
      "failed": 8
    },
    {
      "templateId": 2,
      "templateName": "Password Reset",
      "count": 320,
      "delivered": 318,
      "failed": 2
    }
  ]
}`
        },
        {
          method: "GET",
          path: "/api/admin/email/quota",
          description: "Get AWS SES sending quota information",
          parameters: [
            { name: "api_token", type: "string", description: "API token with admin permissions (in Authorization header)" }
          ],
          responseExample: `{
  "max24HourSend": 50000,
  "maxSendRate": 14,
  "sentLast24Hours": 1240,
  "remainingToday": 48760,
  "sendingEnabled": true
}`
        }
      ]
    },
    {
      id: "verification",
      name: "Email Verification API",
      description: "Endpoints for verifying email addresses with AWS SES",
      endpoints: [
        {
          method: "POST",
          path: "/api/admin/email/verify",
          description: "Request verification for an email address",
          parameters: [
            { name: "api_token", type: "string", description: "API token with admin permissions (in Authorization header)" },
            { name: "email", type: "string", description: "Email address to verify" }
          ],
          requestExample: `{
  "email": "user@example.com"
}`,
          responseExample: `{
  "success": true,
  "message": "Verification email sent to user@example.com"
}`
        }
      ]
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {emailApis.map((api) => (
          <Button 
            key={api.id}
            variant={selectedApi === api.id ? "default" : "outline"}
            onClick={() => setSelectedApi(api.id)}
          >
            {api.name}
          </Button>
        ))}
      </div>

      {emailApis.map((api) => (
        <div 
          key={api.id} 
          className={cn("space-y-6", selectedApi && selectedApi !== api.id && "hidden")}
        >
          <Card>
            <CardHeader>
              <CardTitle>{api.name}</CardTitle>
              <CardDescription>{api.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {api.endpoints.map((endpoint, index) => (
                <div key={index} className="space-y-4 border-b border-border pb-8 last:border-0 last:pb-0">
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="text-primary font-mono">
                      {endpoint.method}
                    </Badge>
                    <code className="bg-muted p-1 rounded text-sm font-mono">
                      {endpoint.path}
                    </code>
                  </div>
                  <p className="text-sm text-muted-foreground">{endpoint.description}</p>

                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Parameters</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Description</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {endpoint.parameters.map((param, paramIndex) => (
                          <TableRow key={paramIndex}>
                            <TableCell className="font-mono text-xs">{param.name}</TableCell>
                            <TableCell>{param.type}</TableCell>
                            <TableCell>{param.description}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {endpoint.requestExample && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Request Example</h4>
                      <pre className="bg-muted p-4 rounded-md overflow-auto text-xs">
                        {endpoint.requestExample}
                      </pre>
                    </div>
                  )}

                  {endpoint.responseExample && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Response Example</h4>
                      <pre className="bg-muted p-4 rounded-md overflow-auto text-xs">
                        {endpoint.responseExample}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  );
}

function SeoTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("basic");
  const queryClient = useQueryClient();
  
  // Get super admin status from main component
  const isSuperAdmin = user?.username === 'yapral27';
  
  // Return access denied message if not a super admin
  if (!isSuperAdmin) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You do not have permission to view or modify SEO settings. Only super administrators have access to this feature.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Fetch current SEO settings
  const { data: seoSettings, isLoading, error } = useQuery<SeoSettings>({
    queryKey: ['/api/seo'],
    staleTime: 60000, // 1 minute
  });

  // Define schema for SEO settings form
  const seoFormSchema = z.object({
    siteTitle: z.string().min(5, "Site title must be at least 5 characters"),
    metaDescription: z.string().min(20, "Meta description must be at least 20 characters"),
    metaKeywords: z.string().min(3, "Meta keywords are required"),
    ogTitle: z.string().min(5, "Open Graph title must be at least 5 characters"),
    ogDescription: z.string().min(20, "Open Graph description must be at least 20 characters"),
    ogImage: z.string().min(1, "Open Graph image path is required"),
    twitterTitle: z.string().min(5, "Twitter title must be at least 5 characters"),
    twitterDescription: z.string().min(20, "Twitter description must be at least 20 characters"),
    twitterImage: z.string().min(1, "Twitter image path is required"),
    robotsTxt: z.string().min(1, "Robots.txt content is required"),
    sitemapXml: z.string().min(1, "Sitemap XML content is required"),
    googleAnalyticsId: z.string().optional(),
    facebookPixelId: z.string().optional(),
    googleTagManagerId: z.string().optional(),
    microsoftClarityId: z.string().optional(),
  });

  type SeoFormValues = z.infer<typeof seoFormSchema>;

  // Form setup with react-hook-form and zod validation
  const form = useForm<SeoFormValues>({
    resolver: zodResolver(seoFormSchema),
    defaultValues: {
      siteTitle: '',
      metaDescription: '',
      metaKeywords: '',
      ogTitle: '',
      ogDescription: '',
      ogImage: '',
      twitterTitle: '',
      twitterDescription: '',
      twitterImage: '',
      robotsTxt: '',
      sitemapXml: '',
      googleAnalyticsId: '',
      facebookPixelId: '',
      googleTagManagerId: '',
      microsoftClarityId: '',
    },
  });

  // Update form values when settings are loaded
  React.useEffect(() => {
    if (seoSettings) {
      // Type cast values to match the expected form schema
      const formValues: SeoFormValues = {
        siteTitle: seoSettings.siteTitle,
        metaDescription: seoSettings.metaDescription,
        metaKeywords: seoSettings.metaKeywords,
        ogTitle: seoSettings.ogTitle,
        ogDescription: seoSettings.ogDescription,
        ogImage: seoSettings.ogImage,
        twitterTitle: seoSettings.twitterTitle,
        twitterDescription: seoSettings.twitterDescription,
        twitterImage: seoSettings.twitterImage,
        robotsTxt: seoSettings.robotsTxt,
        sitemapXml: seoSettings.sitemapXml,
        googleAnalyticsId: seoSettings.googleAnalyticsId || '',
        facebookPixelId: seoSettings.facebookPixelId || '',
        googleTagManagerId: seoSettings.googleTagManagerId || '',
        microsoftClarityId: seoSettings.microsoftClarityId || '',
      };
      form.reset(formValues);
    }
  }, [seoSettings, form]);

  // Update SEO settings mutation
  const updateSeoMutation = useMutation({
    mutationFn: (data: SeoFormValues) => {
      return apiRequest('PUT', '/api/seo', data);
    },
    onSuccess: () => {
      toast({
        title: "SEO settings updated",
        description: "SEO settings have been successfully updated.",
      });
      // Invalidate the SEO query to refetch updated data
      queryClient.invalidateQueries({ queryKey: ['/api/seo'] });
    },
    onError: (error) => {
      console.error('Error updating SEO settings:', error);
      toast({
        title: "Error updating SEO settings",
        description: "An error occurred while updating SEO settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const onSubmit = (data: SeoFormValues) => {
    updateSeoMutation.mutate(data);
  };



  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin">
          <Loader2 className="h-8 w-8 text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load SEO settings. Please try refreshing the page or contact support if the issue persists.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="basic">Basic SEO</TabsTrigger>
            <TabsTrigger value="social">Social Media</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
            <TabsTrigger value="tracking">Tracking</TabsTrigger>
          </TabsList>

          {/* Basic SEO Tab */}
          <TabsContent value="basic" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Basic SEO Settings</CardTitle>
                <CardDescription>Configure your website's basic SEO metadata</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <Label htmlFor="siteTitle">Site Title</Label>
                  <Input
                    id="siteTitle"
                    {...form.register("siteTitle")}
                    placeholder="Cosmic - Collaborative Playlist Management Platform"
                  />
                  {form.formState.errors.siteTitle && (
                    <p className="text-red-500 text-sm">{form.formState.errors.siteTitle.message}</p>
                  )}
                </div>

                <div className="space-y-3">
                  <Label htmlFor="metaDescription">Meta Description</Label>
                  <Textarea
                    id="metaDescription"
                    {...form.register("metaDescription")}
                    placeholder="A brief description of your website (150-160 characters recommended)"
                    rows={3}
                  />
                  {form.formState.errors.metaDescription && (
                    <p className="text-red-500 text-sm">{form.formState.errors.metaDescription.message}</p>
                  )}
                </div>

                <div className="space-y-3">
                  <Label htmlFor="metaKeywords">Meta Keywords</Label>
                  <Input
                    id="metaKeywords"
                    {...form.register("metaKeywords")}
                    placeholder="music, playlist, collaboration, venue, event, sharing, youtube"
                  />
                  {form.formState.errors.metaKeywords && (
                    <p className="text-red-500 text-sm">{form.formState.errors.metaKeywords.message}</p>
                  )}
                  <p className="text-sm text-muted-foreground">Separate keywords with commas</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Social Media Tab */}
          <TabsContent value="social" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Social Media Settings</CardTitle>
                <CardDescription>Configure how your website appears when shared on social media</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="mb-6">
                  <Badge className="mb-3">Open Graph (Facebook, LinkedIn)</Badge>
                  <div className="space-y-3">
                    <Label htmlFor="ogTitle">Open Graph Title</Label>
                    <Input
                      id="ogTitle"
                      {...form.register("ogTitle")}
                      placeholder="Cosmic - Transform Your Music Experience"
                    />
                    {form.formState.errors.ogTitle && (
                      <p className="text-red-500 text-sm">{form.formState.errors.ogTitle.message}</p>
                    )}
                  </div>

                  <div className="space-y-3 mt-3">
                    <Label htmlFor="ogDescription">Open Graph Description</Label>
                    <Textarea
                      id="ogDescription"
                      {...form.register("ogDescription")}
                      placeholder="Create immersive and interactive music experiences with Cosmic collaborative playlists"
                      rows={2}
                    />
                    {form.formState.errors.ogDescription && (
                      <p className="text-red-500 text-sm">{form.formState.errors.ogDescription.message}</p>
                    )}
                  </div>

                  <div className="space-y-3 mt-3">
                    <Label htmlFor="ogImage">Open Graph Image Path</Label>
                    <Input
                      id="ogImage"
                      {...form.register("ogImage")}
                      placeholder="/logo-social.png"
                    />
                    {form.formState.errors.ogImage && (
                      <p className="text-red-500 text-sm">{form.formState.errors.ogImage.message}</p>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="mt-6">
                  <Badge className="mb-3">Twitter Card</Badge>
                  <div className="space-y-3">
                    <Label htmlFor="twitterTitle">Twitter Title</Label>
                    <Input
                      id="twitterTitle"
                      {...form.register("twitterTitle")}
                      placeholder="Cosmic Music Platform"
                    />
                    {form.formState.errors.twitterTitle && (
                      <p className="text-red-500 text-sm">{form.formState.errors.twitterTitle.message}</p>
                    )}
                  </div>

                  <div className="space-y-3 mt-3">
                    <Label htmlFor="twitterDescription">Twitter Description</Label>
                    <Textarea
                      id="twitterDescription"
                      {...form.register("twitterDescription")}
                      placeholder="Advanced playlist management for venues and events"
                      rows={2}
                    />
                    {form.formState.errors.twitterDescription && (
                      <p className="text-red-500 text-sm">{form.formState.errors.twitterDescription.message}</p>
                    )}
                  </div>

                  <div className="space-y-3 mt-3">
                    <Label htmlFor="twitterImage">Twitter Image Path</Label>
                    <Input
                      id="twitterImage"
                      {...form.register("twitterImage")}
                      placeholder="/logo-social.png"
                    />
                    {form.formState.errors.twitterImage && (
                      <p className="text-red-500 text-sm">{form.formState.errors.twitterImage.message}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Advanced Tab */}
          <TabsContent value="advanced" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Advanced SEO Settings</CardTitle>
                <CardDescription>Configure robots.txt and sitemap.xml</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <Label htmlFor="robotsTxt">robots.txt Content</Label>
                  <Textarea
                    id="robotsTxt"
                    {...form.register("robotsTxt")}
                    placeholder="User-agent: *\nAllow: /"
                    rows={6}
                    className="font-mono text-sm"
                  />
                  {form.formState.errors.robotsTxt && (
                    <p className="text-red-500 text-sm">{form.formState.errors.robotsTxt.message}</p>
                  )}
                  <div className="text-xs text-muted-foreground mt-1">
                    This will be served at <code>/robots.txt</code>
                  </div>
                </div>

                <div className="space-y-3 mt-6">
                  <Label htmlFor="sitemapXml">sitemap.xml Content</Label>
                  <Textarea
                    id="sitemapXml"
                    {...form.register("sitemapXml")}
                    placeholder='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>https://cosmic.app/</loc>\n    <lastmod>2025-04-03</lastmod>\n    <priority>1.0</priority>\n  </url>\n</urlset>'
                    rows={12}
                    className="font-mono text-sm"
                  />
                  {form.formState.errors.sitemapXml && (
                    <p className="text-red-500 text-sm">{form.formState.errors.sitemapXml.message}</p>
                  )}
                  <div className="text-xs text-muted-foreground mt-1">
                    This will be served at <code>/sitemap.xml</code>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tracking Tab */}
          <TabsContent value="tracking" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Analytics & Tracking</CardTitle>
                <CardDescription>Configure tracking and analytics services</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <Label htmlFor="googleAnalyticsId">Google Analytics ID</Label>
                  <Input
                    id="googleAnalyticsId"
                    {...form.register("googleAnalyticsId")}
                    placeholder="G-XXXXXXXXXX"
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="googleTagManagerId">Google Tag Manager ID</Label>
                  <Input
                    id="googleTagManagerId"
                    {...form.register("googleTagManagerId")}
                    placeholder="GTM-XXXXXXX"
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="facebookPixelId">Facebook Pixel ID</Label>
                  <Input
                    id="facebookPixelId"
                    {...form.register("facebookPixelId")}
                    placeholder="XXXXXXXXXX"
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="microsoftClarityId">Microsoft Clarity ID</Label>
                  <Input
                    id="microsoftClarityId"
                    {...form.register("microsoftClarityId")}
                    placeholder="XXXXXXXXXX"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="mt-8 flex justify-end">
          <Button 
            type="submit" 
            className="flex items-center gap-2" 
            disabled={updateSeoMutation.isPending}
          >
            {updateSeoMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            <Save className="h-4 w-4" />
            Save SEO Settings
          </Button>
        </div>
      </form>
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
  
  // Check if user is a super admin for SEO tab access
  const isSuperAdmin = user.username === 'yapral27';

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
