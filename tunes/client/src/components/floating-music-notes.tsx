import React from 'react';

interface FloatingMusicNotesProps {
  className?: string;
}

const FloatingMusicNotes: React.FC<FloatingMusicNotesProps> = ({ className = '' }) => {
  return (
    <div className={`${className} overflow-hidden`}>
      <svg 
        width="0" 
        height="0" 
        style={{ position: 'absolute' }}
      >
        <defs>
          <symbol id="music-note" viewBox="0 0 20 30">
            <path d="M10,0 C8.34,1.66 5,3 5,8 V20 C5,22.21 6.79,24 9,24 C11.21,24 13,22.21 13,20 C13,17.79 11.21,16 9,16 C8.45,16 7.95,16.17 7.5,16.41 V8 C7.5,5.83 8.4,4.83 9,4.5 C9.6,4.17 10.67,4 12,6 L10,0 Z" />
          </symbol>
          <symbol id="eighth-note" viewBox="0 0 20 34">
            <path d="M14,0 C12.34,1.66 9,3 9,8 V22 C9,24.21 10.79,26 13,26 C15.21,26 17,24.21 17,22 C17,19.79 15.21,18 13,18 C12.45,18 11.95,18.17 11.5,18.41 V8 C11.5,5.83 12.4,4.83 13,4.5 V0 L14,0 Z" />
            <path d="M14,0 C14,0 14,14 14,14 L4,18 L4,32 L2,34 L0,32 L2,30 L4,32 L4,20 L14,16 L14,0 Z" />
          </symbol>
          <symbol id="quarter-note" viewBox="0 0 20 30">
            <path d="M12,0 C10.34,1.66 7,3 7,8 V20 C7,22.21 8.79,24 11,24 C13.21,24 15,22.21 15,20 C15,17.79 13.21,16 11,16 C10.45,16 9.95,16.17 9.5,16.41 V8 C9.5,5.83 10.4,4.83 11,4.5 V0 L12,0 Z" />
            <ellipse cx="11" cy="28" rx="2" ry="2" />
          </symbol>
        </defs>
      </svg>
      
      {[...Array(5)].map((_, i) => {
        const randomX = Math.random() * 100;
        const randomSize = Math.random() * 15 + 15; // Reduced size
        const randomDelay = Math.random() * 5;
        const randomDuration = Math.random() * 5 + 15;
        const randomNote = ["music-note", "eighth-note", "quarter-note"][Math.floor(Math.random() * 3)];
        
        return (
          <svg 
            key={i} 
            style={{
              position: 'absolute',
              left: `${randomX}%`,
              top: '-50px',
              width: `${randomSize}px`,
              height: `${randomSize * 1.5}px`,
              fill: `rgba(${Math.random() * 100 + 155}, ${Math.random() * 100 + 155}, ${Math.random() * 255}, 0.05)`,
              animation: `float ${randomDuration}s ${randomDelay}s linear infinite`,
              zIndex: '-1',
            }}
          >
            <use href={`#${randomNote}`} />
          </svg>
        );
      })}
      
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes float {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 0.1;
          }
          90% {
            opacity: 0.05;
          }
          100% {
            transform: translateY(100vh) rotate(20deg);
            opacity: 0;
          }
        }
      `}} />
    </div>
  );
};

export default FloatingMusicNotes;