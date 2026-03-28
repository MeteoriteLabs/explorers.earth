import { memo, useEffect, useRef, useState } from "react";
import useAuthStore from "../store/store";
import Button from "./ui/Button";
import { useNavigate, useLocation } from "react-router-dom";
import useDeviceDetection from "../hooks/useDeviceDetection";
import Down from "../assets/icons/Down";
import { gql, useQuery } from "@apollo/client";
import { toast } from "sonner";
import MenuIcon from "../assets/icons/MenuIcon";
import CrossIcon from "../assets/icons/CrossIcon";
import { useTranslation } from "react-i18next";
import SettingsIcon from "../assets/icons/SettingsIcon";
import LogoutIcon from "../assets/icons/LogoutIcon";
import SunIcon from "../assets/icons/SunIcon";
import MoonIcon from "../assets/icons/MoonIcon";
import SwitchButton from "./ui/SwitchButton";
import { motion, AnimatePresence } from "framer-motion";
import { isManualAuthEnabled } from "../config/featureFlags";
import { useDashboardTheme } from "../contexts/DashboardThemeContext";

const getCurrentAccountDataQuery = gql`
  query user($documentId: ID!) {
    usersPermissionsUser(documentId: $documentId) {
      accounts {
        profile_picture {
          url
        }
        Account_Name
        documentId
      }
    }
  }
`;

const recommendationCategories = [
  { id: 'places', name: 'Places', path: '/recommendations/places' },
  { id: 'movies', name: 'Movies & Shows', path: '/recommendations/movies' },
  { id: 'books', name: 'Books', path: '/recommendations/books' },
  { id: 'games', name: 'Games', path: '/recommendations/games' },
  { id: 'music', name: 'Music', path: '/music' },
];

