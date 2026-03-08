import React, { useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Code } from "lucide-react";

export default function GuestApisTab() {
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
