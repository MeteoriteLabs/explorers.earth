import { useQuery } from "@apollo/client";
import { memo, useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getPublicProfileDataQuery, getUserMobileNumberQuery } from "../api/query";
import { useTrackAnalytics, createAnalyticsOptions } from "../../../services/analyticsService";
import WhatsappIcon from "../../../assets/icons/WhatsappIcon";
import MobileIcon from "../../../assets/icons/MobileIcon";
import InstagramIcon from "../../../assets/icons/InstagramIcon";
import { EarthLoader } from "../../../components/EarthLoader";
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
import { normalizeExternalUrl, buildWhatsAppHref } from "../../../utils/url";
import SEO from "../../../components/SEO";
import { createCanonicalUrl } from "../../../utils/getCurrentDomain";
import { createProfileGEOData } from "../../../utils/geoHelpers";
import { extractUtmParamsFromCurrentUrl, createUtmParams } from "../../../utils/urlHelpers";
import { toast } from "sonner";
import ProfileRecommendationsTab from "./ProfileRecommendationsTab";

// Memoized FeedLayout to prevent unnecessary re-renders
const MemoizedFeedLayout = memo(FeedLayout);

const PublicProfile = memo(() => {
  const { username } = useParams();
  const navigate = useNavigate();
  const [showQR, setShowQR] = useState(false);

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
  const businessLocationData = accountData?.Public_Profile_Address
    ? typeof accountData.Public_Profile_Address === "string"
      ? JSON.parse(accountData.Public_Profile_Address)
      : accountData.Public_Profile_Address
    : null;

  // Feed images AND videos now supported with proper aspect ratio detection
  const feedItems = accountData?.Feed_Data || [];
  const memoizedFeedImages = useMemo(() => {
    return (feedItems || []).map((media: any) => ({
      id: media.id || media.documentId || `media-${Math.random()}`,
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

  // Redirect if public_profile tab is disabled
  useEffect(() => {
    if (!loading && accountData) {
      const isProfileDisabled = accountData.public_profile === "No";
      if (isProfileDisabled) {
        // Redirect to the first available enabled tab
        const showRecommendations = accountData.public_recommendations === "Yes" || (!accountData.public_recommendations || accountData.public_recommendations === undefined);
        const showGuides = accountData.public_guides === "Yes";
        const showMovies = accountData.public_movie === "Yes";
        const showBooks = accountData.public_books === "Yes";
        const showGames = accountData.public_games === "Yes";
        const showMusic = accountData.public_music === "Yes";

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
        } else if (showMusic) {
          navigate(`/${username}/music`, { replace: true });
        }
        // If nothing is enabled, stay on profile (will show "not available" or similar)
      }
    }
  }, [loading, accountData, username, navigate]);



  // Determine availability of categories
  const hasRecommendations = !!(
    accountData?.public_recommendations === "Yes" || 
    accountData?.public_recommendations === undefined || 
    accountData?.public_recommendations === null ||
    accountData?.public_music === "Yes" ||
    accountData?.public_movie === "Yes" ||
    accountData?.public_books === "Yes" ||
    accountData?.public_games === "Yes"
  );

  // Determine availability of business details & gallery (safe before data loaded)
  const hasBusinessDetails = !!(
    businessLocationData &&
    (businessLocationData.title ||
      businessLocationData.businessTitle ||
      businessLocationData.address ||
      businessLocationData.businessAddress ||
      businessLocationData.about ||
      businessLocationData.businessDescription ||
      businessLocationData.contact ||
      businessLocationData.businessContact ||
      businessLocationData.website ||
      businessLocationData.businessWebsite)
  );
  const hasGallery = memoizedFeedImages.length > 0;
  const hasGalleryContent = true; // Always show gallery tab, even if empty

  // Tab state must be declared before any early returns to preserve hook order
  // "recommendations" is the default and first tab
  const [activeTab, setActiveTab] = useState<"recommendations" | "gallery" | "business">("recommendations");

  // Ensure activeTab remains valid if data availability changes
  useEffect(() => {
    if (activeTab === "recommendations" && !hasRecommendations) {
      setActiveTab("gallery"); // fallback to gallery since hasGalleryContent is always true
    } else if (activeTab === "gallery" && !hasGalleryContent && hasBusinessDetails) {
      setActiveTab("business");
    } else if (activeTab === "business" && !hasBusinessDetails && hasGalleryContent) {
      setActiveTab("gallery");
    }
  }, [activeTab, hasGalleryContent, hasBusinessDetails, hasRecommendations]);

  if (loading)
    return (
      <div className="bg-black min-h-screen">
        <EarthLoader context="profile" />
      </div>
    );

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
  const socialLinks = [];
  const socialPlatforms = [
    {
      name: "Instagram",
      link: accountData?.social_media?.instagram?.link,
      visibility: accountData?.social_media?.instagram?.visibility,
    },
    {
      name: "WhatsApp",
      link: accountData?.social_media?.whatsapp?.link,
      visibility: accountData?.social_media?.whatsapp?.visibility,
    },
    {
      name: "Website",
      link: accountData?.social_media?.website?.link,
      visibility: accountData?.social_media?.website?.visibility,
    },
    {
      name: "YouTube",
      link: accountData?.social_media?.youtube?.link,
      visibility: accountData?.social_media?.youtube?.visibility,
    },
    {
      name: "Twitter",
      link: accountData?.social_media?.X?.link,
      visibility: accountData?.social_media?.X?.visibility,
    },
    {
      name: "Spotify",
      link: accountData?.social_media?.spotify?.link,
      visibility: accountData?.social_media?.spotify?.visibility,
    },
    {
      name: "Gmail",
      link: accountData?.social_media?.gmail?.link,
      visibility: accountData?.social_media?.gmail?.visibility,
    },
    {
      name: "Facebook",
      link: accountData?.social_media?.facebook?.link,
      visibility: accountData?.social_media?.facebook?.visibility,
    },
    {
      name: "YouTube Music",
      link: accountData?.social_media?.youtubeMusic?.link,
      visibility: accountData?.social_media?.youtubeMusic?.visibility,
    },
    {
      name: "LinkedIn",
      link: accountData?.social_media?.linkedin?.link,
      visibility: accountData?.social_media?.linkedin?.visibility,
    },
    {
      name: "Apple Music",
      link: accountData?.social_media?.appleMusic?.link,
      visibility: accountData?.social_media?.appleMusic?.visibility,
    },
    {
      name: "TikTok",
      link: accountData?.social_media?.tiktok?.link,
      visibility: accountData?.social_media?.tiktok?.visibility,
    },
    {
      name: "Snapchat",
      link: accountData?.social_media?.snapchat?.link,
      visibility: accountData?.social_media?.snapchat?.visibility,
    },
  ];

  // Filter and collect visible social links
  socialPlatforms.forEach((platform) => {
    if (platform.link && platform.visibility) {
      socialLinks.push(platform.name);
    }
  });

  // Add mobile number if visible
  if (accountData?.mobile_number_visibility && mobileNumber) {
    socialLinks.push("Mobile");
  }

  // Create enhanced meta description with bio, location, and social presence
  const socialLinksText =
    socialLinks.length > 0
      ? ` Connect via ${socialLinks.slice(0, 3).join(", ")}${socialLinks.length > 3
        ? ` and ${socialLinks.length - 3} more platforms`
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
  const socialKeywords = socialLinks.map(
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
    ...socialLinks.map((platform) => platform.toLowerCase()),
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
    socialPlatforms: socialLinks.slice(0, 5), // Limit to top 5 social links
  });

  return (
    <>
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

      <div className="h-full bg-black min-h-screen overflow-auto preview-scroll pb-20">
        {/* Fixed Header */}
        <div className="fixed top-0 left-0 right-0 z-50 bg-[#2a2a2a]/90 backdrop-blur-sm border-b border-gray-700 h-14">
          <div className="max-w-4xl mx-auto flex items-center justify-between h-full px-6">
            <span
              className="text-white font-bold text-2xl cursor-pointer"
              onClick={() => navigate("/")}
            >
              explorers.earth
            </span>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  const shareUrl = getCleanShareUrl();
                  if (navigator.share) {
                    navigator.share({
                      title: `${accountData?.Account_Name || username}'s Profile`,
                      text: "Check out this profile!",
                      url: shareUrl,
                    }).catch(() => { });
                  } else {
                    // Copy clean URL without QR code UTM params
                    try {
                      await navigator.clipboard.writeText(shareUrl);
                      toast.success("Link copied!");
                    } catch (error) {
                      console.error("Failed to copy text:", error);
                    }
                  }
                  analytics.trackClick('share-button', { context: 'profile-header' });
                }}
                className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-all duration-300 flex items-center justify-center"
                aria-label="Share"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </button>
              <button
                onClick={async () => {
                  // Copy clean URL without QR code UTM params
                  const shareUrl = getCleanShareUrl();
                  try {
                    await navigator.clipboard.writeText(shareUrl);
                    toast.success("Link copied!");
                  } catch (error) {
                    console.error("Failed to copy text:", error);
                  }
                }}
                className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-all duration-300 flex items-center justify-center"
                aria-label="Copy Link"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Profile Content */}

        {/* Profile Header Section with Background Cover */}
        <div className="relative overflow-hidden bg-black pb-0">
          {/* Cover Photo Background with Rounded Bottom and Fade */}
          <div className="absolute inset-x-0 top-0 h-[380px] md:h-[420px] overflow-hidden z-0 rounded-b-[2rem] md:rounded-none bg-black">
            <img
              src={
                accountData?.bg_picture?.url ||
                IMAGE_CONFIG.defaultImages.background
              }
              alt="Cover"
              className="w-full h-full object-cover object-[center_32%] scale-105"
              loading="eager"
            />
            {/* Cinematic top-to-bottom dimming - Base layer */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-black/20 to-black/80 z-0" />
            
            {/* Smooth blur-from-bottom effect for high-end look */}
            <div 
              className="absolute inset-x-0 bottom-0 h-[70%] backdrop-blur-md bg-black/10 z-0"
              style={{
                WebkitMaskImage: 'linear-gradient(to top, black 30%, transparent 100%)',
                maskImage: 'linear-gradient(to top, black 30%, transparent 100%)'
              }}
            />
            
            {/* Deep bottom shadow for final transition to bio */}
            <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black via-black/40 to-transparent z-0" />
          </div>

          {/* Profile Header Content (Profile Pic, Name, Social Icons) */}
          <div className="relative z-10 pt-16 md:pt-32 pb-0 md:pb-4 text-center px-4">
            {/* Profile Picture */}
            <div className="relative mb-2 px-4">
              <div
                className="w-[7.5rem] h-[7.5rem] mx-auto rounded-full border-4 border-[hsl(var(--evergreen))] overflow-hidden cursor-pointer shadow-xl bg-black"
                onClick={handleImageClick}
              >
                <img
                  src={
                    accountData?.profile_picture?.url ||
                    IMAGE_CONFIG.defaultImages.profile
                  }
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Name & Location */}
            <div className="text-center px-6">
              <h1 className="text-base font-poppins font-bold text-white tracking-tight drop-shadow-md">
                {accountData?.Account_Name}
              </h1>
              <div className="flex items-center justify-center gap-1.5 text-white/90 text-xs font-poppins mt-0.5 drop-shadow-sm">
                <Location className="w-3 h-3 text-white/70" />
                <span>{accountData?.Primary_Address?.address}</span>
              </div>
            </div>

            {/* Social Links */}
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 px-6 mt-4 mb-2 empty:hidden">
            {accountData?.social_media?.instagram?.link &&
              accountData?.social_media?.instagram?.visibility && (
                <a
                  href={normalizeExternalUrl(
                    accountData.social_media.instagram.link
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => analytics.trackClick('social-link', { platform: 'instagram' })}
                >
                  <InstagramIcon color="white" />
                </a>
              )}
            {accountData?.social_media?.whatsapp?.link &&
              accountData?.social_media?.whatsapp?.visibility && (
                <a
                  href={buildWhatsAppHref(
                    accountData.social_media.whatsapp.link
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => analytics.trackClick('social-link', { platform: 'whatsapp' })}
                >
                  <WhatsappIcon fill="white" />
                </a>
              )}
            {showMobileIcon && (
              <a
                href={`sms:+${mobileNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Send SMS"
                className="focus:outline-none focus:ring-2 focus:ring-[hsl(var(--blue-cta))] rounded-full transition-opacity duration-200"
                onClick={() => analytics.trackClick('social-link', { platform: 'mobile' })}
              >
                <MobileIcon fill="white" />
              </a>
            )}
            {accountData?.social_media?.website?.link &&
              accountData?.social_media?.website?.visibility && (
                <a
                  href={normalizeExternalUrl(
                    accountData.social_media.website.link
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => analytics.trackClick('social-link', { platform: 'website' })}
                >
                  <BoldLinkIcon color="white" />
                </a>
              )}
            {accountData?.social_media?.youtube?.link &&
              accountData?.social_media?.youtube?.visibility && (
                <a
                  href={normalizeExternalUrl(
                    accountData.social_media.youtube.link
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => analytics.trackClick('social-link', { platform: 'youtube' })}
                >
                  <YoutubeIcon color="white" />
                </a>
              )}
            {accountData?.social_media?.X?.link &&
              accountData?.social_media?.X?.visibility && (
                <a
                  href={normalizeExternalUrl(accountData.social_media.X.link)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => analytics.trackClick('social-link', { platform: 'twitter' })}
                >
                  <TwitterIcon color="white" />
                </a>
              )}
            {accountData?.social_media?.spotify?.link &&
              accountData?.social_media?.spotify?.visibility && (
                <a
                  href={normalizeExternalUrl(
                    accountData.social_media.spotify.link
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => analytics.trackClick('social-link', { platform: 'spotify' })}
                >
                  <Spotify color="white" />
                </a>
              )}
            {accountData?.social_media?.gmail?.link &&
              accountData?.social_media?.gmail?.visibility && (
                <a
                  href={normalizeExternalUrl(
                    accountData.social_media.gmail.link
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => analytics.trackClick('social-link', { platform: 'gmail' })}
                >
                  <Gmail color="white" />
                </a>
              )}
            {accountData?.social_media?.facebook?.link &&
              accountData?.social_media?.facebook?.visibility && (
                <a
                  href={normalizeExternalUrl(
                    accountData.social_media.facebook.link
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => analytics.trackClick('social-link', { platform: 'facebook' })}
                >
                  <FacebookIcon color="white" />
                </a>
              )}
            {accountData?.social_media?.youtubeMusic?.link &&
              accountData?.social_media?.youtubeMusic?.visibility && (
                <a
                  href={normalizeExternalUrl(
                    accountData.social_media.youtubeMusic.link
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => analytics.trackClick('social-link', { platform: 'youtube-music' })}
                >
                  <YoutubeMusic color="white" />
                </a>
              )}
            {accountData?.social_media?.linkedin?.link &&
              accountData?.social_media?.linkedin?.visibility && (
                <a
                  href={normalizeExternalUrl(
                    accountData.social_media.linkedin.link
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => analytics.trackClick('social-link', { platform: 'linkedin' })}
                >
                  <LinkedinIcon color="white" />
                </a>
              )}
            {accountData?.social_media?.appleMusic?.link &&
              accountData?.social_media?.appleMusic?.visibility && (
                <a
                  href={normalizeExternalUrl(
                    accountData.social_media.appleMusic.link
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => analytics.trackClick('social-link', { platform: 'apple-music' })}
                >
                  <AppleMusic color="white" />
                </a>
              )}
            {accountData?.social_media?.tiktok?.link &&
              accountData?.social_media?.tiktok?.visibility && (
                <a
                  href={normalizeExternalUrl(
                    accountData.social_media.tiktok.link
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => analytics.trackClick('social-link', { platform: 'tiktok' })}
                >
                  <TiktokIcon color="white" />
                </a>
              )}
            {accountData?.social_media?.snapchat?.link &&
              accountData?.social_media?.snapchat?.visibility && (
                <a
                  href={normalizeExternalUrl(
                    accountData.social_media.snapchat.link
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => analytics.trackClick('social-link', { platform: 'snapchat' })}
                >
                  <SnapchatIcon color="white" />
                </a>
              )}
            {accountData?.social_media?.localTunes?.link &&
              accountData?.social_media?.localTunes?.visibility && (
                <a
                  href={normalizeExternalUrl(
                    accountData.social_media.localTunes.link
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MusicNote fill="white" />
                </a>
              )}
              {/* End of Social Links */}
            </div>
            {/* End of Profile Header Content */}
          </div>
          {/* End of Profile Header Section */}
        </div>
        <div className="md:max-w-5xl px-6 md:px-6 md:mx-auto">
          <div className="mt-0 max-w-3xl md:flex flex-col item-center justify-center mx-auto">
            <div className="bg-black rounded-none md:rounded-lg p-2">
              <div
                className="text-gray-300 font-poppins text-xs line-clamp-3 break-words overflow-hidden text-ellipsis"
                dangerouslySetInnerHTML={{ __html: accountData?.Bio || "" }}
              />
            </div>
          </div>

          {/* Tabs: Recommendations (heart) | Gallery (feed) | Address (location) */}
          <div className="mt-1 max-w-5xl mx-auto">
            <div className="bg-black rounded-lg px-0 md:p-4">
              {/* Tab List */}
              <div className="flex w-full justify-center gap-8 border-b border-gray-800 px-2 md:px-0 overflow-x-auto scrollbar-hide">
                {/* Recommendations tab — conditionally rendered */}
                {hasRecommendations && (
                  <button
                    className={`py-2 text-xs font-poppins font-medium tracking-wide transition-colors border-b-2 focus:outline-none ${activeTab === "recommendations"
                      ? "border-[hsl(var(--blue-cta))] text-white"
                      : "border-transparent text-gray-400 hover:text-gray-200"
                      }`}
                    aria-selected={activeTab === "recommendations"}
                    onClick={() => setActiveTab("recommendations")}
                  >
                    <span className="flex items-center justify-center gap-1">
                      <svg viewBox="0 0 24 24" fill={activeTab === "recommendations" ? "currentColor" : "none"} stroke="currentColor" strokeWidth={activeTab === "recommendations" ? 0 : 1.8} className="size-5 transition-all" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                      </svg>
                      <span className="sr-only">Recommendations</span>
                    </span>
                  </button>
                )}

                {/* Gallery tab */}
                <button
                  className={`py-2 text-xs font-poppins font-medium tracking-wide transition-colors border-b-2 focus:outline-none ${activeTab === "gallery"
                    ? "border-[hsl(var(--blue-cta))] text-white"
                    : "border-transparent text-gray-400 hover:text-gray-200"
                    }`}
                  aria-selected={activeTab === "gallery"}
                  onClick={() => setActiveTab("gallery")}
                >
                  <span className="flex items-center justify-center gap-1">
                    <FeedIcon className="size-5" />
                    <span className="sr-only">Gallery</span>
                  </span>
                </button>

                {/* Address tab — only if business details exist */}
                {hasBusinessDetails && (
                  <button
                    className={`py-2 text-xs font-poppins font-medium tracking-wide transition-colors border-b-2 focus:outline-none ${activeTab === "business"
                      ? "border-[hsl(var(--blue-cta))] text-white"
                      : "border-transparent text-gray-400 hover:text-gray-200"
                      }`}
                    aria-selected={activeTab === "business"}
                    onClick={() => setActiveTab("business")}
                  >
                    <span className="flex items-center justify-center gap-1">
                      <Location className="size-5" />
                      <span className="sr-only">Business Details</span>
                    </span>
                  </button>
                )}
              </div>

              {/* Tab Panels */}
              <div className="relative mt-2 pb-20 md:pb-20">

                {/* ── Recommendations Tab ── */}
                {activeTab === "recommendations" && hasRecommendations && (
                  <div role="tabpanel">
                    <ProfileRecommendationsTab
                      accountData={accountData}
                      username={username || ""}
                    />
                  </div>
                )}

                {/* ── Gallery Tab ── */}
                {activeTab === "gallery" && (
                  <div role="tabpanel" aria-hidden={false}>
                    <div className="w-full">
                      <div className="max-w-4xl mx-auto px-1 md:px-4">
                        <div className="bg-black rounded-none md:rounded-lg p-1 md:p-4">
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
                              <div className="w-16 h-16 mb-4 rounded-full bg-gray-800 flex items-center justify-center">
                                <FeedIcon className="size-8 text-gray-400" />
                              </div>
                              <h3 className="text-lg font-poppins font-semibold text-white mb-2">
                                No Photos Yet
                              </h3>
                              <p className="text-sm text-gray-400 text-center max-w-sm">
                                This user hasn't shared any photos in their feed yet. Check back later for updates!
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Business / Address Tab ── */}
                {activeTab === "business" &&
                  hasBusinessDetails &&
                  businessLocationData && (
                    <div role="tabpanel" aria-hidden={false}>
                      <div className="max-w-3xl flex flex-col item-center justify-center mx-auto">
                        <div className="bg-black rounded-none md:rounded-lg p-4">
                          {(businessLocationData.title ||
                            businessLocationData.businessTitle ||
                            businessLocationData.address ||
                            businessLocationData.businessAddress) && (
                              <div className="mb-6">
                                {(businessLocationData.title ||
                                  businessLocationData.businessTitle) && (
                                    <h2 className="text-lg font-poppins font-semibold text-white mb-2">
                                      {businessLocationData.title ||
                                        businessLocationData.businessTitle}
                                    </h2>
                                  )}
                                {(businessLocationData.address ||
                                  businessLocationData.businessAddress) && (
                                    <p className="text-gray-300 font-poppins text-sm">
                                      {businessLocationData.address ||
                                        businessLocationData.businessAddress}
                                    </p>
                                  )}
                              </div>
                            )}
                          {(businessLocationData.about ||
                            businessLocationData.businessDescription) && (
                              <div className="mb-6">
                                <h3 className="text-sm font-poppins font-semibold text-white mb-2">
                                  About
                                </h3>
                                <div
                                  className="text-gray-300 font-poppins text-xs leading-relaxed"
                                  dangerouslySetInnerHTML={{
                                    __html:
                                      businessLocationData.about ||
                                      businessLocationData.businessDescription,
                                  }}
                                />
                              </div>
                            )}
                          {(businessLocationData.contact ||
                            businessLocationData.businessContact ||
                            businessLocationData.website ||
                            businessLocationData.businessWebsite) && (
                              <div className="mb-6 space-y-2">
                                {(businessLocationData.contact ||
                                  businessLocationData.businessContact) && (
                                    <div className="flex items-center gap-2">
                                      <MobileIcon fill="white" />
                                      <a
                                        href={`tel:${businessLocationData.contact ||
                                          businessLocationData.businessContact
                                          }`}
                                        className="text-gray-300 font-poppins text-sm hover:text-white transition-colors"
                                      >
                                        {businessLocationData.contact ||
                                          businessLocationData.businessContact}
                                      </a>
                                    </div>
                                  )}
                                {(businessLocationData.website ||
                                  businessLocationData.businessWebsite) && (
                                    <div className="flex items-center gap-2">
                                      <BoldLinkIcon color="white" />
                                      <a
                                        href={
                                          businessLocationData.website ||
                                          businessLocationData.businessWebsite
                                        }
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-gray-300 font-poppins text-sm hover:text-white transition-colors"
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
            </div>
          </div>


        </div>
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
