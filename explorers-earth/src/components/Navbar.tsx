import { memo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Home from "../assets/icons/Home";
import Profile from "../assets/icons/Profile";
import SettingsIcon from "../assets/icons/SettingsIcon";
import MusicNote from "../assets/icons/MusicNote";
import NavButton from "./ui/NavButton";
import DirectionBoard from "../assets/icons/DirectionBoard";
import Analytics from "../assets/icons/Analytics";
import TravelGuideIcon from "../assets/icons/TravelGuideIcon";

const navItems = [
  { id: "home", icon: Home, text: "Home", path: "/home" },
  {
    id: "recommendations",
    icon: DirectionBoard,
    text: "Recommendation",
    path: "/recommendations",
  },
  {
    id: "guides",
    icon: TravelGuideIcon,
    text: "Guides",
    path: "/guides",
  },
  {
    id: "analytics",
    icon: Analytics,
    text: "Analytics",
    path: "/analytics",
  },
  {
    id: "profile",
    icon: Profile,
    text: "Profile",
    path: "/profile",
  },
  {
    id: "settings",
    icon: SettingsIcon,
    text: "Settings",
    path: "/settings",
  },
];

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Helper function to normalize paths by removing trailing slashes
  const normalizePath = (path: string) => {
    return path.endsWith("/") && path !== "/" ? path.slice(0, -1) : path;
  };

  // Helper function to check if paths match (ignoring trailing slashes)
  const isPathMatch = (currentPath: string, targetPath: string) => {
    const normalizedCurrent = normalizePath(currentPath);
    const normalizedTarget = normalizePath(targetPath);
    return normalizedCurrent === normalizedTarget;
  };

  // Helper function to render Home icon with active color
  const renderHomeIcon = (isActive: boolean) => {
    return (
      <svg
        width="26"
        height="22"
        viewBox="0 0 26 22"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M10.5 22V14.5H15.5V22H21.75V12H25.5L13 0.75L0.5 12H4.25V22H10.5Z"
          fill={isActive ? "var(--dash-accent)" : "#F2F2F2"}
        />
      </svg>
    );
  };

  // Create dynamic nav items including Music for all users
  // Insert Music before Settings
  const allNavItems = [
    ...navItems.slice(0, 3), // Home, Recommendations, Profile
    // Add Music button for all users
    { 
      id: "music", 
      icon: MusicNote, 
      text: "Music", 
      path: "/music"
    },
    ...navItems.slice(3), // Settings
  ];

  return (
    <div className="fixed bottom-0 md:bottom-2 md:rounded-lg z-50 w-full md:w-[33%] bg-dashboard-sidebar backdrop-blur-lg text-dashboard flex md:flex-row md:justify-center md:items-center justify-center py-2 px-2 md:p-1 shadow-lg border-t md:border-t-0 border-dashboard/50">
      <div className="flex flex-row justify-between gap-1 w-full max-w-md mx-auto">
        {allNavItems.map((item) => {
          const isActive = !(item as any).isExternal && isPathMatch(location.pathname, item.path);

          let iconElement;
          if (item.id === "home") {
            iconElement = renderHomeIcon(isActive);
          } else if (item.id === "recommendations") {
            iconElement = (
              <DirectionBoard
                fill={isActive ? "var(--dash-accent)" : "#F2F2F2"}
              />
            );
          } else if (item.id === "analytics") {
            iconElement = (
              <Analytics fill={isActive ? "var(--dash-accent)" : "#F2F2F2"} />
            );
          } else if (item.id === "guides") {
            iconElement = (
              <TravelGuideIcon
                fill={isActive ? "var(--dash-accent)" : "#F2F2F2"}
              />
            );
          } else if (item.id === "profile") {
            iconElement = (
              <Profile fill={isActive ? "var(--dash-accent)" : "#F2F2F2"} />
            );
          } else if (item.id === "settings") {
            iconElement = <SettingsIcon fill={isActive ? "var(--dash-accent)" : "#F2F2F2"} />;
          } else if (item.id === "music") {
            iconElement = <MusicNote fill={isActive ? "var(--dash-accent)" : "#F2F2F2"} />;
          }

          const handleClick = () => {
            if ((item as any).isExternal) {
              window.open(item.path, '_blank');
            } else {
              navigate(item.path);
            }
          };

          return (
            <NavButton
              key={item.id}
              icon={iconElement!}
              text={item.text}
              isActive={isActive}
              onClickHandler={handleClick}
              type="public"
            />
          );
        })}
      </div>
    </div>
  );
};

export default memo(Navbar);
