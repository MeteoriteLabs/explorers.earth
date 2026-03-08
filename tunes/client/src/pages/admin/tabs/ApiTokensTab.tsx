import React, { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { Copy, Loader2, Lock, MoreVertical, Trash2 } from "lucide-react";

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
  fullToken?: string;
}

const apiTokenSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
  expiresIn: z.number().int().min(-1).refine(val => val === -1 || val >= 1, {
    message: "Expiration must be at least 1 day or -1 for unlimited"
  }),
  userId: z.number().int().optional(),
  isUnlimited: z.boolean().optional(),
});

type ApiTokenFormData = z.infer<typeof apiTokenSchema>;

export default function ApiTokensTab() {
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

