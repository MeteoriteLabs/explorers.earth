import React, { useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Home from "../assets/icons/Home";
import SettingsIcon from "../assets/icons/SettingsIcon";
import DirectionBoard from "../assets/icons/DirectionBoard";
import TravelGuideIcon from "../assets/icons/TravelGuideIcon";
import Profile from "../assets/icons/Profile";
import Analytics from "../assets/icons/Analytics";
import MusicNote from "../assets/icons/MusicNote";
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

import { useDashboardTheme } from "../contexts/DashboardThemeContext";
import { Tooltip } from "react-tooltip";
import { motion } from "framer-motion";

const Sidebar = () => {
  const { t } = useTranslation();
  const { theme, isSidebarOpen: isOpen } = useDashboardTheme();

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

  return (
    <div
      className={`dashboard-theme ${isOpen ? "w-64 min-w-[256px]" : "w-16 min-w-[64px]"
        } bg-dashboard-sidebar font-poppins text-dashboard transition-all duration-300 flex flex-col flex-shrink-0 fixed left-2 top-2 bottom-2 z-40 rounded-2xl`}
    >
      {/* Fixed Header - Logo and Toggle Button */}
      <div className={`flex w-full py-2.5 flex-shrink-0 min-h-[56px] ${isOpen ? "items-center justify-start pl-[20px] pr-3 gap-3" : "flex-col items-center justify-center gap-2 px-4"}`}>
        {isOpen ? (
          <div className="flex-shrink-0 flex-1 min-w-0">
            <img
              src="/logo.svg"
              alt="explorers.earth"
              className="object-contain max-h-[40px] w-auto"
              style={{
                filter: theme === 'dark' ? "brightness(0) invert(1)" : "brightness(0)",
              }}
            />
          </div>
        ) : null}
      </div>

      {/* Sidebar Menu */}

      <nav className="flex flex-col gap-2 mt-1.5 flex-1 overflow-y-auto scrollbar-hide w-full px-2">
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
  const isActive = !isExternal && (
    to === "/recommendations"
      ? (location.pathname === "/recommendations" || location.pathname === "/recommendations/" || location.pathname.startsWith("/recommendations/places"))
      : location.pathname.startsWith(to)
  );

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
          <Icon fill="currentColor" />
        </motion.div>
        {isOpen && <span className="text-sm font-medium">{title}</span>}
        {!isOpen && createPortal(
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
          </Tooltip>,
          document.body
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
        <Icon fill="currentColor" />
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
      {!isOpen && createPortal(
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
        </Tooltip>,
        document.body
      )}
    </Link>
  );
};

export default Sidebar;
