import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import MenuIcon from "../assets/icons/MenuIcon";
import CrossIcon from "../assets/icons/CrossIcon";
import Home from "../assets/icons/Home";
import SettingsIcon from "../assets/icons/SettingsIcon";
import DirectionBoard from "../assets/icons/DirectionBoard";
import TravelGuideIcon from "../assets/icons/TravelGuideIcon";
import Profile from "../assets/icons/Profile";
import Analytics from "../assets/icons/Analytics";
import MusicNote from "../assets/icons/MusicNote";
import Button from "./ui/Button";
import { Film, BookOpen } from "lucide-react";
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
  const profilePicture = accountData?.profile_picture?.url || "https://api.dicebear.com/9.x/shapes/svg?seed=Leah";
  const accountName = accountData?.Account_Name || (loading ? t("sidebar.loading") : "");
  const email = data?.usersPermissionsUser?.email || "";

  return (
    <div
      className={`dashboard-theme ${isOpen ? "w-64 min-w-[256px]" : "w-16 min-w-[64px]"
        } h-screen bg-dashboard-sidebar font-poppins text-dashboard transition-all duration-300 flex flex-col flex-shrink-0 fixed left-0 top-0 z-40`}
    >
      {/* Fixed Header - Logo and Toggle Button */}
      <div className={`flex w-full py-4 flex-shrink-0 min-h-[72px] ${isOpen ? "items-center justify-between px-3 gap-2" : "flex-col items-center justify-center gap-2 px-4"}`}>
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
            {/* Toggle Button - Fixed position */}
            <div className="flex-shrink-0 w-[24px] h-[24px] flex items-center justify-center">
              <Button
                startIcon={<CrossIcon stroke="var(--dash-accent)" />}
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
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
          Icon={({ fill }: any) => <Film size={18} color={fill ?? 'var(--dash-icon-primary)'} fill="none" />}
          title={"Movies"}
          to="/recommendations/movies"
        />
        {/* Books */}
        <SidebarItem
          isOpen={isOpen}
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
          Icon={({ fill }: any) => <BookOpen size={18} color={fill ?? 'var(--dash-icon-primary)'} fill="none" />}
          title={"Books"}
          to="/recommendations/books"
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
          className={`flex items-center bg-dashboard-muted px-2 py-2 rounded-lg w-full cursor-pointer hover:bg-dashboard-sidebar transition-colors duration-200 ${isOpen ? "justify-start" : "justify-center gap-2"
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
        className={`relative flex items-center gap-4 px-4 py-3 rounded-lg transition-all dt-interactive ${isOpen && "mx-3"
          } hover:bg-dashboard-muted`}
        {...(!isOpen ? { "data-tooltip-id": title } : {})}
      >
        <motion.div
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
      className={`relative flex items-center gap-4 px-4 py-3 rounded-lg transition-all dt-interactive w-full ${isActive
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
