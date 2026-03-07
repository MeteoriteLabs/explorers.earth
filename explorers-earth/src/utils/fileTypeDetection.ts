export const isVideoFile = (file: File): boolean => {
  return file.type.startsWith('video/');
};

export const isImageFile = (file: File): boolean => {
  return file.type.startsWith('image/');
};

export const getFileType = (file: File): 'video' | 'image' | 'unknown' => {
  if (isVideoFile(file)) return 'video';
  if (isImageFile(file)) return 'image';
  return 'unknown';
};

export const isVideoUrl = (url: string): boolean => {
  // Check if the media object has video mime type based on URL patterns
  const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.m4v'];
  return videoExtensions.some(ext => url.toLowerCase().includes(ext));
};

export const generateVideoThumbnail = (videoFile: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    video.addEventListener('loadedmetadata', () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      video.currentTime = 1; // Get frame at 1 second
    });

    video.addEventListener('seeked', () => {
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.8);
        resolve(thumbnailUrl);
      } else {
        reject(new Error('Failed to get canvas context'));
      }
    });

    video.addEventListener('error', reject);
    
    video.src = URL.createObjectURL(videoFile);
    video.load();
  });
};
