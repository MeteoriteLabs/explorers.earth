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
  deduplicatePeople, buildImageUrl, generateSlug, getPlatformLabel, detectPlatform,
} from "../../utils/personHelpers";
import type { RecommendedPerson, PersonCategory } from "../../types";
import TiptapEditor from "../../../Favorites/components/TiptapEditor";
import {
  generateProductUploadPath,
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
          <LinkIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://instagram.com/username or linkedin.com/in/..."
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
          <span key={tag} className="flex items-center gap-1 text-xs bg-violet-500/20 border border-violet-500/30 text-violet-300 px-2.5 py-1 rounded-full">
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
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50"
        />
        <button onClick={addTag} className="px-3 py-2 rounded-lg bg-violet-600/30 text-violet-300 text-xs hover:bg-violet-600/50 transition-colors">
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

  const { data: listData } = useQuery(PEOPLE_BY_LIST, {
    variables: peopleByListVars(listId!),
    skip: !listId,
  });

  const { data: categoryData } = useQuery(PERSON_CATEGORIES);
  const categories: PersonCategory[] = categoryData?.peopleCategories ?? [];

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
      setSelectedCategoryId(existingPerson.person_category?.documentId ?? "");
      if (existingPerson.avatar_url) {
        setAvatarPreview(buildImageUrl(existingPerson.avatar_url));
      }
    }
  }, [isEdit, existingPerson?.documentId]);

  const [createPerson] = useMutation(CREATE_RECOMMENDED_PERSON);
  const [updatePerson] = useMutation(UPDATE_RECOMMENDED_PERSON);

  const currentPeopleCount = deduplicatePeople(
    listData?.personLists?.[0]?.recommended_people ?? []
  ).length;

  const uploadAvatar = async (file: File): Promise<string> => {
    const username = sanitizeUsername(user?.username || "user");
    const ext = file.name.split(".").pop() || "jpg";
    const fileName = generateRandomFileName(ext);
    const path = `people/${username}/avatars/${fileName}`;
    const formDataUpload = new FormData();
    formDataUpload.append("file", file);
    formDataUpload.append("path", path);
    const resp = await axios.post(
      `${import.meta.env.VITE_REST_API_URL}/upload/s3`,
      formDataUpload,
      { headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" } }
    );
    return resp.data?.url || "";
  };

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
      let avatarUrl = formData.avatar_url || "";
      if (avatarFile) {
        avatarUrl = await uploadAvatar(avatarFile);
      }

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
  }, [formData, note, userRating, isPinned, selectedCategoryId, avatarFile, isEdit, personId, listId, currentPeopleCount]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  return (
    <div className="max-w-2xl mx-auto pb-24 md:pb-6">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 sticky top-0 bg-dashboard-bg/90 backdrop-blur-sm z-10 border-b border-white/5">
        <button
          onClick={() => step === "form" && !isEdit ? setStep("url") : navigate(`/recommendations/people/${listId}`)}
          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-base font-bold text-white flex-1">
          {isEdit ? "Edit Person" : step === "url" ? "Add Person" : "Fill Details"}
        </h1>
        {step === "form" && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm text-white font-medium transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {isEdit ? "Save" : "Add"}
          </button>
        )}
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* Step 1: URL */}
        {step === "url" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-semibold text-white mb-1">Paste Profile Link</h2>
              <p className="text-xs text-white/40 mb-4">Instagram, LinkedIn, GitHub, X — any public profile URL</p>
              <UrlScrapePanel
                onScraped={(data) => {
                  setFormData((prev) => ({ ...prev, ...data }));
                  if (data.avatar_url) setAvatarPreview(buildImageUrl(data.avatar_url));
                  setStep("form");
                }}
              />
            </div>
            <div className="text-center">
              <button onClick={() => setStep("form")} className="text-xs text-white/40 hover:text-white/70 transition-colors underline">
                Skip — fill in manually
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Form */}
        {step === "form" && (
          <div className="space-y-5">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-20 flex-shrink-0">
                <div className="w-20 h-20 rounded-full overflow-hidden bg-white/5 ring-2 ring-white/10">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Users size={28} className="text-white/20" />
                    </div>
                  )}
                </div>
                <label className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-violet-600 hover:bg-violet-700 flex items-center justify-center cursor-pointer transition-colors shadow-lg">
                  <Upload size={12} className="text-white" />
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                </label>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{formData.full_name || "Person Name"}</p>
                <p className="text-xs text-white/40">{formData.handle ? `@${formData.handle}` : formData.profile_url || "No URL yet"}</p>
              </div>
            </div>

            {/* Profile URL (read-only in form step) */}
            <div>
              <label className="text-xs font-semibold text-white/60 mb-1.5 block">Profile URL *</label>
              <input
                type="url"
                value={formData.profile_url || ""}
                onChange={(e) => setFormData((p) => ({ ...p, profile_url: e.target.value, platform: detectPlatform(e.target.value) }))}
                placeholder="https://instagram.com/username"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50 transition-colors"
              />
            </div>

            {/* Full Name */}
            <div>
              <label className="text-xs font-semibold text-white/60 mb-1.5 block">Full Name *</label>
              <input
                type="text"
                value={formData.full_name || ""}
                onChange={(e) => setFormData((p) => ({ ...p, full_name: e.target.value }))}
                placeholder="e.g. John Doe"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50 transition-colors"
              />
            </div>

            {/* Handle */}
            <div>
              <label className="text-xs font-semibold text-white/60 mb-1.5 block">Handle / Username</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">@</span>
                <input
                  type="text"
                  value={formData.handle || ""}
                  onChange={(e) => setFormData((p) => ({ ...p, handle: e.target.value }))}
                  placeholder="username"
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-7 pr-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50 transition-colors"
                />
              </div>
            </div>

            {/* Platform */}
            <div>
              <label className="text-xs font-semibold text-white/60 mb-1.5 block">Platform</label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {PLATFORMS.map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFormData((p) => ({ ...p, platform: value as RecommendedPerson["platform"] }))}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                      formData.platform === value
                        ? "bg-violet-600/30 border-violet-500/60 text-violet-300"
                        : "bg-white/5 border-white/10 text-white/50 hover:border-white/20"
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
              <label className="text-xs font-semibold text-white/60 mb-1.5 block">Headline / Role</label>
              <input
                type="text"
                value={formData.headline || ""}
                onChange={(e) => setFormData((p) => ({ ...p, headline: e.target.value }))}
                placeholder="e.g. Tech Entrepreneur · Speaker"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50 transition-colors"
              />
            </div>

            {/* Bio */}
            <div>
              <label className="text-xs font-semibold text-white/60 mb-1.5 block">Bio / Description</label>
              <textarea
                value={formData.bio || ""}
                onChange={(e) => setFormData((p) => ({ ...p, bio: e.target.value }))}
                placeholder="Short bio or description"
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50 transition-colors resize-none"
              />
            </div>

            {/* Location & Followers */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-white/60 mb-1.5 block">Location</label>
                <input
                  type="text"
                  value={formData.location || ""}
                  onChange={(e) => setFormData((p) => ({ ...p, location: e.target.value }))}
                  placeholder="e.g. San Francisco"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-white/60 mb-1.5 block">Followers</label>
                <input
                  type="text"
                  value={formData.follower_count || ""}
                  onChange={(e) => setFormData((p) => ({ ...p, follower_count: e.target.value }))}
                  placeholder="e.g. 1.2M"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50 transition-colors"
                />
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="text-xs font-semibold text-white/60 mb-1.5 block">Tags</label>
              <TagsEditor tags={formData.tags || []} onChange={(tags) => setFormData((p) => ({ ...p, tags }))} />
            </div>

            {/* Category */}
            {categories.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-white/60 mb-1.5 block">Category</label>
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500/50 transition-colors"
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
              <label className="text-xs font-semibold text-white/60 mb-2 block">Your Rating (1–10)</label>
              <div className="flex gap-1 flex-wrap">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setUserRating(userRating === star ? null : star)}
                    className={`p-1 transition-colors ${userRating && userRating >= star ? "text-amber-400" : "text-white/20 hover:text-amber-400/60"}`}
                  >
                    <Star size={20} fill={userRating && userRating >= star ? "currentColor" : "none"} />
                  </button>
                ))}
              </div>
            </div>

            {/* Note */}
            <div>
              <label className="text-xs font-semibold text-white/60 mb-2 block">Your Note</label>
              <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                <TiptapEditor value={note} onChange={setNote} placeholder="Why do you recommend this person?" />
              </div>
            </div>

            {/* Pin */}
            <div className="flex items-center justify-between p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
              <div>
                <p className="text-sm font-medium text-amber-400">Pin to Top Picks</p>
                <p className="text-xs text-white/40 mt-0.5">Featured prominently on your profile</p>
              </div>
              <button
                type="button"
                onClick={() => setIsPinned(!isPinned)}
                className={`p-2 rounded-lg transition-all ${isPinned ? "bg-amber-400/20 text-amber-400" : "bg-white/5 text-white/30 hover:text-amber-400"}`}
              >
                <Star size={18} fill={isPinned ? "currentColor" : "none"} />
              </button>
            </div>

            {/* Mobile save */}
            <div className="flex gap-3 pt-2 md:hidden">
              <button onClick={() => navigate(`/recommendations/people/${listId}`)} className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-sm text-white/70 font-medium transition-colors">Cancel</button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm text-white font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                {isEdit ? "Save Changes" : "Add Person"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AddPersonPage;
