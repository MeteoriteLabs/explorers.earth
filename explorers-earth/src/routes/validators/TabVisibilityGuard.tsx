import { memo } from "react";
import { useQuery } from "@apollo/client";
import { useParams, Navigate, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { getPublicAccountBasicQuery } from "../../features/PublicHome/api/query";
import { EarthLoader } from "../../components/EarthLoader";
import Button from "../../components/ui/Button";
import Home from "../../assets/icons/Home";
import HeroSkeleton from "../../components/ui/HeroSkeleton";

interface TabVisibilityGuardProps {
    /** Which tab visibility field to check */
    tabField: "public_profile" | "public_recommendations" | "public_music" | "public_guides" | "public_movie" | "public_books" | "public_games";
    /** Default visibility if the field is not set */
    defaultVisible?: boolean;
    /** The content to render if the tab is enabled */
    children: React.ReactNode;
}

/**
 * Guards a public route based on the user's tab visibility settings.
 * If the tab is disabled (set to "No"), redirects to the first available tab.
 * This prevents manual URL navigation to disabled tabs.
 */
const TabVisibilityGuard = memo(({ tabField, defaultVisible = true, children }: TabVisibilityGuardProps) => {
    const { username } = useParams();
    const navigate = useNavigate();

    const { data, loading } = useQuery(getPublicAccountBasicQuery, {
        variables: {
            filters: {
                username: {
                    eq: username,
                },
            },
        },
        skip: !username,
    });

    // Show loader while checking visibility
    if (loading) {
        if ((window as any).__publicProfileLoaded) {
            return (
                <div className="bg-black min-h-screen pt-20 px-4 md:px-6">
                    <div className="max-w-5xl mx-auto">
                        <HeroSkeleton accentColor="yellow" showThumbnails />
                    </div>
                </div>
            );
        }
        return (
            <div className="bg-black min-h-screen">
                <EarthLoader context="general" size="default" />
            </div>
        );
    }

    const accountData = data?.accounts?.[0];

    // If no account found, let the child component handle the "not found" state
    if (!accountData) {
        return <>{children}</>;
    }

    // Check if the specific tab is enabled
    const fieldValue = accountData[tabField];
    const isTabEnabled = fieldValue === "Yes" || fieldValue === "No"
        ? fieldValue === "Yes"
        : defaultVisible; // Use default if field is not set (null/undefined)

    if (!isTabEnabled) {
        // Find the first available tab to redirect to
        const tabOptions = [
            { field: "public_recommendations", path: `/${username}/places`, default: true },
            { field: "public_guides", path: `/${username}/guides`, default: false },
            { field: "public_movie", path: `/${username}/movies`, default: false },
            { field: "public_books", path: `/${username}/books`, default: false },
            { field: "public_games", path: `/${username}/games`, default: true },
            { field: "public_music", path: `/${username}/music`, default: false },
            { field: "public_profile", path: `/${username}`, default: true },
        ];

        // Don't redirect to the same tab we're guarding
        const availableTab = tabOptions.find(tab => {
            if (tab.field === tabField) return false;
            const value = accountData[tab.field];
            return value === "Yes" || (value !== "No" && tab.default);
        });

        if (availableTab) {
            return <Navigate to={availableTab.path} replace />;
        }

        // If nothing is available, show a premium "not available" message
        // Matches the 404 page design language exactly
        return (
            <div className="min-h-screen flex font-poppins items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white px-4 sm:px-6 py-6 sm:py-10">
                <div className="relative w-full max-w-md mx-auto">
                    <motion.div
                        className="backdrop-blur-sm bg-gray-900/80 border border-gray-800 p-6 sm:p-8 rounded-2xl shadow-2xl text-center"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        {/* Lock icon — matching 404's large number styling */}
                        <motion.div
                            className="mx-auto mb-4 w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gray-800/60 border border-gray-700/40 flex items-center justify-center"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                        >
                            <svg
                                className="w-8 h-8 sm:w-10 sm:h-10"
                                fill="none"
                                stroke="url(#lockGradient)"
                                viewBox="0 0 24 24"
                            >
                                <defs>
                                    <linearGradient id="lockGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                        <stop offset="0%" stopColor="rgb(147, 51, 234)" />
                                        <stop offset="100%" stopColor="rgb(168, 85, 247)" />
                                    </linearGradient>
                                </defs>
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={1.5}
                                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                />
                            </svg>
                        </motion.div>

                        <motion.h2
                            className="text-xl sm:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple to-purple-500 mb-4"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                        >
                            Content Not Available
                        </motion.h2>

                        <motion.p
                            className="text-sm sm:text-base text-gray-400 mt-2 sm:mt-3 mb-6 sm:mb-8"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                        >
                            This section is currently private and has been hidden by the profile owner.
                        </motion.p>

                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                            className="flex justify-center"
                        >
                            <Button
                                btnText="Go Home"
                                variant="primary"
                                size="medium"
                                startIcon={<Home />}
                                onClickHandler={() => navigate("/")}
                            />
                        </motion.div>
                    </motion.div>
                </div>
            </div>
        );
    }

    // Tab is enabled — render the content
    return <>{children}</>;
});

export default TabVisibilityGuard;
