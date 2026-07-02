import { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useQuery, useMutation } from "@apollo/client";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Star, MoreVertical, Trash2, Loader2, Smartphone, Pencil, Copy, Check } from "lucide-react";
import { AddIcon } from "../../../../assets/icons/AddIcon";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import Accordion from "../../../../components/ui/Accordian";
import useAuthStore from "../../../../store/store";
import { APPS_BY_LIST, appsByListVars } from "../../api/query";
import { UPDATE_APP_LIST, DELETE_APP_LIST, TOGGLE_APP_PIN, DELETE_RECOMMENDED_APP } from "../../api/mutation";
import { deduplicateApps, buildLogoUrl, extractNoteText, getPriceTierColor } from "../../utils/appHelpers";
import type { RecommendedApp, AppList } from "../../types";
import Switch from "../../../../components/ui/Switch";
import AppDetailModal from "../public/AppDetailModal";
import { ListVisibilityModal } from "../../../../components/ListVisibilityModal";

const VITE_BASE_URL = import.meta.env.VITE_BASE_URL || window.location.origin;

interface AppRowProps {
  app: RecommendedApp;
  onPinToggle: (app: RecommendedApp) => void;
  onEdit: (app: RecommendedApp) => void;
  onDelete: (app: RecommendedApp) => void;
  onClick: (app: RecommendedApp) => void;
  isPinning: boolean;
}

