import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation } from "@apollo/client";
import {
  ArrowLeft, Star, X, Loader2, Check, ShoppingBag, Link as LinkIcon,
  AlertCircle, Plus, Trash2
} from "lucide-react";
import { toast } from "sonner";
import useAuthStore from "../../../../store/store";
import { PRODUCTS_BY_LIST, PRODUCT_CATEGORIES, productsByListVars, refetchProductsByList } from "../../api/query";
import { CREATE_RECOMMENDED_PRODUCT, UPDATE_RECOMMENDED_PRODUCT } from "../../api/mutation";
import {
  deduplicateProducts, buildImageUrl, generateSlug, formatPrice,
} from "../../utils/productHelpers";
import type { RecommendedProduct, ProductCategory } from "../../types";
import TiptapEditor from "../../../Favorites/components/TiptapEditor";

// ─────────────────────────────────────────────────────────────
// URL Scraper Panel
// ─────────────────────────────────────────────────────────────
const UrlScrapePanel = ({
  onScraped,
}: {
  onScraped: (data: Partial<RecommendedProduct>) => void;
}) => {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleScrape = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_REST_API_URL}/products/scrape-link`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) }
      );
      if (!resp.ok) throw new Error("Scrape failed");
      const data = await resp.json();
      onScraped({ ...data, product_url: url });
      toast.success("Product metadata fetched!");
    } catch {
      setError("Could not fetch metadata — fill in details manually below.");
      onScraped({ product_url: url });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <LinkIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://amazon.com/product/... or any retail link"
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50 transition-colors"
            onKeyDown={(e) => e.key === "Enter" && handleScrape()}
          />
        </div>
        <button
          onClick={handleScrape}
          disabled={loading || !url.trim()}
          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-sm text-white font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : "Fetch"}
        </button>
      </div>
      {error && (
        <div className="flex items-center gap-2 text-xs text-amber-400/80 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
          <AlertCircle size={12} /> {error}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// SpecificationsEditor — dynamic key/value pairs
// ─────────────────────────────────────────────────────────────
const SpecificationsEditor = ({
  specs,
  onChange,
}: {
  specs: Record<string, string>;
  onChange: (newSpecs: Record<string, string>) => void;
}) => {
  const entries = Object.entries(specs);

  const handleAdd = () => {
    onChange({ ...specs, "": "" });
  };

  const handleChange = (oldKey: string, newKey: string, val: string) => {
    const updated: Record<string, string> = {};
    for (const [k, v] of Object.entries(specs)) {
      if (k === oldKey) {
        updated[newKey] = val;
      } else {
        updated[k] = v;
      }
    }
    onChange(updated);
  };

  const handleDelete = (key: string) => {
    const updated = { ...specs };
    delete updated[key];
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      {entries.map(([key, val], i) => (
        <div key={i} className="flex gap-2">
          <input
            type="text"
            value={key}
            onChange={(e) => handleChange(key, e.target.value, val)}
            placeholder="Key (e.g. Color)"
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50"
          />
          <input
            type="text"
            value={val}
            onChange={(e) => handleChange(key, key, e.target.value)}
            placeholder="Value (e.g. Space Grey)"
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50"
          />
          <button onClick={() => handleDelete(key)} className="p-2 rounded-lg bg-red-900/20 text-red-400 hover:bg-red-900/40 transition-colors">
            <Trash2 size={12} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={handleAdd}
        className="flex items-center gap-2 text-xs text-emerald-400/70 hover:text-emerald-400 transition-colors"
      >
        <Plus size={12} /> Add spec
      </button>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// AddProductPage Main Component
// ─────────────────────────────────────────────────────────────
const AddProductPage = () => {
  const navigate = useNavigate();
  const { listId, productId } = useParams<{ listId: string; productId: string }>();
  const { user } = useAuthStore();
  const isEdit = !!productId;

  const [step, setStep] = useState<"url" | "form">(isEdit ? "form" : "url");
  const [formData, setFormData] = useState<Partial<RecommendedProduct>>({
    currency: "USD",
    images: [],
    specifications: {},
    product_category: [],
  });
  const [note, setNote] = useState<any>(null);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: listData } = useQuery(PRODUCTS_BY_LIST, {
    variables: productsByListVars(listId!),
    skip: !listId,
  });

  const { data: categoryData } = useQuery(PRODUCT_CATEGORIES);
  const categories: ProductCategory[] = categoryData?.productCategories ?? [];

  const existingProduct: RecommendedProduct | null = isEdit
    ? deduplicateProducts(listData?.productLists?.[0]?.recommended_products ?? []).find(
        (p) => p.documentId === productId
      ) ?? null
    : null;

  useEffect(() => {
    if (isEdit && existingProduct) {
      setFormData({
        product_url: existingProduct.product_url,
        title: existingProduct.title,
        brand: existingProduct.brand ?? "",
        price: existingProduct.price ?? undefined,
        currency: existingProduct.currency ?? "USD",
        buy_url: existingProduct.buy_url ?? "",
        logo_url: existingProduct.logo_url ?? "",
        description: existingProduct.description ?? "",
        specifications: existingProduct.specifications ?? {},
        images: existingProduct.images ?? [],
      });
      setNote(existingProduct.user_recommendation_note);
      setUserRating(existingProduct.user_rating);
      setIsPinned(existingProduct.is_pinned);
      setSelectedCategories(existingProduct.product_category ? [existingProduct.product_category.documentId] : []);
    }
  }, [isEdit, existingProduct?.documentId]);

  const [createProduct] = useMutation(CREATE_RECOMMENDED_PRODUCT);
  const [updateProduct] = useMutation(UPDATE_RECOMMENDED_PRODUCT);

  const handleUrlScraped = useCallback((data: Partial<RecommendedProduct>) => {
    setFormData((prev) => ({ ...prev, ...data }));
    setStep("form");
  }, []);

  const handleSave = async () => {
    if (!formData.title?.trim()) { toast.error("Product title is required."); return; }
    if (!formData.product_url?.trim()) { toast.error("Product URL is required."); return; }

    setSaving(true);
    const existingProducts = deduplicateProducts(listData?.productLists?.[0]?.recommended_products ?? []);
    const displayOrder = isEdit ? existingProduct?.display_order ?? 0 : existingProducts.length;

    try {
      if (isEdit && productId) {
        await updateProduct({
          variables: {
            documentId: productId,
            title: formData.title,
            brand: formData.brand,
            price: formData.price,
            currency: formData.currency,
            buy_url: formData.buy_url,
            logo_url: formData.logo_url,
            description: formData.description,
            specifications: formData.specifications,
            images: formData.images,
            user_recommendation_note: note,
            user_rating: userRating,
            is_pinned: isPinned,
            product_category: selectedCategories[0] || null,
          },
          refetchQueries: refetchProductsByList(listId!),
        });
        toast.success("Product updated!");
      } else {
        await createProduct({
          variables: {
            product_url: formData.product_url,
            title: formData.title,
            brand: formData.brand,
            price: formData.price,
            currency: formData.currency,
            buy_url: formData.buy_url,
            logo_url: formData.logo_url,
            description: formData.description,
            specifications: formData.specifications || {},
            images: formData.images || [],
            user_recommendation_note: note,
            user_rating: userRating,
            is_pinned: isPinned,
            pin_order: isPinned ? existingProducts.filter((p) => p.is_pinned).length : null,
            display_order: displayOrder,
            product_list: listId,
            product_category: selectedCategories[0] || null,
          },
          refetchQueries: refetchProductsByList(listId!),
        });
        toast.success("Product added!");
      }
      navigate(`/recommendations/products/${listId}`, { state: { refetch: true } });
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to save product.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-2 md:px-6 pt-2 pb-24 md:pb-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => step === "form" && !isEdit ? setStep("url") : navigate(`/recommendations/products/${listId}`)}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-bold text-dashboard">
          {isEdit ? "Edit Product" : step === "url" ? "Add Product via URL" : "Product Details"}
        </h1>
      </div>

      {/* Step: URL paste */}
      {step === "url" && (
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-900/20 to-teal-900/10 border border-emerald-800/20">
            <p className="text-sm font-semibold text-white mb-1">Paste a product link</p>
            <p className="text-xs text-white/40 mb-4">We'll try to fetch the product name, image, and price automatically. Works best with Amazon, Apple Store, and other major retailers.</p>
            <UrlScrapePanel onScraped={handleUrlScraped} />
          </div>
          <div className="text-center">
            <button onClick={() => setStep("form")} className="text-xs text-white/30 hover:text-white/60 transition-colors">
              Skip — enter details manually
            </button>
          </div>
        </div>
      )}

      {/* Step: Form */}
      {step === "form" && (
        <div className="space-y-5">
          {/* Preview */}
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-white/5 flex-shrink-0">
              {formData.logo_url ? (
                <img src={buildImageUrl(formData.logo_url)} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"><ShoppingBag size={24} className="text-white/20" /></div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white truncate">{formData.title || "Product Name"}</p>
              <p className="text-xs text-white/40 truncate">{formData.brand || "Brand"}</p>
              {formData.price && <p className="text-sm font-bold text-emerald-400 mt-0.5">{formatPrice(formData.price, formData.currency)}</p>}
            </div>
          </div>

          {/* Fields */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2 block">Product URL *</label>
              <input type="url" value={formData.product_url || ""} onChange={(e) => setFormData((p) => ({ ...p, product_url: e.target.value }))} placeholder="https://amazon.com/..." className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50" />
            </div>
            <div>
              <label className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2 block">Title *</label>
              <input type="text" value={formData.title || ""} onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))} placeholder="Product name" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50" />
            </div>
            <div>
              <label className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2 block">Brand</label>
              <input type="text" value={formData.brand || ""} onChange={(e) => setFormData((p) => ({ ...p, brand: e.target.value }))} placeholder="e.g. Keychron, Sony" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2 block">Price</label>
                <input type="number" step="0.01" min="0" value={formData.price ?? ""} onChange={(e) => setFormData((p) => ({ ...p, price: e.target.value ? parseFloat(e.target.value) : undefined }))} placeholder="79.99" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50" />
              </div>
              <div>
                <label className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2 block">Currency</label>
                <select value={formData.currency || "USD"} onChange={(e) => setFormData((p) => ({ ...p, currency: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50">
                  {["USD", "EUR", "GBP", "INR", "JPY", "AUD", "CAD", "SGD"].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2 block">Buy / Affiliate URL</label>
              <input type="url" value={formData.buy_url || ""} onChange={(e) => setFormData((p) => ({ ...p, buy_url: e.target.value }))} placeholder="Custom affiliate or buy link..." className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50" />
            </div>
            <div>
              <label className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2 block">Image URL</label>
              <input type="url" value={formData.logo_url || ""} onChange={(e) => setFormData((p) => ({ ...p, logo_url: e.target.value }))} placeholder="https://..." className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50" />
            </div>
            <div>
              <label className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2 block">Description</label>
              <textarea value={formData.description || ""} onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))} placeholder="Brief product description..." rows={3} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50 resize-none" />
            </div>

            {/* Specs */}
            <div>
              <label className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2 block">Specifications</label>
              <SpecificationsEditor specs={formData.specifications || {}} onChange={(s) => setFormData((p) => ({ ...p, specifications: s }))} />
            </div>

            {/* Categories */}
            {categories.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2 block">Categories</label>
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => {
                    const selected = selectedCategories.includes(cat.documentId);
                    return (
                      <button
                        key={cat.documentId}
                        type="button"
                        onClick={() => setSelectedCategories(selected ? [] : [cat.documentId])}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${selected ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-300" : "border-white/10 bg-white/5 text-white/50 hover:border-white/20"}`}
                      >
                        {cat.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Rating */}
            <div>
              <label className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2 block">Your Rating {userRating ? `(${userRating}/10)` : "(optional)"}</label>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setUserRating(userRating === n ? null : n)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${userRating !== null && n <= userRating ? "bg-amber-500/30 text-amber-300 border border-amber-500/40" : "bg-white/5 text-white/30 border border-white/10 hover:border-white/20"}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Pin */}
            <div className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <Star size={16} className={isPinned ? "text-amber-400" : "text-white/30"} fill={isPinned ? "currentColor" : "none"} />
              <div className="flex-1">
                <p className="text-sm font-medium text-white">Pin to Top Picks</p>
                <p className="text-xs text-white/40">Appears in your featured section</p>
              </div>
              <button type="button" onClick={() => setIsPinned((p) => !p)} className={`w-10 h-6 rounded-full transition-all ${isPinned ? "bg-amber-500" : "bg-white/10"}`}>
                <div className={`w-4 h-4 rounded-full bg-white mx-1 transition-transform ${isPinned ? "translate-x-4" : ""}`} />
              </button>
            </div>

            {/* Note */}
            <div>
              <label className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2 block">Your Note (optional)</label>
              <TiptapEditor content={note} onChange={setNote} placeholder="Share why you recommend this product..." />
            </div>
          </div>

          {/* Save */}
          <div className="flex gap-3 pt-4 border-t border-white/10">
            <button onClick={() => navigate(`/recommendations/products/${listId}`)} className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-sm text-white/70 font-medium transition-colors">Cancel</button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-sm text-white font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {isEdit ? "Save Changes" : "Add to List"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddProductPage;
