import { useState, useEffect } from 'react';

/**
 * Custom hook for responsive chart behavior
 * 
 * This hook:
 * 1. Detects screen size changes
 * 2. Determines if labels should be shown on chart elements
 * 3. Provides responsive configuration for charts
 */
export const useResponsiveChart = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth;
      setIsMobile(width < 640); // sm breakpoint
    };

    // Check initial screen size
    checkScreenSize();

    // Add event listener for window resize
    window.addEventListener('resize', checkScreenSize);

    // Cleanup
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  return {
    isMobile,
    // For pie charts: show labels on slices only on desktop
    showPieLabels: !isMobile,
    // For other charts: adjust font sizes and spacing
    chartConfig: {
      fontSize: isMobile ? 8 : 12,
      legendFontSize: isMobile ? 8 : 10,
      chartHeight: isMobile ? 200 : 300,
    }
  };
};
