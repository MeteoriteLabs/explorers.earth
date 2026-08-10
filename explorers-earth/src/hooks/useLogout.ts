import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import useAuthStore from "../store/store";

/**
 * Shared logout flow used by the header and the sidebar account menu.
 * Clears all auth/session state (storage, cookies), redirects to /login,
 * and shows a confirmation toast. Single source of truth so the two entry
 * points can never drift.
 */
export const useLogout = () => {
  const { logout } = useAuthStore();
  const navigate = useNavigate();
  const { t } = useTranslation();

  return async () => {
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
};
