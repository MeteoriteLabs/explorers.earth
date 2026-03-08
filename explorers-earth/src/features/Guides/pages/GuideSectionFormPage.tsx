/**
 * GuideSectionFormPage Component
 * Full-page form for adding or editing a guide day/stop section.
 * Replaces the cramped SectionFormModal by rendering the form as a
 * dedicated routed page — mirrors the AddRecommendation page pattern.
 */

import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@apollo/client";
import { motion } from "framer-motion";
import { EarthLoader } from "../../../components/EarthLoader";
import Button from "../../../components/ui/Button";
import BackIcon from "../../../assets/icons/BackIcon";
import GuideSectionForm from "../components/GuideSectionForm";
import { GET_GUIDE_BY_ID_QUERY } from "../api/queries";

const GuideSectionFormPage = () => {
    const { guideId } = useParams<{ guideId: string }>();
    const navigate = useNavigate();
    const location = useLocation();

    // The editing section (if any) is passed via navigation state
    const editingSection = location.state?.editingSection ?? null;
    const isAIGenerated = editingSection?._isAIGenerated ?? false;
    const isEditMode = !!editingSection?.documentId;

    const [isSubmitting, setIsSubmitting] = useState(false);

    // Fetch the guide to get sections list + multi-city info
    const { data, loading, error } = useQuery(GET_GUIDE_BY_ID_QUERY, {
        variables: { documentId: guideId },
        skip: !guideId,
        fetchPolicy: "cache-and-network",
    });

    // Fallback: reset submitting after 10 s in case of error
    useEffect(() => {
        if (isSubmitting) {
            const id = setTimeout(() => setIsSubmitting(false), 10000);
            return () => clearTimeout(id);
        }
    }, [isSubmitting]);

    const handleBack = () => {
        navigate(`/guides/${guideId}`, { state: { refetch: true } });
    };

    const handleSuccess = () => {
        navigate(`/guides/${guideId}`, { state: { refetch: true } });
    };

    const handleCancel = () => {
        navigate(`/guides/${guideId}`);
    };

    // ── Loading / Error states ──────────────────────────────────────────────
    if (loading) {
        return (
            <div className="dashboard-theme flex justify-center items-center min-h-screen bg-dashboard-bg">
                <EarthLoader context="general" size="small" />
            </div>
        );
    }

    if (error || !data?.guide) {
        return (
            <div className="dashboard-theme flex flex-col justify-center items-center min-h-screen bg-dashboard-bg gap-4">
                <p className="text-red-500 font-poppins text-sm">Failed to load guide data.</p>
                <Button variant="primary" onClickHandler={handleBack} btnText="Back to Guide" />
            </div>
        );
    }

    const guide = data.guide;
    const allSections: any[] = guide.guide_sections || [];
    const sections = allSections.filter(
        (s: any, i: number, self: any[]) =>
            i === self.findIndex((x: any) => x.documentId === s.documentId)
    );

    // ── Page heading ────────────────────────────────────────────────────────
    let headingText = "Add Day or Stop";
    if (isAIGenerated) headingText = "Review AI-Generated Day";
    else if (isEditMode) headingText = "Edit Day/Stop";

    return (
        <div className="dashboard-theme bg-dashboard-bg text-dashboard-light">
            {/*
        Bottom padding keeps content clear of the floating action bar.
        Mobile: pb-36 = 144px (60px nav + 72px action bar + buffer)
        Desktop: pb-20 = 80px (just the action bar)
      */}
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-4xl pb-36 md:pb-20">

                {/* ── Top bar ──────────────────────────────────────────── */}
                <div className="mb-6 flex items-center gap-3">
                    <button
                        onClick={handleBack}
                        className="flex items-center gap-2 text-dashboard-light hover:text-dashboard-accent transition-colors duration-200 group"
                        aria-label="Back to Guide"
                    >
                        <div className="p-2 rounded-lg bg-dashboard-sidebar hover:bg-dashboard-muted transition-colors duration-200 group-hover:scale-105">
                            <BackIcon />
                        </div>
                        <span className="text-sm font-medium font-poppins hidden sm:inline">
                            Back to Guide
                        </span>
                    </button>

                    <div className="flex items-center gap-2 ml-1">
                        <h1 className="text-dashboard text-xl font-poppins font-bold">
                            {headingText}
                        </h1>
                        {isAIGenerated && (
                            <span className="px-2 py-1 text-xs font-poppins font-medium bg-dashboard-accent/10 text-dashboard-accent rounded-md border border-dashboard-accent/30">
                                ✨ AI Generated
                            </span>
                        )}
                    </div>
                </div>

                {/* ── AI tip banner ───────────────────────────────────── */}
                {isAIGenerated && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-6 bg-dashboard-accent/10 border border-dashboard-accent/30 rounded-lg p-4"
                    >
                        <p className="text-sm text-dashboard-light font-poppins">
                            <span className="font-medium text-dashboard-accent">💡 Tip:</span>{" "}
                            Review and edit the AI-generated content below. Feel free to modify
                            any details before saving to your guide.
                        </p>
                    </motion.div>
                )}

                {/* ── Form card ───────────────────────────────────────────
            No overflow-hidden / no fixed height — card grows with content.
        ────────────────────────────────────────────────────────── */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="bg-dashboard-sidebar rounded-2xl border border-dashboard-muted"
                >
                    <div className="p-4 sm:p-6">
                        <GuideSectionForm
                            guideDocumentId={guideId!}
                            sectionId={editingSection?.documentId}
                            initialData={editingSection}
                            existingSections={sections}
                            guide={guide}
                            onSuccess={() => {
                                setIsSubmitting(false);
                                handleSuccess();
                            }}
                            onCancel={() => {
                                setIsSubmitting(false);
                                handleCancel();
                            }}
                            onLoadingChange={(loading) => setIsSubmitting(loading)}
                        />
                    </div>
                </motion.div>
            </div>

            {/* ── Floating action bar ─────────────────────────────────────────────
          Sits above the mobile bottom nav bar on small screens (bottom-[60px]),
          and flush with the bottom on desktop where there is no bottom nav.
          z-40 keeps it above all page content.
      ───────────────────────────────────────────────────────────────────── */}
            <div className="fixed bottom-[60px] md:bottom-0 left-0 right-0 action-bar-offset bg-dashboard-bg/95 backdrop-blur-md border-t border-dashboard-muted px-4 sm:px-6 py-3 z-40 shadow-[0_-4px_24px_rgba(0,0,0,0.25)]">
                <div className="flex gap-3 justify-center max-w-4xl mx-auto">
                    <button
                        type="button"
                        onClick={handleCancel}
                        disabled={isSubmitting}
                        className="px-5 py-2.5 bg-dashboard-sidebar hover:bg-dashboard-muted text-dashboard rounded-xl transition-colors font-poppins text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed border border-dashboard-muted"
                    >
                        {isAIGenerated ? "Discard" : "Cancel"}
                    </button>
                    <button
                        type="submit"
                        form="guide-section-form-content"
                        disabled={isSubmitting}
                        className="px-5 py-2.5 bg-dashboard-accent hover:bg-dashboard-accent/90 text-white rounded-xl transition-colors font-poppins text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                        {isSubmitting
                            ? isAIGenerated
                                ? "Keeping..."
                                : isEditMode
                                    ? "Updating..."
                                    : "Adding..."
                            : isAIGenerated
                                ? "Keep & Save"
                                : isEditMode
                                    ? "Update"
                                    : "Add to Guide"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GuideSectionFormPage;
