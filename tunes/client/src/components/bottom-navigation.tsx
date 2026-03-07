import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Play, ListMusic, Search, History, List, Sliders } from "lucide-react";

interface BottomNavigationProps {
  className?: string;
  onAccordionValueChange?: (value: string) => void;
}

export function BottomNavigation({ className, onAccordionValueChange }: BottomNavigationProps) {
  const [activeNav, setActiveNav] = useState<string | null>(null);

  const handleNavClick = (id: string, accordionValue?: string) => {
    // Update active nav state
    setActiveNav(accordionValue || id);
    
    // Always call onAccordionValueChange to expand/collapse the section
    if (accordionValue && onAccordionValueChange) {
      onAccordionValueChange(accordionValue);
    }
    
    // Add a longer delay for queue section to ensure it has time to render properly
    const delay = id === 'queue' ? 250 : 150;
    
    // Add a delay to ensure accordion state is updated before scrolling
    setTimeout(() => {
      // Get header height to offset the scroll position
      const header = document.querySelector('header');
      const headerHeight = header ? header.offsetHeight + 10 : 80; // Added padding
      
      // Then scroll to the section
      const element = document.getElementById(id);
      if (element) {
        // Get the element's position
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.scrollY - headerHeight;
        
        // Scroll the element just below the header
        window.scrollTo({
          top: offsetPosition,
          behavior: "smooth"
        });
      }
    }, delay); // Dynamic delay to ensure accordion has time to expand
  };

  return (
    <div className={cn(
      "fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around bg-background border-t border-border py-2 px-1 h-16 sm:hidden",
      className
    )}>
      <div 
        onClick={() => handleNavClick("now-playing", "now-playing")}
        className={cn(
          "flex flex-col items-center justify-center p-2 text-muted-foreground hover:text-primary cursor-pointer flex-1",
          activeNav === "now-playing" && "text-primary"
        )}
      >
        <Play className="h-5 w-5" />
        <span className="text-xs mt-1">Playing</span>
      </div>
      
      <div 
        onClick={() => handleNavClick("queue", "queue")}
        className={cn(
          "flex flex-col items-center justify-center p-2 text-muted-foreground hover:text-primary cursor-pointer flex-1",
          activeNav === "queue" && "text-primary"
        )}
      >
        <ListMusic className="h-5 w-5" />
        <span className="text-xs mt-1">Queue</span>
      </div>
      
      <div 
        onClick={() => handleNavClick("search", "add-songs")}
        className={cn(
          "flex flex-col items-center justify-center p-2 text-muted-foreground hover:text-primary cursor-pointer flex-1",
          activeNav === "add-songs" && "text-primary"
        )}
      >
        <Search className="h-5 w-5" />
        <span className="text-xs mt-1">Search</span>
      </div>
      
      <div 
        onClick={() => handleNavClick("history", "history")}
        className={cn(
          "flex flex-col items-center justify-center p-2 text-muted-foreground hover:text-primary cursor-pointer flex-1",
          activeNav === "history" && "text-primary"
        )}
      >
        <History className="h-5 w-5" />
        <span className="text-xs mt-1">History</span>
      </div>
      
      <div 
        onClick={() => handleNavClick("playlists", "playlists")}
        className={cn(
          "flex flex-col items-center justify-center p-2 text-muted-foreground hover:text-primary cursor-pointer flex-1",
          activeNav === "playlists" && "text-primary"
        )}
      >
        <List className="h-5 w-5" />
        <span className="text-xs mt-1">Playlists</span>
      </div>

      <div 
        onClick={() => handleNavClick("guest-controls", "guest-controls")}
        className={cn(
          "flex flex-col items-center justify-center p-2 text-muted-foreground hover:text-primary cursor-pointer flex-1",
          activeNav === "guest-controls" && "text-primary"
        )}
      >
        <Sliders className="h-5 w-5" />
        <span className="text-xs mt-1">Controls</span>
      </div>
    </div>
  );
}