const Header = memo(() => {
  const [showMenu, setShowMenu] = useState<boolean>(false);
  const [showMobileMenu, setShowMobileMenu] = useState<boolean>(false);
  const { isAuthenticated, user, logout } = useAuthStore();
  const { data } = useQuery(getCurrentAccountDataQuery, {
    variables: { documentId: user?.documentId },
    skip: !user?.documentId,
  });
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const { theme, toggleTheme } = useDashboardTheme();
  const location = useLocation();
  const { isDesktop } = useDeviceDetection();
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const categoryMenuRef = useRef<HTMLDivElement>(null);

  const currentCategory = recommendationCategories.find(cat => {
    // Exact match for /recommendations as Places
    if (cat.id === 'places' && location.pathname === '/recommendations') return true;
    // Prefix match for all categories
    return location.pathname.startsWith(cat.path);
  });

  const isRecommendationPage = !!currentCategory;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setShowMobileMenu(false);
      }
      if (categoryMenuRef.current && !categoryMenuRef.current.contains(event.target as Node)) {
        setShowCategoryMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  const accountData = data?.usersPermissionsUser?.accounts;

  return (
    <div className="bg-dashboard-sidebar w-full z-[100] md:px-6 p-4 fixed top-0 left-0 right-0 md:relative md:border-b md:border-dashboard">
      <div className="flex flex-row rounded-xl items-center justify-between md:p-[10px]">
        <div className="logo-container">
          {!isDesktop && isRecommendationPage ? (
            <div className="relative" ref={categoryMenuRef}>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowCategoryMenu(!showCategoryMenu)}
                className="flex items-center gap-2 text-white font-bold text-lg bg-dashboard-muted px-4 py-2 rounded-xl border border-dashboard/50"
              >
                <span className="truncate max-w-[150px]">{currentCategory.name}</span>
                <motion.div
                  animate={{ rotate: showCategoryMenu ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Down stroke="white" />
                </motion.div>
              </motion.button>

              <AnimatePresence>
                {showCategoryMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute top-14 left-0 w-56 bg-dashboard-sidebar rounded-xl shadow-dashboard-elevated border border-dashboard overflow-hidden z-[110]"
                  >
                    <div className="py-2">
                      {recommendationCategories.map((cat) => (
                        <button
                          key={cat.id}
                          className={`w-full text-left px-4 py-3 text-sm font-medium transition-colors ${
                            (location.pathname.startsWith(cat.path) || (cat.id === 'places' && location.pathname === '/recommendations'))
                              ? "bg-dashboard-accent/20 text-dashboard-accent"
                              : "text-white hover:bg-dashboard-muted"
                          }`}
                          onClick={() => {
                            navigate(cat.path);
                            setShowCategoryMenu(false);
                          }}
                        >
                          {cat.name}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <img
              src="/logo.svg"
              alt="explorers.earth"
              className={`object-contain cursor-pointer header-logo ${theme === 'dark' ? 'header-logo-dark' : 'header-logo-light'}`}
              onClick={() => navigate(isAuthenticated ? "/home" : "/")}
              style={{
                height: "48px",
                width: "auto",
              }}
            />
          )}
        </div>

        <div
          className="md:hidden"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.nativeEvent.stopImmediatePropagation();
            setShowMobileMenu((prev) => !prev);
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          {showMobileMenu ? (
            <CrossIcon stroke="white" />
          ) : (
            <MenuIcon stroke="white" />
          )}
        </div>

        <div className="hidden md:flex flex-row items-center gap-4">
          {isAuthenticated ? (
            <div className="relative md:pr-6" ref={menuRef}>
              <img
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.nativeEvent.stopImmediatePropagation();
                  setShowMenu((prev) => !prev);
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className="h-12 w-12 cursor-pointer rounded-full"
                src={
                  accountData?.[0]?.profile_picture?.url ||
                  "https://api.dicebear.com/9.x/shapes/svg?seed=Leah"
                }
                alt="profile"
              />

              <AnimatePresence>
                {showMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="absolute top-16 right-0 w-56 bg-dashboard-sidebar rounded-xl shadow-dashboard-elevated border border-dashboard overflow-hidden z-[100]"
                  >
                    {/* User Info Section */}
                    <div className="px-4 py-3 bg-dashboard-muted border-b border-dashboard">
                      <div className="flex items-center gap-3">
                        <img
                          className="h-10 w-10 rounded-full ring-2 ring-dashboard-accent"
                          src={
                            accountData?.[0]?.profile_picture?.url ||
                            "https://api.dicebear.com/9.x/shapes/svg?seed=Leah"
                          }
                          alt="profile"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">
                            {user?.username || accountData?.[0]?.Account_Name || "User"}
                          </p>
                          <p className="text-xs text-[hsl(var(--text-light))]">Account Settings</p>
                        </div>
                      </div>
                    </div>

                    {/* Menu Items */}
                    <div className="py-2">
                      {/* Theme Toggle */}
                      <div className="w-full flex items-center justify-between px-4 py-3">
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

                      <motion.button
                        whileHover={{ backgroundColor: "#374151" }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left text-[hsl(var(--text-light))] hover:text-white transition-colors"
                        onClick={() => {
                          navigate("/settings");
                          setShowMenu(false);
                        }}
                      >
                        <div className="w-5 h-5 text-[hsl(var(--muted-foreground))]">
                          <SettingsIcon fill="currentColor" />
                        </div>
                        <span className="font-medium">Settings</span>
                      </motion.button>

                      <motion.button
                        whileHover={{ backgroundColor: "#7f1d1d" }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left text-[hsl(var(--destructive))] hover:text-[hsl(var(--destructive))]/80 transition-colors"
                        onClick={() => {
                          handleLogout();
                          setShowMenu(false);
                        }}
                      >
                        <div className="w-5 h-5 text-[hsl(var(--destructive))]">
                          <LogoutIcon size="20" />
                        </div>
                        <span className="font-medium">Logout</span>
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <>
              {/* MANUAL AUTH DISABLED - Hide register button when OAuth-only mode */}
              <Button
                btnText={"Login"}
                variant="primary"
                type="button"
                size="xsmall"
                onClickHandler={() => navigate("/login")}
              />
              {isManualAuthEnabled() && (
                <Button
                  btnText={"Register"}
                  variant="primary"
                  type="button"
                  size="xsmall"
                  onClickHandler={() => navigate("/register")}
                />
              )}
            </>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showMobileMenu && (
          <motion.div
            ref={mobileMenuRef}
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="md:hidden absolute right-4 top-16 w-64 bg-dashboard-sidebar rounded-xl shadow-dashboard-elevated border border-dashboard overflow-hidden z-[100]"
          >
            {isAuthenticated ? (
              <>
                {/* User Info Section */}
                <div className="px-4 py-3 bg-dashboard-muted border-b border-dashboard">
                  <div className="flex items-center gap-3">
                    <img
                      className="h-10 w-10 rounded-full ring-2 ring-white"
                      src={
                        accountData?.[0]?.profile_picture?.url ||
                        "https://api.dicebear.com/9.x/shapes/svg?seed=Leah"
                      }
                      alt="profile"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {user?.username || accountData?.[0]?.Account_Name || "User"}
                      </p>
                      <p className="text-xs text-white">Account Settings</p>
                    </div>
                  </div>
                </div>

                {/* Menu Items */}
                <div className="py-2">
                  {/* Theme Toggle */}
                  <div className="w-full flex items-center justify-between px-4 py-3">
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

                  <motion.button
                    whileHover={{ backgroundColor: "hsl(var(--dash-muted))" }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-white hover:text-white transition-colors"
                    onClick={() => {
                      navigate("/settings");
                      setShowMobileMenu(false);
                    }}
                  >
                    <div className="w-5 h-5 text-white">
                      <SettingsIcon fill="currentColor" />
                    </div>
                    <span className="font-medium">Settings</span>
                  </motion.button>

                  <motion.button
                    whileHover={{ backgroundColor: "hsl(var(--dash-danger-hover))" }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-white hover:text-white transition-colors"
                    onClick={() => {
                      handleLogout();
                      setShowMobileMenu(false);
                    }}
                  >
                    <div className="w-5 h-5 text-white">
                      <LogoutIcon size="20" />
                    </div>
                    <span className="font-medium">Logout</span>
                  </motion.button>
                </div>
              </>
            ) : (
              <div className="p-4 space-y-3">
                {/* MANUAL AUTH DISABLED - Hide register button when OAuth-only mode */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full bg-[hsl(var(--dash-accent))] hover:bg-[hsl(var(--dash-accent))]/90 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                  onClick={() => {
                    navigate("/login");
                    setShowMobileMenu(false);
                  }}
                >
                  Login
                </motion.button>
                {isManualAuthEnabled() && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full border border-[hsl(var(--dash-accent))] text-[hsl(var(--dash-accent))] hover:bg-[hsl(var(--dash-accent))]/20 font-medium py-3 px-4 rounded-lg transition-colors"
                    onClick={() => {
                      navigate("/register");
                      setShowMobileMenu(false);
                    }}
                  >
                    Register
                  </motion.button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default Header;