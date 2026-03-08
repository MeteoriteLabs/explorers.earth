import React from 'react';

interface PlayerMockupProps {
  className?: string;
}

const PlayerMockup: React.FC<PlayerMockupProps> = ({ className = '' }) => {
  return (
    <div className={`relative rounded-xl bg-black/80 backdrop-blur-sm border border-white/10 shadow-lg ${className}`}>
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polygon points="10 8 16 12 10 16 10 8"></polygon>
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-medium text-white">Now Playing</h3>
              <p className="text-xs text-white/60">Awesome Playlist</p>
            </div>
          </div>
          <div className="flex space-x-2">
            <button className="p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18"></path>
                <path d="M3 12h18"></path>
                <path d="M3 18h18"></path>
              </svg>
            </button>
            <button className="p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9l6 6 6-6"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>
      
      <div className="p-4">
        <div className="relative aspect-video rounded-lg overflow-hidden mb-4 bg-black">
          <div className="absolute inset-0 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-white/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polygon points="10 8 16 12 10 16 10 8" fill="currentColor"></polygon>
            </svg>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
            <div className="h-full w-1/3 bg-primary"></div>
          </div>
        </div>
        
        <div className="mb-4">
          <h2 className="text-lg font-medium text-white mb-1">Shape of You</h2>
          <p className="text-sm text-white/60">Ed Sheeran</p>
        </div>
        
        <div className="flex justify-between items-center mb-6">
          <span className="text-xs text-white/60">1:23</span>
          <div className="relative flex-1 mx-2 h-1 bg-white/20 rounded-full">
            <div className="absolute h-full w-1/3 bg-primary rounded-full"></div>
            <div className="absolute h-3 w-3 bg-primary rounded-full -top-1 left-1/3 transform -translate-x-1/2"></div>
          </div>
          <span className="text-xs text-white/60">3:54</span>
        </div>
        
        <div className="flex justify-between items-center">
          <button className="p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2Z"></path>
              <path d="M9 9H1l8-6v18l-8-6h8"></path>
            </svg>
          </button>
          
          <button className="p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m12 19-7-7 7-7"></path>
              <path d="M19 12H5"></path>
            </svg>
          </button>
          
          <button className="p-3 rounded-full bg-primary hover:bg-primary/90 text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polygon points="10 8 16 12 10 16 10 8" fill="currentColor"></polygon>
            </svg>
          </button>
          
          <button className="p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 19 7-7-7-7"></path>
              <path d="M19 12H5"></path>
            </svg>
          </button>
          
          <button className="p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 22V2l10 5v15l-10-5"></path>
            </svg>
          </button>
        </div>
      </div>
      
      <div className="p-4 border-t border-white/10">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-medium text-white">Up Next</h3>
          <button className="text-xs text-primary hover:text-primary/80 transition-colors">
            View All
          </button>
        </div>
        
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center p-2 rounded-lg hover:bg-white/5 transition-colors">
              <div className="w-10 h-10 rounded bg-white/10 flex-shrink-0 mr-3"></div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-white truncate">Song Title {i}</h4>
                <p className="text-xs text-white/60 truncate">Artist Name</p>
              </div>
              <div className="flex items-center ml-2">
                <button className="p-1.5 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 8v8"></path>
                    <path d="M8 12h8"></path>
                  </svg>
                </button>
                <button className="p-1.5 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="1"></circle>
                    <circle cx="19" cy="12" r="1"></circle>
                    <circle cx="5" cy="12" r="1"></circle>
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
        
        <button className="mt-3 w-full py-2 rounded-lg border border-white/10 text-sm text-white/60 hover:bg-white/5 hover:text-white transition-colors">
          Add a Song
        </button>
      </div>
    </div>
  );
};

export default PlayerMockup;