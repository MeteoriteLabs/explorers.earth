import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Music, ExternalLink } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Props = {
  playlistId: number;
};

export default function ImportYouTubePlaylist({ playlistId }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [url, setUrl] = useState("");

  const importMutation = useMutation({
    mutationFn: async (playlistUrl: string) => {
      return apiRequest<{
        sourcePlaylistId: string;
        videosFetched: number;
        videosAdded: number;
        targetPlaylistId: number;
        status: string;
      }>("POST", `/api/playlists/${playlistId}/import-youtube`, {
        url: playlistUrl,
      });
    },
    onSuccess: (data) => {
      // Invalidate playlists query to refresh the data
      queryClient.invalidateQueries({ queryKey: ["/api/playlists"] });

      toast({
        title: "Playlist imported successfully",
        description: `Added ${data.videosAdded} song${data.videosAdded !== 1 ? "s" : ""} from YouTube playlist`,
      });

      // Clear the input
      setUrl("");
    },
    onError: (error: Error) => {
      console.error("Failed to import YouTube playlist:", error);
      toast({
        title: "Failed to import playlist",
        description: error.message || "Could not import YouTube playlist",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      toast({
        title: "URL required",
        description: "Please enter a YouTube Music playlist URL",
        variant: "destructive",
      });
      return;
    }

    // Basic URL validation
    if (!url.includes("music.youtube.com") && !url.includes("youtube.com")) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid YouTube Music playlist URL",
        variant: "destructive",
      });
      return;
    }

    importMutation.mutate(url.trim());
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="py-3 sm:py-4">
        <div className="flex items-center gap-2">
          <Music className="h-4 w-4 sm:h-5 sm:w-5" />
          <div>
            <CardTitle className="text-base sm:text-lg">
              Import YouTube Music Playlist
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Paste a YouTube Music playlist URL to import all songs
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex gap-2">
            <Input
              type="url"
              placeholder="https://music.youtube.com/playlist?list=..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={importMutation.isPending}
              className="flex-1"
            />
            <Button
              type="submit"
              disabled={importMutation.isPending || !url.trim()}
              className="shrink-0"
            >
              {importMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Import
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Example: https://music.youtube.com/playlist?list=PL7M0K8x1gABRljM07vXnTgPjX5hKOGvVb
          </p>
        </form>
      </CardContent>
    </Card>
  );
}



