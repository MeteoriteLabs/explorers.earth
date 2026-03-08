import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertCircle,
  BarChart3,
  CheckCircle,
  Eye,
  Loader2,
  Mail,
  MoreVertical,
  Pencil,
  Percent,
  RefreshCw,
  Send,
  Trash2,
} from "lucide-react";

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
export default function EmailTab() {
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


