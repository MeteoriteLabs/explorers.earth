import { useState, useEffect } from 'react';
import { Chart } from 'react-google-charts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Globe } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

// Google Maps API Key from environment
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

interface WorldMapProps {
  regionalStats: Record<string, { hostCount: number; guestCount?: number; songRequestCount?: number }>;
  isLoading?: boolean;
}

// Country code mapping to proper country names for display
const COUNTRY_NAMES: Record<string, string> = {
  // Country codes mapped to country names
  "US": "United States",
  "CA": "Canada",
  "GB": "United Kingdom",
  "FR": "France",
  "DE": "Germany",
  "IT": "Italy",
  "ES": "Spain",
  "JP": "Japan",
  "CN": "China",
  "IN": "India",
  "BR": "Brazil",
  "RU": "Russia",
  "AU": "Australia",
  "ZA": "South Africa",
  
  // Regional names for fallback
  "Asia": "Asia",
  "North America": "North America",
  "Europe": "Europe",
  "South America": "South America",
  "Africa": "Africa",
  "Australia": "Australia",
  "Oceania": "Oceania",
  "Unknown": "Unknown"
};

export function WorldMap({ regionalStats, isLoading = false }: WorldMapProps) {
  const [mapData, setMapData] = useState<any[]>([]);
  
  useEffect(() => {
    if (regionalStats) {
      // Format data for Google GeoChart
      const formattedData = [
        ['Country', 'Hosts'],
        ...Object.entries(regionalStats).map(([code, stats]) => [
          code, // Now we're using country codes directly from the database
          stats.hostCount || 0
        ])
      ];
      
      setMapData(formattedData);
    }
  }, [regionalStats]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Global Distribution</CardTitle>
          <CardDescription>Loading regional statistics...</CardDescription>
        </CardHeader>
        <CardContent className="min-h-[400px] flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading map data...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Don't render if no data is available
  if (!regionalStats || Object.keys(regionalStats).length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Global Distribution</CardTitle>
          <CardDescription>No regional data available yet</CardDescription>
        </CardHeader>
        <CardContent className="min-h-[300px] flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <Globe className="h-16 w-16 text-muted-foreground opacity-20" />
            <p className="text-sm text-muted-foreground">No geographic data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Global Distribution</CardTitle>
        <CardDescription>Visualization of hosts by country/region</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="min-h-[400px] mb-6">
          <Chart
            chartType="GeoChart"
            width="100%"
            height="400px"
            data={mapData}
            options={{
              colorAxis: { colors: ['#e5f5ff', '#2563eb'] },
              backgroundColor: 'transparent',
              datalessRegionColor: '#f5f5f5',
              defaultColor: '#f5f5f5',
              legend: { textStyle: { color: 'gray' } },
            }}
            mapsApiKey={GOOGLE_MAPS_API_KEY}
          />
        </div>
        
        {/* Data table with region details */}
        <div className="overflow-x-auto mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Region</TableHead>
                <TableHead className="text-right">Hosts</TableHead>
                <TableHead className="text-right">Guests</TableHead>
                <TableHead className="text-right">Song Requests</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(regionalStats).map(([region, stats]) => (
                <TableRow key={region}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{COUNTRY_NAMES[region] || region}</Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{stats.hostCount || 0}</TableCell>
                  <TableCell className="text-right">{stats.guestCount || 0}</TableCell>
                  <TableCell className="text-right">{stats.songRequestCount || 0}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}