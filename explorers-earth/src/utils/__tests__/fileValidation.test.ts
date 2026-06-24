import { describe, it, expect } from 'vitest';
import {
  validateFile,
  validateFiles,
  formatFileSize,
  getSupportedFormatsText,
  getEnhancedFileType,
  createUnsupportedFileMessage,
  FILE_SIZE_LIMITS
} from '../fileValidation';

describe('fileValidation', () => {

  // Helper to create mock File objects
  const createMockFile = (name: string, type: string, size: number): File => {
    // Note: We use a simple Blob fallback for test environments if File isn't fully supported
    return new File([''], name, { type }) as File;
  };

  // ── formatFileSize ─────────────────────────────────────────────────────────
  describe('formatFileSize', () => {
    it('returns "0 Bytes" for 0', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
    });

    it('formats bytes correctly', () => {
      expect(formatFileSize(500)).toBe('500 Bytes');
    });

    it('formats KB correctly', () => {
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1500)).toBe('1.46 KB');
    });

    it('formats MB correctly', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1 MB');
      expect(formatFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
    });

    it('formats GB correctly', () => {
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
    });
  });

  // ── getSupportedFormatsText ────────────────────────────────────────────────
  describe('getSupportedFormatsText', () => {
    it('returns both image and video formats by default', () => {
      const text = getSupportedFormatsText();
      expect(text).toContain('.JPG');
      expect(text).toContain('.PNG');
      expect(text).toContain('.MP4');
    });

    it('returns only image formats when includeVideos is false', () => {
      const text = getSupportedFormatsText(true, false);
      expect(text).toContain('.JPG');
      expect(text).not.toContain('.MP4');
    });

    it('returns only video formats when includeImages is false', () => {
      const text = getSupportedFormatsText(false, true);
      expect(text).not.toContain('.JPG');
      expect(text).toContain('.MP4');
    });
  });

  // ── validateFile ───────────────────────────────────────────────────────────
  describe('validateFile', () => {
    it('validates a correct image file', () => {
      const file = createMockFile('test.jpg', 'image/jpeg', 1024);
      Object.defineProperty(file, 'size', { value: 1024 });
      
      const result = validateFile(file);
      expect(result.isValid).toBe(true);
      expect(result.fileType).toBe('image');
      expect(result.error).toBeUndefined();
    });

    it('validates a correct video file', () => {
      const file = createMockFile('test.mp4', 'video/mp4', 1024);
      Object.defineProperty(file, 'size', { value: 1024 });

      const result = validateFile(file);
      expect(result.isValid).toBe(true);
      expect(result.fileType).toBe('video');
    });

    it('rejects an unsupported file type', () => {
      const file = createMockFile('test.txt', 'text/plain', 1024);
      const result = validateFile(file);
      expect(result.isValid).toBe(false);
      expect(result.fileType).toBe('unknown');
      expect(result.error).toContain('Unsupported file format: text/plain');
    });

    it('rejects an image when allowImages is false', () => {
      const file = createMockFile('test.jpg', 'image/jpeg', 1024);
      const result = validateFile(file, { allowImages: false });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Image files are not allowed');
    });

    it('rejects a video when allowVideos is false', () => {
      const file = createMockFile('test.mp4', 'video/mp4', 1024);
      const result = validateFile(file, { allowVideos: false });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Video files are not allowed');
    });

    it('rejects file when extension does not match MIME type', () => {
      const file = createMockFile('test.txt', 'image/jpeg', 1024);
      const result = validateFile(file);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('File extension ".txt" doesn\'t match the file type');
    });

    it('rejects oversized image', () => {
      const size = FILE_SIZE_LIMITS.IMAGE_MAX_SIZE + 1024;
      const file = createMockFile('test.jpg', 'image/jpeg', size);
      Object.defineProperty(file, 'size', { value: size });

      const result = validateFile(file);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Image file size');
      expect(result.error).toContain('exceeds the maximum limit');
    });

    it('rejects oversized video', () => {
      const size = FILE_SIZE_LIMITS.VIDEO_MAX_SIZE + 1024;
      const file = createMockFile('test.mp4', 'video/mp4', size);
      Object.defineProperty(file, 'size', { value: size });

      const result = validateFile(file);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Video file size');
      expect(result.error).toContain('exceeds the maximum limit');
    });

    it('uses custom error messages', () => {
      const size = FILE_SIZE_LIMITS.IMAGE_MAX_SIZE + 1024;
      const file = createMockFile('test.jpg', 'image/jpeg', size);
      Object.defineProperty(file, 'size', { value: size });

      const result = validateFile(file, { customErrorMessages: { oversizedImage: 'Too big!' } });
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Too big!');
    });
  });

  // ── validateFiles ──────────────────────────────────────────────────────────
  describe('validateFiles', () => {
    it('separates valid and invalid files', () => {
      const validFile = createMockFile('valid.jpg', 'image/jpeg', 1024);
      Object.defineProperty(validFile, 'size', { value: 1024 });

      const invalidFile = createMockFile('invalid.txt', 'text/plain', 1024);
      Object.defineProperty(invalidFile, 'size', { value: 1024 });

      const result = validateFiles([validFile, invalidFile]);
      expect(result.validFiles).toHaveLength(1);
      expect(result.validFiles[0].name).toBe('valid.jpg');
      expect(result.invalidFiles).toHaveLength(1);
      expect(result.invalidFiles[0].file.name).toBe('invalid.txt');
      expect(result.invalidFiles[0].error).toBeTruthy();
    });
  });

  // ── getEnhancedFileType ────────────────────────────────────────────────────
  describe('getEnhancedFileType', () => {
    it('detects type from File object', () => {
      const file = createMockFile('test.jpg', 'image/jpeg', 1024);
      expect(getEnhancedFileType(file)).toBe('image');
    });

    it('detects image type from URL string', () => {
      expect(getEnhancedFileType('https://example.com/image.png')).toBe('image');
    });

    it('detects video type from URL string', () => {
      expect(getEnhancedFileType('https://example.com/video.mp4')).toBe('video');
    });

    it('returns unknown for unsupported URL extension', () => {
      expect(getEnhancedFileType('https://example.com/document.pdf')).toBe('unknown');
    });
  });

  // ── createUnsupportedFileMessage ───────────────────────────────────────────
  describe('createUnsupportedFileMessage', () => {
    it('returns a formatted error message with supported formats', () => {
      const message = createUnsupportedFileMessage('test.pdf', 'application/pdf');
      expect(message).toContain('"test.pdf" (application/pdf) is not supported');
      expect(message).toContain('.JPG');
    });
  });
});
