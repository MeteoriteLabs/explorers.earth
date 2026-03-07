import { useState, useEffect } from 'react';

interface ImageWithFallbackProps {
  src?: string;
  alt: string;
  fallbackSrc?: string;
  className?: string;
  referrerPolicy?: React.ImgHTMLAttributes<HTMLImageElement>['referrerPolicy'];
  onError?: () => void;
  onLoad?: () => void;
}

const ImageWithFallback: React.FC<ImageWithFallbackProps> = ({
  src,
  alt,
  fallbackSrc,
  className = "",
  referrerPolicy,
  onError,
  onLoad,
}) => {
  const [imgSrc, setImgSrc] = useState(src);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Reset state when src changes
  useEffect(() => {
    setImgSrc(src);
    setHasError(false);
    setIsLoading(true);
  }, [src]);

  const handleError = () => {
    console.log('Image failed to load:', imgSrc);
    if (!hasError && imgSrc !== fallbackSrc) {
      setHasError(true);
      if (fallbackSrc) {
        setImgSrc(fallbackSrc);
      } else {
        setIsLoading(false);
      }
      onError?.();
    } else if (imgSrc === fallbackSrc) {
      console.log('Fallback image also failed');
      setIsLoading(false);
    }
  };

  const handleLoad = () => {
    setIsLoading(false);
    onLoad?.();
  };

  // If we have an error and no fallback, or fallback also failed, show a styled placeholder
  if (hasError && (!fallbackSrc || imgSrc === fallbackSrc) && !isLoading) {
    return (
      <div 
        className={`${className} bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-sm font-semibold rounded-full shadow-lg`}
        style={{ minHeight: '60px', minWidth: '60px' }}
      >
        {alt?.charAt(0)?.toUpperCase() || 'L'}
      </div>
    );
  }

  return (
    <img
      src={imgSrc || fallbackSrc}
      alt={alt}
      className={className}
      referrerPolicy={referrerPolicy}
      onError={handleError}
      onLoad={handleLoad}
    />
  );
};

export default ImageWithFallback;