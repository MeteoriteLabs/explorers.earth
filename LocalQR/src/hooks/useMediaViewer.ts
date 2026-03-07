import { useState, useCallback } from 'react';
import type { MediaItem } from '../components/ui/MediaViewer';

interface UseMediaViewerReturn {
  isOpen: boolean;
  currentIndex: number;
  openViewer: (index?: number) => void;
  closeViewer: () => void;
  goToIndex: (index: number) => void;
}

/**
 * Hook for managing MediaViewer state
 * 
 * Provides convenient methods for opening/closing the media viewer
 * and managing the current slide index.
 */
export const useMediaViewer = (): UseMediaViewerReturn => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const openViewer = useCallback((index: number = 0) => {
    setCurrentIndex(index);
    setIsOpen(true);
  }, []);

  const closeViewer = useCallback(() => {
    setIsOpen(false);
  }, []);

  const goToIndex = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  return {
    isOpen,
    currentIndex,
    openViewer,
    closeViewer,
    goToIndex,
  };
};

/**
 * Utility function to convert various media formats to MediaItem
 */
export const convertToMediaItems = (items: any[]): MediaItem[] => {
  return items.map((item, index) => ({
    id: item.id || item.documentId || `media-${index}`,
    url: item.url,
    alt: item.alt || item.fileName || (item.type === 'video' ? 'Video' : 'Image'),
    type: item.type || 'image',
    fileName: item.fileName,
    aspectRatio: item.aspectRatio,
    width: item.width,
    height: item.height,
  }));
};
