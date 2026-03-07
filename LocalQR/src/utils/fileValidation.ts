/**
 * File Upload Validation Utility
 * Provides comprehensive validation for image and video uploads
 * with support for Strapi Media Library and S3 storage
 */

// Supported file formats
export const SUPPORTED_IMAGE_FORMATS = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
};

export const SUPPORTED_VIDEO_FORMATS = {
  'video/mp4': ['.mp4'],
  'video/webm': ['.webm'],
  'video/quicktime': ['.mov'],
  // Note: Commenting out formats that may not be well-supported by all browsers
  // 'video/x-msvideo': ['.avi'],
  // 'video/x-matroska': ['.mkv'],
  // 'video/mp4': ['.m4v'],
};

// File size limits (in bytes)
export const FILE_SIZE_LIMITS = {
  IMAGE_MAX_SIZE: 5 * 1024 * 1024, // 5MB for images
  VIDEO_MAX_SIZE: 10 * 1024 * 1024, // 10MB for videos
} as const;

// All supported MIME types
export const ALL_SUPPORTED_IMAGE_TYPES = Object.keys(SUPPORTED_IMAGE_FORMATS) as string[];
export const ALL_SUPPORTED_VIDEO_TYPES = Object.keys(SUPPORTED_VIDEO_FORMATS) as string[];
export const ALL_SUPPORTED_TYPES = [...ALL_SUPPORTED_IMAGE_TYPES, ...ALL_SUPPORTED_VIDEO_TYPES];

// Generate accept attribute for file inputs
export const ACCEPT_STRINGS = {
  IMAGES_ONLY: ALL_SUPPORTED_IMAGE_TYPES.join(','),
  VIDEOS_ONLY: ALL_SUPPORTED_VIDEO_TYPES.join(','),
  IMAGES_AND_VIDEOS: ALL_SUPPORTED_TYPES.join(','),
} as const;

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  fileType: 'image' | 'video' | 'unknown';
  size: number;
  name: string;
}

export interface FileValidationOptions {
  allowImages?: boolean;
  allowVideos?: boolean;
  maxImageSize?: number;
  maxVideoSize?: number;
  customErrorMessages?: {
    unsupportedType?: string;
    oversizedImage?: string;
    oversizedVideo?: string;
  };
}

/**
 * Validates a single file for upload
 */
export const validateFile = (
  file: File,
  options: FileValidationOptions = {}
): FileValidationResult => {
  const {
    allowImages = true,
    allowVideos = true,
    maxImageSize = FILE_SIZE_LIMITS.IMAGE_MAX_SIZE,
    maxVideoSize = FILE_SIZE_LIMITS.VIDEO_MAX_SIZE,
    customErrorMessages = {},
  } = options;

  const result: FileValidationResult = {
    isValid: false,
    fileType: 'unknown',
    size: file.size,
    name: file.name,
  };

  // Check if it's an image
  if (ALL_SUPPORTED_IMAGE_TYPES.includes(file.type)) {
    result.fileType = 'image';
    
    if (!allowImages) {
      result.error = 'Image files are not allowed';
      return result;
    }

    // Verify file extension matches MIME type
    const expectedExtensions = SUPPORTED_IMAGE_FORMATS[file.type as keyof typeof SUPPORTED_IMAGE_FORMATS];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (expectedExtensions && !expectedExtensions.includes(fileExtension)) {
      result.error = customErrorMessages.unsupportedType || 
        `File extension "${fileExtension}" doesn't match the file type. Expected: ${expectedExtensions?.join(', ')}`;
      return result;
    }

    // Check file size
    if (file.size > maxImageSize) {
      result.error = customErrorMessages.oversizedImage || 
        `Image file size (${formatFileSize(file.size)}) exceeds the maximum limit of ${formatFileSize(maxImageSize)}`;
      return result;
    }

    result.isValid = true;
    return result;
  }

  // Check if it's a video
  if (ALL_SUPPORTED_VIDEO_TYPES.includes(file.type)) {
    result.fileType = 'video';
    
    if (!allowVideos) {
      result.error = 'Video files are not allowed';
      return result;
    }

    // Verify file extension matches MIME type
    const expectedExtensions = SUPPORTED_VIDEO_FORMATS[file.type as keyof typeof SUPPORTED_VIDEO_FORMATS];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (expectedExtensions && !expectedExtensions.includes(fileExtension)) {
      result.error = customErrorMessages.unsupportedType || 
        `File extension "${fileExtension}" doesn't match the file type. Expected: ${expectedExtensions?.join(', ')}`;
      return result;
    }

    // Check file size
    if (file.size > maxVideoSize) {
      result.error = customErrorMessages.oversizedVideo || 
        `Video file size (${formatFileSize(file.size)}) exceeds the maximum limit of ${formatFileSize(maxVideoSize)}`;
      return result;
    }

    result.isValid = true;
    return result;
  }

  // Unsupported file type
  result.error = customErrorMessages.unsupportedType || 
    `Unsupported file format: ${file.type}. Supported formats: Images (${Object.values(SUPPORTED_IMAGE_FORMATS).flat().join(', ')}) and Videos (${Object.values(SUPPORTED_VIDEO_FORMATS).flat().join(', ')})`;
  
  return result;
};

/**
 * Validates multiple files for upload
 */
export const validateFiles = (
  files: FileList | File[],
  options: FileValidationOptions = {}
): { validFiles: File[]; invalidFiles: { file: File; error: string }[] } => {
  const validFiles: File[] = [];
  const invalidFiles: { file: File; error: string }[] = [];

  Array.from(files).forEach(file => {
    const validation = validateFile(file, options);
    
    if (validation.isValid) {
      validFiles.push(file);
    } else {
      invalidFiles.push({ file, error: validation.error || 'Unknown validation error' });
    }
  });

  return { validFiles, invalidFiles };
};

/**
 * Format file size for display
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Get human-readable list of supported formats
 */
export const getSupportedFormatsText = (includeImages = true, includeVideos = true): string => {
  const formats: string[] = [];
  
  if (includeImages) {
    formats.push(...Object.values(SUPPORTED_IMAGE_FORMATS).flat());
  }
  
  if (includeVideos) {
    formats.push(...Object.values(SUPPORTED_VIDEO_FORMATS).flat());
  }
  
  return formats.join(', ').toUpperCase();
};

/**
 * Enhanced file type detection that works with both File objects and URLs
 */
export const getEnhancedFileType = (input: File | string): 'image' | 'video' | 'unknown' => {
  if (typeof input === 'string') {
    // URL-based detection (fallback)
    const url = input.toLowerCase();
    
    if (Object.values(SUPPORTED_IMAGE_FORMATS).flat().some(ext => url.includes(ext))) {
      return 'image';
    }
    
    if (Object.values(SUPPORTED_VIDEO_FORMATS).flat().some(ext => url.includes(ext))) {
      return 'video';
    }
    
    return 'unknown';
  }
  
  // File object detection (preferred)
  const validation = validateFile(input);
  return validation.fileType;
};

/**
 * Create error message for unsupported files with suggestions
 */
export const createUnsupportedFileMessage = (fileName: string, fileType: string): string => {
  return `"${fileName}" (${fileType}) is not supported. Please upload files in these formats: ${getSupportedFormatsText()}`;
};
