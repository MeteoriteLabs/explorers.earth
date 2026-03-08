/**
 * Aspect Ratio Detection and Management Utility
 * Supports Instagram-like aspect ratios for both images and videos
 */

export type SupportedAspectRatio = 
  | "1:1"      // Square (e.g., 1080 × 1080 px)
  | "4:5"      // Portrait (e.g., 1080 × 1350 px, tallest allowed in feed)
  | "1.91:1"   // Landscape (e.g., 1080 × 566 px)
  | "9:16";    // Fullscreen vertical (e.g., 1080 × 1920 px)

export interface AspectRatioInfo {
  ratio: SupportedAspectRatio;
  decimal: number;
  width: number;
  height: number;
}

// Supported aspect ratios with their decimal values
export const ASPECT_RATIOS: Record<SupportedAspectRatio, AspectRatioInfo> = {
  "1:1": {
    ratio: "1:1",
    decimal: 1.0,
    width: 1080,
    height: 1080,
  },
  "4:5": {
    ratio: "4:5",
    decimal: 0.8,
    width: 1080,
    height: 1350,
  },
  "1.91:1": {
    ratio: "1.91:1",
    decimal: 1.91,
    width: 1080,
    height: 566,
  },
  "9:16": {
    ratio: "9:16",
    decimal: 0.5625,
    width: 1080,
    height: 1920,
  },
};

/**
 * Calculates the decimal aspect ratio from width and height
 */
export const calculateAspectRatio = (width: number, height: number): number => {
  if (height === 0) return 1;
  return width / height;
};

/**
 * Finds the closest supported aspect ratio for given dimensions
 */
export const getClosestAspectRatio = (
  width: number, 
  height: number
): SupportedAspectRatio => {
  const actualRatio = calculateAspectRatio(width, height);
  
  let closestRatio: SupportedAspectRatio = "1:1";
  let minDifference = Infinity;
  
  Object.entries(ASPECT_RATIOS).forEach(([key, info]) => {
    const difference = Math.abs(actualRatio - info.decimal);
    if (difference < minDifference) {
      minDifference = difference;
      closestRatio = key as SupportedAspectRatio;
    }
  });
  
  return closestRatio;
};

/**
 * Detects aspect ratio from an image or video file
 */
export const detectMediaAspectRatio = async (
  file: File
): Promise<{ aspectRatio: SupportedAspectRatio; width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    if (file.type.startsWith('image/')) {
      const img = new Image();
      img.onload = () => {
        const aspectRatio = getClosestAspectRatio(img.naturalWidth, img.naturalHeight);
        resolve({
          aspectRatio,
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    } else if (file.type.startsWith('video/')) {
      const video = document.createElement('video');
      video.onloadedmetadata = () => {
        const aspectRatio = getClosestAspectRatio(video.videoWidth, video.videoHeight);
        resolve({
          aspectRatio,
          width: video.videoWidth,
          height: video.videoHeight,
        });
      };
      video.onerror = () => reject(new Error('Failed to load video'));
      video.src = URL.createObjectURL(file);
    } else {
      reject(new Error('Unsupported file type'));
    }
  });
};

/**
 * Detects aspect ratio from a URL (for existing media)
 */
export const detectUrlAspectRatio = async (
  url: string,
  isVideo: boolean = false
): Promise<{ aspectRatio: SupportedAspectRatio; width: number; height: number }> => {
  return new Promise((resolve) => {
    if (isVideo) {
      const video = document.createElement('video');
      
      // Set a timeout for video loading
      const timeout = setTimeout(() => {
        resolve({
          aspectRatio: "1.91:1",
          width: 1080,
          height: 566,
        });
      }, 10000); // 10 second timeout
      
      video.crossOrigin = 'anonymous';
      video.onloadedmetadata = () => {
        clearTimeout(timeout);
        const aspectRatio = getClosestAspectRatio(video.videoWidth, video.videoHeight);
        resolve({
          aspectRatio,
          width: video.videoWidth,
          height: video.videoHeight,
        });
      };
      video.onerror = () => {
        clearTimeout(timeout);
        console.warn(`Failed to load video for aspect ratio detection: ${url}`);
        // Fallback to 16:9 for videos if detection fails
        resolve({
          aspectRatio: "1.91:1",
          width: 1080,
          height: 566,
        });
      };
      video.src = url;
    } else {
      const img = new Image();
      
      // Set a timeout for image loading
      const timeout = setTimeout(() => {
        console.warn(`Timeout loading image for aspect ratio detection: ${url}`);
        resolve({
          aspectRatio: "4:5",
          width: 800,
          height: 1000,
        });
      }, 10000); // 10 second timeout
      
      img.onload = () => {
        clearTimeout(timeout);
        const aspectRatio = getClosestAspectRatio(img.naturalWidth, img.naturalHeight);
        resolve({
          aspectRatio,
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
      };
      img.onerror = () => {
        clearTimeout(timeout);
        console.warn(`Failed to load image for aspect ratio detection: ${url}`);
        // Use a more intelligent fallback based on typical image dimensions
        resolve({
          aspectRatio: "4:5", // Common social media aspect ratio
          width: 800,
          height: 1000,
        });
      };
      
      // Try without crossOrigin first for better compatibility
      try {
        img.src = url;
      } catch (error) {
        // If direct loading fails, try with crossOrigin
        img.crossOrigin = 'anonymous';
        img.src = url;
      }
    }
  });
};

/**
 * Gets the normalized dimensions for a given aspect ratio
 * @param aspectRatio - The target aspect ratio
 * @param baseSize - Base size for calculations (default: 300)
 */
export const getNormalizedDimensions = (
  aspectRatio: SupportedAspectRatio,
  baseSize: number = 300
): { width: number; height: number } => {
  switch (aspectRatio) {
    case "1:1":
      return { width: baseSize, height: baseSize };
    case "4:5":
      return { width: baseSize, height: Math.round(baseSize * 1.25) };
    case "1.91:1":
      return { width: baseSize, height: Math.round(baseSize / 1.91) };
    case "9:16":
      return { width: baseSize, height: Math.round(baseSize * 1.78) };
    default:
      return { width: baseSize, height: baseSize };
  }
};
