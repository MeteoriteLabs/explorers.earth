import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { sanitizePublicRichText } from "../utils/publicProfileContent";

export interface PublicProfileBioProps {
  html: unknown;
  collapsedLines?: number;
}

export default function PublicProfileBio({
  html,
  collapsedLines = 3,
}: PublicProfileBioProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const sanitizedHtml = typeof html === "string" || html ? sanitizePublicRichText(html) : "";

  useEffect(() => {
    setExpanded(false);
  }, [sanitizedHtml]);

  useEffect(() => {
    if (!sanitizedHtml || sanitizedHtml.trim() === "" || !contentRef.current) {
      setIsOverflowing(false);
      return;
    }

    let isMounted = true;

    const measure = () => {
      if (!contentRef.current || !isMounted) return;
      const element = contentRef.current;
      const collapsedMaxHeight = collapsedLines * 24;
      const scrollH = element.scrollHeight;

      // Overflowing means the total content scroll height exceeds 3-line max collapsed height
      const overflowing = scrollH > collapsedMaxHeight;
      setIsOverflowing(overflowing);
    };

    measure();

    let resizeObserver: ResizeObserver | null = null;
    const ResizeObserverClass =
      typeof window !== "undefined" && typeof window.ResizeObserver === "function"
        ? window.ResizeObserver
        : typeof ResizeObserver === "function"
          ? ResizeObserver
          : null;

    if (ResizeObserverClass && contentRef.current) {
      try {
        resizeObserver = new ResizeObserverClass(() => {
          measure();
        });
        resizeObserver.observe(contentRef.current);
      } catch {
        resizeObserver = null;
      }
    }

    if (typeof document !== "undefined" && document.fonts && document.fonts.ready) {
      document.fonts.ready
        .then(() => {
          if (isMounted) {
            measure();
          }
        })
        .catch(() => {});
    }

    return () => {
      isMounted = false;
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [sanitizedHtml, collapsedLines]);

  if (!sanitizedHtml || sanitizedHtml.trim() === "") {
    return null;
  }

  const handleFocusCapture = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!expanded && e.target !== contentRef.current) {
      setExpanded(true);
    }
  };

  return (
    <div className="w-full">
      <div
        ref={contentRef}
        onFocusCapture={handleFocusCapture}
        style={{
          maxHeight: expanded ? "none" : `${collapsedLines * 1.5}rem`,
          color: "var(--text-primary)",
        }}
        className="font-poppins text-base leading-6 break-words overflow-hidden transition-[max-height] duration-200"
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />
      {isOverflowing && (
        <div className="mt-1 flex justify-start">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="profile-presentation-focus min-h-[44px] min-w-[44px] inline-flex items-center text-xs font-poppins font-medium transition-colors cursor-pointer"
            style={{ color: "var(--accent-color)" }}
          >
            {expanded
              ? t("publicProfile.bio.showLess", "Show less")
              : t("publicProfile.bio.showMore", "Show more")}
          </button>
        </div>
      )}
    </div>
  );
}
