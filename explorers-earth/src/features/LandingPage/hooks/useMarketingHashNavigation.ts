import { useEffect } from "react";
import { useLocation } from "react-router-dom";

function getHashTarget(hash: string) {
  if (!hash || hash === "#") return null;

  try {
    return decodeURIComponent(hash.slice(1));
  } catch {
    return null;
  }
}

export default function useMarketingHashNavigation(reducedMotion = false) {
  const location = useLocation();

  useEffect(() => {
    const targetId = getHashTarget(location.hash);
    if (!targetId) return;

    let firstFrame = 0;
    let secondFrame = 0;

    firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        document.getElementById(targetId)?.scrollIntoView({
          behavior: reducedMotion ? "auto" : "smooth",
          block: "start",
        });
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [location.hash, location.key, location.pathname, reducedMotion]);
}
