import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Star, Smartphone, Share2, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import type { RecommendedApp } from "../../types";
import { buildLogoUrl, extractNoteText, getPriceTierColor, getPlatformColor } from "../../utils/appHelpers";

interface AppDetailModalProps {
  app: RecommendedApp | null;
  open: boolean;
  onClose: () => void;
}

const AppDetailModal = ({ app, open, onClose }: AppDetailModalProps) => {
  const [screenshotIdx, setScreenshotIdx] = useState(0);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "unset";
    return () => { document.body.style.overflow = "unset"; };
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: app?.title, url }); } catch { /* ignore */ }
    } else {
      await navigator.clipboard.writeText(url);
    }
  };

  if (!app) return null;

  const logoUrl = buildLogoUrl(app.logo_url);
  const screenshots = app.screenshots || [];
  const noteText = extractNoteText(app.user_recommendation_note);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[150]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-x-0 bottom-0 md:inset-0 md:flex md:items-center md:justify-center z-[151] p-0 md:p-4"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            <div
              className="relative bg-[#0f1520] w-full md:max-w-lg rounded-t-3xl md:rounded-2xl overflow-hidden max-h-[92dvh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Handle */}
              <div className="md:hidden w-10 h-1 rounded-full bg-white/20 mx-auto mt-3 mb-0" />

              {/* Close */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              >
                <X size={16} />
              </button>

              {/* Header */}
              <div className="flex items-start gap-4 p-5 pt-6">
                <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white/5 flex-shrink-0 shadow-lg">
                  {logoUrl ? (
                    <img src={logoUrl} alt={app.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Smartphone size={28} className="text-white/20" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 pt-1">
                  <h2 className="text-lg font-bold text-white">{app.title}</h2>
                  {app.developer && (
                    <p className="text-sm text-white/50 mt-0.5">{app.developer}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {app.price_tier && (
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${getPriceTierColor(app.price_tier)}`}>
                        {app.price_tier}
                      </span>
                    )}
                    {app.user_rating && (
                      <span className="flex items-center gap-1 text-xs text-amber-400 font-semibold">
                        <Star size={11} fill="currentColor" /> {app.user_rating}/10
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Platforms */}
              {(app.platforms?.length ?? 0) > 0 && (
                <div className="px-5 pb-3 flex gap-2 flex-wrap">
                  {app.platforms!.map((p) => (
                    <span key={p} className={`text-[10px] font-medium px-2 py-0.5 rounded-md ${getPlatformColor(p)}`}>
                      {p}
                    </span>
                  ))}
                </div>
              )}

              {/* Screenshots */}
              {screenshots.length > 0 && (
                <div className="relative px-5 mb-4">
                  <div className="relative rounded-xl overflow-hidden bg-white/5 aspect-video">
                    <img
                      src={screenshots[screenshotIdx]}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    {screenshots.length > 1 && (
                      <>
                        <button
                          onClick={() => setScreenshotIdx((i) => (i - 1 + screenshots.length) % screenshots.length)}
                          className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50"
                        >
                          <ChevronLeft size={14} />
                        </button>
                        <button
                          onClick={() => setScreenshotIdx((i) => (i + 1) % screenshots.length)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50"
                        >
                          <ChevronRight size={14} />
                        </button>
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                          {screenshots.map((_, i) => (
                            <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === screenshotIdx ? "bg-violet-400" : "bg-white/30"}`} />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Description */}
              {app.description && (
                <div className="px-5 mb-4">
                  <p className="text-sm text-white/60 leading-relaxed">{app.description}</p>
                </div>
              )}

              {/* Creator note */}
              {noteText && (
                <div className="mx-5 mb-4 p-4 rounded-xl bg-violet-900/20 border border-violet-800/30">
                  <p className="text-[10px] text-violet-400/70 font-semibold uppercase tracking-wider mb-1.5">Creator's Note</p>
                  <p className="text-sm text-white/80 leading-relaxed italic">"{noteText}"</p>
                </div>
              )}

              {/* Categories */}
              {(app.app_category?.length ?? 0) > 0 && (
                <div className="px-5 mb-4">
                  <div className="flex gap-2 flex-wrap">
                    {app.app_category!.map((cat) => (
                      <span key={cat.documentId} className="text-[11px] text-violet-400/70 bg-violet-900/20 border border-violet-800/20 px-2.5 py-1 rounded-full">
                        {cat.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="px-5 pb-6 flex gap-3">
                {app.download_url && (
                  <a
                    href={app.download_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm text-white font-medium transition-colors"
                  >
                    <ExternalLink size={15} /> Download / Get App
                  </a>
                )}
                {!app.download_url && app.app_url && (
                  <a
                    href={app.app_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm text-white font-medium transition-colors"
                  >
                    <ExternalLink size={15} /> Visit Website
                  </a>
                )}
                <button
                  onClick={handleShare}
                  className="px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 transition-colors"
                >
                  <Share2 size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default AppDetailModal;
