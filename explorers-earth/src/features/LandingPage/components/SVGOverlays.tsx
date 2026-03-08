export const CompassOverlay = () => (
  <div className="absolute inset-0 opacity-10 pointer-events-none">
    <svg viewBox="0 0 1000 1000" className="w-full h-full">
      <defs>
        <pattern id="compass" patternUnits="userSpaceOnUse" width="200" height="200">
          <circle cx="100" cy="100" r="80" fill="none" stroke="currentColor" strokeWidth="2"/>
          <path d="M100 20 L100 180 M20 100 L180 100" stroke="currentColor" strokeWidth="1"/>
          <polygon points="100,40 110,80 100,70 90,80" fill="currentColor"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#compass)"/>
    </svg>
  </div>
);

export const GridOverlay = () => (
  <div className="absolute inset-0 opacity-5 pointer-events-none">
    <div className="grid grid-cols-12 gap-1 h-full">
      {Array(144).fill(0).map((_, i) => (
        <div key={i} className="bg-current rounded-sm"></div>
      ))}
    </div>
  </div>
);

export const AnalyticsOverlay = () => (
  <div className="absolute inset-0 opacity-10 pointer-events-none">
    <svg viewBox="0 0 800 600" className="w-full h-full">
      <defs>
        <pattern id="analytics-pattern" patternUnits="userSpaceOnUse" width="100" height="100">
          <path d="M20 20 L80 80 M80 20 L20 80" stroke="currentColor" strokeWidth="1" strokeDasharray="5,5"/>
          <circle cx="20" cy="20" r="3" fill="currentColor"/>
          <circle cx="80" cy="80" r="3" fill="currentColor"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#analytics-pattern)"/>
    </svg>
  </div>
);

export const BadgeOverlay = () => (
  <div className="absolute inset-0 opacity-10 pointer-events-none">
    <svg viewBox="0 0 600 400" className="w-full h-full">
      <defs>
        <pattern id="badge-pattern" patternUnits="userSpaceOnUse" width="80" height="80">
          <circle cx="40" cy="40" r="25" fill="none" stroke="currentColor" strokeWidth="2"/>
          <path d="M40 20 L50 35 L40 30 L30 35 Z" fill="currentColor"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#badge-pattern)"/>
    </svg>
  </div>
);

export const WorldOverlay = () => (
  <div className="absolute inset-0 opacity-10 pointer-events-none">
    <svg viewBox="0 0 1000 600" className="w-full h-full">
      <defs>
        <pattern id="world-outline" patternUnits="userSpaceOnUse" width="200" height="200">
          <path d="M50 100 C50 50, 150 50, 150 100 C150 150, 50 150, 50 100" fill="none" stroke="currentColor" strokeWidth="1"/>
          <circle cx="75" cy="75" r="3" fill="currentColor"/>
          <circle cx="125" cy="125" r="3" fill="currentColor"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#world-outline)"/>
    </svg>
  </div>
);
