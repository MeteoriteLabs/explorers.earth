import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation } from "@apollo/client";
import {
  ArrowLeft, Search, Star, X, Loader2, Check, Smartphone, Link as LinkIcon,
  AlertCircle, Upload,
} from "lucide-react";
import axios from "axios";
import { toast } from "sonner";
import useAuthStore from "../../../../store/store";
import { APPS_BY_LIST, APP_CATEGORIES, appsByListVars, refetchAppsByList } from "../../api/query";
import { CREATE_RECOMMENDED_APP, UPDATE_RECOMMENDED_APP } from "../../api/mutation";
import itunesService from "../../../../services/itunesService";
import type { ItunesResult } from "../../../../services/itunesService";
import {
  deduplicateApps, buildLogoUrl, generateSlug,
  getPriceTierColor, itunesPriceTier,
} from "../../utils/appHelpers";
import type { RecommendedApp, AppCategory } from "../../types";
import TiptapEditor from "../../../Favorites/components/TiptapEditor";
import {
  generateAppUploadPath,
  generateRandomFileName,
  sanitizeUsername,
} from "../../../../utils/uploadPathGenerator";

const PRICE_TIERS = ["Free", "Freemium", "Paid", "Subscription"] as const;
const ALL_PLATFORMS = ["iOS", "iPadOS", "macOS", "Android", "Windows", "Web", "Linux", "Chrome Extension"];

