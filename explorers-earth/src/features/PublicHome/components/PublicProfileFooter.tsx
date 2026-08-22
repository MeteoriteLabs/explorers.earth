import { memo } from "react";
import { Link } from "react-router-dom";
import { LogoFull } from "../../../assets/icons/EoeLogo";

interface PublicProfileFooterProps {
  brandingStyle?: 'enabled' | 'minimal' | 'disabled';
}

export const PublicProfileFooter = memo(({ brandingStyle = 'enabled' }: PublicProfileFooterProps) => {
  if (brandingStyle === 'disabled') return null;

  return (
    <footer className="relative z-10 mt-auto w-full border-t border-slate-700/40 px-4 pb-8 pt-10 text-center">
      <div className="flex justify-center items-center">
        <Link
          to="/"
          aria-label="explorers.earth"
          data-theme-invariant="true"
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-white/10 bg-slate-950/90 px-4 py-2 text-white shadow-sm transition-colors hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2"
        >
          <LogoFull className="h-9 w-auto text-white md:h-10" />
        </Link>
      </div>

      {brandingStyle === 'enabled' && (
        <nav
          aria-label="Footer"
          className="mt-3 flex items-center justify-center gap-4 font-poppins text-xs text-slate-400"
        >
          <Link
            to="/"
            className="inline-flex min-h-[44px] items-center rounded px-1 py-2 transition-colors hover:text-white focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2"
          >
            Create your profile
          </Link>
          <span aria-hidden="true">•</span>
          <a
            href="mailto:support@explorers.earth"
            className="inline-flex min-h-[44px] items-center rounded px-1 py-2 transition-colors hover:text-white focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2"
          >
            Report
          </a>
          <span aria-hidden="true">•</span>
          <Link
            to="/privacy"
            className="inline-flex min-h-[44px] items-center rounded px-1 py-2 transition-colors hover:text-white focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2"
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
