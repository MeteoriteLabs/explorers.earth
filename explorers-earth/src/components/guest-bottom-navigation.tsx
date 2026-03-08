// GuestBottomNavigation component for mobile navigation
import { Song } from '../types/music';
import Button from './ui/Button';
import { 
  Music2, 
  Search, 
  History, 
  Volume2
} from 'lucide-react';

interface GuestBottomNavigationProps {
  currentlyPlaying?: Song;
  onAccordionValueChange: (value: string) => void;
  allowSongRequests: boolean;
  allowPlaylistSharing: boolean;
  allowGuestPlayOnDevice: boolean;
  allowRecentlyPlayedVisibility: boolean;
}

export default function GuestBottomNavigation({
  currentlyPlaying,
  onAccordionValueChange,
  allowSongRequests,
  allowPlaylistSharing: _allowPlaylistSharing,
  allowGuestPlayOnDevice,
  allowRecentlyPlayedVisibility,
}: GuestBottomNavigationProps) {
  
  const navigationItems = [
    {
      id: 'queue',
      label: 'Queue',
      icon: Music2,
      enabled: true,
    },
    {
      id: 'search',
      label: 'Search',
      icon: Search,
      enabled: allowSongRequests,
    },
    {
      id: 'history',
      label: 'History',
      icon: History,
      enabled: allowRecentlyPlayedVisibility,
    },
    {
      id: 'play-device',
      label: 'Play',
      icon: Volume2,
      enabled: allowGuestPlayOnDevice,
    },
  ].filter(item => item.enabled);

  const handleNavigationClick = (itemId: string) => {
    // Scroll to the corresponding section
    const element = document.getElementById(itemId);
    if (element) {
      element.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });
      
      // Update accordion state to open the clicked section
      onAccordionValueChange(itemId);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] bg-gray-800/95 backdrop-blur-sm border-t border-gray-700 md:hidden">
      <div className="container mx-auto px-4 py-2">
        <div className="flex items-center justify-around">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentlyPlaying && item.id === 'queue';
            
            return (
              <Button
                key={item.id}
                variant="ghost"
                size="small"
                onClick={() => handleNavigationClick(item.id)}
                className={`flex flex-col items-center space-y-1 h-auto py-2 px-3 ${
                  isActive ? 'text-blue-400' : 'text-gray-300'
                }`}
                style={{ 
                  backgroundColor: 'transparent',
                  color: isActive ? '#60a5fa' : '#d1d5db'
                }}
              >
                <Icon className="h-5 w-5" style={{ color: isActive ? '#60a5fa' : '#d1d5db' }} />
                <span className="text-xs font-medium">{item.label}</span>
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