// ─────────────────────────────────────────────────────────────
// iTunes Inline Search
// ─────────────────────────────────────────────────────────────
const ItunesInlineSearch = ({ onSelect }: { onSelect: (item: ItunesResult) => void }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ItunesResult[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const items = await itunesService.searchApps(query, 12);
        setResults(items);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 500);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          autoFocus
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search App Store (e.g. Figma, Notion)..."
          className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50 transition-colors"
        />
        {loading && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 animate-spin" />}
      </div>

      {results.length > 0 && (
        <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
          {results.map((item) => (
            <button
              key={item.trackId}
              onClick={() => onSelect(item)}
              className="flex items-center gap-3 w-full text-left p-2.5 rounded-xl hover:bg-white/6 transition-colors border border-transparent hover:border-white/10"
            >
              <div className="w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden bg-white/5">
                <img
                  src={itunesService.getArtworkUrl(item, 100)}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{item.trackName}</p>
                <p className="text-xs text-white/40 truncate">{item.sellerName}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${getPriceTierColor(itunesPriceTier(item.price))}`}>
                    {item.formattedPrice || "Free"}
                  </span>
                  <span className="text-[10px] text-white/30">{item.primaryGenreName}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {!loading && query.trim() && results.length === 0 && (
        <p className="text-sm text-white/30 text-center py-6">No results found for "{query}"</p>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// URL Paste Scraper
// ─────────────────────────────────────────────────────────────
const UrlScrapePanel = ({ onScraped }: { onScraped: (data: Partial<RecommendedApp>) => void }) => {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleScrape = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    try {
      const resp = await fetch(
        `/api/apps/scrape-url`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) }
      );
      if (!resp.ok) throw new Error("Scrape failed");
      const data = await resp.json();
      onScraped({ ...data, app_url: url });
      toast.success("URL metadata fetched!");
    } catch {
      setError("Could not fetch metadata — fill in details manually below.");
      onScraped({ app_url: url });
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
            placeholder="https://figma.com or App Store URL..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50 transition-colors"
            onKeyDown={(e) => e.key === "Enter" && handleScrape()}
          />
        </div>
        <button
          onClick={handleScrape}
          disabled={loading || !url.trim()}
          className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm text-white font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
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
// AddAppPage Main Component
// ─────────────────────────────────────────────────────────────
const AddAppPage = () => {
  const navigate = useNavigate();
  const { listId, appId } = useParams<{ listId: string; appId: string }>();
  const { user, token } = useAuthStore();
  const isEdit = !!appId;

  const [step, setStep] = useState<"method" | "search" | "url" | "form">(isEdit ? "form" : "method");
  const [formData, setFormData] = useState<Partial<RecommendedApp>>({
    platforms: [],
    price_tier: "Freemium",
    screenshots: [],
    app_category: [] as unknown as RecommendedApp["app_category"],
  });
  const [note, setNote] = useState<any>(null);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  // Scraped/fetched images from platform (shown as selectable grid)
  const [scrapedImages, setScrapedImages] = useState<{ url: string; selected: boolean }[]>([]);
  // Manual file uploads → S3
  const [existingSnapshots, setExistingSnapshots] = useState<{ id: string; url: string }[]>([]);
  const [newSnapshots, setNewSnapshots] = useState<File[]>([]);

  // Load existing data for edit mode
  const { data: listData } = useQuery(APPS_BY_LIST, {
    variables: appsByListVars(listId!),
    skip: !listId,
  });

  const { data: categoryData } = useQuery(APP_CATEGORIES);
  const categories: AppCategory[] = categoryData?.appCategories ?? [];

  const existingApp: RecommendedApp | null = isEdit
    ? (deduplicateApps(listData?.appLists?.[0]?.recommended_apps ?? []).find(
        (a) => a.documentId === appId
      ) as RecommendedApp | undefined) ?? null
    : null;

  useEffect(() => {
    if (isEdit && existingApp) {
      setFormData({
        app_url: existingApp.app_url,
        title: existingApp.title,
        description: existingApp.description ?? "",
        logo_url: existingApp.logo_url ?? "",
        developer: existingApp.developer ?? "",
        platforms: existingApp.platforms ?? [],
        price_tier: existingApp.price_tier ?? "Freemium",
        download_url: existingApp.download_url ?? "",
        screenshots: existingApp.screenshots ?? [],
      });
      setNote(existingApp.user_recommendation_note);
      setUserRating(existingApp.user_rating);
      setIsPinned(existingApp.is_pinned);
      setSelectedCategories(existingApp.app_category ? [existingApp.app_category.documentId] : []);
      // Populate existing snapshots from saved screenshots
      if (existingApp.screenshots && existingApp.screenshots.length > 0) {
        setExistingSnapshots(
          existingApp.screenshots.map((url: string, i: number) => ({ id: `existing_${i}`, url }))
        );
      }
    }
  }, [isEdit, existingApp?.documentId]);

  const [createApp] = useMutation(CREATE_RECOMMENDED_APP);
  const [updateApp] = useMutation(UPDATE_RECOMMENDED_APP);

  const handleItunesSelect = useCallback((item: ItunesResult) => {
    const platforms = itunesService.getPlatforms(item);
    const priceTier = itunesService.getPriceTier(item.price);
    // Use screenshotUrls as selectable scraped images if available
    const screenshots: string[] = (item as any).screenshotUrls || [];
    setFormData({
      app_url: item.trackViewUrl,
      title: item.trackName,
      description: item.description || "",
      logo_url: itunesService.getArtworkUrl(item, 512),
      developer: item.sellerName || "",
      platforms,
      price_tier: priceTier,
      download_url: item.trackViewUrl,
      screenshots: [],
    });
    if (screenshots.length > 0) {
      setScrapedImages(screenshots.map((url) => ({ url, selected: true })));
    } else {
      setScrapedImages([]);
    }
    setStep("form");
  }, []);

  const handleUrlScraped = useCallback((data: Partial<RecommendedApp>) => {
    // Separate scraped screenshots from form data
    const { screenshots: scrapedScreenshots, ...rest } = data as any;
    setFormData((prev) => ({ ...prev, ...rest, screenshots: [] }));
    if (Array.isArray(scrapedScreenshots) && scrapedScreenshots.length > 0) {
      setScrapedImages(scrapedScreenshots.map((url: string) => ({ url, selected: true })));
    } else {
      setScrapedImages([]);
    }
    setStep("form");
  }, []);

  const togglePlatform = (platform: string) => {
    setFormData((prev) => {
      const current = prev.platforms || [];
      return {
        ...prev,
        platforms: current.includes(platform)
          ? current.filter((p) => p !== platform)
          : [...current, platform],
      };
    });
  };

  const handleSave = async () => {
    if (!formData.title?.trim()) { toast.error("App title is required."); return; }
    if (!formData.app_url?.trim()) { toast.error("App URL is required."); return; }

    setSaving(true);
    const existingApps = deduplicateApps(listData?.appLists?.[0]?.recommended_apps ?? []);
    const displayOrder = isEdit
      ? existingApp?.display_order ?? 0
      : existingApps.length;

    try {
      let finalLogoUrl = formData.logo_url || "";
      // Start with existing snapshots (already on S3)
      let uploadedSnapshots: { id: string; url: string }[] = [...existingSnapshots];

      // Upload S3 helper for URL-based images
      const uploadUrlToS3 = async (imageUrl: string, label: string, silent: boolean = false): Promise<string> => {
        try {
          if (!silent) {
            toast.loading(`Uploading ${label}...`, { id: `upload-${label}` });
          }
          const res = await axios.get(imageUrl, { responseType: "blob" });
          const blob: Blob = res.data;
          const fileType = blob.type || "image/jpeg";
          const ext = fileType.split("/")[1] || "jpg";
          const usernameStr = sanitizeUsername(user?.username || "user");
          const slugBase = generateSlug(formData.title || "app");
          const randomFileName = generateRandomFileName(`${label}.${ext}`);
          const fullS3Path = generateAppUploadPath(usernameStr, listId!, slugBase, randomFileName);
          const directoryPath = fullS3Path.substring(0, fullS3Path.lastIndexOf("/"));
          const fd = new FormData();
          fd.append("files", new File([blob], randomFileName, { type: fileType }));
          fd.append("path", directoryPath);
          const uploadRes = await axios.post(
            `${import.meta.env.VITE_REST_API_URL}/upload`,
            fd,
            { headers: { "Content-Type": "multipart/form-data", ...(token ? { Authorization: `Bearer ${token}` } : {}) } }
          );
          if (!silent) {
            toast.success(`${label} uploaded!`, { id: `upload-${label}` });
          }
          if (uploadRes.data?.[0]?.url) return uploadRes.data[0].url;
        } catch (err) {
          console.error(`S3 upload failed for ${label}:`, err);
          if (!silent) {
            toast.error(`Could not upload ${label}.`, { id: `upload-${label}` });
          }
        }
        return imageUrl;
      };

      if (!isEdit) {
        // Upload selected scraped screenshots to S3
        const selectedScraped = scrapedImages.filter((img) => img.selected);
        if (selectedScraped.length > 0) {
          toast.loading("Uploading images...", { id: "upload-scraped" });
          const scrapedUploads = await Promise.all(
            selectedScraped.map(async (img, idx) => {
              try {
                const s3Url = await uploadUrlToS3(img.url, `scraped_${idx}`, true);
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

        // Upload logo to S3 — if empty, use first uploaded image as logo
        if (finalLogoUrl && finalLogoUrl.startsWith("http")) {
          finalLogoUrl = await uploadUrlToS3(finalLogoUrl, "logo");
        } else if (!finalLogoUrl && uploadedSnapshots.length > 0) {
          finalLogoUrl = uploadedSnapshots[0].url;
        }
      }

      // Upload manually selected snapshot files to S3
      if (newSnapshots.length > 0) {
        toast.loading("Uploading snapshots...", { id: "upload-snapshots" });
        try {
          const manualUploads = await Promise.all(
            newSnapshots.map(async (file, idx) => {
              try {
                const usernameStr = sanitizeUsername(user?.username || "user");
                const slugBase = generateSlug(formData.title || "app");
                const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
                const randomFileName = generateRandomFileName(safeName);
                const fullS3Path = generateAppUploadPath(usernameStr, listId!, slugBase, randomFileName);
                const directoryPath = fullS3Path.substring(0, fullS3Path.lastIndexOf("/"));
                const fd = new FormData();
                fd.append("files", file, randomFileName);
                fd.append("path", directoryPath);
                const uploadRes = await axios.post(
                  `${import.meta.env.VITE_REST_API_URL}/upload`,
                  fd,
                  { headers: { "Content-Type": "multipart/form-data", ...(token ? { Authorization: `Bearer ${token}` } : {}) } }
                );
                if (uploadRes.data?.[0]?.url) return { id: `snap_${Date.now()}_${idx}`, url: uploadRes.data[0].url };
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

      const finalScreenshots = uploadedSnapshots.map((s) => s.url);
      if (isEdit && appId) {
        await updateApp({
          variables: {
            documentId: appId,
            title: formData.title,
            description: formData.description,
            logo_url: formData.logo_url,
            developer: formData.developer,
            platforms: formData.platforms,
            price_tier: formData.price_tier,
            download_url: formData.download_url,
            screenshots: finalScreenshots,
            user_recommendation_note: note,
            user_rating: userRating,
            is_pinned: isPinned,
            app_category: selectedCategories[0] || null,
          },
          refetchQueries: refetchAppsByList(listId!),
        });
        toast.success("App updated!");
      } else {
        await createApp({
          variables: {
            app_url: formData.app_url,
            title: formData.title,
            description: formData.description,
            logo_url: finalLogoUrl,
            developer: formData.developer,
            platforms: formData.platforms || [],
            price_tier: formData.price_tier,
            download_url: formData.download_url,
            screenshots: finalScreenshots,
            user_recommendation_note: note,
            user_rating: userRating,
            is_pinned: isPinned,
            pin_order: isPinned ? existingApps.filter((a) => a.is_pinned).length : null,
            display_order: displayOrder,
            app_list: listId,
            app_category: selectedCategories[0] || null,
          },
          refetchQueries: refetchAppsByList(listId!),
        });
        toast.success("App added!");
      }
      navigate(`/recommendations/apps/${listId}`, { state: { refetch: true } });
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to save app.");
    } finally {
      setSaving(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────

  return (
    <div className="px-2 md:px-6 pt-2 pb-24 md:pb-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => step === "form" && !isEdit ? setStep("method") : navigate(`/recommendations/apps/${listId}`)}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-bold text-dashboard">
          {isEdit ? "Edit App" : step === "method" ? "Add App or Tool" : step === "search" ? "Search App Store" : step === "url" ? "Add via URL" : "App Details"}
        </h1>
      </div>

      {/* Step: Method selection */}
      {step === "method" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <motion.button
            whileHover={{ scale: 1.02 }}
            onClick={() => setStep("search")}
            className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-gradient-to-br from-violet-900/30 to-purple-900/20 border border-violet-700/30 hover:border-violet-500/50 transition-all text-center"
          >
            <div className="w-14 h-14 rounded-2xl bg-violet-600/30 flex items-center justify-center">
              <Search size={24} className="text-violet-300" />
            </div>
            <div>
              <p className="font-semibold text-white">Search App Store</p>
              <p className="text-xs text-white/40 mt-1">Find iOS, iPadOS & Mac apps</p>
            </div>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            onClick={() => setStep("url")}
            className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-gradient-to-br from-slate-900/40 to-slate-800/20 border border-slate-700/30 hover:border-violet-500/50 transition-all text-center"
          >
            <div className="w-14 h-14 rounded-2xl bg-slate-700/30 flex items-center justify-center">
              <LinkIcon size={24} className="text-slate-300" />
            </div>
            <div>
              <p className="font-semibold text-white">Add via URL</p>
              <p className="text-xs text-white/40 mt-1">Paste any app or tool link</p>
            </div>
          </motion.button>
        </div>
      )}

      {/* Step: iTunes Search */}
      {step === "search" && (
        <ItunesInlineSearch onSelect={handleItunesSelect} />
      )}

      {/* Step: URL Scrape */}
      {step === "url" && (
        <UrlScrapePanel onScraped={handleUrlScraped} />
      )}

      {/* Step: Form */}
      {step === "form" && (
        <div className="space-y-6">
          {/* App preview header */}
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
            <div className="w-16 h-16 rounded-2xl overflow-hidden bg-white/5 flex-shrink-0">
              {formData.logo_url ? (
                <img src={buildLogoUrl(formData.logo_url)} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Smartphone size={24} className="text-white/20" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white truncate">{formData.title || "App Name"}</p>
              <p className="text-xs text-white/40 truncate">{formData.developer || "Developer"}</p>
              {formData.price_tier && (
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded mt-1 inline-block ${getPriceTierColor(formData.price_tier)}`}>
                  {formData.price_tier}
                </span>
              )}
            </div>
          </div>

          {/* Basic fields */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2 block">App URL *</label>
              <input
                type="url"
                value={formData.app_url || ""}
                onChange={(e) => setFormData((p) => ({ ...p, app_url: e.target.value }))}
                placeholder="https://figma.com"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2 block">Title *</label>
              <input
                type="text"
                value={formData.title || ""}
                onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                placeholder="Figma"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2 block">Developer / Company</label>
              <input
                type="text"
                value={formData.developer || ""}
                onChange={(e) => setFormData((p) => ({ ...p, developer: e.target.value }))}
                placeholder="Figma Inc."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2 block">Description</label>
              <textarea
                value={formData.description || ""}
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                placeholder="Brief description of what this app does..."
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50 resize-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2 block">Logo URL</label>
              <input
                type="url"
                value={formData.logo_url || ""}
                onChange={(e) => setFormData((p) => ({ ...p, logo_url: e.target.value }))}
                placeholder="https://..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2 block">Download / Affiliate URL</label>
              <input
                type="url"
                value={formData.download_url || ""}
                onChange={(e) => setFormData((p) => ({ ...p, download_url: e.target.value }))}
                placeholder="https://apps.apple.com/..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50"
              />
            </div>

            {/* Platforms */}
            <div>
              <label className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2 block">Platforms</label>
              <div className="flex flex-wrap gap-2">
                {ALL_PLATFORMS.map((p) => {
                  const selected = (formData.platforms || []).includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => togglePlatform(p)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${selected ? "border-violet-500/60 bg-violet-500/20 text-violet-300" : "border-white/10 bg-white/5 text-white/50 hover:border-white/20"}`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Price Tier */}
            <div>
              <label className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2 block">Price Tier</label>
              <div className="flex gap-2 flex-wrap">
                {PRICE_TIERS.map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setFormData((p) => ({ ...p, price_tier: tier }))}
                    className={`text-xs px-4 py-2 rounded-lg border font-semibold transition-all ${formData.price_tier === tier ? getPriceTierColor(tier) + " border-current" : "border-white/10 bg-white/5 text-white/50"}`}
                  >
                    {tier}
                  </button>
                ))}
              </div>
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
                        onClick={() =>
                          setSelectedCategories(selected ? [] : [cat.documentId])
                        }
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${selected ? "border-violet-500/60 bg-violet-500/20 text-violet-300" : "border-white/10 bg-white/5 text-white/50 hover:border-white/20"}`}
                      >
                        {cat.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* User Rating — 10 stars matching movie form */}
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
                    className={`p-1 transition-all hover:scale-110 active:scale-95 ${
                      userRating && userRating >= star ? "text-yellow-400" : "text-white/20 hover:text-white/40"
                    }`}
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
                    <button type="button" onClick={() => setScrapedImages((imgs) => imgs.map((img) => ({ ...img, selected: true })))} className="text-violet-400/70 hover:text-violet-400 transition-colors">Select All</button>
                    <button type="button" onClick={() => setScrapedImages((imgs) => imgs.map((img) => ({ ...img, selected: false })))} className="text-white/30 hover:text-white/50 transition-colors">Deselect All</button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {scrapedImages.map((img, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setScrapedImages((imgs) => imgs.map((m, idx) => idx === i ? { ...m, selected: !m.selected } : m))}
                      className={`relative w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 transition-all ${
                        img.selected
                          ? "ring-2 ring-violet-500 ring-offset-1 ring-offset-black/50 opacity-100"
                          : "opacity-35 grayscale"
                      }`}
                    >
                      <img src={img.url} alt={`media-${i}`} className="w-full h-full object-cover" />
                      {img.selected && (
                        <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center">
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
              <button
                type="button"
                onClick={() => setIsPinned((p) => !p)}
                className={`w-10 h-6 rounded-full transition-all ${isPinned ? "bg-amber-500" : "bg-white/10"}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white mx-1 transition-transform ${isPinned ? "translate-x-4" : ""}`} />
              </button>
            </div>

            {/* Manual Snapshots */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-dashboard">Manual Snapshots from App (Optional)</label>
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
              <TiptapEditor value={note ?? ""} onChange={setNote} placeholder="Share why you love this app..." />
            </div>
          </div>

          {/* Save Button */}
          <div className="flex gap-3 pt-4 border-t border-white/10">
            <button
              onClick={() => navigate(`/recommendations/apps/${listId}`)}
              className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-sm text-white/70 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm text-white font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
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

export default AddAppPage;
