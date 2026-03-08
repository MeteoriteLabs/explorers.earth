import { Gallery, type Image } from "react-grid-gallery";
import React from "react";
import {
  SupportedAspectRatio,
  getNormalizedDimensions,
  detectUrlAspectRatio,
} from "../../utils/aspectRatioUtils";

/**
 * FeedLayout     return {
      // For videos: use a small colored placeholder that will be completely covered by video
      // For images: use the actual image URL
      src: isVideo 
        ? "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMWYyOTM3Ii8+PC9zdmc+"
        : media.url,
      width,
      height,
      alt: media.alt || media.fileName || (isVideo ? "Video" : "Image"),
      caption: media.caption,
      isSelected: enableSelection ? false : undefined,
      customOverlay,
      // Add custom properties to identify videos
      ...(isVideo && {
        tags: [{ value: "video", title: "video" }],
      }),
    } as Image;ith direct video rendering support
 * Now supports both images and videos with proper aspect ratio detection.
 * Videos are rendered directly in the grid with autoplay, mute, and loop
 * functionality, seamlessly integrated with images using predefined
 * aspect ratios (1:1, 4:5, 1.91:1, 9:16).
 */

interface MediaData {
  id: string;
  url: string;
  alt?: string;
  type?: "image" | "video";
  /** Detected or provided aspect ratio */
  aspectRatio?: SupportedAspectRatio;
  /** Optional explicit dimensions (override aspectRatio inference) */
  width?: number;
  height?: number;
  /** Optional caption text */
  caption?: string;
  /** Optional filename for accessibility */
  fileName?: string;
}

interface FeedLayoutProps {
  images: MediaData[];
  className?: string;
  /** Height of each justified row (react-grid-gallery option). Default 200 */
  rowHeight?: number;
  /** Margin (gap) between images. Default 4 */
  margin?: number;
  /** Disable built‑in selection behavior */
  enableSelection?: boolean;
  /** Click handler for a media item */
  onImageClick?: (index: number, media: MediaData) => void;
  /** Try to auto-detect aspect ratios for media missing dimensions. Default true */
  autoDetectDimensions?: boolean;
  /** Optional overlay renderer placed above each media item */
  getOverlay?: (media: MediaData, index: number) => React.ReactNode;
  /** Whether videos should have cursor pointer. Default true */
  videoCursorPointer?: boolean;
}

const DEFAULT_BASE = 300; // base width used for aspect ratio inference

/**
 * Determines if a URL is likely a video based on common video extensions
 */
const isVideoUrl = (url: string): boolean => {
  const videoExtensions = [".mp4", ".webm", ".mov", ".avi", ".mkv", ".m4v"];
  return videoExtensions.some((ext) => url.toLowerCase().includes(ext));
};

/**
 * Infers dimensions from aspect ratio using new supported ratios
 */
const inferDimensions = (
  media: MediaData
): { width: number; height: number } => {
  if (media.width && media.height)
    return { width: media.width, height: media.height };

  // Use the new aspect ratio system
  if (media.aspectRatio) {
    return getNormalizedDimensions(media.aspectRatio, DEFAULT_BASE);
  }

  // Fallback to square for unknown aspect ratios
  return { width: DEFAULT_BASE, height: DEFAULT_BASE };
};

