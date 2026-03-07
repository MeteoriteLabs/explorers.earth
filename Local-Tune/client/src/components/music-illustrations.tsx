import React from "react";

export function WavyMusicPattern({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 1000 300"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Background Waves */}
      <path
        d="M0,100 C150,160 350,0 500,100 C650,200 850,60 1000,120 L1000,300 L0,300 Z"
        fill="rgba(18, 18, 18, 0.4)"
      />
      <path
        d="M0,150 C150,220 350,80 500,150 C650,220 850,120 1000,170 L1000,300 L0,300 Z"
        fill="rgba(18, 18, 18, 0.3)"
      />
      <path
        d="M0,180 C150,250 350,120 500,180 C650,240 850,160 1000,190 L1000,300 L0,300 Z"
        fill="rgba(18, 18, 18, 0.2)"
      />

      {/* Music Notes */}
      <g className="music-notes">
        <circle cx="200" cy="100" r="8" fill="rgba(80, 80, 80, 0.9)" />
        <path
          d="M200,100 L200,60 L210,50 L215,55 L205,65 L205,100"
          fill="rgba(80, 80, 80, 0.9)"
        />

        <circle cx="400" cy="80" r="8" fill="rgba(80, 80, 80, 0.9)" />
        <path
          d="M400,80 L400,40 L410,30 L415,35 L405,45 L405,80"
          fill="rgba(80, 80, 80, 0.9)"
        />

        <circle cx="600" cy="120" r="8" fill="rgba(80, 80, 80, 0.9)" />
        <path
          d="M600,120 L600,80 L610,70 L615,75 L605,85 L605,120"
          fill="rgba(80, 80, 80, 0.9)"
        />

        <circle cx="800" cy="90" r="8" fill="rgba(80, 80, 80, 0.9)" />
        <path
          d="M800,90 L800,50 L810,40 L815,45 L805,55 L805,90"
          fill="rgba(80, 80, 80, 0.9)"
        />

        {/* Additional small notes */}
        <circle cx="250" cy="70" r="5" fill="rgba(80, 80, 80, 0.7)" />
        <circle cx="450" cy="110" r="5" fill="rgba(80, 80, 80, 0.7)" />
        <circle cx="650" cy="60" r="5" fill="rgba(80, 80, 80, 0.7)" />
        <circle cx="850" cy="130" r="5" fill="rgba(80, 80, 80, 0.7)" />
      </g>
      
      {/* Sound Waves */}
      <g className="sound-waves" opacity="0.6">
        <path
          d="M300,150 Q325,130 350,150 Q375,170 400,150"
          fill="none"
          stroke="rgba(80, 80, 80, 0.9)"
          strokeWidth="2"
        />
        <path
          d="M500,120 Q525,100 550,120 Q575,140 600,120"
          fill="none"
          stroke="rgba(80, 80, 80, 0.9)"
          strokeWidth="2"
        />
        <path
          d="M700,140 Q725,120 750,140 Q775,160 800,140"
          fill="none"
          stroke="rgba(80, 80, 80, 0.9)"
          strokeWidth="2"
        />
      </g>
    </svg>
  );
}

export function PlayerMockup({ className }: { className?: string }) {
  return (
    <div className={`rounded-xl shadow-2xl bg-white p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <div className="w-10 h-10 rounded-md bg-primary/20 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 18V6L21 12L9 18Z" fill="currentColor" className="text-primary" />
            </svg>
          </div>
          <div className="ml-3">
            <div className="text-sm font-semibold text-gray-800">Now Playing</div>
            <div className="text-xs text-gray-500">Local Tunes</div>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 6L9 12L15 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary" />
            </svg>
          </div>
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5 3L19 12L5 21V3Z" fill="currentColor" />
            </svg>
          </div>
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary" />
            </svg>
          </div>
        </div>
      </div>
      
      <div className="mt-4">
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-primary w-1/3 rounded-full"></div>
        </div>
        <div className="flex justify-between text-xs mt-1 text-gray-500">
          <span>1:25</span>
          <span>3:45</span>
        </div>
      </div>
      
      <div className="mt-4 space-y-2">
        <div className="p-2 rounded-md bg-gray-50 flex items-center">
          <div className="w-8 h-8 rounded bg-primary/20 flex-shrink-0"></div>
          <div className="ml-2 flex-1">
            <div className="text-xs font-medium text-gray-800 truncate">Your Favorite Song</div>
            <div className="text-xs text-gray-500">Artist Name</div>
          </div>
        </div>
        <div className="p-2 rounded-md bg-gray-50 flex items-center">
          <div className="w-8 h-8 rounded bg-primary/20 flex-shrink-0"></div>
          <div className="ml-2 flex-1">
            <div className="text-xs font-medium text-gray-800 truncate">Another Great Track</div>
            <div className="text-xs text-gray-500">Different Artist</div>
          </div>
        </div>
        <div className="p-2 rounded-md bg-gray-50 flex items-center">
          <div className="w-8 h-8 rounded bg-primary/20 flex-shrink-0"></div>
          <div className="ml-2 flex-1">
            <div className="text-xs font-medium text-gray-800 truncate">Next Up in Queue</div>
            <div className="text-xs text-gray-500">Popular Band</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FloatingMusicNotes({ className }: { className?: string }) {
  return (
    <div className={`absolute w-full h-full overflow-hidden pointer-events-none ${className}`}>
      <div className="note-1 absolute w-8 h-8 text-gray-600 animate-float1">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
        </svg>
      </div>
      <div className="note-2 absolute w-6 h-6 text-gray-500 animate-float2">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
        </svg>
      </div>
      <div className="note-3 absolute w-5 h-5 text-gray-400 animate-float3">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
        </svg>
      </div>
    </div>
  );
}