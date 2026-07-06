import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation } from "@apollo/client";
import {
  ArrowLeft, Star, Loader2, Check, Users, Link as LinkIcon,
  AlertCircle, Upload, X, Instagram, Linkedin, Github, Youtube, Globe,
} from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import useAuthStore from "../../../../store/store";
import { PEOPLE_BY_LIST, PERSON_CATEGORIES, peopleByListVars, refetchPeopleByList } from "../../api/query";
import { CREATE_RECOMMENDED_PERSON, UPDATE_RECOMMENDED_PERSON } from "../../api/mutation";
import {
  deduplicatePeople, buildImageUrl, generateSlug, detectPlatform, getPlatformColor,
} from "../../utils/personHelpers";
import type { RecommendedPerson, PeopleCategory } from "../../types";
import TiptapEditor from "../../../Favorites/components/TiptapEditor";
import {
  generatePersonUploadPath,
  generateRandomFileName,
  sanitizeUsername,
} from "../../../../utils/uploadPathGenerator";

// ─────────────────────────────────────────────────────────────
// URL Scrape Panel
// ─────────────────────────────────────────────────────────────
const UrlScrapePanel = ({
  onScraped,
}: {
  onScraped: (data: Partial<RecommendedPerson>) => void;
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
        `${import.meta.env.VITE_REST_API_URL}/people/scrape-profile`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) }
      );
      if (!resp.ok) throw new Error("Scrape failed");
      const data = await resp.json();
      const detectedPlatform = detectPlatform(url);
      onScraped({ ...data, profile_url: url, platform: data.platform || detectedPlatform });
      toast.success("Profile metadata fetched!");
    } catch {
      setError("Could not fetch profile data — fill in the details below.");
      const detectedPlatform = detectPlatform(url);
      onScraped({ profile_url: url, platform: detectedPlatform });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <LinkIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dashboard-muted" />
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://instagram.com/username or linkedin.com/in/..."
            className="w-full bg-dashboard-muted border border-dashboard-border rounded-xl pl-9 pr-4 py-3 text-sm text-dashboard placeholder-dashboard-muted focus:outline-none focus:border-dashboard-accent transition-colors"
            onKeyDown={(e) => e.key === "Enter" && handleScrape()}
          />
        </div>
        <button
          onClick={handleScrape}
          disabled={loading || !url.trim()}
          className="px-5 py-2.5 rounded-xl bg-dashboard-accent hover:opacity-90 text-sm text-white font-medium transition-all shadow-lg shadow-blue-900/30 flex items-center gap-2 disabled:opacity-50"
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
// Platform selector
// ─────────────────────────────────────────────────────────────
const PLATFORMS = [
  { value: "instagram", label: "Instagram", Icon: Instagram },
  { value: "linkedin", label: "LinkedIn", Icon: Linkedin },
  { value: "x", label: "X / Twitter", Icon: () => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
  )},
  { value: "github", label: "GitHub", Icon: Github },
  { value: "youtube", label: "YouTube", Icon: Youtube },
  { value: "website", label: "Website", Icon: Globe },
  { value: "other", label: "Other", Icon: Globe },
];

