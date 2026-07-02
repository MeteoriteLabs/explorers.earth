import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Star, ShoppingBag, Share2, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import type { RecommendedProduct } from "../../types";
import { buildImageUrl, extractNoteText, formatPrice } from "../../utils/productHelpers";

interface ProductDetailModalProps {
  product: RecommendedProduct | null;
  open: boolean;
  onClose: () => void;
}

const ProductDetailModal = ({ product, open, onClose }: ProductDetailModalProps) => {
  const [imgIdx, setImgIdx] = useState(0);

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
      try { await navigator.share({ title: product?.title, url }); } catch { /* ignore */ }
    } else {
      await navigator.clipboard.writeText(url);
    }
  };

  if (!product) return null;

  const mainImg = buildImageUrl(product.logo_url);
  const gallery = (product.images || []).map(buildImageUrl).filter(Boolean);
  const allImages = mainImg ? [mainImg, ...gallery.filter((i) => i !== mainImg)] : gallery;
  const noteText = extractNoteText(product.user_recommendation_note);
  const specs = product.specifications || {};
  const hasSpecs = Object.keys(specs).length > 0;
  const priceStr = formatPrice(product.price, product.currency);

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
              {/* Handle (mobile) */}
              <div className="md:hidden w-10 h-1 rounded-full bg-white/20 mx-auto mt-3" />

              {/* Close */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              >
                <X size={16} />
              </button>

              {/* Image gallery */}
              {allImages.length > 0 ? (
                <div className="relative aspect-square overflow-hidden bg-black/30">
                  <img src={allImages[imgIdx]} alt={product.title} className="w-full h-full object-contain" />
                  {allImages.length > 1 && (
                    <>
                      <button onClick={() => setImgIdx((i) => (i - 1 + allImages.length) % allImages.length)} className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50"><ChevronLeft size={14} /></button>
                      <button onClick={() => setImgIdx((i) => (i + 1) % allImages.length)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50"><ChevronRight size={14} /></button>
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                        {allImages.map((_, i) => (<div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === imgIdx ? "bg-emerald-400" : "bg-white/30"}`} />))}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="aspect-square bg-emerald-900/10 flex items-center justify-center">
                  <ShoppingBag size={48} className="text-emerald-800/40" />
                </div>
              )}

              {/* Product info */}
              <div className="p-5">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-bold text-white">{product.title}</h2>
                    {product.brand && <p className="text-sm text-white/50 mt-0.5">{product.brand}</p>}
                  </div>
                  {priceStr && (
                    <div className="text-right flex-shrink-0">
                      <p className="text-xl font-bold text-emerald-400">{priceStr}</p>
                    </div>
                  )}
                </div>

                {product.user_rating && (
                  <div className="flex items-center gap-1 mb-3">
                    <Star size={13} fill="currentColor" className="text-amber-400" />
                    <span className="text-sm text-amber-400 font-semibold">{product.user_rating}/10</span>
                  </div>
                )}

                {product.description && (
                  <p className="text-sm text-white/60 leading-relaxed mb-4">{product.description}</p>
                )}

                {/* Creator Note */}
                {noteText && (
                  <div className="p-4 rounded-xl bg-emerald-900/20 border border-emerald-800/30 mb-4">
                    <p className="text-[10px] text-emerald-400/70 font-semibold uppercase tracking-wider mb-1.5">Creator's Note</p>
                    <p className="text-sm text-white/80 leading-relaxed italic">"{noteText}"</p>
                  </div>
                )}

                {/* Specs */}
                {hasSpecs && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Specifications</p>
                    <div className="rounded-xl border border-white/10 overflow-hidden">
                      {Object.entries(specs).map(([key, val], i) => (
                        <div key={key} className={`flex items-center px-3 py-2 text-xs ${i % 2 === 0 ? "bg-white/[0.03]" : ""}`}>
                          <span className="text-white/40 w-1/3">{key}</span>
                          <span className="text-white/80 flex-1">{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Category */}
                {product.product_category && (
                  <div className="flex gap-2 flex-wrap mb-4">
                    <span className="text-[11px] text-emerald-400/70 bg-emerald-900/20 border border-emerald-800/20 px-2.5 py-1 rounded-full">
                      {product.product_category.name}
                    </span>
                  </div>
                )}

                {/* CTA */}
                <div className="flex gap-3">
                  {(product.buy_url || product.product_url) && (
                    <a
                      href={product.buy_url || product.product_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-sm text-white font-medium transition-colors"
                    >
                      <ExternalLink size={15} /> {product.buy_url ? "Buy / Get it" : "View Product"}
                    </a>
                  )}
                  <button onClick={handleShare} className="px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 transition-colors">
                    <Share2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ProductDetailModal;
