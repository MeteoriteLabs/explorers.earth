import { useEffect, useRef, useState } from "react";
import Globe, { GlobeMethods } from "react-globe.gl";
import { useDashboardTheme } from "../../contexts/DashboardThemeContext";

type ArcData = {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: string;
};

interface GlobeDemoProps {
  arcsData: ArcData[];
}

export function GlobeDemo({ arcsData }: GlobeDemoProps) {
  const { theme } = useDashboardTheme();
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [dimensions, setDimensions] = useState({ width: 600, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (globeRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const controls = (globeRef.current as any).controls();
      if (controls) {
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.5;
      }
    }
  }, []);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        const size = Math.min(containerWidth, 600); // Cap at 600px max
        setDimensions({ width: size, height: size });
      }
    };

    // Initialize dimensions
    updateDimensions();

    // Update dimensions on window resize
    window.addEventListener('resize', updateDimensions);

    return () => {
      window.removeEventListener('resize', updateDimensions);
    };
  }, []);

  // Set background color based on theme
  const globeBackgroundColor = theme === 'dark' ? '#060608' : '#2E4032';

  return (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center overflow-hidden bg-dashboard-bg">
      <Globe
        ref={globeRef}
        width={dimensions.width}
        height={dimensions.height}
        backgroundColor={globeBackgroundColor}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
        arcsData={arcsData}
        arcColor={() => "white"}
        arcDashLength={0.5}
        arcDashGap={2}
        arcDashAnimateTime={1300}
      />
    </div>
  );
}
