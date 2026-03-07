import * as React from "react";
import { cn } from "@/lib/utils";
import { Music2, Search, List, Clock, Volume2, History } from "lucide-react";
import { Song } from "@shared/schema";

interface GuestBottomNavigationProps {
  className?: string;
  onAccordionValueChange?: (value: string) => void;
  currentlyPlaying?: Song;
  allowSongRequests?: boolean;
  allowPlaylistSharing?: boolean;
  allowGuestPlayOnDevice?: boolean;
  allowRecentlyPlayedVisibility?: boolean;
}

export function GuestBottomNavigation({ 
  className, 
  onAccordionValueChange,
  currentlyPlaying,
  allowSongRequests = true,
  allowPlaylistSharing = true,
  allowGuestPlayOnDevice = true,
  allowRecentlyPlayedVisibility = true
}: GuestBottomNavigationProps) {
  // Track the currently active accordion
  const [activeSection, setActiveSection] = React.useState<string | null>(null);
  
  const scrollToSection = (id: string, accordionValue?: string) => {
    // First handle the accordion state
    if (accordionValue && onAccordionValueChange) {
      // If clicking on the same section that's already open, close it
      if (activeSection === accordionValue) {
        onAccordionValueChange("");
        setActiveSection(null);
      } else {
        // Otherwise, open the clicked section
        onAccordionValueChange(accordionValue);
        setActiveSection(accordionValue);
      }
    }
    
    // Add a small delay to ensure accordion state is updated before scrolling
    setTimeout(() => {
      // Get header height to offset the scroll position
      const header = document.querySelector('header');
      const headerHeight = header ? header.offsetHeight + 10 : 80; // add padding
      
      // Then scroll to the section
      const element = document.getElementById(id);
      if (element) {
        // Get the element's position
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerHeight;
        
        // Perform the scroll
        window.scrollTo({
          top: offsetPosition,
          behavior: "smooth"
        });
      }
    }, 150); // longer delay to ensure accordion has time to expand
  };

  // Count enabled navigation items to adjust widths
  const enabledCount = 2 + // Now Playing and Queue are always shown
    (allowSongRequests ? 1 : 0) +
    (allowPlaylistSharing ? 1 : 0) +
    (allowGuestPlayOnDevice ? 1 : 0) +
    (allowRecentlyPlayedVisibility ? 1 : 0);
  
  // Calculate width for each navigation item
  const itemWidth = `${100 / enabledCount}%`;

  return (
    <div className={cn(
      "fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around bg-background border-t border-border py-2 px-1 h-16 sm:hidden",
      className
    )}>
      {/* Now Playing */}
      <div 
        onClick={() => {
          // Scroll to the currently playing song display at the top
          const headerHeight = document.querySelector('header')?.offsetHeight || 70;
          window.scrollTo({
            top: headerHeight,
            behavior: "smooth"
          });
          // Close any open accordions
          if (onAccordionValueChange) {
            onAccordionValueChange("");
            setActiveSection(null);
          }
        }}
        className={cn(
          "flex flex-col items-center justify-center p-2 hover:text-primary cursor-pointer",
          activeSection === "current-song" ? "text-primary" : "text-muted-foreground"
        )}
        style={{ width: itemWidth }}
      >
        <Music2 className="h-5 w-5" />
        <span className="text-xs mt-1">Playing</span>
      </div>
      
      {/* Queue */}
      <div 
        onClick={() => scrollToSection("queue", "queue")}
        className={cn(
          "flex flex-col items-center justify-center p-2 hover:text-primary cursor-pointer",
          activeSection === "queue" ? "text-primary" : "text-muted-foreground"
        )}
        style={{ width: itemWidth }}
      >
        <Clock className="h-5 w-5" />
        <span className="text-xs mt-1">Queue</span>
      </div>
      
      {/* Search - Only show if song requests are allowed */}
      {allowSongRequests && (
        <div 
          onClick={() => scrollToSection("search", "search")}
          className={cn(
            "flex flex-col items-center justify-center p-2 hover:text-primary cursor-pointer",
            activeSection === "search" ? "text-primary" : "text-muted-foreground"
          )}
          style={{ width: itemWidth }}
        >
          <Search className="h-5 w-5" />
          <span className="text-xs mt-1">Search</span>
        </div>
      )}
      
      {/* Playlists - Only show if playlist sharing is allowed */}
      {allowPlaylistSharing && (
        <div 
          onClick={() => scrollToSection("playlists", "playlists")}
          className={cn(
            "flex flex-col items-center justify-center p-2 hover:text-primary cursor-pointer",
            activeSection === "playlists" ? "text-primary" : "text-muted-foreground"
          )}
          style={{ width: itemWidth }}
        >
          <List className="h-5 w-5" />
          <span className="text-xs mt-1">Playlists</span>
        </div>
      )}

      {/* Play on Device - Only show if guest play on device is allowed */}
      {allowGuestPlayOnDevice && (
        <div 
          onClick={() => scrollToSection("play-device", "play-device")}
          className={cn(
            "flex flex-col items-center justify-center p-2 hover:text-primary cursor-pointer",
            activeSection === "play-device" ? "text-primary" : "text-muted-foreground"
          )}
          style={{ width: itemWidth }}
        >
          <Volume2 className="h-5 w-5" />
          <span className="text-xs mt-1">Play</span>
        </div>
      )}

      {/* Recently Played - Only show if recently played visibility is allowed */}
      {allowRecentlyPlayedVisibility && (
        <div 
          onClick={() => scrollToSection("history", "history")}
          className={cn(
            "flex flex-col items-center justify-center p-2 hover:text-primary cursor-pointer",
            activeSection === "history" ? "text-primary" : "text-muted-foreground"
          )}
          style={{ width: itemWidth }}
        >
          <History className="h-5 w-5" />
          <span className="text-xs mt-1">History</span>
        </div>
      )}
    </div>
  );
}