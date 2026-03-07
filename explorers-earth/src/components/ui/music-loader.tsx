// MusicLoader component for loading states
import { Loader2, Music2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface MusicLoaderProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  className?: string;
}

export default function MusicLoader({ 
  size = 'md', 
  text = 'Loading...', 
  className 
}: MusicLoaderProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  return (
    <div className={cn('flex flex-col items-center justify-center space-y-2', className)}>
      <div className="relative">
        <Music2 className={cn('text-primary', sizeClasses[size])} />
        <Loader2 className={cn(
          'absolute -top-1 -right-1 animate-spin text-primary',
          size === 'sm' ? 'h-3 w-3' : size === 'md' ? 'h-4 w-4' : 'h-5 w-5'
        )} />
      </div>
      {text && (
        <p className="text-sm text-muted-foreground">{text}</p>
      )}
    </div>
  );
}
