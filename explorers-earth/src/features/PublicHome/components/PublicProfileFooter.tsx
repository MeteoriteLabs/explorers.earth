import { memo } from "react";
import { Link } from "react-router-dom";
import { LogoFull } from "../../../assets/icons/EoeLogo";

interface PublicProfileFooterProps {
  brandingStyle?: 'enabled' | 'minimal' | 'disabled';
}

export const PublicProfileFooter = memo(({ brandingStyle = 'enabled' }: PublicProfileFooterProps) => {
  if (brandingStyle === 'disabled') return null;

  return (
    <footer className="w-full pt-10 pb-8 text-center px-4 mt-auto border-t border-[var(--border-card)] relative z-10">
      <div className="flex justify-center items-center">
        <Link
          to="/"
          aria-label="explorers.earth"
          className="inline-flex items-center justify-center p-1 min-w-[44px] min-h-[44px] hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--accent-color)] rounded-md"
        >
          <LogoFull className="h-7 md:h-8 w-auto text-[var(--text-primary)]" />
        </Link>
      </div>

      {brandingStyle === 'enabled' && (
        <nav
          aria-label="Footer"
          className="flex justify-center items-center gap-4 mt-3 text-xs font-poppins text-[var(--text-secondary)] opacity-90"
        >
          <Link
            to="/"
            className="hover:text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--accent-color)] transition-colors rounded"
          >
            Create your profile
          </Link>
          <span aria-hidden="true">•</span>
          <a
            href="mailto:support@explorers.earth"
            className="hover:text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--accent-color)] transition-colors rounded"
          >
            Report
          </a>
          <span aria-hidden="true">•</span>
          <Link
            to="/privacy"
            className="hover:text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--accent-color)] transition-colors rounded"
          >
            Privacy
          </Link>
        </nav>
      )}
    </footer>
  );
});

PublicProfileFooter.displayName = "PublicProfileFooter";
export default PublicProfileFooter;
