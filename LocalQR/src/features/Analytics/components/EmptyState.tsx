import React from 'react';

type IconType = 'globe' | 'bar-chart' | 'map' | 'line-chart' | 'map-pin' | 'share';

interface EmptyStateProps {
  icon: IconType;
  message: string;
  description?: string;
  className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon, message, description, className = '' }) => {
  const renderIcon = () => {
    const iconClasses = "w-8 h-8 text-dashboard-accent";
    
    switch (icon) {
      case 'globe':
        return (
          <svg className={iconClasses} fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"/>
            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" 
                  fill="none" stroke="currentColor" strokeWidth="2"/>
          </svg>
        );
      
      case 'bar-chart':
        return (
          <svg className={iconClasses} fill="currentColor" viewBox="0 0 24 24">
            <rect x="4" y="14" width="4" height="7" rx="1"/>
            <rect x="10" y="8" width="4" height="13" rx="1"/>
            <rect x="16" y="4" width="4" height="17" rx="1"/>
          </svg>
        );
      
      case 'map':
        return (
          <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      
      case 'line-chart':
        return (
          <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
            />
          </svg>
        );
      
      case 'map-pin':
        return (
          <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.828 0L6.343 16.657a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        );
      
      case 'share':
        return (
          <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
            />
          </svg>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className={`flex flex-col items-center justify-center py-8 px-4 ${className}`}>
      <div className="w-16 h-16 bg-dashboard-muted rounded-full flex items-center justify-center mb-4 flex-shrink-0">
        {renderIcon()}
      </div>
      <p className="dt-subtext text-dashboard-muted text-center">{message}</p>
      {description && (
        <p className="dt-subtext text-dashboard-muted text-center text-sm mt-2">{description}</p>
      )}
    </div>
  );
};

export default EmptyState;
