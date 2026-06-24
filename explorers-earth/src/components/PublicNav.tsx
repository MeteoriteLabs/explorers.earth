import { memo } from "react";
import NavButton from "./ui/NavButton";
import DirectionBoard from "../assets/icons/DirectionBoard";
import Profile from "../assets/icons/Profile";
import MusicNote from "../assets/icons/MusicNote";
import TravelGuideIcon from "../assets/icons/TravelGuideIcon";
import { Film, BookOpen, Gamepad2 } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@apollo/client";
import { getPublicAccountBasicQuery } from "../features/PublicHome/api/query";

const PublicNav = memo(() => {
  const navigate = useNavigate();
  const location = useLocation();
  const { username } = useParams();

  // Query to get account data for tab visibility
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

  const accountData = data?.accounts[0];

  // Helper function to normalize paths by removing trailing slashes
  const normalizePath = (path: string | undefined) => {
    if (!path) return '';
    return path.endsWith('/') && path !== '/' ? path.slice(0, -1) : path;
  };

  // Helper function to check if paths match (ignoring trailing slashes)
  const isPathMatch = (currentPath: string, targetPath: string) => {
    const normalizedCurrent = normalizePath(currentPath);
    const normalizedTarget = normalizePath(targetPath);
    return normalizedCurrent === normalizedTarget;
  };

  // Helper function to check if current path is for places
  const isPlacesPath = (currentPath: string) => {
    const normalizedPath = normalizePath(currentPath);
    return normalizedPath.includes('/places');
  };

  // Helper function to check if current path is for music
  const isMusicPath = (currentPath: string) => {
    const normalizedPath = normalizePath(currentPath);
    return normalizedPath.includes('/music');
  };

  // Tab visibility logic based on Account collection fields
  const showRecommendationsTab = accountData?.public_recommendations === "Yes" || accountData?.public_recommendations === "No" ? accountData?.public_recommendations === "Yes" : true; // Default to show if not set
  const showProfileTab = accountData?.public_profile === "Yes" || accountData?.public_profile === "No" ? accountData?.public_profile === "Yes" : true; // Default to show if not set
  const showMusicTab = accountData?.public_music === "Yes" || accountData?.public_music === "No" ? accountData?.public_music === "Yes" : false; // Default to hide if not set
  const showGuidesTab = accountData?.public_guides === "Yes"; // Only show when explicitly "Yes"
  const showMoviesTab = accountData?.public_movie === "Yes"; // Only show when explicitly "Yes"
  const showBooksTab = accountData?.public_books === "Yes"; // Only show when explicitly "Yes"
  const showGamesTab = accountData?.public_games === "Yes" || accountData?.public_games === "No" ? accountData?.public_games === "Yes" : true; // Default to show if not set

  // Helper function to check if current path is for movies
  const isMoviesPath = (currentPath: string) => {
    const normalizedPath = normalizePath(currentPath);
    return normalizedPath.includes('/movies');
  };

  // Helper function to check if current path is for books
  const isBooksPath = (currentPath: string) => {
    const normalizedPath = normalizePath(currentPath);
    return normalizedPath.includes('/books');
  };

  // Helper function to check if current path is for games
  const isGamesPath = (currentPath: string) => {
    const normalizedPath = normalizePath(currentPath);
    return normalizedPath.includes('/games');
  };

  // Helper function to check if current path is for guides
  const isGuidesPath = (currentPath: string) => {
    const normalizedPath = normalizePath(currentPath);
    return normalizedPath.includes('/guides');
  };

  // Don't render tabs until account data is loaded to prevent flash of default tabs
  if (loading || !accountData) {
    return (
      <div className="fixed bottom-0 md:bottom-2 md:rounded-lg z-50 w-full md:w-[33%]  md:translate-x-[102%]  bg-[#2a2a2a] text-white flex md:flex-row md:justify-center md:items-center justify-center p-1  shadow-md">
        <div className="flex mx-[1.5rem] md:border-0 flex-row justify-around w-full">
          {/* Empty placeholder to maintain layout height while loading */}
          <div style={{ height: '2.5rem' }} />
        </div>
      </div>
    );
  }

  const navItems = [
    // Only add recommendations tab if visibility is enabled
    ...(showRecommendationsTab ? [{
      id: 'public_recommendations',
      icon: <DirectionBoard fill={isPlacesPath(location.pathname) ? "hsl(var(--blue-cta))" : "#F2F2F2"} />,
      text: "Recommendations",
      path: `/${username}/places`,
    }] : []),
    // Only add guides tab if visibility is enabled
    ...(showGuidesTab ? [{
      id: 'public_guides',
      icon: <TravelGuideIcon fill={isGuidesPath(location.pathname) ? "hsl(var(--blue-cta))" : "#F2F2F2"} />,
      text: "Guides",
      path: `/${username}/guides`,
    }] : []),
    // Only add profile tab if visibility is enabled
    ...(showProfileTab ? [{
      id: 'public_profile',
      icon: <Profile fill={isPathMatch(location.pathname, `/${username}`) ? "hsl(var(--blue-cta))" : "#F2F2F2"} />,
      text: "Profile",
      path: `/${username}`,
    }] : []),
    // Only add movies tab if visibility is enabled
    ...(showMoviesTab ? [{
      id: 'public_movie',
      icon: <Film size={18} color={isMoviesPath(location.pathname) ? "hsl(var(--blue-cta))" : "#F2F2F2"} />,
      text: "Movies",
      path: `/${username}/movies`,
    }] : []),
    // Only add music tab if visibility is enabled
    ...(showMusicTab ? [{
      id: 'public_music',
      icon: <MusicNote fill={isMusicPath(location.pathname) ? "hsl(var(--blue-cta))" : "#F2F2F2"} />,
      text: "Music",
      path: `/${username}/music`,
    }] : []),
    // Only add books tab if visibility is enabled
    ...(showBooksTab ? [{
      id: 'public_books',
      icon: <BookOpen size={18} color={isBooksPath(location.pathname) ? "hsl(var(--blue-cta))" : "#F2F2F2"} />,
      text: "Books",
      path: `/${username}/books`,
    }] : []),
    // Only add games tab if visibility is enabled
    ...(showGamesTab ? [{
      id: 'public_games',
      icon: <Gamepad2 size={18} color={isGamesPath(location.pathname) ? "hsl(var(--blue-cta))" : "#F2F2F2"} />,
      text: "Games",
      path: `/${username}/games`,
    }] : []),
  ];

  // Filter based on user's pinned tabs preference if defined, otherwise show first 5 enabled ones
  const pinnedTabs = accountData?.pinned_nav_tabs;
  let finalNavItems = navItems;

  if (pinnedTabs && Array.isArray(pinnedTabs) && pinnedTabs.length > 0) {
    // Keep only the tabs that are pinned, respecting their order or just filtering existing array
    finalNavItems = navItems.filter(item => pinnedTabs.includes(item.id));
  }
  
  // Enforce Max 5 limit
  finalNavItems = finalNavItems.slice(0, 5);



  return (
    <div className="fixed bottom-0 md:bottom-2 md:rounded-lg z-50 w-full md:w-[33%]  md:translate-x-[102%]  bg-[#2a2a2a] text-white flex md:flex-row md:justify-center md:items-center justify-center p-1  shadow-md">
      <div className="flex mx-[1.5rem] md:border-0 flex-row justify-around w-full">
        {finalNavItems.map((item, index) => {
          // Check if current path matches the nav item path
          const isActive = isPathMatch(location.pathname, item.path) ||
            (item.path.includes('/places') && isPlacesPath(location.pathname)) ||
            (item.path.includes('/music') && isMusicPath(location.pathname)) ||
            (item.path.includes('/movies') && isMoviesPath(location.pathname)) ||
            (item.path.includes('/books') && isBooksPath(location.pathname)) ||
            (item.path.includes('/games') && isGamesPath(location.pathname)) ||
            (item.path.includes('/guides') && isGuidesPath(location.pathname));

          return (
            <NavButton
              type="public"
              key={index}
              icon={item.icon}
              text={item.text}
              isActive={isActive}
              onClickHandler={() => navigate(item.path)}
            />
          );
        })}
      </div>
    </div>
  );
});

export default PublicNav;