// ─────────────────────────────────────────────────────────────
// Tags editor
// ─────────────────────────────────────────────────────────────
const TagsEditor = ({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) => {
  const [input, setInput] = useState("");

  const addTag = () => {
    const trimmed = input.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput("");
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {tags.map((tag) => (
          <span key={tag} className="flex items-center gap-1 text-xs bg-dashboard-accent/20 border border-dashboard-accent/30 text-white px-2.5 py-1 rounded-full">
            {tag}
            <button onClick={() => onChange(tags.filter((t) => t !== tag))} className="hover:text-red-400 transition-colors ml-0.5">
              <X size={10} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
          placeholder="Add a tag (press Enter)"
          className="flex-1 bg-dashboard-muted border border-dashboard-border rounded-lg px-3 py-2 text-xs text-white placeholder-dashboard-muted focus:outline-none focus:border-dashboard-accent"
        />
        <button onClick={addTag} className="px-3 py-2 rounded-lg bg-dashboard-accent/30 text-white text-xs hover:bg-dashboard-accent/50 transition-colors">
          Add
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Main AddPersonPage
// ─────────────────────────────────────────────────────────────
const AddPersonPage = () => {
  const navigate = useNavigate();
  const { listId, personId } = useParams<{ listId: string; personId: string }>();
  const { user, token } = useAuthStore();
  const isEdit = !!personId;

  const [step, setStep] = useState<"url" | "form">(isEdit ? "form" : "url");
  const [formData, setFormData] = useState<Partial<RecommendedPerson>>({
    platform: null,
    tags: [],
  });
  const [note, setNote] = useState<any>(null);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  // Avatar upload
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  // Manual file uploads -> S3 (Gallery/Screenshots)
  const [existingSnapshots, setExistingSnapshots] = useState<{ id: string; url: string }[]>([]);
  const [newSnapshots, setNewSnapshots] = useState<File[]>([]);

  const { data: listData } = useQuery(PEOPLE_BY_LIST, {
    variables: peopleByListVars(listId!),
    skip: !listId,
  });

  const { data: categoryData } = useQuery(PERSON_CATEGORIES);
  const categories: PeopleCategory[] = categoryData?.peopleCategories ?? [];

  const existingPerson: RecommendedPerson | null = isEdit
    ? (deduplicatePeople(listData?.personLists?.[0]?.recommended_people ?? []).find(
        (p) => p.documentId === personId
      ) as RecommendedPerson | undefined) ?? null
    : null;

  useEffect(() => {
    if (isEdit && existingPerson) {
      setFormData({
        profile_url: existingPerson.profile_url,
        full_name: existingPerson.full_name,
        handle: existingPerson.handle ?? "",
        headline: existingPerson.headline ?? "",
        bio: existingPerson.bio ?? "",
        avatar_url: existingPerson.avatar_url ?? "",
        platform: existingPerson.platform,
        follower_count: existingPerson.follower_count ?? "",
        location: existingPerson.location ?? "",
        tags: existingPerson.tags ?? [],
      });
      setNote(existingPerson.user_recommendation_note);
      setUserRating(existingPerson.user_rating);
      setIsPinned(existingPerson.is_pinned);
      setSelectedCategoryId(existingPerson.people_category?.documentId ?? "");
      if (existingPerson.avatar_url) {
        setAvatarPreview(buildImageUrl(existingPerson.avatar_url));
      }
      // Populate existing snapshots from saved images
      if (existingPerson.media_details?.imageDetails) {
        setExistingSnapshots(existingPerson.media_details.imageDetails);
      }
    }
  }, [isEdit, existingPerson?.documentId]);

  const [createPerson] = useMutation(CREATE_RECOMMENDED_PERSON);
  const [updatePerson] = useMutation(UPDATE_RECOMMENDED_PERSON);

  const currentPeopleCount = deduplicatePeople(
    listData?.personLists?.[0]?.recommended_people ?? []
  ).length;

  const handleSave = useCallback(async () => {
    if (!formData.full_name?.trim()) {
      toast.error("Full name is required.");
      return;
    }
    if (!formData.profile_url?.trim()) {
      toast.error("Profile URL is required.");
      return;
    }
    setSaving(true);
    try {
      const uploadFileToStrapi = async (file: File, titleForSlug: string): Promise<string> => {
        const usernameStr = sanitizeUsername(user?.username || "user");
        const slugBase = generateSlug(titleForSlug || "person");
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const randomFileName = generateRandomFileName(safeName);
        const fullS3Path = generatePersonUploadPath(usernameStr, listId!, slugBase, randomFileName);
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
        return uploadRes.data?.[0]?.url || "";
      };

      const uploadUrlToS3 = async (imageUrl: string, label: string, titleForSlug: string): Promise<string> => {
        try {
          toast.loading(`Uploading ${label}...`, { id: `upload-${label}` });
          
          let blob: Blob | null = null;
          try {
            const directResponse = await axios.get(imageUrl, { responseType: "blob", timeout: 5000 });
            if (directResponse?.data) {
              blob = directResponse.data;
            }
          } catch {
            const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(imageUrl)}`;
            const proxyResponse = await axios.get(proxyUrl, { responseType: "blob", timeout: 10000 });
            blob = proxyResponse.data;
          }

          if (!blob) throw new Error("Could not download image");

          const fileType = blob.type || "image/jpeg";
          const ext = fileType.split("/")[1] || "jpg";

          const usernameStr = sanitizeUsername(user?.username || "user");
          const slugBase = generateSlug(titleForSlug || "person");
          const randomFileName = generateRandomFileName(`${label}.${ext}`);
          const fullS3Path = generatePersonUploadPath(usernameStr, listId!, slugBase, randomFileName);
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

      let avatarUrl = formData.avatar_url || "";
      if (avatarFile) {
        avatarUrl = await uploadFileToStrapi(avatarFile, formData.full_name || "person");
      } else if (avatarUrl && avatarUrl.startsWith("http")) {
        const isExternal = avatarUrl.startsWith("http") && 
          !avatarUrl.includes("amazonaws.com") && 
          !avatarUrl.includes("digitaloceanspaces.com") && 
          !avatarUrl.includes("/uploads/");
        
        if (isExternal) {
          avatarUrl = await uploadUrlToS3(avatarUrl, "avatar", formData.full_name || "person");
        }
      }

      let uploadedSnapshots = [...existingSnapshots];

      if (newSnapshots.length > 0) {
        toast.loading("Uploading screenshots...", { id: "upload-snapshots" });
        try {
          const manualUploads = await Promise.all(
            newSnapshots.map(async (file, idx) => {
              try {
                const s3Url = await uploadFileToStrapi(file, formData.full_name || "person");
                if (s3Url) {
                  return { id: `snap_${Date.now()}_${idx}`, url: s3Url };
                }
                return null;
              } catch (e) {
                console.error("Snapshot upload failed:", e);
                return null;
              }
            })
          );
          uploadedSnapshots = [
            ...uploadedSnapshots,
            ...(manualUploads.filter(Boolean) as { id: string; url: string }[]),
          ];
          toast.success("Screenshots uploaded!", { id: "upload-snapshots" });
        } catch {
          toast.error("Some screenshots failed to upload.", { id: "upload-snapshots" });
        }
      }

      const mediaDetails = uploadedSnapshots.length > 0 ? { imageDetails: uploadedSnapshots } : null;

      // Persist the selected category selection as a tag inside the skills_tags JSON field
      const selectedCategory = categories.find((c) => c.documentId === selectedCategoryId);
      const tagsList = formData.tags && formData.tags.length > 0 ? [...formData.tags] : [];
      if (selectedCategory && !tagsList.includes(selectedCategory.Category_name)) {
        tagsList.push(selectedCategory.Category_name);
      }

      const variables = {
        name: formData.full_name,
        username_handle: formData.handle || null,
        headline: formData.headline || null,
        location: formData.location || null,
        avatar_path: avatarUrl || null,
        primary_platform: formData.platform === "x" ? "twitter" : (formData.platform || "website"),
        social_urls: {
          primary: formData.profile_url,
          [formData.platform || "website"]: formData.profile_url
        },
        skills_tags: tagsList,
        user_recommendation_note: note || null,
        user_rating: userRating,
        is_pinned: isPinned,
        pin_order: isPinned ? currentPeopleCount : null,
        display_order: isEdit ? existingPerson?.display_order ?? currentPeopleCount : currentPeopleCount,
        person_list: listId!,
        people_category: selectedCategoryId || null,
        media_details: mediaDetails,
      };

      if (isEdit && personId) {
        await updatePerson({
          variables: { documentId: personId, ...variables },
          refetchQueries: refetchPeopleByList(listId!),
        });
        toast.success("Person updated!");
      } else {
        await createPerson({
          variables,
          refetchQueries: refetchPeopleByList(listId!),
        });
        toast.success("Person added!");
      }
      navigate(`/recommendations/people/${listId}`, { state: { justAddedRecommendation: true } });
    } catch (err: any) {
      toast.error(err?.message || "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [formData, note, userRating, isPinned, selectedCategoryId, avatarFile, isEdit, personId, listId, currentPeopleCount, user, token, existingSnapshots, newSnapshots]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const showForm = isEdit || step === "form";

  return (
    <div className="min-h-screen text-dashboard bg-dashboard-bg">
      {/* Sticky header */}
      <div className="border-b border-dashboard-border px-4 md:px-6 py-3 flex items-center gap-3 sticky top-0 bg-dashboard-bg z-40 w-full">
        <button
          onClick={() => step === "form" && !isEdit ? setStep("url") : navigate(`/recommendations/people/${listId}`)}
          className="text-white/40 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-dashboard">
            {isEdit ? "Edit Person" : "Add Person"}
          </h1>
          <p className="text-xs text-dashboard-muted mt-0.5">
            {isEdit
              ? "Update the details and save your changes"
              : selectedCategoryId
                ? "Edit the details below before saving"
                : "Paste a profile URL to fetch metadata"}
          </p>
        </div>
        {saving && (
          <div className="flex items-center gap-2 text-xs text-blue-400">
            <Loader2 size={14} className="animate-spin" />
            Saving changes…
          </div>
        )}
      </div>

      {/* Single-column form container */}
      <div className="max-w-2xl mx-auto px-6 pt-6 pb-40 md:pb-8 space-y-5">
        {/* Step 1: URL input */}
        {!isEdit && step === "url" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-semibold text-white mb-1">Paste Profile Link</h2>
              <p className="text-xs text-dashboard-muted mb-4">Instagram, LinkedIn, GitHub, X — any public profile URL</p>
              <UrlScrapePanel
                onScraped={(data) => {
                  setFormData((prev) => ({ ...prev, ...data }));
                  if (data.avatar_url) setAvatarPreview(buildImageUrl(data.avatar_url));
                  setStep("form");
                }}
              />
            </div>
            <div className="text-center">
              <button onClick={() => setStep("form")} className="text-xs text-dashboard-muted hover:text-white/70 transition-colors underline">
                Skip — fill in manually
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Form */}
        {showForm && (
          <>
            {/* Backdrop + avatar strip */}
            <div className="relative rounded-xl overflow-hidden bg-white/5 mb-2 h-32 flex items-end">
              {avatarPreview ? (
                <img src={avatarPreview} alt="" className="absolute inset-0 w-full h-full object-cover opacity-25 filter blur-sm scale-110" />
              ) : (
                <div className={`absolute inset-0 bg-gradient-to-r ${formData.platform ? getPlatformColor(formData.platform) : "from-blue-900/20 to-purple-900/20"} opacity-20`} />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-dashboard-bg via-transparent to-transparent" />
              <div className="absolute bottom-3 left-4 flex items-end gap-3 z-10">
                <div className="relative w-16 h-16 rounded-full overflow-hidden shadow-xl border border-white/10 flex-shrink-0 bg-dashboard-muted">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Users size={24} className="text-white/20" />
                    </div>
                  )}
                  <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 cursor-pointer transition-opacity">
                    <Upload size={12} className="text-white" />
                    <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                  </label>
                </div>
                <div className="pb-1">
                  <p className="text-sm font-semibold text-white leading-tight">{formData.full_name || "Person Name"}</p>
                  <p className="text-xs text-dashboard-muted mt-0.5">{formData.handle ? `@${formData.handle}` : formData.profile_url || "No URL yet"}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5">
              {/* Profile URL */}
              <div>
                <label className="text-sm font-semibold text-white/90 mb-2 block">Profile URL *</label>
                <input
                  type="url"
                  value={formData.profile_url || ""}
                  onChange={(e) => setFormData((p) => ({ ...p, profile_url: e.target.value, platform: detectPlatform(e.target.value) }))}
                  placeholder="https://instagram.com/username"
                  className="w-full bg-dashboard-muted border border-dashboard-border rounded-xl px-4 py-3 text-sm text-dashboard placeholder-dashboard-muted focus:outline-none focus:border-dashboard-accent transition-colors"
                />
              </div>

              {/* Full Name */}
              <div>
                <label className="text-sm font-semibold text-white/90 mb-2 block">Full Name *</label>
                <input
                  type="text"
                  value={formData.full_name || ""}
                  onChange={(e) => setFormData((p) => ({ ...p, full_name: e.target.value }))}
                  placeholder="e.g. John Doe"
                  className="w-full bg-dashboard-muted border border-dashboard-border rounded-xl px-4 py-3 text-sm text-dashboard placeholder-dashboard-muted focus:outline-none focus:border-dashboard-accent transition-colors"
                />
              </div>

              {/* Handle */}
              <div>
                <label className="text-sm font-semibold text-white/90 mb-2 block">Handle / Username</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dashboard-muted text-sm">@</span>
                  <input
                    type="text"
                    value={formData.handle || ""}
                    onChange={(e) => setFormData((p) => ({ ...p, handle: e.target.value }))}
                    placeholder="username"
                    className="w-full bg-dashboard-muted border border-dashboard-border rounded-xl pl-7 pr-4 py-3 text-sm text-dashboard placeholder-dashboard-muted focus:outline-none focus:border-dashboard-accent transition-colors"
                  />
                </div>
              </div>

              {/* Platform */}
              <div>
                <label className="text-sm font-semibold text-white/90 mb-2 block">Platform</label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {PLATFORMS.map(({ value, label, Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFormData((p) => ({ ...p, platform: value as RecommendedPerson["platform"] }))}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                        formData.platform === value
                          ? "bg-dashboard-accent/30 border-dashboard-accent/60 text-white"
                          : "bg-dashboard-muted border-dashboard-border text-white/50 hover:border-white/20"
                      }`}
                    >
                      <Icon size={12} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Headline */}
              <div>
                <label className="text-sm font-semibold text-white/90 mb-2 block">Headline / Role</label>
                <input
                  type="text"
                  value={formData.headline || ""}
                  onChange={(e) => setFormData((p) => ({ ...p, headline: e.target.value }))}
                  placeholder="e.g. Tech Entrepreneur · Speaker"
                  className="w-full bg-dashboard-muted border border-dashboard-border rounded-xl px-4 py-3 text-sm text-dashboard placeholder-dashboard-muted focus:outline-none focus:border-dashboard-accent transition-colors"
                />
              </div>

              {/* Bio */}
              <div>
                <label className="text-sm font-semibold text-white/90 mb-2 block">Bio / Description</label>
                <textarea
                  value={formData.bio || ""}
                  onChange={(e) => setFormData((p) => ({ ...p, bio: e.target.value }))}
                  placeholder="Short bio or description"
                  rows={3}
                  className="w-full bg-dashboard-muted border border-dashboard-border rounded-xl px-4 py-3 text-sm text-dashboard placeholder-dashboard-muted focus:outline-none focus:border-dashboard-accent transition-colors resize-none"
                />
              </div>

              {/* Location & Followers */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-white/90 mb-2 block">Location</label>
                  <input
                    type="text"
                    value={formData.location || ""}
                    onChange={(e) => setFormData((p) => ({ ...p, location: e.target.value }))}
                    placeholder="e.g. San Francisco"
                    className="w-full bg-dashboard-muted border border-dashboard-border rounded-xl px-4 py-3 text-sm text-dashboard placeholder-dashboard-muted focus:outline-none focus:border-dashboard-accent transition-colors"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-white/90 mb-2 block">Followers</label>
                  <input
                    type="text"
                    value={formData.follower_count || ""}
                    onChange={(e) => setFormData((p) => ({ ...p, follower_count: e.target.value }))}
                    placeholder="e.g. 1.2M"
                    className="w-full bg-dashboard-muted border border-dashboard-border rounded-xl px-4 py-3 text-sm text-dashboard placeholder-dashboard-muted focus:outline-none focus:border-dashboard-accent transition-colors"
                  />
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="text-sm font-semibold text-white/90 mb-2 block">Tags</label>
                <TagsEditor tags={formData.tags || []} onChange={(tags) => setFormData((p) => ({ ...p, tags }))} />
              </div>

              {/* Category */}
              {categories.length > 0 && (
                <div>
                  <label className="text-sm font-semibold text-white/90 mb-2 block">Category</label>
                  <select
                    value={selectedCategoryId}
                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                    className="w-full bg-dashboard-muted border border-dashboard-border rounded-xl px-4 py-3 text-sm text-dashboard placeholder-dashboard-muted focus:outline-none focus:border-dashboard-accent transition-colors"
                  >
                    <option value="">No category</option>
                    {categories.map((cat) => (
                      <option key={cat.documentId} value={cat.documentId}>{cat.Category_name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Rating */}
              <div>
                <label className="text-sm font-semibold text-white/90 mb-2 block">Your Rating</label>
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

              {/* Additional Media — manual file uploads */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-semibold text-white/90">Manual Screenshots / Portfolio Images (Optional)</label>
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
                <label className="text-sm font-semibold text-white/90 mb-2 block">Your Recommendation Note (optional)</label>
                <div className="bg-dashboard-muted border border-dashboard-border rounded-xl overflow-hidden focus-within:border-dashboard-accent transition-colors">
                  <TiptapEditor value={note} onChange={setNote} placeholder="Why do you recommend this person? What makes them special?" />
                </div>
              </div>

              {/* Pin */}
              <div className="flex items-center justify-between p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-amber-400">Pin to Top Picks</p>
                  <p className="text-xs text-dashboard-muted mt-0.5">Featured prominently on your profile</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPinned(!isPinned)}
                  className={`p-2 rounded-lg transition-all ${isPinned ? "bg-amber-400/20 text-amber-400" : "bg-white/5 text-white/30 hover:text-amber-400"}`}
                >
                  <Star size={18} fill={isPinned ? "currentColor" : "none"} />
                </button>
              </div>

              {/* Actions Section */}
              <div className="pt-4 border-t border-dashboard-border">
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => navigate(`/recommendations/people/${listId}`)}
                    className="px-6 py-3 rounded-xl bg-dashboard-muted hover:bg-white/10 text-sm text-white font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !formData.full_name?.trim()}
                    className="flex-1 py-3 rounded-xl bg-dashboard-accent hover:opacity-90 text-sm text-white font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                    {isEdit ? "Save Changes" : "Add to List"}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AddPersonPage;
