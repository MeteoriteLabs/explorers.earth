import { getThemeTokenStyles } from "../../Profile/constants/themePresets";
import {
  getPreferredRecommendationCategory,
  isRecommendationCategoryVisible,
  normalizeThemeSettings,
  resolveInitialPublicProfileTab,
  type PublicProfileTab,
} from "../../Profile/constants/recommendationsPresentation";
import { RECOMMENDATION_CATEGORY_IDS } from "../../Profile/types/themeTypes";
import PublicProfileFooter from "./PublicProfileFooter";
import { useQuery } from "@apollo/client";
import { memo, useEffect, useState, useMemo, type KeyboardEvent } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import { getPublicProfileDataQuery, getUserMobileNumberQuery } from "../api/query";
import { useTrackAnalytics, createAnalyticsOptions } from "../../../services/analyticsService";
import WhatsappIcon from "../../../assets/icons/WhatsappIcon";
import MobileIcon from "../../../assets/icons/MobileIcon";
import InstagramIcon from "../../../assets/icons/InstagramIcon";
import QRModal from "../../../components/ui/QRModal";
import { useQRActions } from "../../../hooks/useQRActions";
import { generateUserProfileQRUrl } from "../../../utils/qrCodeService";
import BoldLinkIcon from "../../../assets/icons/BoldLinkIcon";
import YoutubeIcon from "../../../assets/icons/YoutubeIcon";
import TwitterIcon from "../../../assets/icons/TwitterIcon";
import Spotify from "../../../assets/icons/Spotify";
import Gmail from "../../../assets/icons/Gmail";
import FacebookIcon from "../../../assets/icons/FacebookIcon";
import YoutubeMusic from "../../../assets/icons/YoutubeMusic";
import LinkedinIcon from "../../../assets/icons/LinkedinIcon";
import AppleMusic from "../../../assets/icons/AppleMusic";
import TiktokIcon from "../../../assets/icons/TiktokIcon";
import SnapchatIcon from "../../../assets/icons/SnapchatIcon";
import MusicNote from "../../../assets/icons/MusicNote";
import { IMAGE_CONFIG } from "../../../config";
import FeedLayout from "../../../components/ui/FeedLayout";
import FeedIcon from "../../../assets/icons/FeedIcon";
import Location from "../../../assets/icons/Location";
import MediaViewer from "../../../components/ui/MediaViewer";
import {
  useMediaViewer,
  convertToMediaItems,
} from "../../../hooks/useMediaViewer";
import { buildWhatsAppHref } from "../../../utils/url";
import SEO from "../../../components/SEO";
import { createCanonicalUrl } from "../../../utils/getCurrentDomain";
import { createProfileGEOData } from "../../../utils/geoHelpers";
import { extractUtmParamsFromCurrentUrl, createUtmParams } from "../../../utils/urlHelpers";
import { toast } from "sonner";
import ProfileRecommendationsTab from "./ProfileRecommendationsTab";
import {
  normalizePublicEmailHref,
  normalizePublicWebHref,
  sanitizePublicRichText,
} from "../utils/publicProfileContent";
import { PublicProfileHeader } from "./PublicProfileHeader";
import PublicProfileBio from "./PublicProfileBio";
import PublicProfileTabs, { type PublicProfileTabDefinition } from "./PublicProfileTabs";
import {
  isSafeMediaUrl,
  resolvePublicProfileSurface,
  type PublicProfileSocialLinkViewModel,
} from "../utils/resolvePublicProfileSurface";

const HeartIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    className="size-5"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
    />
  </svg>
);

// Memoized FeedLayout to prevent unnecessary re-renders
const MemoizedFeedLayout = memo(FeedLayout);

function FullWallpaperBackground({ wallpaperUrl }: { wallpaperUrl: string | null }) {
  const defaultBg = IMAGE_CONFIG?.defaultImages?.background || null;
  const initialUrl = isSafeMediaUrl(wallpaperUrl)
    ? wallpaperUrl
    : isSafeMediaUrl(defaultBg)
      ? defaultBg
      : null;

  const [activeUrl, setActiveUrl] = useState<string | null>(initialUrl);
  const [failedPrimary, setFailedPrimary] = useState(false);

  useEffect(() => {
    const freshUrl = isSafeMediaUrl(wallpaperUrl)
      ? wallpaperUrl
      : isSafeMediaUrl(defaultBg)
        ? defaultBg
        : null;
    setActiveUrl(freshUrl);
    setFailedPrimary(false);
  }, [wallpaperUrl, defaultBg]);

  const handleError = () => {
    if (!failedPrimary && defaultBg && activeUrl !== defaultBg && isSafeMediaUrl(defaultBg)) {
      setFailedPrimary(true);
      setActiveUrl(defaultBg);
    } else {
      setActiveUrl(null);
    }
  };

  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none" data-testid="full-wallpaper-background">
      {activeUrl && (
        <img
          src={activeUrl}
          alt=""
          referrerPolicy="no-referrer"
          onError={handleError}
          data-testid="full-wallpaper-image"
          className="w-full h-full object-cover opacity-25 blur-[3px] scale-105 transition-opacity duration-300 motion-reduce:transition-none"
        />
      )}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
    </div>
  );
}

