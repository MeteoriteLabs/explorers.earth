import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Song } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Loader2, LogOut, QrCode } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useRef, useCallback } from "react";
import PlaylistTable from "@/components/playlist-table";
import SearchSongs from "@/components/search-songs";
import YoutubePlayer from "@/components/youtube-player";

export default function HomePage() {
  const { user, logoutMutation } = useAuth();
  const qrCodeRef = useRef<HTMLCanvasElement>(null);

  const { data: playlist, isLoading } = useQuery<{songs: Song[]}>({
    queryKey: [`/api/playlist/${user?.guestUrl}`],
  });

  // Callback to fetch current song
  const fetchCurrentSong = useCallback(async () => {
    if (!user?.guestUrl) return;
    const response = await fetch(`/api/playlist/${user.guestUrl}`);
    if (!response.ok) throw new Error('Failed to fetch current song');
    const data = await response.json();
    return data.currentlyPlaying;
  }, [user?.guestUrl]);

  useEffect(() => {
    if (qrCodeRef.current && user) {
      const guestUrl = `${window.location.origin}/playlist/${user.guestUrl}`;
      QRCode.toCanvas(qrCodeRef.current, guestUrl, {
        width: 200,
        margin: 2,
        scale: 4,
      });
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  const guestUrl = `${window.location.origin}/playlist/${user?.guestUrl}`;

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Welcome, {user?.username}!</h1>
        <Button variant="outline" onClick={() => logoutMutation.mutate()}>
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Your Playlist</CardTitle>
            <CardDescription>Manage your collaborative playlist</CardDescription>
          </CardHeader>
          <CardContent>
            <YoutubePlayer
              currentSong={playlist?.songs[0]}
              nextSong={playlist?.songs[1]}
              fetchCurrentSong={fetchCurrentSong}
            />
            <div className="mt-4">
              <PlaylistTable songs={playlist?.songs || []} showControls />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Add Songs</CardTitle>
              <CardDescription>Search and add songs to your playlist</CardDescription>
            </CardHeader>
            <CardContent>
              <SearchSongs />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Share Your Playlist</CardTitle>
              <CardDescription>Let guests view and interact with your playlist</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible>
                <AccordionItem value="qr">
                  <AccordionTrigger>
                    <div className="flex items-center">
                      <QrCode className="h-4 w-4 mr-2" />
                      Show QR Code
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="flex justify-center">
                      <canvas ref={qrCodeRef} />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <div className="mt-4">
                <p className="text-sm text-muted-foreground mb-2">Guest URL:</p>
                <code className="block p-2 bg-muted rounded-md break-all">
                  {guestUrl}
                </code>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}