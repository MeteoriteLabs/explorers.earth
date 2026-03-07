import React from 'react';

interface WavyMusicPatternProps {
  className?: string;
}

const WavyMusicPattern: React.FC<WavyMusicPatternProps> = ({ className = '' }) => {
  return (
    <div className={`${className} overflow-hidden`}>
      <svg 
        width="100%" 
        height="100%" 
        viewBox="0 0 1600 400" 
        xmlns="http://www.w3.org/2000/svg" 
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(79, 70, 229, 0.05)" />
            <stop offset="50%" stopColor="rgba(16, 185, 129, 0.05)" />
            <stop offset="100%" stopColor="rgba(59, 130, 246, 0.05)" />
          </linearGradient>
          <linearGradient id="gradient2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(16, 185, 129, 0.05)" />
            <stop offset="50%" stopColor="rgba(59, 130, 246, 0.05)" />
            <stop offset="100%" stopColor="rgba(79, 70, 229, 0.05)" />
          </linearGradient>
        </defs>
        
        {/* Wave 1 */}
        <path 
          d="M0,200 Q400,100 800,200 T1600,200 V400 H0 Z" 
          fill="url(#gradient1)"
          opacity="0.8"
        >
          <animate 
            attributeName="d" 
            values="M0,200 Q400,100 800,200 T1600,200 V400 H0 Z;
                    M0,200 Q400,300 800,200 T1600,200 V400 H0 Z;
                    M0,200 Q400,100 800,200 T1600,200 V400 H0 Z"
            dur="20s" 
            repeatCount="indefinite" 
          />
        </path>
        
        {/* Wave 2 */}
        <path 
          d="M0,250 Q400,350 800,250 T1600,250 V400 H0 Z" 
          fill="url(#gradient2)"
          opacity="0.6"
        >
          <animate 
            attributeName="d" 
            values="M0,250 Q400,350 800,250 T1600,250 V400 H0 Z;
                    M0,250 Q400,150 800,250 T1600,250 V400 H0 Z;
                    M0,250 Q400,350 800,250 T1600,250 V400 H0 Z"
            dur="15s" 
            repeatCount="indefinite" 
          />
        </path>
      </svg>
    </div>
  );
};

export default WavyMusicPattern;