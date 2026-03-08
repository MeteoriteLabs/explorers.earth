import React, { useState } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Globe2, MoreVertical, Settings, Shield, Trash2, UserPlus, Users } from "lucide-react";

const teamMemberSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  role: z.string().min(1, "Role is required"),
  regions: z.array(z.string()).min(1, "At least one region is required"),
});

type TeamMemberFormData = z.infer<typeof teamMemberSchema>;

const ROLES = ["Account Manager", "Team Lead", "Regional Manager", "Support Specialist"];
const REGIONS = ["North America", "Europe", "Asia", "South America", "Africa", "Australia"];

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
type EmailTemplateFormData = z.infer<typeof emailTemplateSchema>;
type EmailVerificationFormData = z.infer<typeof emailVerificationSchema>;


export default function TeamTab() {
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
