import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import type { Theme } from "@shared/schema";
// Use the SVG logo from public folder
const logoImage = "/logo.svg";

interface BrandProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  showVenueName?: boolean;
}

export function Brand({ className, size = "md", showVenueName = false }: BrandProps) {
  const { user } = useAuth();
  const [location] = useLocation();
  const isLandingPage = location === "/";

  // Always show Local Tunes on landing page, otherwise respect showVenueName prop
  const displayText = (isLandingPage || !showVenueName || !user?.venueName) 
    ? "Local Tunes" 
    : user.venueName;

  // Only use venue theme color if we're showing the venue name and not on landing page
  const userTheme = user?.theme as Theme | undefined;
  const useVenueTheme = !isLandingPage && showVenueName && userTheme?.primary;

  // Determine logo sizing based on the size prop
  const logoHeight = size === "sm" ? 25 : size === "md" ? 35 : 50;
  
  // Always use text for non-landing pages
  if (!isLandingPage) {
    return (
      <span
        className={cn(
          "font-bold tracking-tight",
          useVenueTheme
            ? "" // No gradient when using venue theme
            : "gradient-text", // Use our updated gradient from CSS
          size === "sm" && "text-xl",
          size === "md" && "text-2xl",
          size === "lg" && "text-4xl",
          className
        )}
        style={useVenueTheme && userTheme ? { color: userTheme.primary } : undefined}
      >
        {displayText}
      </span>
    );
  }
  
  // For landing page, use the imported logo image
  return (
    <img 
      src={logoImage} 
      alt="Local Tunes" 
      height={logoHeight}
      className={cn("h-auto", className)}
    />
  );
}