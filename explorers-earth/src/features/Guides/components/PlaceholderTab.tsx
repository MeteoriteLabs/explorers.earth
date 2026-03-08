/**
 * Reusable placeholder component for tabs that are not yet implemented
 * Used for Transportation, Stay, and Budget tabs at guide level
 */

interface PlaceholderTabProps {
  title: string;
  description: string;
  message: string;
}

const PlaceholderTab: React.FC<PlaceholderTabProps> = ({
  title,
  description,
  message,
}) => {
  return (
    <div className="bg-dashboard-sidebar rounded-lg shadow-dashboard-elevated p-6 border border-dashboard-muted">
      <h2 className="text-dashboard text-xl mb-4 font-poppins font-bold">
        {title}
      </h2>
      <p className="text-dashboard-light font-poppins mb-6">{description}</p>
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 opacity-20 text-dashboard-light">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <p className="text-dashboard-light font-poppins">Coming soon</p>
        <p className="text-dashboard-light text-sm font-poppins mt-2">
          {message}
        </p>
      </div>
    </div>
  );
};

export default PlaceholderTab;

