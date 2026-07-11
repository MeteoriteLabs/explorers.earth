import { FC } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { useQuery as useReactQuery } from "@tanstack/react-query";
import { localTunesRequest } from "../lib/apiClient";
import useAuthStore from "../store/store";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2 } from "lucide-react";
import { updateTabVisibilityMutation, CHECK_PUBLISHED_LISTS } from "../features/Settings/api/mutation";

interface CategoryVisibilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  categoryName: string; // e.g. "Places", "Games", "Books", "Movies", "Music", "Guides"
  visibilityField: string; // e.g. "public_recommendations", "public_games", etc.
  accountDocumentId: string;
  onSuccess?: () => void;
}

const CATEGORY_EMOJIS: Record<string, string> = {
  Places: "📍",
  Games: "🎮",
  Books: "📚",
  Movies: "🎬",
  Music: "🎵",
  Guides: "📖",
};

export const CategoryVisibilityModal: FC<CategoryVisibilityModalProps> = ({
  isOpen,
  onClose,
  categoryName,
  visibilityField,
  accountDocumentId,
  onSuccess,
}) => {
  const [updateTabVisibility, { loading }] = useMutation(updateTabVisibilityMutation);
  const { user } = useAuthStore();

  const {
    data: publishedListsData,
    loading: publishedListsLoading,
    error: publishedListsError,
  } = useQuery(CHECK_PUBLISHED_LISTS, {
    variables: { accountDocumentId },
    skip: !accountDocumentId,
    fetchPolicy: "network-only",
  });

  const { data: musicPlaylists } = useReactQuery<any[]>({
    queryKey: ['tunes-playlists', user?.username],
    queryFn: () => localTunesRequest('GET', `/api/playlists?username=${user?.username}`),
    enabled: !!user?.username && categoryName === "Music",
  });

  const handleMakePublic = async () => {
    // Guard: do not validate while the query is still loading or has errored.
    // Without this, publishedListsData is undefined and every check evaluates
    // to 0 > 0 = false, incorrectly blocking users who do have published lists.
    if (publishedListsLoading) {
      toast.info("Checking your published lists, please wait…");
      return;
    }
    if (publishedListsError) {
      toast.error("Could not verify your published lists. Please try again.");
      return;
    }

    let hasPublished = false;
    let errorMsg = "";

    switch (visibilityField) {
      case "public_books":
        hasPublished = (publishedListsData?.bookLists?.length ?? 0) > 0;
        errorMsg = "You must have at least one published book list to make Books public.";
        break;
      case "public_games":
        hasPublished = (publishedListsData?.gameLists?.length ?? 0) > 0;
        errorMsg = "You must have at least one published game list to make Games public.";
        break;
      case "public_apps":
        hasPublished = (publishedListsData?.appLists?.length ?? 0) > 0;
        errorMsg = "You must have at least one published app list to make Apps & Tools public.";
        break;
      case "public_products":
        hasPublished = (publishedListsData?.productLists?.length ?? 0) > 0;
        errorMsg = "You must have at least one published product list to make Products public.";
        break;
      case "public_movie":
        hasPublished = (publishedListsData?.movieLists?.length ?? 0) > 0;
        errorMsg = "You must have at least one published movie list to make Movies public.";
        break;
      case "public_people":
        hasPublished = (publishedListsData?.personLists?.length ?? 0) > 0;
        errorMsg = "You must have at least one published people list to make People public.";
        break;
      case "public_guides":
        hasPublished = (publishedListsData?.guides?.length ?? 0) > 0;
        errorMsg = "You must have at least one published guide to make Guides public.";
        break;
      case "public_recommendations":
        hasPublished = (publishedListsData?.recommendationLists?.length ?? 0) > 0;
        errorMsg = "You must have at least one published place list to make Recommendations public.";
        break;
      case "public_music":
        hasPublished = musicPlaylists?.some((pl: any) => pl.isVisibleToGuests === true) ?? false;
        errorMsg = "You must have at least one published playlist to make Music public.";
        break;
      default:
        hasPublished = true;
        break;
    }

    if (!hasPublished) {
      toast.error(errorMsg);
      return;
    }

    try {
      await updateTabVisibility({
        variables: {
          documentId: accountDocumentId,
          data: {
            [visibilityField]: "Yes",
          },
        },
      });
      toast.success(`${categoryName} visibility updated to Public!`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Error updating visibility:", error);
      toast.error(`Failed to make ${categoryName} public: ${error.message || ""}`);
    }
  };

  const emoji = CATEGORY_EMOJIS[categoryName] || "✨";

  // AnimatePresence must always be mounted in the tree so it can intercept
  // the child unmount and play the exit animation before removing the DOM node.
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[160] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="bg-dashboard-sidebar rounded-xl border border-dashboard-border p-6 md:p-8 w-full max-w-md shadow-2xl relative"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-dashboard-muted hover:text-dashboard transition-colors border-none cursor-pointer"
            >
              <X size={16} />
            </button>

            {/* Content */}
            <div className="flex flex-col items-center text-center mt-2">
              <div className="w-16 h-16 rounded-full bg-dashboard-accent/15 border border-dashboard-accent/30 flex items-center justify-center mb-5 text-3xl">
                {emoji}
              </div>

              <h3 className="text-lg font-bold text-white font-poppins mb-2">
                Make your {categoryName} public?
              </h3>

              <p className="text-sm text-dashboard-light mb-6 font-poppins leading-relaxed">
                Your {categoryName} tab is currently hidden on your public profile. Would you like to make it public so others can see your recommendations?
              </p>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3 w-full border-t border-dashboard-border pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-[#ef4444] hover:bg-[#dc2626] text-sm text-white font-medium transition-colors border-none cursor-pointer font-poppins"
                >
                  Keep Private
                </button>
                <button
                  type="button"
                  onClick={handleMakePublic}
                  disabled={loading || publishedListsLoading || !!publishedListsError}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-[#3b82f6] hover:bg-[#2563eb] text-sm text-white font-bold transition-all flex items-center justify-center gap-2 border-none cursor-pointer font-poppins shadow-lg shadow-blue-900/30 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {(loading || publishedListsLoading) && <Loader2 size={14} className="animate-spin" />}
                  Yes, Make Public
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