const parseBusinessLocationData = (value: unknown): Record<string, any> | null => {
  if (!value) return null;

  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, any>)
      : null;
  } catch {
    return null;
  }
};

const ProfileSkeleton = memo(() => {
  return (
    <div className="min-h-screen bg-black text-white pb-20">
      {/* Cover Photo Shimmer */}
      <div className="relative h-[380px] md:h-[420px] bg-white/5 skeleton-shimmer w-full rounded-b-[2rem] md:rounded-none overflow-hidden" />
      
      {/* Profile Pic, Name, Bio Skeletons */}
      <div className="relative z-10 -mt-20 text-center px-4">
        {/* Avatar Circle */}
        <div className="w-[7.5rem] h-[7.5rem] mx-auto rounded-full border-4 border-gray-800 bg-white/10 skeleton-shimmer overflow-hidden shadow-xl" />
        
        {/* Name */}
        <div className="mt-4 h-6 w-48 bg-white/10 skeleton-shimmer rounded mx-auto" />
        
        {/* Location */}
        <div className="mt-2 h-4 w-32 bg-white/5 skeleton-shimmer rounded mx-auto" />
        
        {/* Social Icons */}
        <div className="flex justify-center gap-4 mt-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="w-8 h-8 rounded-full bg-white/5 skeleton-shimmer" />
          ))}
        </div>
        
        {/* Bio */}
        <div className="max-w-md mx-auto mt-8 px-6 space-y-2">
          <div className="h-3 w-full bg-white/5 skeleton-shimmer rounded" />
          <div className="h-3 w-5/6 bg-white/5 skeleton-shimmer rounded mx-auto" />
          <div className="h-3 w-2/3 bg-white/5 skeleton-shimmer rounded mx-auto" />
        </div>
      </div>
    </div>
  );
});

ProfileSkeleton.displayName = "ProfileSkeleton";

