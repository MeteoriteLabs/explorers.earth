import { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation, Link } from "react-router-dom";
import { useQuery, useMutation } from "@apollo/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Star, MoreVertical, Trash2, Loader2, Users, Pencil, Copy, Check, Share2, Download
} from "lucide-react";
import { AddIcon } from "../../../../assets/icons/AddIcon";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import Accordion from "../../../../components/ui/Accordian";
import useAuthStore from "../../../../store/store";
import { PEOPLE_BY_LIST, peopleByListVars } from "../../api/query";
import { UPDATE_PERSON_LIST, DELETE_PERSON_LIST, TOGGLE_PERSON_PIN, DELETE_RECOMMENDED_PERSON } from "../../api/mutation";
import { deduplicatePeople, buildImageUrl, extractNoteText, getPlatformLabel, getPlatformBadgeClass } from "../../utils/personHelpers";
import type { RecommendedPerson, PersonList } from "../../types";
import Switch from "../../../../components/ui/Switch";
import PersonDetailModal from "../public/PersonDetailModal";
import { ListVisibilityModal } from "../../../../components/ListVisibilityModal";

const VITE_BASE_URL = import.meta.env.VITE_BASE_URL || "https://explorers.earth";

interface PersonRowProps {
  person: RecommendedPerson;
  onPinToggle: (person: RecommendedPerson) => void;
  onEdit: (person: RecommendedPerson) => void;
  onDelete: (person: RecommendedPerson) => void;
  onClick: (person: RecommendedPerson) => void;
  isPinning: boolean;
}

