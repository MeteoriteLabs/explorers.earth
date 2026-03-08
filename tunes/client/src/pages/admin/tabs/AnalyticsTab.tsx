import React from "react";
import { useQuery } from "@tanstack/react-query";
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
import { Badge } from "@/components/ui/badge";
import { WorldMap } from "@/components/world-map";
import { Activity, BarChart3, Calculator, Clock, Database, Music, Timer, Users } from "lucide-react";
import { format } from "date-fns";

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
    };
  };
}

export default function AnalyticsTab() {
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