const PublicProfile = memo(() => {
  const { username } = useParams();
  const navigate = useNavigate();
  const [showQR, setShowQR] = useState(false);
  const outletContext = useOutletContext<{ setIsPageLoaded?: (val: boolean) => void } | null>();

  // Extract UTM parameters from current URL for QR codes only
  // Only use QR code UTM params if they already exist in the URL (user came from QR scan)
  const utmParams = useMemo(() => {
    const currentUtmParams = extractUtmParamsFromCurrentUrl();
    // Only use existing UTM params if they're already in the URL
    // Don't create new QR code UTM params for direct shares
    return currentUtmParams;
  }, []);

  // MediaViewer state
  const { isOpen, currentIndex, openViewer, closeViewer } = useMediaViewer();

  // Use centralized QR actions hook with profile context
  // PublicProfile page QR should redirect to: host/{username}
  // Only include UTM params if they exist (user came from QR scan)
  useQRActions({
    username: username,
    context: "profile",
    utmParams: utmParams, // Only include if user came from QR scan
  });

  // Clean share URL without QR code UTM parameters for direct sharing
  const getCleanShareUrl = () => {
    return `${window.location.origin}/${username}`;
  };

  const { data, loading } = useQuery(getPublicProfileDataQuery, {
    variables: {
      filters: {
        username: {
          eq: username,
        },
      },
    },
  });

  const accountData = data?.accounts[0];
  const themeSettings = useMemo(
    () => normalizeThemeSettings(accountData?.social_media?.theme_settings),
    [accountData?.social_media?.theme_settings],
  );
  const themeStyles = getThemeTokenStyles(themeSettings);

  // Set public profile loaded when query completes successfully
  useEffect(() => {
    if (!loading) {
      (window as any).__publicProfileLoaded = true;
      outletContext?.setIsPageLoaded?.(true);
    }
  }, [loading, outletContext]);

  // Fetch mobile number ONLY when visibility is explicitly enabled
  // This prevents the mobile number from ever being in the response unless visibility is set
  const { data: mobileData } = useQuery(getUserMobileNumberQuery, {
    variables: {
      documentId: accountData?.documentId,
    },
    skip: !accountData?.documentId || !accountData?.mobile_number_visibility,
  });

  const mobileNumber = mobileData?.account?.mobile_number;

  // Analytics tracking - initialize after accountData is available
  const analytics = useTrackAnalytics(
    createAnalyticsOptions.profile(accountData?.documentId || "", username)
  );

  // Parse business location data
  const businessLocationData = useMemo(
    () => parseBusinessLocationData(accountData?.Public_Profile_Address),
    [accountData?.Public_Profile_Address],
  );
  const sanitizedProfileBio = useMemo(
    () => sanitizePublicRichText(accountData?.Bio),
    [accountData?.Bio],
  );
  const rawBusinessDescription =
    businessLocationData?.about || businessLocationData?.businessDescription;
  const sanitizedBusinessDescription = useMemo(
    () => sanitizePublicRichText(rawBusinessDescription),
    [rawBusinessDescription],
  );
  const businessWebsiteHref = useMemo(
    () =>
      normalizePublicWebHref(
        businessLocationData?.website || businessLocationData?.businessWebsite,
      ),
    [businessLocationData?.businessWebsite, businessLocationData?.website],
  );
  const emailSocial =
    accountData?.social_media?.email ?? accountData?.social_media?.gmail;
  const emailHref = normalizePublicEmailHref(emailSocial?.link);
  const publicSocialHrefs = useMemo(
    () => ({
      instagram: normalizePublicWebHref(accountData?.social_media?.instagram?.link),
      whatsapp: normalizePublicWebHref(
        buildWhatsAppHref(accountData?.social_media?.whatsapp?.link),
      ),
      website: normalizePublicWebHref(accountData?.social_media?.website?.link),
      youtube: normalizePublicWebHref(accountData?.social_media?.youtube?.link),
      X: normalizePublicWebHref(accountData?.social_media?.X?.link),
      spotify: normalizePublicWebHref(accountData?.social_media?.spotify?.link),
      facebook: normalizePublicWebHref(accountData?.social_media?.facebook?.link),
      youtubeMusic: normalizePublicWebHref(
        accountData?.social_media?.youtubeMusic?.link,
      ),
      linkedin: normalizePublicWebHref(accountData?.social_media?.linkedin?.link),
      appleMusic: normalizePublicWebHref(
        accountData?.social_media?.appleMusic?.link,
      ),
      tiktok: normalizePublicWebHref(accountData?.social_media?.tiktok?.link),
      snapchat: normalizePublicWebHref(accountData?.social_media?.snapchat?.link),
      localTunes: normalizePublicWebHref(accountData?.social_media?.localTunes?.link),
    }),
    [accountData?.social_media],
  );


  // Feed images AND videos now supported with proper aspect ratio detection
  const feedItems = accountData?.Feed_Data || [];
  const memoizedFeedImages = useMemo(() => {
    return (feedItems || []).map((media: any, index: number) => ({
      id: media.id || media.documentId || `feed-item-${media.fileName || media.url || "media"}-${index}`,
      url: media.url,
      alt: media.fileName || (media.type === "video" ? "Video" : "Feed image"),
      type: media.type || "image", // Include video support
      fileName: media.fileName,
      // Enhanced: Use stored aspect ratio information for consistent rendering
      aspectRatio: media.aspectRatio || "4:5", // Default to common social media ratio
      width: media.width || 800,
      height: media.height || (media.aspectRatio === "1:1" ? 800 : 1000),
    }));
  }, [feedItems]);

  // Convert feed items to MediaViewer format
  const mediaViewerItems = useMemo(() => {
    return convertToMediaItems(feedItems);
  }, [feedItems]);

  // Handle media item click to open MediaViewer
  const handleMediaClick = (index: number) => {
    openViewer(index);
    analytics.trackClick('feed-item', {
      action: 'open-media-viewer',
      index,
      totalItems: mediaViewerItems.length
    });
  };

  // Generate QR URL for user profile: host/{username}
  // Always use QR code UTM params for the QR code itself (not for direct shares)
  const qrCodeUtmParams = createUtmParams.qrCode();
  const qrValue = generateUserProfileQRUrl(username || "", qrCodeUtmParams);

  // Mobile number visibility: only show if visibility is enabled AND we have a number from the separate query
  const showMobileIcon = !!(accountData?.mobile_number_visibility && mobileNumber);

  const surface = useMemo(
    () =>
      resolvePublicProfileSurface({
        wallpaperMode: themeSettings.wallpaperMode,
        wallpaperUrl: themeSettings.wallpaperUrl,
        bgPictureUrl: accountData?.bg_picture?.url,
      }),
    [themeSettings.wallpaperMode, themeSettings.wallpaperUrl, accountData?.bg_picture?.url],
  );

  const socialLinks = useMemo<PublicProfileSocialLinkViewModel[]>(() => {
    const links: PublicProfileSocialLinkViewModel[] = [];
    const sm = accountData?.social_media;

    if (publicSocialHrefs.instagram && sm?.instagram?.visibility) {
      links.push({
        id: "instagram",
        href: publicSocialHrefs.instagram,
        ariaLabel: "Instagram",
        renderIcon: ({ className }) => <InstagramIcon color="currentColor" className={className} />,
        analyticsPlatform: "instagram",
      });
    }
    if (publicSocialHrefs.whatsapp && sm?.whatsapp?.visibility) {
      links.push({
        id: "whatsapp",
        href: publicSocialHrefs.whatsapp,
        ariaLabel: "WhatsApp",
        renderIcon: ({ className }) => <WhatsappIcon fill="currentColor" className={className} />,
        analyticsPlatform: "whatsapp",
      });
    }
    if (showMobileIcon) {
      links.push({
        id: "mobile",
        href: `sms:+${mobileNumber}`,
        ariaLabel: "Send SMS",
        renderIcon: ({ className }) => <MobileIcon fill="currentColor" className={className} />,
        analyticsPlatform: "mobile",
      });
    }
    if (publicSocialHrefs.website && sm?.website?.visibility) {
      links.push({
        id: "website",
        href: publicSocialHrefs.website,
        ariaLabel: "Website",
        renderIcon: ({ className }) => <BoldLinkIcon color="currentColor" className={className} />,
        analyticsPlatform: "website",
      });
    }
    if (publicSocialHrefs.youtube && sm?.youtube?.visibility) {
      links.push({
        id: "youtube",
        href: publicSocialHrefs.youtube,
        ariaLabel: "YouTube",
        renderIcon: ({ className }) => <YoutubeIcon color="currentColor" className={className} />,
        analyticsPlatform: "youtube",
      });
    }
    if (publicSocialHrefs.X && sm?.X?.visibility) {
      links.push({
        id: "X",
        href: publicSocialHrefs.X,
        ariaLabel: "Twitter",
        renderIcon: ({ className }) => <TwitterIcon color="currentColor" className={className} />,
        analyticsPlatform: "twitter",
      });
    }
    if (publicSocialHrefs.spotify && sm?.spotify?.visibility) {
      links.push({
        id: "spotify",
        href: publicSocialHrefs.spotify,
        ariaLabel: "Spotify",
        renderIcon: ({ className }) => <Spotify color="currentColor" className={className} />,
        analyticsPlatform: "spotify",
      });
    }
    if (emailHref && emailSocial?.visibility) {
      links.push({
        id: "gmail",
        href: emailHref,
        ariaLabel: "Gmail",
        renderIcon: ({ className }) => <Gmail color="currentColor" className={className} />,
        analyticsPlatform: "gmail",
      });
    }
    if (publicSocialHrefs.facebook && sm?.facebook?.visibility) {
      links.push({
        id: "facebook",
        href: publicSocialHrefs.facebook,
        ariaLabel: "Facebook",
        renderIcon: ({ className }) => <FacebookIcon color="currentColor" className={className} />,
        analyticsPlatform: "facebook",
      });
    }
    if (publicSocialHrefs.youtubeMusic && sm?.youtubeMusic?.visibility) {
      links.push({
        id: "youtubeMusic",
        href: publicSocialHrefs.youtubeMusic,
        ariaLabel: "YouTube Music",
        renderIcon: ({ className }) => <YoutubeMusic color="currentColor" className={className} />,
        analyticsPlatform: "youtube-music",
      });
    }
    if (publicSocialHrefs.linkedin && sm?.linkedin?.visibility) {
      links.push({
        id: "linkedin",
        href: publicSocialHrefs.linkedin,
        ariaLabel: "LinkedIn",
        renderIcon: ({ className }) => <LinkedinIcon color="currentColor" className={className} />,
        analyticsPlatform: "linkedin",
      });
    }
    if (publicSocialHrefs.appleMusic && sm?.appleMusic?.visibility) {
      links.push({
        id: "appleMusic",
        href: publicSocialHrefs.appleMusic,
        ariaLabel: "Apple Music",
        renderIcon: ({ className }) => <AppleMusic color="currentColor" className={className} />,
        analyticsPlatform: "apple-music",
      });
    }
    if (publicSocialHrefs.tiktok && sm?.tiktok?.visibility) {
      links.push({
        id: "tiktok",
        href: publicSocialHrefs.tiktok,
        ariaLabel: "TikTok",
        renderIcon: ({ className }) => <TiktokIcon color="currentColor" className={className} />,
        analyticsPlatform: "tiktok",
      });
    }
    if (publicSocialHrefs.snapchat && sm?.snapchat?.visibility) {
      links.push({
        id: "snapchat",
        href: publicSocialHrefs.snapchat,
        ariaLabel: "Snapchat",
        renderIcon: ({ className }) => <SnapchatIcon color="currentColor" className={className} />,
        analyticsPlatform: "snapchat",
      });
    }
    if (publicSocialHrefs.localTunes && sm?.localTunes?.visibility) {
      links.push({
        id: "localTunes",
        href: publicSocialHrefs.localTunes,
        ariaLabel: "Local Tunes",
        renderIcon: ({ className }) => <MusicNote fill="currentColor" className={className} />,
        analyticsPlatform: "localtunes",
      });
    }

    return links;
  }, [
    accountData?.social_media,
    publicSocialHrefs,
    showMobileIcon,
    mobileNumber,
    emailHref,
    emailSocial,
  ]);

  const handleShare = async () => {
    const shareUrl = getCleanShareUrl();
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `${accountData?.Account_Name || username}'s Profile`,
          text: "Check out this profile!",
          url: shareUrl,
        });
        analytics.trackClick("share-button", { context: "profile-header" });
        return;
      } catch (err: any) {
        if (err?.name === "AbortError") {
          return;
        }
      }
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Link copied!");
      } else {
        throw new Error("Clipboard API unavailable");
      }
    } catch (error) {
      toast.error("Failed to copy link");
      if (process.env.NODE_ENV !== "production") {
        console.error("Failed to copy text:", error);
      }
    }
    analytics.trackClick("share-button", { context: "profile-header" });
  };

  // Redirect if public_profile tab is disabled
  useEffect(() => {
    if (!loading && accountData) {
      const isProfileDisabled = false; // Public profile is always enabled by default
      if (isProfileDisabled) {
        // Redirect to the first available enabled tab
        const showRecommendations = accountData.public_recommendations === "Yes" || (!accountData.public_recommendations || accountData.public_recommendations === undefined);
        const showGuides = accountData.public_guides === "Yes";
        const showMovies = accountData.public_movie === "Yes";
        const showBooks = accountData.public_books === "Yes";
        const showGames = accountData.public_games === "Yes";
        const showMusic = accountData.public_music === "Yes";
        const showApps = accountData.public_apps === "Yes";
        const showProducts = accountData.public_products === "Yes";
        const showPeople = accountData.public_people === "Yes";

        if (showRecommendations) {
          navigate(`/${username}/places`, { replace: true });
        } else if (showGuides) {
          navigate(`/${username}/guides`, { replace: true });
        } else if (showMovies) {
          navigate(`/${username}/movies`, { replace: true });
        } else if (showBooks) {
          navigate(`/${username}/books`, { replace: true });
        } else if (showGames) {
          navigate(`/${username}/games`, { replace: true });
        } else if (showApps) {
          navigate(`/${username}/apps`, { replace: true });
        } else if (showProducts) {
          navigate(`/${username}/products`, { replace: true });
        } else if (showPeople) {
          navigate(`/${username}/people`, { replace: true });
        } else if (showMusic) {
          navigate(`/${username}/music`, { replace: true });
        }
        // If nothing is enabled, stay on profile (will show "not available" or similar)
      }
    }
  }, [loading, accountData, username, navigate]);



  // Determine availability of categories
  const hasRecommendations = RECOMMENDATION_CATEGORY_IDS.some((categoryId) =>
    isRecommendationCategoryVisible(accountData || {}, categoryId),
  );

  // Determine availability of business details & gallery (safe before data loaded)
  const hasBusinessDetails = !!(
    businessLocationData &&
    (businessLocationData.title ||
      businessLocationData.businessTitle ||
      businessLocationData.address ||
      businessLocationData.businessAddress ||
      sanitizedBusinessDescription ||
      businessLocationData.contact ||
      businessLocationData.businessContact ||
      businessWebsiteHref)
  );
  const hasGallery = memoizedFeedImages.length > 0;
  const availableTabs = useMemo<PublicProfileTab[]>(
    () => [
      "recommendations",
      "gallery",
      ...(hasBusinessDetails ? (["business"] as const) : []),
    ],
    [hasBusinessDetails],
  );
  const automaticActiveTab = resolveInitialPublicProfileTab({
    landingTab: themeSettings.landingTab,
    hasVisibleRecommendationCategories: hasRecommendations,
    hasGallery: true,
    hasBusiness: hasBusinessDetails,
  });
  const [manualTabOverride, setManualTabOverride] = useState<{
    username: string;
    tab: PublicProfileTab;
  } | null>(null);
  const manualTabForProfile =
    manualTabOverride && manualTabOverride.username === username
      ? manualTabOverride.tab
      : undefined;
  const activeTab =
    manualTabForProfile && availableTabs.includes(manualTabForProfile)
      ? manualTabForProfile
      : availableTabs.includes(automaticActiveTab)
        ? automaticActiveTab
        : "recommendations";
  const preferredRecommendationCategory = getPreferredRecommendationCategory(
    themeSettings.landingTab,
  );

  const selectTab = (tab: PublicProfileTab) => {
    setManualTabOverride({ username: username || "", tab });
  };

  const tabDefinitions = useMemo<PublicProfileTabDefinition[]>(
    () => [
      {
        id: "recommendations",
        label: "Recommendations",
        icon: HeartIcon,
      },
      {
        id: "gallery",
        label: "Gallery",
        icon: FeedIcon,
      },
      ...(hasBusinessDetails
        ? [
            {
              id: "business" as const,
              label: "Business Details",
              icon: Location,
            },
          ]
        : []),
    ],
    [hasBusinessDetails],
  );

  if (loading) {
    if ((window as any).__publicProfileLoaded) {
      return <ProfileSkeleton />;
    }
    return null;
  }

  // Add safety check for accountData
  if (!accountData) {
    return (
      <div className="flex bg-black items-center justify-center min-h-screen">
        <div className="text-white text-center">
          <h2 className="text-lg font-poppins font-semibold mb-2">
            Profile not found
          </h2>
          <p className="text-gray-400 text-sm">
            This user profile is not available.
          </p>
        </div>
      </div>
    );
  }

  const handleImageClick = () => {
    setShowQR(true);
    analytics.trackClick('profile-image', { action: 'open-qr-modal' });
  };

  // Enhanced dynamic SEO data preparation with all profile data
  const profileName = accountData?.Account_Name || username || "User";
  const profileLocation = accountData?.Primary_Address?.address || "";
  const profileBio = accountData?.Bio || "";
  const profileUsername = username || "";

  // Extract all available social media links for SEO
  const seoSocialLinks: string[] = [];
  const socialPlatforms = [
    {
      name: "Instagram",
      link: publicSocialHrefs.instagram,
      visibility: accountData?.social_media?.instagram?.visibility,
    },
    {
      name: "WhatsApp",
      link: publicSocialHrefs.whatsapp,
      visibility: accountData?.social_media?.whatsapp?.visibility,
    },
    {
      name: "Website",
      link: publicSocialHrefs.website,
      visibility: accountData?.social_media?.website?.visibility,
    },
    {
      name: "YouTube",
      link: publicSocialHrefs.youtube,
      visibility: accountData?.social_media?.youtube?.visibility,
    },
    {
      name: "Twitter",
      link: publicSocialHrefs.X,
      visibility: accountData?.social_media?.X?.visibility,
    },
    {
      name: "Spotify",
      link: publicSocialHrefs.spotify,
      visibility: accountData?.social_media?.spotify?.visibility,
    },
    {
      name: "Gmail",
      link: emailHref,
      visibility: emailSocial?.visibility,
    },
    {
      name: "Facebook",
      link: publicSocialHrefs.facebook,
      visibility: accountData?.social_media?.facebook?.visibility,
    },
    {
      name: "YouTube Music",
      link: publicSocialHrefs.youtubeMusic,
      visibility: accountData?.social_media?.youtubeMusic?.visibility,
    },
    {
      name: "LinkedIn",
      link: publicSocialHrefs.linkedin,
      visibility: accountData?.social_media?.linkedin?.visibility,
    },
    {
      name: "Apple Music",
      link: publicSocialHrefs.appleMusic,
      visibility: accountData?.social_media?.appleMusic?.visibility,
    },
    {
      name: "TikTok",
      link: publicSocialHrefs.tiktok,
      visibility: accountData?.social_media?.tiktok?.visibility,
    },
    {
      name: "Snapchat",
      link: publicSocialHrefs.snapchat,
      visibility: accountData?.social_media?.snapchat?.visibility,
    },
  ];

  // Filter and collect visible social links
  socialPlatforms.forEach((platform) => {
    if (platform.link && platform.visibility) {
      seoSocialLinks.push(platform.name);
    }
  });

  // Add mobile number if visible
  if (accountData?.mobile_number_visibility && mobileNumber) {
    seoSocialLinks.push("Mobile");
  }

  // Create enhanced meta description with bio, location, and social presence
  const socialLinksText =
    seoSocialLinks.length > 0
      ? ` Connect via ${seoSocialLinks.slice(0, 3).join(", ")}${seoSocialLinks.length > 3
        ? ` and ${seoSocialLinks.length - 3} more platforms`
        : ""
      }.`
      : "";

  const metaDescription = profileBio
    ? `${profileName} (@${profileUsername}) - ${profileBio
      .replace(/<[^>]*>/g, "")
      .substring(0, 100)}${profileBio.length > 100 ? "..." : ""}${profileLocation ? ` Based in ${profileLocation}.` : ""
    }${socialLinksText}`
    : profileLocation
      ? `${profileName} (@${profileUsername}) - Discover local recommendations and favorite places from ${profileLocation}. Local guide sharing authentic insights and curated suggestions.${socialLinksText}`
      : `${profileName} (@${profileUsername}) - Explore recommendations, interests and profile details. Discover favorite places and local insights.${socialLinksText}`;

  // Dynamic title - keeping original format as requested
  const pageTitle = `${profileName} | explorers Profile`;

  // Enhanced keywords with social platforms, bio content, and profile data
  const bioKeywords = profileBio
    ? profileBio
      .replace(/<[^>]*>/g, "")
      .split(/\s+/)
      .filter((word: string) => word.length > 3)
      .slice(0, 5)
    : [];
  const socialKeywords = seoSocialLinks.map(
    (platform) => `${profileName} ${platform.toLowerCase()}`
  );

  const enhancedKeywords = [
    `${profileName} explorers profile`,
    `${profileUsername} explorers`,
    "explorers public profile",
    "explorers user recommendations",
    "explorers social links",
    "explorers local insights",
    "QR code user profile",
    "explorers personal page",
    "public profile explorers",
    "explorers social media",
    "explorers authentic recommendations",
    "explorers discover users",
    "explorers connect profile",
    `${profileName} explorers`,
    `${profileUsername} profile`,
    `${profileName} recommendations`,
    `${profileUsername} explorers`,
    "local recommendations",
    "QR profile",
    "user recommendations",
    "local insights",
    "place recommendations",
    "travel recommendations",
    "local guide",
    `${profileLocation || "local"} recommendations`,
    `${profileLocation || "local"} guide`,
    ...socialKeywords,
    ...bioKeywords,
    ...seoSocialLinks.map((platform) => platform.toLowerCase()),
    `${profileName} social`,
    `${profileUsername} social media`,
    "public profile",
    "profile page",
  ].filter(Boolean);

  // Profile image for social sharing
  const profileImage =
    accountData?.profile_picture?.url || accountData?.bg_picture?.url;

  // Generate GEO data for enhanced structured data
  const geoData = createProfileGEOData({
    accountName: profileName,
    username: profileUsername,
    bio: profileBio,
    location: profileLocation,
    socialPlatforms: seoSocialLinks.slice(0, 5), // Limit to top 5 social links
  });

  return (
    <>
      {!loading && accountData && (
        <SEO
          title={pageTitle}
          description={metaDescription}
          keywords={enhancedKeywords}
          canonical={createCanonicalUrl(`/${username}`)}
          image={profileImage}
          url={createCanonicalUrl(`/${username}`)}
          type="profile"
          author={profileName}
          siteName="explorers"
          enableGEO={true}
          geoData={geoData}
        />
      )}

      <div className="h-full min-h-screen overflow-auto preview-scroll pb-20" style={{ ...themeStyles, backgroundColor: "var(--bg-page)", color: "var(--text-primary)" }}>
        {/* Full-Screen Wallpaper Background Mode */}
        {surface.mode === "full-wallpaper-image" && (
          <FullWallpaperBackground wallpaperUrl={surface.wallpaperUrl} />
        )}

        {/* Ambient Gradient Background Mode */}
        {surface.mode === "ambient-gradient" && (
          <div
            className="fixed inset-0 z-0 overflow-hidden pointer-events-none transition-all duration-500"
            style={{
              background: `linear-gradient(155deg, color-mix(in srgb, var(--accent-color, #10b981) 62%, var(--bg-page, #000000)) 0%, var(--bg-page, #000000) 62%, color-mix(in srgb, var(--accent-color, #10b981) 18%, var(--bg-page, #000000)) 100%)`,
            }}
          />
        )}

        {/* Adaptive Identity Header */}
        <PublicProfileHeader
          surface={surface}
          accountName={accountData?.Account_Name || username || ""}
          location={accountData?.Primary_Address?.address}
          avatarUrl={accountData?.profile_picture?.url || IMAGE_CONFIG.defaultImages.profile}
          socialLinks={socialLinks}
          onShare={handleShare}
          onAvatarActivate={handleImageClick}
        />

        {/* Main Content Area: Bio, Tabs, and Active Panel as Siblings */}
        <main className="max-w-5xl mx-auto px-4 sm:px-6 relative z-10 space-y-6 mt-4">
          {/* Bio Section */}
          <PublicProfileBio html={accountData?.Bio} />

          {/* Tab Rail Section */}
          <PublicProfileTabs
            tabs={tabDefinitions}
            activeTab={activeTab}
            onChange={selectTab}
          />

          {/* Active Panel Section */}
          <div className="w-full">
            {activeTab === "recommendations" && (
              <div
                id="public-profile-recommendations-panel"
                role="tabpanel"
                aria-labelledby="public-profile-recommendations-tab"
              >
                <ProfileRecommendationsTab
                  accountData={accountData}
                  username={username || ""}
                  presentation={themeSettings.recommendations}
                  preferredCategory={preferredRecommendationCategory}
                />
              </div>
            )}

            {activeTab === "gallery" && (
              <div
                id="public-profile-gallery-panel"
                role="tabpanel"
                aria-labelledby="public-profile-gallery-tab"
              >
                <div className="w-full">
                  <div
                    className="rounded-none md:rounded-lg p-1 md:p-4 transition-colors"
                    style={{
                      backgroundColor: "var(--bg-card)",
                      borderColor: "var(--border-card)",
                    }}
                  >
                    {hasGallery ? (
                      <MemoizedFeedLayout
                        images={memoizedFeedImages}
                        className="w-full always-show-overlays"
                        autoDetectDimensions={false}
                        rowHeight={200}
                        margin={1}
                        onImageClick={handleMediaClick}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 px-4">
                        <div
                          className="w-16 h-16 mb-4 rounded-full border flex items-center justify-center"
                          style={{
                            backgroundColor: "var(--bg-page)",
                            borderColor: "var(--border-card)",
                            color: "var(--text-secondary)",
                          }}
                        >
                          <FeedIcon className="size-8" />
                        </div>
                        <h3
                          className="text-lg font-poppins font-semibold mb-2"
                          style={{ color: "var(--text-primary)" }}
                        >
                          No public photos yet
                        </h3>
                        <p
                          className="text-sm text-center max-w-sm"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          Check back later for updates!
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "business" &&
              hasBusinessDetails &&
              businessLocationData && (
                <div
                  id="public-profile-business-panel"
                  role="tabpanel"
                  aria-labelledby="public-profile-business-tab"
                >
                  <div className="max-w-3xl flex flex-col item-center justify-center mx-auto">
                    <div
                      className="rounded-none md:rounded-lg p-4"
                      style={{ backgroundColor: "var(--bg-card)" }}
                    >
                      {(businessLocationData.title ||
                        businessLocationData.businessTitle ||
                        businessLocationData.address ||
                        businessLocationData.businessAddress) && (
                        <div className="mb-6">
                          {(businessLocationData.title ||
                            businessLocationData.businessTitle) && (
                            <h2
                              className="text-lg font-poppins font-semibold mb-2"
                              style={{ color: "var(--text-primary)" }}
                            >
                              {businessLocationData.title ||
                                businessLocationData.businessTitle}
                            </h2>
                          )}
                          {(businessLocationData.address ||
                            businessLocationData.businessAddress) && (
                            <p
                              className="font-poppins text-sm"
                              style={{ color: "var(--text-secondary)" }}
                            >
                              {businessLocationData.address ||
                                businessLocationData.businessAddress}
                            </p>
                          )}
                        </div>
                      )}
                      {sanitizedBusinessDescription && (
                        <div className="mb-6">
                          <h3
                            className="text-sm font-poppins font-semibold mb-2"
                            style={{ color: "var(--text-primary)" }}
                          >
                            About
                          </h3>
                          <div
                            className="font-poppins text-xs leading-relaxed"
                            style={{ color: "var(--text-secondary)" }}
                            dangerouslySetInnerHTML={{
                              __html: sanitizedBusinessDescription,
                            }}
                          />
                        </div>
                      )}
                      {(businessLocationData.contact ||
                        businessLocationData.businessContact ||
                        businessWebsiteHref) && (
                        <div className="mb-6 space-y-2">
                          {(businessLocationData.contact ||
                            businessLocationData.businessContact) && (
                            <div className="flex items-center gap-2">
                              <MobileIcon fill="currentColor" />
                              <a
                                href={`tel:${
                                  businessLocationData.contact ||
                                  businessLocationData.businessContact
                                }`}
                                className="profile-presentation-focus font-poppins text-sm transition-colors"
                                style={{ color: "var(--text-secondary)" }}
                              >
                                {businessLocationData.contact ||
                                  businessLocationData.businessContact}
                              </a>
                            </div>
                          )}
                          {businessWebsiteHref && (
                            <div className="flex items-center gap-2">
                              <BoldLinkIcon color="currentColor" />
                              <a
                                href={businessWebsiteHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="profile-presentation-focus font-poppins text-sm transition-colors"
                                style={{ color: "var(--text-secondary)" }}
                              >
                                Visit Website
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
          </div>
        </main>

        {/* Footer Branding Badge */}
        <PublicProfileFooter brandingStyle={themeSettings?.footerBranding || "enabled"} username={username} />
        {showQR && (
          <QRModal
            isOpen={showQR}
            onClose={() => {
              setShowQR(false);
            }}
            qrValue={qrValue}
            onCopyLink={async () => {
              // Copy the QR code value which includes QR code UTM params
              try {
                await navigator.clipboard.writeText(qrValue);
                toast.success("Link copied!");
              } catch (error) {
                console.error("Failed to copy text:", error);
              }
            }}
            title="Profile QR Code"
            qrSize="medium"
          />
        )}

        {/* MediaViewer for feed images and videos */}
        <MediaViewer
          mediaItems={mediaViewerItems}
          initialIndex={currentIndex}
          isOpen={isOpen}
          onClose={closeViewer}
        />
      </div>
    </>
  );
});

export default PublicProfile;
