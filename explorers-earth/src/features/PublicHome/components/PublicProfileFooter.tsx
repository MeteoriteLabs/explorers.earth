import { memo } from "react";
import { Link } from "react-router-dom";

interface PublicProfileFooterProps {
  brandingStyle?: 'enabled' | 'minimal' | 'disabled';
  username?: string;
}

export const PublicProfileFooter = memo(({ brandingStyle = 'enabled' }: PublicProfileFooterProps) => {
  if (brandingStyle === 'disabled') return null;

  return (
    <footer className="w-full pt-10 pb-8 text-center px-4 mt-auto border-t border-white/5 relative z-10">
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300 shadow-md border" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-card)" }}>
        <span className="text-xs font-poppins font-medium opacity-90" style={{ color: "var(--text-primary)" }}>
          🌍 Powered by <span className="font-bold text-[var(--accent-color,#10B981)]">explorers.earth</span>
        </span>
      </div>
      
      {brandingStyle === 'enabled' && (
        <div className="flex justify-center items-center gap-4 mt-3 text-[11px] font-poppins opacity-75" style={{ color: "var(--text-secondary)" }}>
          <Link to="/" className="hover:text-white transition-colors">Create your profile</Link>
          <span>•</span>
          <a href="mailto:support@explorers.earth" className="hover:text-white transition-colors">Report</a>
          <span>•</span>
          <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
        </div>
      )}
    </footer>
  );
});

PublicProfileFooter.displayName = "PublicProfileFooter";
export default PublicProfileFooter;