const AppRow = ({ app, onPinToggle, onEdit, onDelete, onClick, isPinning }: AppRowProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const notePreview = extractNoteText(app.user_recommendation_note);
  const logoUrl = buildLogoUrl(app.logo_url);

  return (
    <div
      className="group flex items-center gap-3 p-3 bg-white/[0.03] border border-white/[0.05] hover:border-white/[0.08] hover:bg-white/[0.06] cursor-pointer rounded-xl transition-all mb-2"
      onClick={() => onClick(app)}
    >
      <div className="w-10 h-10 flex-shrink-0 rounded-xl overflow-hidden bg-white/5 shadow-sm">
        {logoUrl ? (
          <img src={logoUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Smartphone size={14} className="text-white/20" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{app.title}</p>
        <div className="flex items-center gap-2 text-xs text-white/40 mt-0.5 flex-wrap">
          {app.developer && <span className="truncate max-w-[150px]">{app.developer}</span>}
          {app.price_tier && (
            <>
              <span className="text-white/20">·</span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${getPriceTierColor(app.price_tier)}`}>
                {app.price_tier}
              </span>
            </>
          )}
          {app.user_rating && (
            <>
              <span className="text-white/20">·</span>
              <span className="flex items-center gap-0.5 text-amber-400/80">
                <Star size={10} fill="currentColor" /> {app.user_rating}
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

      {/* Pin */}
      <button
        onClick={(e) => { e.stopPropagation(); onPinToggle(app); }}
        className={`flex-shrink-0 text-sm transition-all ${app.is_pinned ? "text-amber-400" : "text-white/20 hover:text-white/50"}`}
        disabled={isPinning}
        title={app.is_pinned ? "Unpin" : "Pin to Top"}
      >
        {isPinning ? <Loader2 size={14} className="animate-spin" /> : <Star size={14} fill={app.is_pinned ? "currentColor" : "none"} />}
      </button>

      {/* Menu */}
      <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="p-1 rounded-lg text-white/20 hover:text-white/60 hover:bg-white/5 transition-all opacity-0 group-hover:opacity-100"
        >
          <MoreVertical size={15} />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-7 z-20 w-32 bg-dashboard-sidebar border border-dashboard-border rounded-xl shadow-xl py-1 text-xs">
            <button
              onClick={() => { setMenuOpen(false); onEdit(app); }}
              className="flex items-center gap-2 w-full px-3 py-2 hover:bg-white/5 text-white/70 hover:text-white"
            >
              <Pencil size={12} /> Edit
            </button>
            <button
              onClick={() => { setMenuOpen(false); onDelete(app); }}
              className="flex items-center gap-2 w-full px-3 py-2 hover:bg-red-900/20 text-red-400"
            >
              <Trash2 size={12} /> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// AppListView Main Component
// ─────────────────────────────────────────────────────────────
const AppListView = () => {
  const { listId } = useParams<{ listId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();

  const [selectedApp, setSelectedApp] = useState<RecommendedApp | null>(null);
  const [pinningId, setPinningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showVisibilityModal, setShowVisibilityModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data, loading, refetch } = useQuery(APPS_BY_LIST, {
    variables: appsByListVars(listId!),
    skip: !listId,
    fetchPolicy: "cache-and-network",
  });

  useEffect(() => {
    if (location.state?.refetch) {
      refetch();
      window.history.replaceState({}, document.title);
    }
  }, [location.state, refetch]);

  const [updateAppList] = useMutation(UPDATE_APP_LIST);
  const [deleteAppList] = useMutation(DELETE_APP_LIST);
  const [togglePin] = useMutation(TOGGLE_APP_PIN);
  const [deleteApp] = useMutation(DELETE_RECOMMENDED_APP);

  const listData: AppList | null = data?.appLists?.[0] ?? null;
  const apps = deduplicateApps(listData?.recommended_apps ?? []);

  const publicUrl = listData
    ? `${VITE_BASE_URL}/${user?.username}/apps/${listData.slug}`
    : "";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePinToggle = async (app: RecommendedApp) => {
    setPinningId(app.documentId);
    const pinnedApps = apps.filter((a) => a.is_pinned && a.documentId !== app.documentId);
    const newPinOrder = app.is_pinned ? null : pinnedApps.length;
    try {
      await togglePin({
        variables: { documentId: app.documentId, is_pinned: !app.is_pinned, pin_order: newPinOrder },
        refetchQueries: [{ query: APPS_BY_LIST, variables: appsByListVars(listId!) }],
      });
    } catch {
      toast.error("Failed to update pin.");
    } finally {
      setPinningId(null);
    }
  };

  const handleDelete = async (app: RecommendedApp) => {
    if (!window.confirm(`Delete "${app.title}"?`)) return;
    setDeletingId(app.documentId);
    try {
      await deleteApp({
        variables: { documentId: app.documentId },
        refetchQueries: [{ query: APPS_BY_LIST, variables: appsByListVars(listId!) }],
      });
      toast.success("App removed.");
    } catch {
      toast.error("Failed to delete app.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteList = async () => {
    if (!listData || !window.confirm(`Delete list "${listData.List_Name}"? This cannot be undone.`)) return;
    try {
      await deleteAppList({ variables: { documentId: listData.documentId } });
      toast.success("List deleted.");
      navigate("/recommendations/apps");
    } catch {
      toast.error("Failed to delete list.");
    }
  };

  if (loading && !listData) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={24} className="animate-spin text-violet-400" />
      </div>
    );
  }

  if (!listData) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <p className="text-dashboard-muted mb-4">List not found.</p>
        <button onClick={() => navigate("/recommendations/apps")} className="text-sm text-violet-400 hover:underline">
          Back to Apps
        </button>
      </div>
    );
  }

  return (
    <div className="px-2 md:px-6 pt-2 pb-24 md:pb-6 max-w-4xl mx-auto">
      {/* Back + Header */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => navigate("/recommendations/apps")}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-dashboard truncate">{listData.List_Name}</h1>
          {listData.list_description && (
            <p className="text-xs text-dashboard-muted truncate">{listData.list_description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-dashboard-muted">Public</span>
          <Switch
            checked={listData.Visibility}
            onChange={() => setShowVisibilityModal(true)}
            disabled={apps.length === 0}
          />
        </div>
      </div>

      {/* Actions bar */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(`/recommendations/apps/${listId}/add`)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm text-white font-medium transition-colors shadow-lg shadow-violet-900/20"
        >
          <AddIcon size="4" />
          <span>Add App</span>
        </button>
        {publicUrl && (
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-sm text-white/70 transition-colors"
          >
            {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            {copied ? "Copied!" : "Copy Link"}
          </button>
        )}
        <button
          onClick={handleDeleteList}
          className="ml-auto flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-red-900/20 hover:bg-red-900/40 text-sm text-red-400 transition-colors"
        >
          <Trash2 size={14} />
          <span className="hidden sm:inline">Delete List</span>
        </button>
      </div>

      {/* QR + Public URL */}
      {listData.Visibility && publicUrl && (
        <Accordion title="Public Link & QR Code">
          <div className="flex flex-col sm:flex-row gap-4 items-start p-4">
            <QRCodeSVG value={publicUrl} size={96} bgColor="transparent" fgColor="#a78bfa" />
            <div className="flex-1">
              <p className="text-xs text-dashboard-muted mb-1">Share this link</p>
              <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-violet-400 hover:underline break-all">
                {publicUrl}
              </a>
            </div>
          </div>
        </Accordion>
      )}

      {/* Apps list */}
      <div className="mt-6">
        {apps.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-violet-900/20 border border-violet-800/30 flex items-center justify-center mb-4">
              <Smartphone size={28} className="text-violet-500/60" />
            </div>
            <p className="text-sm text-dashboard-muted mb-4">No apps in this list yet.</p>
            <button
              onClick={() => navigate(`/recommendations/apps/${listId}/add`)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm text-white"
            >
              <AddIcon size="4" /> Add First App
            </button>
          </div>
        ) : (
          <AnimatePresence>
            {apps.map((app) => (
              <motion.div
                key={app.documentId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: deletingId === app.documentId ? 0.4 : 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
              >
                <AppRow
                  app={app}
                  onClick={setSelectedApp}
                  onPinToggle={handlePinToggle}
                  onEdit={(a) => navigate(`/recommendations/apps/${listId}/edit/${a.documentId}`)}
                  onDelete={handleDelete}
                  isPinning={pinningId === app.documentId}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Detail Modal */}
      {selectedApp && (
        <AppDetailModal
          open={!!selectedApp}
          app={selectedApp}
          onClose={() => setSelectedApp(null)}
        />
      )}

      {/* Visibility Modal */}
      {showVisibilityModal && listData && (
        <ListVisibilityModal
          isOpen={showVisibilityModal}
          onClose={() => setShowVisibilityModal(false)}
          listDocumentId={listData.documentId}
          currentVisibility={listData.Visibility}
          listName={listData.List_Name}
          updateMutation={UPDATE_APP_LIST}
          refetchQuery={APPS_BY_LIST}
          refetchVars={appsByListVars(listId!)}
          onSuccess={refetch}
        />
      )}
    </div>
  );
};

export default AppListView;
