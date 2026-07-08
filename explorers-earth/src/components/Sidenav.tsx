import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import MenuIcon from "../assets/icons/MenuIcon";
import Home from "../assets/icons/Home";
import SettingsIcon from "../assets/icons/SettingsIcon";
import DirectionBoard from "../assets/icons/DirectionBoard";
import TravelGuideIcon from "../assets/icons/TravelGuideIcon";
import Profile from "../assets/icons/Profile";
import Analytics from "../assets/icons/Analytics";
import MusicNote from "../assets/icons/MusicNote";
import Button from "./ui/Button";
const MovieIcon = ({ fill = "currentColor" }: { fill?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width="20"
    height="20"
  >
    <path
      fill={fill}
      d="M2 3.993A1 1 0 0 1 2.992 3h18.016c.548 0 .992.445.992.993v16.014a1 1 0 0 1-.992.993H2.992A.993.993 0 0 1 2 20.007zM4 5v2h2V5zm14 0v2h2V5zM4 9v2h2V9zm14 0v2h2V9zM4 13v2h2v-2zm14 0v2h2v-2zM4 17v2h2v-2zm14 0v2h2v-2z"
    />
  </svg>
);

const BookIcon = ({ fill = "currentColor" }: { fill?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width="20"
    height="20"
  >
    <path
      fill={fill}
      d="M21 21h-8V6a3 3 0 0 1 3-3h5a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1m-10 0H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a3 3 0 0 1 3 3zm0 0h2v2h-2z"
    />
  </svg>
);

const GameIcon = ({ fill = "currentColor" }: { fill?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width="20"
    height="20"
  >
    <path
      fill={fill}
      d="M17 4a6 6 0 0 1 6 6v4a6 6 0 0 1-6 6H7a6 6 0 0 1-6-6v-4a6 6 0 0 1 6-6zm-7 5H8v2H6v2h1.999L8 15h2l-.001-2H12v-2h-2zm8 4h-2v2h2zm-2-4h-2v2h2z"
    />
  </svg>
);

const AppIcon = ({ fill = "currentColor" }: { fill?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width="20"
    height="20"
  >
    <path
      fill={fill}
      d="M17 2H7c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-5 18c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm5.2-3H6.8V6h10.4v11z"
    />
  </svg>
);

const ProductIcon = ({ fill = "currentColor" }: { fill?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width="20"
    height="20"
  >
    <path
      fill={fill}
      d="M19 6h-2c0-2.76-2.24-5-5-5S7 3.24 7 6H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-3c1.66 0 3 1.34 3 3H9c0-1.66 1.34-3 3-3zm7 17H5V8h14v12zm-7-8c-1.66 0-3-1.34-3-3H7c0 2.76 2.24 5 5 5s5-2.24 5-5h-2c0 1.66-1.34 3-3 3z"
    />
  </svg>
);


const PeopleIcon = ({ fill = "currentColor" }: { fill?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width="20"
    height="20"
  >
    <path
      fill={fill}
      d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"
    />
  </svg>
);

import SunIcon from "../assets/icons/SunIcon";
import MoonIcon from "../assets/icons/MoonIcon";
import SwitchButton from "./ui/SwitchButton";
import useAuthStore from "../store/store";
import { gql, useQuery } from "@apollo/client";
import LogoutIcon from "../assets/icons/LogoutIcon";
import { toast } from "sonner";
import { Tooltip } from "react-tooltip";
import { motion } from "framer-motion";
import { useDashboardTheme } from "../contexts/DashboardThemeContext";
import { IMAGE_CONFIG } from "../config";

const accountQuery = gql`
  query account($documentId: ID!) {
    usersPermissionsUser(documentId: $documentId) {
      accounts {
        Account_Name
        profile_picture {
          url
        }
        localtunes_integrated
      }
      email
    }
  }
`;

const Sidebar = () => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(true);
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [showMenu, setShowMenu] = useState<boolean>(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { theme, toggleTheme } = useDashboardTheme();

  const { data, loading } = useQuery(accountQuery, {
    variables: {
      documentId: user?.documentId,
    },
    skip: !user?.documentId,
  });

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(prev => {
          if (prev) return false;
          return prev;
        });
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Set CSS variable for sidebar width to help with button positioning
  // Use useLayoutEffect for immediate synchronous execution before paint
  useLayoutEffect(() => {
    const sidebarWidth = isOpen ? '256px' : '64px';
    document.documentElement.style.setProperty('--sidebar-width', sidebarWidth);
    document.body.setAttribute('data-sidebar-open', isOpen.toString());

    return () => {
      document.documentElement.style.removeProperty('--sidebar-width');
      document.body.removeAttribute('data-sidebar-open');
    };
  }, [isOpen]);

  const handleLogout = async () => {
    logout();

    // Clear all explorers storage
    localStorage.removeItem("auth-storage");
    localStorage.removeItem("qrtoken");

    // Clear Local Tunes session
    localStorage.removeItem("localTunes_session");

    // Clear session storage (user credentials)
    sessionStorage.removeItem("explorers_user_credentials");

    // Clear all other possible storage
    localStorage.clear();
    sessionStorage.clear();

    // Clear all cookies
    document.cookie.split(";").forEach(function (c) {
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });

    navigate("/login");
    toast(t("toast.success.loggedOutSuccessfully"));
  };

  // Get account data with fallback for loading state
  const accountData = data?.usersPermissionsUser?.accounts?.[0];
  const profilePicture = accountData?.profile_picture?.url || IMAGE_CONFIG.defaultImages.profile;
  const accountName = accountData?.Account_Name || (loading ? t("sidebar.loading") : "");
  const email = data?.usersPermissionsUser?.email || "";

  return (
    <div
      className={`dashboard-theme ${isOpen ? "w-64 min-w-[256px]" : "w-16 min-w-[64px]"
        } h-screen bg-dashboard-sidebar font-poppins text-dashboard transition-all duration-300 flex flex-col flex-shrink-0 fixed left-0 top-0 z-40`}
    >
      {/* Fixed Header - Logo and Toggle Button */}
      <div className={`flex w-full py-4 flex-shrink-0 min-h-[72px] ${isOpen ? "items-center justify-start pl-[20px] pr-3 gap-3" : "flex-col items-center justify-center gap-2 px-4"}`}>
        {isOpen ? (
          <>
            {/* SVG Text - explorers.earth */}
            <div className="flex-shrink-0 flex-1 min-w-0">
              <img
                src="/logo.svg"
                alt="explorers.earth"
                className="object-contain max-h-[40px] w-auto"
                style={{
                  filter: "brightness(0) invert(1)",
                }}
              />
            </div>
            {/* Toggle Button - On immediate right of logo */}
            <div className="flex-shrink-0 w-[24px] h-[24px] flex items-center justify-center">
              <Button
                startIcon={<MenuIcon stroke="var(--dash-accent)" />}
                onClickHandler={() => setIsOpen(!isOpen)}
                variant="icon"
                size="none"
              />
            </div>
          </>
        ) : (
          <>
            {/* Toggle Button at top */}
            <div className="flex-shrink-0 w-[24px] h-[24px] flex items-center justify-center">
              <Button
                startIcon={<MenuIcon />}
                onClickHandler={() => setIsOpen(!isOpen)}
                variant="icon"
                size="none"
              />
            </div>
          </>
        )}
      </div>

      {/* Sidebar Menu */}

      <nav className="flex flex-col gap-2 mt-4 flex-shrink-0 w-full px-2">
        <SidebarItem
          isOpen={isOpen}
          Icon={Home}
          title={t("sidebar.home")}
          to="/home"
        />

        <SidebarItem
          isOpen={isOpen}
          Icon={Profile}
          title={t("sidebar.profile")}
          to="/profile"
        />
        <SidebarItem
          isOpen={isOpen}
          Icon={DirectionBoard}
          title={t("sidebar.places")}
          to="/recommendations"
        />
        <SidebarItem
          isOpen={isOpen}
          Icon={TravelGuideIcon}
          title={"Guides"}
          to="/guides"
        />
        {/* Movies & Shows */}
        <SidebarItem
          isOpen={isOpen}
          Icon={MovieIcon}
          title={"Movies"}
          to="/recommendations/movies"
        />
        {/* Books */}
        <SidebarItem
          isOpen={isOpen}
          Icon={BookIcon}
          title={"Books"}
          to="/recommendations/books"
        />
        {/* Games */}
        <SidebarItem
          isOpen={isOpen}
          Icon={GameIcon}
          title={"Games"}
          to="/recommendations/games"
        />
        {/* Apps & Tools */}
        <SidebarItem
          isOpen={isOpen}
          Icon={AppIcon}
          title={"Apps & Tools"}
          to="/recommendations/apps"
        />
        {/* Products */}
        <SidebarItem
          isOpen={isOpen}
          Icon={ProductIcon}
          title={"Products"}
          to="/recommendations/products"
        />
        {/* People */}
        <SidebarItem
          isOpen={isOpen}
          Icon={PeopleIcon}
          title={"People"}
          to="/recommendations/people"
        />
        {/* Music button - show for all users */}
        <SidebarItem
          isOpen={isOpen}
          Icon={MusicNote}
          title={t('sidebar.music')}
          to="/music"
        />
        <SidebarItem
          isOpen={isOpen}
          Icon={Analytics}
          title={t('sidebar.analytics')}
          to="/analytics"
        />
        <SidebarItem
          isOpen={isOpen}
          Icon={SettingsIcon}
          title={t("sidebar.settings")}
          to="/settings"
        />
      </nav>

      {/* Profile Section */}
      <div className="flex justify-end flex-col flex-1 p-2 relative">
        {/* Theme Toggle - Above Username Section */}
        {isOpen && (
          <div className="flex items-center justify-between px-2 mb-3">
            <div className="flex items-center gap-2.5">
              {theme === 'dark' ? (
                <SunIcon fill="var(--dash-icon-primary)" />
              ) : (
                <MoonIcon fill="var(--dash-icon-primary)" />
              )}
              <span className="text-sm font-medium text-dashboard">
                {theme === 'dark' ? t("sidebar.lightMode") : t("sidebar.darkMode")}
              </span>
            </div>
            <SwitchButton
              isChecked={theme === 'dark'}
              onChange={toggleTheme}
              variant="blue"
            />
          </div>
        )}
        <div
          className={`flex items-center bg-dashboard-muted rounded-lg w-full cursor-pointer hover:bg-dashboard-sidebar transition-colors duration-200 ${isOpen ? "px-2 py-2 justify-start" : "p-1 justify-center"
            }`}
          onClick={() => setShowMenu(!showMenu)}
        >
          {isOpen ? (
            <>
              <img
                src={profilePicture}
                alt=""
                className="h-8 w-8 rounded-lg"
              />
              <div className="flex relative flex-col mx-2 text-left">
                <h2 className="dt-label leading-tight">
                  {accountName}
                </h2>
                <h3 className="text-[0.65rem] truncate w-40 text-dashboard-light">
                  {email}
                </h3>
              </div>
            </>
          ) : (
            <img
              src={profilePicture}
              alt=""
              className="h-10 w-10 rounded-full hover:opacity-80 transition-opacity mx-auto"
              data-tooltip-id="profile-image"
            />
          )}
        </div>

        {/* Tooltips for collapsed profile section */}
        {!isOpen && (
          <Tooltip
            style={{
              fontSize: "12px",
              maxWidth: "200px",
              whiteSpace: "nowrap",
              zIndex: 1000,
            }}
            id="profile-image"
            place="right"
            className="!bg-dashboard-muted !text-dashboard !border !border-dashboard !rounded-lg !px-2 !py-1"
          >
            {t("sidebar.clickToOpenMenu")}
          </Tooltip>
        )}

        {/* Dropdown Menu */}
        {showMenu && (
          <motion.div
            ref={menuRef}
            className={`absolute bg-dashboard-muted p-2 border-b border-dashboard-sidebar text-dashboard rounded-lg shadow-dashboard-elevated z-50 ${isOpen ? "bottom-16 right-2" : "bottom-16 left-16"
              }`}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
          >
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 py-2.5 px-3 text-sm text-dashboard bg-dashboard-muted hover:bg-dashboard-sidebar hover:text-dashboard rounded-lg transition-all duration-200 whitespace-nowrap w-full"
            >
              <LogoutIcon size="4" />
              <span className="font-medium">{t("sidebar.logout")}</span>
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
};

// Sidebar Item Component with Active State and Tooltip
const SidebarItem = ({
  Icon,
  title,
  to,
  isOpen,
  isExternal = false,
}: {
  Icon: React.ComponentType<{ size?: string; fill?: string }>;
  title: string;
  to: string;
  isOpen: boolean;
  isExternal?: boolean;
}) => {
  const location = useLocation();
  const isActive = !isExternal && location.pathname.startsWith(to);

  const handleClick = (e: React.MouseEvent) => {
    if (isExternal) {
      e.preventDefault();
      window.open(to, '_blank');
    }
  };

  if (isExternal) {
    return (
      <a
        href={to}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        className={`relative flex items-center rounded-lg transition-all dt-interactive ${isOpen ? "gap-4 px-4 py-3 mx-3" : "justify-center py-3 w-full"
          } hover:bg-dashboard-muted`}
        {...(!isOpen ? { "data-tooltip-id": title } : {})}
      >
        <motion.div
          className="flex-shrink-0 w-6 h-6 flex items-center justify-center"
          whileHover={{ scale: 1.3 }}
          transition={{ type: "spring", stiffness: 120 }}
        >
          <Icon />
        </motion.div>
        {isOpen && <span className="text-sm font-medium">{title}</span>}
        {!isOpen && (
          <Tooltip
            style={{
              fontSize: "12px",
              maxWidth: "200px",
              whiteSpace: "nowrap",
              zIndex: 1000
            }}
            id={title}
            place="right"
            className="!bg-gray-800 !text-white !border !border-gray-600 !rounded-lg !px-2 !py-1"
          >
            {title}
          </Tooltip>
        )}
      </a>
    );
  }

  return (
    <Link
      to={to}
      className={`relative flex items-center rounded-lg transition-all dt-interactive w-full ${isOpen ? "gap-4 px-4 py-3" : "justify-center py-3"
        } ${isActive
          ? "bg-dashboard-muted text-dashboard-accent"
          : "hover:bg-dashboard-muted"
        }`}
      {...(!isOpen ? { "data-tooltip-id": title } : {})}
    >
      {/* Icon - Fixed width container */}
      <motion.div
        className="flex-shrink-0 w-6 h-6 flex items-center justify-center"
        whileHover={{ scale: 1.3 }}
        transition={{ type: "spring", stiffness: 120 }}
      >
        <Icon />
      </motion.div>
      {/* Text - Truncate if needed, with fixed width when open */}
      {isOpen && (
        <span
          className="text-sm font-medium overflow-hidden text-ellipsis block"
          style={{ maxWidth: "160px" }}
        >
          {title}
        </span>
      )}
      {!isOpen && (
        <Tooltip
          style={{
            fontSize: "12px",
            maxWidth: "200px",
            whiteSpace: "nowrap",
            zIndex: 1000,
          }}
          id={title}
          place="right"
          className="!bg-gray-800 !text-white !border !border-gray-600 !rounded-lg !px-2 !py-1"
        >
          {title}
        </Tooltip>
      )}
    </Link>
  );
};

export default Sidebar;
