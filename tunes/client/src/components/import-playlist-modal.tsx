import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ExternalLink, Music } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guestUrl?: string;
  playlistId?: number;
};

type Platform = "youtube" | "spotify" | null;

export default function ImportPlaylistModal({
  open,
  onOpenChange,
  guestUrl,
  playlistId,
}: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [url, setUrl] = useState("");
  const [validationError, setValidationError] = useState<string>("");

  const importMutation = useMutation({
    mutationFn: async ({ playlistUrl, platform }: { playlistUrl: string; platform: "youtube" | "spotify" }): Promise<{
        sourcePlaylistId?: string;
        sourcePlaylistUri?: string;
        videosFetched?: number;
        songsFetched?: number;
        videosAdded?: number;
        songsAdded?: number;
        status: string;
      }> => {
      void playlistUrl;
      void platform;
      throw new Error("Playlist import is unavailable until a fresh server-derived entitlement can authorize it.");
    },
    onSuccess: (data, variables) => {
      // Invalidate the appropriate queries based on context
      if (playlistId) {
        queryClient.invalidateQueries({ queryKey: ["/api/playlists", user?.id] });
      } else {
        // For main playlist, invalidate using guestUrl or user's guestUrl
        const playlistUrl = guestUrl || user?.guestUrl;
        if (playlistUrl) {
          queryClient.invalidateQueries({ queryKey: [`/api/playlist/${playlistUrl}`] });
        }
      }

      // Handle both YouTube (videosAdded) and Spotify (songsAdded) responses
      // Convert to numbers and handle string values, ensuring we get valid numbers
      const videosAddedNum = data.videosAdded != null ? Number(data.videosAdded) : NaN;
      const songsAddedNum = data.songsAdded != null ? Number(data.songsAdded) : NaN;
      
      const videosAdded = !isNaN(videosAddedNum) ? videosAddedNum : 0;
      const songsAdded = !isNaN(songsAddedNum) ? songsAddedNum : 0;
      
      // Use the appropriate count based on platform
      // For YouTube, use videosAdded; for Spotify, use songsAdded
      const addedCount = variables.platform === "youtube" 
        ? videosAdded
        : songsAdded;
      
      const platformName = variables.platform === "youtube" ? "YouTube" : "Spotify";

      // Debug log to see what we're getting
      console.log('Import response:', { 
        rawData: data,
        videosAddedValue: data.videosAdded,
        songsAddedValue: data.songsAdded,
        videosAdded,
        songsAdded,
        addedCount,
        platform: variables.platform 
      });

      toast({
        title: "Playlist imported successfully",
        description: `Added ${addedCount} song${addedCount !== 1 ? "s" : ""} from ${platformName} playlist`,
      });

      // Clear the input and close modal
      setUrl("");
      setValidationError("");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      console.error("Failed to import playlist:", error);
      toast({
        title: "Failed to import playlist",
        description: error.message || "Could not import playlist",
        variant: "destructive",
      });
    },
  });

  const detectPlatform = (url: string): Platform => {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes("music.youtube.com") || lowerUrl.includes("youtube.com")) {
      return "youtube";
    } else if (lowerUrl.includes("open.spotify.com") || lowerUrl.includes("spotify.com")) {
      return "spotify";
    }
    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url.trim()) {
      setValidationError("Please enter a YouTube Music or Spotify playlist URL");
      return;
    }

    // Validate URL (this will also update the validation error state)
    const error = validateUrl(url.trim());
    if (error) {
      setValidationError(error);
      return;
    }

    // Auto-detect platform from URL
    const detectedPlatform = detectPlatform(url.trim());
    
    if (!detectedPlatform) {
      setValidationError("Please enter a valid playlist URL from Spotify or YouTube Music.");
      return;
    }

    importMutation.mutate({ playlistUrl: url.trim(), platform: detectedPlatform });
  };

  const validateUrl = (urlValue: string): string => {
    if (!urlValue.trim()) {
      return "";
    }
    
    const detectedPlatform = detectPlatform(urlValue.trim());
    if (!detectedPlatform) {
      return "Please enter a valid playlist URL from Spotify or YouTube Music.";
    }
    
    return "";
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setUrl(newUrl);
    // Real-time validation
    const error = validateUrl(newUrl);
    setValidationError(error);
  };

  // Clear validation error when modal closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setValidationError("");
      setUrl("");
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Music className="h-5 w-5 text-primary" />
            <DialogTitle className="text-lg sm:text-xl">
              Import Playlist
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm sm:text-base">
            Import songs from YouTube Music or Spotify playlists
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Input
              type="url"
              placeholder="Enter youtube or spotify playlist URL"
              value={url}
              onChange={handleUrlChange}
              disabled={importMutation.isPending}
              className="w-full"
            />
            {validationError && (
              <p className="text-sm font-bold text-red-800 dark:text-yellow-800 bg-red-200 dark:bg-yellow-900/20 px-2 py-1.5 rounded">
                {validationError}
              </p>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0 px-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={importMutation.isPending}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={importMutation.isPending || !url.trim()}
              className="w-full sm:w-auto"
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
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

