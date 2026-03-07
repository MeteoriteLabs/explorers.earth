import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Activity, MoreVertical, Search, Trash2, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

export default function UsersTab() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data: teamData } = useQuery({
    queryKey: ["/api/admin/team"],
    queryFn: async () => {
      const res = await fetch("/api/admin/team");
      if (!res.ok) throw new Error("Failed to fetch team members");
      return res.json();
    },
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["/api/admin/users", page, limit, debouncedSearchTerm],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/users?page=${page}&limit=${limit}${debouncedSearchTerm ? `&search=${encodeURIComponent(debouncedSearchTerm)}` : ""}`,
      );
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete user");
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
    },
  });

  const updateAccountManagerMutation = useMutation({
    mutationFn: async ({ userId, accountManagerId }: { userId: number; accountManagerId: number | null }) => {
      const res = await fetch(`/api/admin/users/${userId}/account-manager`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountManagerId }),
      });
      if (!res.ok) throw new Error("Failed to update account manager");
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
    },
  });

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
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.total || 0}</div>
            <p className="text-xs text-muted-foreground">Registered accounts</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.stats?.active || 0}</div>
            <p className="text-xs text-muted-foreground">Active in last 30 days</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>View and manage registered users</CardDescription>
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
                <TableRow key={user.id} className="hover:bg-muted/50">
                  <TableCell className="cursor-pointer hover:underline">
                    <div className="flex items-center gap-2">
                      <Link to={`/admin/users/${user.id}`}>{user.username}</Link>
                      {user.username === "yapral27" && (
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
                      value={user.accountManagerId || ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        updateAccountManagerMutation.mutate({
                          userId: user.id,
                          accountManagerId: value ? parseInt(value) : null,
                        });
                      }}
                      onClick={(e) => e.stopPropagation()}
                      disabled={user.username === "yapral27"}
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
                        <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-destructive"
                          disabled={user.username === "yapral27"}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm("Are you sure you want to delete this user?")) {
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

          <div className="flex items-center justify-between space-x-2 py-4">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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
