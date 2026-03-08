import React, { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Activity, BarChart3, Clock, Copy, Loader2, Settings, Timer, Users } from "lucide-react";

const appUrlSettingsSchema = z.object({
  app_url: z.string().url("Please enter a valid URL").min(1, "URL is required"),
});

type AppUrlSettingsFormData = z.infer<typeof appUrlSettingsSchema>;

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


export default function SystemTab() {
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