const FeedLayout: React.FC<FeedLayoutProps> = ({
  images,
  className = "",
  rowHeight = 200,
  margin = 4,
  enableSelection = false,
  onImageClick,
  autoDetectDimensions = true,
  getOverlay,
  videoCursorPointer = true,
}) => {
  const [resolvedImages, setResolvedImages] =
    React.useState<MediaData[]>(images);
  const [loadingDims, setLoadingDims] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const needDetection =
      autoDetectDimensions &&
      images.some((item) => !item.width || !item.height);

    if (!needDetection) {
      setResolvedImages(images);
      return;
    }

    setLoadingDims(true);

    // Enhanced dimension detection for both images and videos
    const loaders = images.map(async (media) => {
      if (media.width && media.height) return media;

      try {
        const isVideo = media.type === "video" || isVideoUrl(media.url);
        const detection = await detectUrlAspectRatio(media.url, isVideo);

        return {
          ...media,
          width: detection.width,
          height: detection.height,
          aspectRatio: detection.aspectRatio,
          type:
            media.type || (isVideo ? ("video" as const) : ("image" as const)),
        };
      } catch (error) {
        console.warn(`Failed to detect dimensions for ${media.url}:`, error);
        // Fallback to inferred dimensions
        const { width, height } = inferDimensions(media);
        return {
          ...media,
          width,
          height,
          aspectRatio: media.aspectRatio || ("1:1" as SupportedAspectRatio),
        };
      }
    });

    Promise.all(loaders).then((withDims) => {
      if (!cancelled) {
        setResolvedImages(withDims);
        setLoadingDims(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [images, autoDetectDimensions]);

  if (!images || images.length === 0) return null;

  // Transform media data to react-grid-gallery format with direct video support
  const galleryImages: Image[] = resolvedImages.map((media, idx) => {
    const { width, height } =
      media.width && media.height
        ? { width: media.width, height: media.height }
        : inferDimensions(media);

    const isVideo = media.type === "video" || isVideoUrl(media.url);

    // For videos: render directly in grid with autoplay, mute, and loop
    // For images: use standard image rendering with optional overlay
    const customOverlay = isVideo ? (
      <div
        className="absolute inset-0 w-full h-full react-grid-gallery--custom-overlay"
        style={{
          display: "block",
          visibility: "visible",
          opacity: 1,
          zIndex: 2,
        }}
      >
        {/* Direct video rendering - autoplay, muted, looped */}
        <video
          className={`w-full h-full object-cover ${
            videoCursorPointer ? "cursor-pointer" : ""
          }`}
          src={media.url}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "auto",
            borderRadius: "inherit",
            background: "#1f2937", // Fallback background color
            display: "block",
            visibility: "visible",
            opacity: 1,
            zIndex: 1,
          }}
          onClick={() => {
            // Forward click to parent gallery handler
            if (onImageClick) {
              // Don't prevent default or stop propagation - let it bubble to gallery
              onImageClick(idx, media);
            }
          }}
          onError={(e) => {
            // Fallback: hide video and show error state
            const target = e.target as HTMLVideoElement;
            target.style.display = "none";
            const fallback = target.nextElementSibling as HTMLElement;
            if (fallback) fallback.style.display = "flex";
          }}
          onLoadStart={(e) => {
            // Add loading state styling
            const target = e.target as HTMLVideoElement;
            target.style.background = "#374151";
          }}
          onCanPlay={(e) => {
            // Remove loading state styling and ensure autoplay
            const target = e.target as HTMLVideoElement;
            target.style.background = "transparent";
            // Force play if paused (browser autoplay restrictions)
            if (target.paused) {
              target.play().catch(() => {
                // Silently handle autoplay restrictions
              });
            }
          }}
        />
        {/* Fallback content for failed video loads - initially hidden */}
        <div
          className={`absolute inset-0 bg-gray-800 flex items-center justify-center ${
            videoCursorPointer ? "cursor-pointer" : ""
          }`}
          style={{
            display: "none",
            borderRadius: "inherit",
          }}
          onClick={() => {
            // Forward click to parent gallery handler even for failed videos
            if (onImageClick) {
              onImageClick(idx, media);
            }
          }}
        >
          <div className="text-gray-400 text-xs text-center p-2">
            <div className="mb-2 text-lg">📹</div>
            <div className="break-words max-w-full px-1">
              {media.fileName || "Video"}
            </div>
            <div className="text-xs mt-1 text-gray-500">Unable to load</div>
          </div>
        </div>
        {/* Optional overlay from parent component */}
        {getOverlay && (
          <div className="pointer-events-auto relative z-10">
            {getOverlay(media, idx)}
          </div>
        )}
      </div>
    ) : getOverlay ? (
      <div className="pointer-events-auto">{getOverlay(media, idx)}</div>
    ) : undefined;

    return {
      // For videos: use a transparent placeholder to prevent image loading attempts
      // For images: use the actual image URL
      src: isVideo
        ? "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ0cmFuc3BhcmVudCIvPjwvc3ZnPg=="
        : media.url,
      width,
      height,
      alt: media.alt || media.fileName || (isVideo ? "Video" : "Image"),
      caption: media.caption,
      isSelected: enableSelection ? false : undefined,
      customOverlay,
      // Add custom properties to identify videos
      ...(isVideo && {
        tags: [{ value: "video", title: "video" }],
      }),
    } as Image;
  });

  if (loadingDims) {
    return (
      <div
        className={`w-full ${className} text-center text-xs text-gray-400 py-4`}
      >
        Loading media...
      </div>
    );
  }

  return (
    <div className={`w-full pb-4 ${className}`}>
      <Gallery
        images={galleryImages}
        enableImageSelection={enableSelection}
        rowHeight={rowHeight}
        margin={margin}
        onClick={(index) => {
          if (typeof index === "number" && onImageClick) {
            onImageClick(index, resolvedImages[index]);
          }
        }}
      />
    </div>
  );
};

export default FeedLayout;

// Export types for external use
export type { MediaData, FeedLayoutProps, SupportedAspectRatio };

// Backward compatibility export (deprecated - use MediaData instead)
export type ImageData = MediaData;
