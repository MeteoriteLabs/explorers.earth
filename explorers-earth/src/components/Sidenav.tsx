import React, { useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Home from "../assets/icons/Home";
import SettingsIcon from "../assets/icons/SettingsIcon";
import DirectionBoard from "../assets/icons/DirectionBoard";
import Profile from "../assets/icons/Profile";
import Analytics from "../assets/icons/Analytics";

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
          title={"Recommendations"}
          to="/recommendations"
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
