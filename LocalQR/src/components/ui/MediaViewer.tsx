import React, { useCallback, useMemo } from "react";
import Lightbox from "yet-another-react-lightbox";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/thumbnails.css";

export interface MediaItem {
  id: string;
  url: string;
  alt?: string;
  type?: "image" | "video";
  fileName?: string;
  aspectRatio?: string;
  width?: number;
  height?: number;
}

interface MediaViewerProps {
  /** Array of media items (images and videos) */
  mediaItems: MediaItem[];
  /** Initial index to show when lightbox opens */
  initialIndex?: number;
  /** Whether the lightbox is open */
  isOpen: boolean;
  /** Callback when lightbox is closed */
  onClose: () => void;
  /** Optional className for custom styling */
  className?: string;
}

/**
 * Determines if a media item is a video based on type or URL
 */
const isVideo = (item: MediaItem): boolean => {
  if (item.type) {
    return item.type === "video";
  }

  // Fallback to URL-based detection
  const videoExtensions = [
    ".mp4",
    ".webm",
    ".mov",
    ".avi",
    ".mkv",
    ".m4v",
    ".ogg",
  ];
  const url = item.url.toLowerCase();
  return videoExtensions.some((ext) => url.includes(ext));
};

/**
 * MediaViewer Component
 *
 * A reusable lightbox component for viewing mixed media (images and videos)
 * with thumbnail navigation, keyboard controls, zoom, and fullscreen support.
 */
const MediaViewer: React.FC<MediaViewerProps> = ({
  mediaItems,
  initialIndex = 0,
  isOpen,
  onClose,
  className = "",
}) => {
  // Transform media items to lightbox format
  const slides = useMemo(() => {
    return mediaItems.map((item) => {
      const itemIsVideo = isVideo(item);

      // For videos, create a custom slide with video element
      if (itemIsVideo) {
        return {
          type: "image" as const, // Required by the library
          src: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ0cmFuc3BhcmVudCIvPjwvc3ZnPg==", // Transparent placeholder
          alt: item.alt || item.fileName || "Video",
          width: item.width || 1920,
          height: item.height || 1080,
          // Store the actual video URL and metadata
          videoSrc: item.url,
          isVideoSlide: true,
        };
      }

      return {
        type: "image" as const,
        src: item.url,
        alt: item.alt || item.fileName || "Image",
        width: item.width || 1920,
        height: item.height || 1080,
        isVideoSlide: false,
      };
    });
  }, [mediaItems]);

  // Custom slide renderer for videos
  const renderSlide = useCallback(({ slide }: any) => {
    if (slide.isVideoSlide && slide.videoSrc) {
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "black",
          }}
        >
          <video
            controls
            autoPlay
            muted
            playsInline
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
            }}
            src={slide.videoSrc}
          >
            Your browser does not support the video tag.
          </video>
        </div>
      );
    }
    // Return undefined for images to use default rendering
    return undefined;
  }, []);

  // Custom thumbnail renderer
  const renderThumbnail = useCallback(({ slide, rect }: any) => {
    if (slide.isVideoSlide && slide.videoSrc) {
      return (
        <div
          style={{
            width: rect.width,
            height: rect.height,
            position: "relative",
            backgroundColor: "#1f2937",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "4px",
            overflow: "hidden",
          }}
        >
          {/* Video thumbnail */}
          <video
            src={slide.videoSrc}
            muted
            preload="metadata"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
          {/* Play icon overlay */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              color: "white",
              fontSize: "14px",
              backgroundColor: "rgba(0,0,0,0.7)",
              borderRadius: "50%",
              width: "24px",
              height: "24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            ▶
          </div>
        </div>
      );
    }

    // Default image thumbnail
    return (
      <img
        src={slide.src}
        alt={slide.alt || ""}
        style={{
          width: rect.width,
          height: rect.height,
          objectFit: "cover",
          borderRadius: "4px",
        }}
      />
    );
  }, []);

  if (!isOpen || mediaItems.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <Lightbox
        open={isOpen}
        close={onClose}
        slides={slides}
        index={initialIndex}
        plugins={[Thumbnails, Zoom, Fullscreen]}
        thumbnails={{
          position: "bottom",
          width: 80,
          height: 60,
          border: 2,
          borderRadius: 4,
          padding: 4,
          gap: 8,
        }}
        zoom={{
          maxZoomPixelRatio: 3,
          zoomInMultiplier: 2,
          doubleTapDelay: 300,
          doubleClickDelay: 300,
          doubleClickMaxStops: 2,
          keyboardMoveDistance: 50,
          wheelZoomDistanceFactor: 100,
          pinchZoomDistanceFactor: 100,
        }}
        carousel={{
          finite: false,
          preload: 2,
          padding: "16px",
          spacing: "30%",
          imageFit: "contain",
        }}
        controller={{
          closeOnPullDown: true,
          closeOnBackdropClick: true,
        }}
        // Custom styles
        styles={{
          container: {
            backgroundColor: "rgba(0, 0, 0, 0.95)",
          },
          slide: {
            padding: "20px",
          },
        }}
        // Animation settings
        animation={{
          fade: 250,
          swipe: 500,
        }}
        // Custom rendering
        render={{
          slide: renderSlide,
          thumbnail: renderThumbnail,
        }}
      />
    </div>
  );
};

export default MediaViewer;