const PersonRow = ({ person, onPinToggle, onEdit, onDelete, onClick, isPinning }: PersonRowProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const notePreview = extractNoteText(person.user_recommendation_note);
  const imgUrl = buildImageUrl(person.avatar_url);

  return (
    <div
      className="group flex items-center gap-3 p-3 bg-white/[0.03] border border-white/[0.05] hover:border-white/[0.08] hover:bg-white/[0.06] cursor-pointer rounded-xl transition-all mb-2"
      onClick={() => onClick(person)}
    >
      <div className="w-12 h-12 flex-shrink-0 rounded-full overflow-hidden bg-white/5 shadow-sm ring-2 ring-white/10">
        {imgUrl ? (
          <img src={imgUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full bg-violet-950/30 flex items-center justify-center">
            <Users size={14} className="text-violet-400/40" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-white truncate">{person.full_name}</p>
          {person.platform && (
            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md border ${getPlatformBadgeClass(person.platform)}`}>
              {getPlatformLabel(person.platform)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-white/40 mt-0.5 flex-wrap">
          {person.handle && <span className="truncate max-w-[120px]">@{person.handle}</span>}
          {person.headline && (
            <>
              {person.handle && <span className="text-white/20">·</span>}
              <span className="truncate max-w-[200px] text-white/30">{person.headline}</span>
            </>
          )}
          {person.user_rating && (
            <>
              <span className="text-white/20">·</span>
              <span className="flex items-center gap-0.5 text-amber-400/80">
                <Star size={10} fill="currentColor" /> {person.user_rating}
              </span>
            </>
          )}
        </div>
        {notePreview && (
          <p className="text-[11px] text-white/30 truncate mt-1 italic line-clamp-1">
            {notePreview.replace(/<[^>]+>/g, "")}
          </p>
        )}
      </div>

      {/* Pin button */}
      <button
        onClick={(e) => { e.stopPropagation(); onPinToggle(person); }}
        className={`p-1.5 rounded-lg transition-all ${
          person.is_pinned
            ? "text-amber-400 bg-amber-400/10"
            : "text-white/30 hover:text-amber-400 hover:bg-amber-400/10"
        } disabled:opacity-50`}
        disabled={isPinning}
        title={person.is_pinned ? "Unpin from Top Picks" : "Pin to Top Picks"}
      >
        <Star size={14} fill={person.is_pinned ? "currentColor" : "none"} />
      </button>

      {/* Three-dot menu */}
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="p-1.5 rounded-lg text-white/20 hover:text-white hover:bg-white/5 transition-all"
        >
          <MoreVertical size={14} />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 bg-[#1a2332] border border-white/10 rounded-xl shadow-xl z-20 min-w-[130px] overflow-hidden">
            <button
              onClick={() => { setMenuOpen(false); onEdit(person); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-dashboard hover:bg-white/8 transition-colors"
            >
              <Pencil size={13} /> Edit
            </button>
            <button
              onClick={() => { setMenuOpen(false); onDelete(person); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 size={13} /> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const PersonListView = () => {
  const { listId } = useParams<{ listId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();

  const [activeTab, setActiveTab] = useState<"recommendations" | "manage">("recommendations");
  const [selectedPerson, setSelectedPerson] = useState<RecommendedPerson | null>(null);
  const [pinningId, setPinningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteListModal, setShowDeleteListModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isEditingList, setIsEditingList] = useState(false);
  const [listVisibilityPrompt, setListVisibilityPrompt] = useState<{
    isOpen: boolean;
    listName: string;
  } | null>(null);

  const { data, loading, refetch } = useQuery(PEOPLE_BY_LIST, {
    variables: peopleByListVars(listId!),
    skip: !listId,
    fetchPolicy: "cache-and-network",
  });

  const [updatePersonList, { loading: isUpdating }] = useMutation(UPDATE_PERSON_LIST);
  const [deletePersonList, { loading: deletingList }] = useMutation(DELETE_PERSON_LIST);
  const [togglePin] = useMutation(TOGGLE_PERSON_PIN);
  const [deletePerson] = useMutation(DELETE_RECOMMENDED_PERSON);

  const listData: PersonList | null = data?.personLists?.[0] ?? null;
  const people = deduplicatePeople(listData?.recommended_people ?? []);
  const pinnedCount = people.filter((p) => p.is_pinned).length;

  useEffect(() => {
    if (location.state?.justAddedRecommendation && listData && !listData.Visibility) {
      setListVisibilityPrompt({
        isOpen: true,
        listName: listData.List_Name,
      });
      window.history.replaceState({}, document.title);
    }
  }, [location.state, listData]);

  const publicUrl = listData
    ? `${VITE_BASE_URL}/${user?.username}/people/${listData.slug}`
    : "";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleVisibility = async () => {
    if (!listData) return;
    if (!listData.Visibility && people.length === 0) {
      toast.error("Add at least one person before publishing.");
      return;
    }
    try {
      await updatePersonList({
        variables: { documentId: listData.documentId, Visibility: !listData.Visibility },
        optimisticResponse: {
          updatePersonList: {
            __typename: "PersonList",
            documentId: listData.documentId,
            List_Name: listData.List_Name,
            list_description: listData.list_description,
            slug: listData.slug,
            Visibility: !listData.Visibility,
            display_order: listData.display_order,
            top_people_heading: listData.top_people_heading || null,
          }
        },
        refetchQueries: [{ query: PEOPLE_BY_LIST, variables: peopleByListVars(listId!) }],
      });
      toast.success(listData.Visibility ? "List set to draft." : "List published!");
    } catch {
      toast.error("Failed to update visibility.");
    }
  };

  const handlePinToggle = async (person: RecommendedPerson) => {
    setPinningId(person.documentId);
    try {
      const newPinned = !person.is_pinned;
      const newPinOrder = newPinned ? (pinnedCount) : null;
      await togglePin({
        variables: { documentId: person.documentId, is_pinned: newPinned, pin_order: newPinOrder },
        refetchQueries: [{ query: PEOPLE_BY_LIST, variables: peopleByListVars(listId!) }],
      });
      toast.success(newPinned ? "Added to Top Picks!" : "Removed from Top Picks");
    } catch {
      toast.error("Failed to update pin.");
    } finally {
      setPinningId(null);
    }
  };

  const handleDelete = async (person: RecommendedPerson) => {
    if (!window.confirm(`Delete "${person.full_name}"? This cannot be undone.`)) return;
    setDeletingId(person.documentId);
    try {
      await deletePerson({
        variables: { documentId: person.documentId },
        refetchQueries: [{ query: PEOPLE_BY_LIST, variables: peopleByListVars(listId!) }],
      });
      toast.success("Person deleted.");
    } catch {
      toast.error("Failed to delete.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteList = async () => {
    if (!listData) return;
    try {
      await deletePersonList({
        variables: { documentId: listData.documentId },
      });
      toast.success("List deleted.");
      navigate("/recommendations/people");
    } catch {
      toast.error("Failed to delete list.");
    }
  };

  const handleDownloadQR = () => {
    const svg = document.getElementById("person-list-qr-svg");
    if (!svg) return;
    const blob = new Blob([svg.outerHTML], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${listData?.slug || "person-list"}-qr.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading && !listData) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="h-8 w-48 bg-white/5 animate-pulse rounded mb-6" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-white/3 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!loading && !listData) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-red-400">List not found. <Link to="/recommendations/people" className="text-blue-400 underline">Go back</Link></p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-24 md:pb-6">
      {/* Header */}
      <div className="flex items-center gap-3 px-2 md:px-4 py-4">
        <button
          onClick={() => navigate("/recommendations/people")}
          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all flex-shrink-0"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-white truncate">{listData?.List_Name}</h1>
          {listData?.list_description && (
            <p className="text-xs text-white/40 truncate mt-0.5">{listData.list_description}</p>
          )}
        </div>
        <Switch
          checked={listData?.Visibility ?? false}
          onChange={handleToggleVisibility}
          disabled={people.length === 0}
          loading={isUpdating}
        />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/8 px-2 md:px-4 mb-4">
        {(["recommendations", "manage"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 ${
              activeTab === tab
                ? "border-dashboard-accent text-dashboard"
                : "border-transparent text-white/40 hover:text-white/70"
            }`}
          >
            {tab === "recommendations" ? `People (${people.length})` : "Manage"}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "recommendations" ? (
          <motion.div
            key="recs"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-2 md:px-4"
          >
            {/* Add button */}
            <div className="flex justify-end mb-4">
              <button
                onClick={() => navigate(`/recommendations/people/${listId}/add`)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-dashboard-accent hover:opacity-90 text-sm text-white font-medium transition-all"
              >
                <AddIcon size="4" /> Add Person
              </button>
            </div>

            {people.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-violet-900/20 border border-violet-800/30 flex items-center justify-center mb-4">
                  <Users size={28} className="text-violet-500/60" />
                </div>
                <p className="text-sm text-white/50 mb-4">No people added yet</p>
                <button
                  onClick={() => navigate(`/recommendations/people/${listId}/add`)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-sm text-white font-medium transition-colors"
                >
                  Add First Person
                </button>
              </div>
            ) : (
              <div>
                {people.map((person) => (
                  <PersonRow
                    key={person.documentId}
                    person={person}
                    onPinToggle={handlePinToggle}
                    onEdit={(p) => navigate(`/recommendations/people/${listId}/edit/${p.documentId}`)}
                    onDelete={handleDelete}
                    onClick={setSelectedPerson}
                    isPinning={pinningId === person.documentId}
                  />
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="manage"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-2 md:px-4 space-y-4"
          >
            {/* Public URL */}
            <Accordion title="Public URL & QR Code" defaultOpen>
              <div className="space-y-3">
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                  <span className="text-xs text-white/50 flex-1 truncate">{publicUrl}</span>
                  <button onClick={handleCopy} className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors flex-shrink-0">
                    {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                  </button>
                  <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors flex-shrink-0">
                    <Share2 size={12} /> Open
                  </a>
                </div>
                <div className="flex flex-col items-center gap-3 py-4">
                  <QRCodeSVG id="person-list-qr-svg" value={publicUrl} size={160} bgColor="#0d1117" fgColor="#ffffff" level="H" />
                  <button onClick={handleDownloadQR} className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition-colors">
                    <Download size={12} /> Download QR
                  </button>
                </div>
              </div>
            </Accordion>

            {/* Edit list settings */}
            <Accordion title="List Settings">
              <EditListForm listData={listData!} onSave={async (vals) => {
                try {
                  await updatePersonList({ variables: { documentId: listData!.documentId, ...vals } });
                  toast.success("List updated!");
                  setIsEditingList(false);
                  refetch();
                } catch {
                  toast.error("Failed to update.");
                }
              }} />
            </Accordion>

            {/* Danger zone */}
            <Accordion title="Danger Zone">
              <div className="space-y-3">
                <p className="text-sm text-white/50">Deleting a list removes all {people.length} people in it permanently.</p>
                <button
                  onClick={() => setShowDeleteListModal(true)}
                  className="px-4 py-2 rounded-lg bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 text-sm font-medium transition-colors"
                >
                  Delete This List
                </button>
              </div>
            </Accordion>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete list confirmation */}
      <AnimatePresence>
        {showDeleteListModal && (
          <motion.div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[150] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowDeleteListModal(false)}
          >
            <motion.div
              className="bg-[#0d1117] border border-white/10 rounded-2xl p-6 max-w-sm w-full"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-base font-bold text-white mb-2">Delete list?</h3>
              <p className="text-sm text-white/50 mb-5">This will permanently delete "<span className="text-white/80">{listData?.List_Name}</span>" and all {people.length} people in it.</p>
              <div className="flex gap-3">
                <button onClick={() => setShowDeleteListModal(false)} className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-sm text-white transition-colors">Cancel</button>
                <button
                  onClick={handleDeleteList}
                  disabled={deletingList}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-sm text-white font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {deletingList ? <Loader2 size={14} className="animate-spin" /> : null}
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {selectedPerson && (
        <PersonDetailModal open={!!selectedPerson} person={selectedPerson} onClose={() => setSelectedPerson(null)} />
      )}

      {listVisibilityPrompt && (
        <ListVisibilityModal
          isOpen={listVisibilityPrompt.isOpen}
          onClose={() => setListVisibilityPrompt(null)}
          listName={listVisibilityPrompt.listName}
          onToggle={handleToggleVisibility}
          isToggling={isUpdating}
        />
      )}
    </div>
  );
};

// Inline edit form
const EditListForm = ({ listData, onSave }: { listData: PersonList; onSave: (vals: any) => Promise<void> }) => {
  const [name, setName] = useState(listData.List_Name);
  const [desc, setDesc] = useState(listData.list_description || "");
  const [heading, setHeading] = useState(listData.top_people_heading || "");
  const [saving, setSaving] = useState(false);

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-white/50 mb-1 block">List Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50" />
      </div>
      <div>
        <label className="text-xs text-white/50 mb-1 block">Description</label>
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 resize-none" />
      </div>
      <div>
        <label className="text-xs text-white/50 mb-1 block">Top Picks Section Heading</label>
        <input value={heading} onChange={(e) => setHeading(e.target.value)} placeholder="e.g. Featured Creators" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50" />
      </div>
      <button
        onClick={async () => {
          setSaving(true);
          await onSave({ List_Name: name, list_description: desc || null, top_people_heading: heading || null });
          setSaving(false);
        }}
        disabled={saving}
        className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm text-white font-medium transition-colors flex items-center gap-2"
      >
        {saving && <Loader2 size={13} className="animate-spin" />}
        Save Changes
      </button>
    </div>
  );
};

export default PersonListView;
