import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation } from "@apollo/client";
import {
  ArrowLeft, Star, Loader2, Check, ShoppingBag, Link as LinkIcon,
  AlertCircle, Plus, Trash2, Upload, X,
} from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import useAuthStore from "../../../../store/store";
import { PRODUCTS_BY_LIST, PRODUCT_CATEGORIES, productsByListVars, refetchProductsByList } from "../../api/query";
import { CREATE_RECOMMENDED_PRODUCT, UPDATE_RECOMMENDED_PRODUCT } from "../../api/mutation";
import {
  deduplicateProducts, buildImageUrl, generateSlug, formatPrice,
} from "../../utils/productHelpers";
import type { RecommendedProduct, ProductCategory } from "../../types";
import TiptapEditor from "../../../Favorites/components/TiptapEditor";
import {
  generateProductUploadPath,
  generateRandomFileName,
  sanitizeUsername,
} from "../../../../utils/uploadPathGenerator";

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
      setError("Could not fetch metadata — fill in the details below.");
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

const SpecificationsEditor = ({
  specs,
  onChange,
}: {
  specs: Record<string, string>;
  onChange: (newSpecs: Record<string, string>) => void;
}) => {
  const entries = Object.entries(specs);

  const handleAdd = () => onChange({ ...specs, "": "" });

  const handleChange = (oldKey: string, newKey: string, val: string) => {
    const updated: Record<string, string> = {};
    for (const [k, v] of Object.entries(specs)) {
      updated[k === oldKey ? newKey : k] = k === oldKey ? val : v;
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
      <button type="button" onClick={handleAdd} className="flex items-center gap-2 text-xs text-emerald-400/70 hover:text-emerald-400 transition-colors">
        <Plus size={12} /> Add spec
      </button>
    </div>
  );
};

const AddProductPage = () => {
  const navigate = useNavigate();
  const { listId, productId } = useParams<{ listId: string; productId: string }>();
  const { user, token } = useAuthStore();
  const isEdit = !!productId;

  const [step, setStep] = useState<"url" | "form">(isEdit ? "form" : "url");
  const [formData, setFormData] = useState<Partial<RecommendedProduct>>({
    currency: "USD",
    images: [],
    specifications: {},
    product_category: [] as unknown as RecommendedProduct["product_category"],
  });
  const [note, setNote] = useState<any>(null);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  // Scraped images from platform (shown as selectable grid)
  const [scrapedImages, setScrapedImages] = useState<{ url: string; selected: boolean }[]>([]);
  // Manual file uploads → S3
  const [existingSnapshots, setExistingSnapshots] = useState<{ id: string; url: string }[]>([]);
  const [newSnapshots, setNewSnapshots] = useState<File[]>([]);

  const { data: listData } = useQuery(PRODUCTS_BY_LIST, {
    variables: productsByListVars(listId!),
    skip: !listId,
  });

  const { data: categoryData } = useQuery(PRODUCT_CATEGORIES);
  const categories: ProductCategory[] = categoryData?.productCategories ?? [];

  const existingProduct: RecommendedProduct | null = isEdit
    ? (deduplicateProducts(listData?.productLists?.[0]?.recommended_products ?? []).find(
        (p) => p.documentId === productId
      ) as RecommendedProduct | undefined) ?? null
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
      // Populate existing snapshots from saved images (exclude logo)
      if (existingProduct.images && existingProduct.images.length > 0) {
        setExistingSnapshots(
          existingProduct.images.map((url: string, i: number) => ({ id: `existing_${i}`, url }))
        );
      }
    }
  }, [isEdit, existingProduct?.documentId]);

  const [createProduct] = useMutation(CREATE_RECOMMENDED_PRODUCT);
  const [updateProduct] = useMutation(UPDATE_RECOMMENDED_PRODUCT);

  const handleUrlScraped = useCallback((data: Partial<RecommendedProduct>) => {
    // Separate scraped images from form data — we'll show them as a selectable grid
    const { images: scrapedImgs, ...rest } = data as any;
    setFormData((prev) => ({ ...prev, ...rest, images: [] }));
    if (Array.isArray(scrapedImgs) && scrapedImgs.length > 0) {
      setScrapedImages(scrapedImgs.map((url: string) => ({ url, selected: true })));
    } else {
      setScrapedImages([]);
    }
    setStep("form");
  }, []);

  const uploadUrlToS3 = async (imageUrl: string, label: string, titleForSlug: string): Promise<string> => {
    try {
      toast.loading(`Uploading ${label}...`, { id: `upload-${label}` });
      const res = await axios.get(imageUrl, { responseType: "blob" });
      const blob: Blob = res.data;
      const fileType = blob.type || "image/jpeg";
      const ext = fileType.split("/")[1] || "jpg";

      const usernameStr = sanitizeUsername(user?.username || "user");
      const slugBase = generateSlug(titleForSlug || "product");
      const randomFileName = generateRandomFileName(`${label}.${ext}`);
      const fullS3Path = generateProductUploadPath(usernameStr, listId!, slugBase, randomFileName);
      const directoryPath = fullS3Path.substring(0, fullS3Path.lastIndexOf("/"));

      const fd = new FormData();
      fd.append("files", new File([blob], randomFileName, { type: fileType }));
      fd.append("path", directoryPath);

      const uploadRes = await axios.post(
        `${import.meta.env.VITE_REST_API_URL}/upload`,
        fd,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );

      toast.success(`${label} uploaded!`, { id: `upload-${label}` });
      if (uploadRes.data?.[0]?.url) return uploadRes.data[0].url;
    } catch (err) {
      console.error(`S3 upload failed for ${label}:`, err);
      toast.error(`Could not upload ${label}, using original URL.`, { id: `upload-${label}` });
    }
    return imageUrl;
  };

  // Truncate strings to fit Strapi's VARCHAR(255) column limit
  const trunc = (val: string | undefined | null, max = 255): string | undefined =>
    val ? val.slice(0, max) : val ?? undefined;

  const handleSave = async () => {
    if (!formData.title?.trim()) { toast.error("Product title is required."); return; }
    if (!formData.product_url?.trim()) { toast.error("Product URL is required."); return; }

    setSaving(true);
    const existingProducts = deduplicateProducts(listData?.productLists?.[0]?.recommended_products ?? []);
    const displayOrder = isEdit ? existingProduct?.display_order ?? 0 : existingProducts.length;

    try {
      let finalLogoUrl = formData.logo_url || "";
      // Start with existing snapshots (already on S3)
      let uploadedSnapshots: { id: string; url: string }[] = [...existingSnapshots];

      if (!isEdit) {
        // Upload selected scraped images to S3
        const selectedScraped = scrapedImages.filter((img) => img.selected);
        if (selectedScraped.length > 0) {
          toast.loading("Uploading fetched images...", { id: "upload-scraped" });
          const scrapedUploads = await Promise.all(
            selectedScraped.map(async (img, idx) => {
              try {
                const s3Url = await uploadUrlToS3(img.url, `scraped_${idx}`, formData.title || "product");
                return { id: `scraped_${Date.now()}_${idx}`, url: s3Url };
              } catch {
                return null;
              }
            })
          );
          const validUploads = scrapedUploads.filter(Boolean) as { id: string; url: string }[];
          uploadedSnapshots = [...uploadedSnapshots, ...validUploads];
          toast.success("Images uploaded!", { id: "upload-scraped" });
        }

        // Upload logo to S3 — if empty, use first uploaded scraped image
        if (finalLogoUrl && finalLogoUrl.startsWith("http")) {
          finalLogoUrl = await uploadUrlToS3(finalLogoUrl, "logo", formData.title || "product");
        } else if (!finalLogoUrl && uploadedSnapshots.length > 0) {
          // Use the first scraped image's S3 URL as logo
          finalLogoUrl = uploadedSnapshots[0].url;
        }
      }

      // Upload any manually selected snapshot files to S3
      if (newSnapshots.length > 0) {
        toast.loading("Uploading snapshots...", { id: "upload-snapshots" });
        try {
          const manualUploads = await Promise.all(
            newSnapshots.map(async (file, idx) => {
              try {
                const usernameStr = sanitizeUsername(user?.username || "user");
                const slugBase = generateSlug(formData.title || "product");
                const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
                const randomFileName = generateRandomFileName(safeName);
                const fullS3Path = generateProductUploadPath(usernameStr, listId!, slugBase, randomFileName);
                const directoryPath = fullS3Path.substring(0, fullS3Path.lastIndexOf("/"));

                const fd = new FormData();
                fd.append("files", file, randomFileName);
                fd.append("path", directoryPath);

                const uploadRes = await axios.post(
                  `${import.meta.env.VITE_REST_API_URL}/upload`,
                  fd,
                  {
                    headers: {
                      "Content-Type": "multipart/form-data",
                      ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                  }
                );
                if (uploadRes.data?.[0]?.url) {
                  return { id: `snap_${Date.now()}_${idx}`, url: uploadRes.data[0].url };
                }
                return null;
              } catch (e) {
                console.error("Snapshot upload failed:", e);
                return null;
              }
            })
          );
          uploadedSnapshots = [...uploadedSnapshots, ...manualUploads.filter(Boolean) as { id: string; url: string }[]];
          toast.success("Snapshots uploaded!", { id: "upload-snapshots" });
        } catch {
          toast.error("Some snapshots failed to upload.", { id: "upload-snapshots" });
        }
      }

      const finalImages = uploadedSnapshots.map((s) => s.url);

      if (isEdit && productId) {
        await updateProduct({
          variables: {
            documentId: productId,
            title: trunc(formData.title),
            brand: trunc(formData.brand),
            price: formData.price,
            currency: trunc(formData.currency),
            buy_url: trunc(formData.buy_url),
            logo_url: trunc(formData.logo_url),
            description: trunc(formData.description),
            specifications: formData.specifications,
            images: finalImages,
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
            product_url: trunc(formData.product_url),
            title: trunc(formData.title),
            brand: trunc(formData.brand),
            price: formData.price,
            currency: trunc(formData.currency),
            buy_url: trunc(formData.buy_url),
            logo_url: trunc(finalLogoUrl),
            description: trunc(formData.description),
            specifications: formData.specifications || {},
            images: finalImages,
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
            <p className="text-xs text-white/40 mb-4">We'll fetch the product name, image, and price automatically. Works best with Amazon, Apple Store, and other major retailers.</p>
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

            {/* Rating — 10 stars matching movie form */}
            <div>
              <label className="text-sm font-semibold text-dashboard mb-2 block">
                Your Rating {userRating ? `(${userRating}/10)` : "(optional)"}
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setUserRating(userRating === star ? null : star)}
                    className={`p-1 transition-all hover:scale-110 active:scale-95 ${userRating && userRating >= star ? "text-yellow-400" : "text-white/20 hover:text-white/40"}`}
                  >
                    <Star size={24} fill={userRating && userRating >= star ? "currentColor" : "none"} />
                  </button>
                ))}
              </div>
            </div>

            {/* Scraped Images — selectable grid */}
            {scrapedImages.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-white/60 uppercase tracking-wider">Media from Platform</label>
                  <div className="flex gap-3 text-xs">
                    <button type="button" onClick={() => setScrapedImages((imgs) => imgs.map((img) => ({ ...img, selected: true })))} className="text-emerald-400/70 hover:text-emerald-400 transition-colors">Select All</button>
                    <button type="button" onClick={() => setScrapedImages((imgs) => imgs.map((img) => ({ ...img, selected: false })))} className="text-white/30 hover:text-white/50 transition-colors">Deselect All</button>
                  </div>
                </div>
                <p className="text-[11px] text-white/30 mb-3">Click to deselect images you don't want. Selected images will be uploaded to S3.</p>
                <div className="flex flex-wrap gap-2">
                  {scrapedImages.map((img, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setScrapedImages((imgs) => imgs.map((m, idx) => idx === i ? { ...m, selected: !m.selected } : m))}
                      className={`relative w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 transition-all ${
                        img.selected
                          ? "ring-2 ring-emerald-500 ring-offset-1 ring-offset-black/50 opacity-100"
                          : "opacity-35 grayscale"
                      }`}
                    >
                      <img src={img.url} alt={`media-${i}`} className="w-full h-full object-cover" />
                      {img.selected && (
                        <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                          <Check size={10} className="text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-white/30 mt-2">{scrapedImages.filter((i) => i.selected).length} of {scrapedImages.length} selected</p>
              </div>
            )}

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

            {/* Additional Media — manual file uploads */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-dashboard">Manual Snapshots from Product (Optional)</label>
              </div>
              <div className="flex flex-col gap-3">
                {/* Existing Snapshots */}
                {existingSnapshots.length > 0 && (
                  <div className="flex flex-wrap gap-3 mb-2">
                    {existingSnapshots.map((snap) => (
                      <div key={snap.id} className="relative w-24 h-24 rounded-xl overflow-hidden shadow-sm group">
                        <img
                          src={snap.url.startsWith("http") ? snap.url : `${import.meta.env.VITE_REST_API_URL?.replace("/api", "") || "http://localhost:1337"}${snap.url}`}
                          className="w-full h-full object-cover"
                          alt="Snapshot"
                        />
                        <button
                          type="button"
                          onClick={() => setExistingSnapshots((prev) => prev.filter((s) => s.id !== snap.id))}
                          className="absolute top-1 right-1 bg-black/60 p-1 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* New Snapshots Preview */}
                {newSnapshots.length > 0 && (
                  <div className="flex flex-wrap gap-3 mb-2">
                    {newSnapshots.map((file, i) => (
                      <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden shadow-sm group border border-white/10">
                        <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" alt="New Snapshot preview" />
                        <button
                          type="button"
                          onClick={() => setNewSnapshots((prev) => prev.filter((_, idx) => idx !== i))}
                          className="absolute top-1 right-1 bg-black/60 p-1 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload Button */}
                <label className="w-full md:w-auto self-start cursor-pointer flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 border-dashed rounded-xl px-5 py-3 text-sm text-white/70 transition-colors">
                  <Upload size={16} className="text-white/50" />
                  <span>Upload Images</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) {
                        setNewSnapshots((prev) => [...prev, ...Array.from(e.target.files!)]);
                      }
                    }}
                  />
                </label>
              </div>
            </div>

            {/* Note */}
            <div>
              <label className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2 block">Your Note (optional)</label>
              <TiptapEditor value={note ?? ""} onChange={setNote} placeholder="Share why you recommend this product..." />
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
