import { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import SEO from "../components/SEO";
import { createCanonicalUrl } from "../utils/getCurrentDomain";

const TUNES_API = import.meta.env.VITE_LOCAL_TUNES_API_URL || "http://localhost:5000";

type Status = "loading" | "success" | "error";

const ReactivateConfirm = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const hasVerified = useRef(false);

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      setErrorMessage(t("reactivateAccount.confirmError"));
      setStatus("error");
      return;
    }

    if (hasVerified.current) {
      return;
    }
    hasVerified.current = true;

    const verify = async () => {
      try {
        const response = await fetch(
          `${TUNES_API}/api/user/reactivate?token=${encodeURIComponent(token)}`
        );
        const data = await response.json();

        if (response.ok && data.success) {
          setStatus("success");
        } else {
          setErrorMessage(data.error || t("reactivateAccount.confirmError"));
          setStatus("error");
        }
      } catch {
        setErrorMessage(t("toast.error.networkError"));
        setStatus("error");
      }
    };

    verify();
  }, [searchParams, t]);

  return (
    <>
      <SEO
        title="Account Reactivated – explorers"
        description="Your explorers account has been successfully reactivated."
        canonical={createCanonicalUrl("/reactivate-confirm")}
        noIndex={true}
      />

      <div className="dashboard-theme dashboard-theme-dark min-h-screen flex font-poppins items-center justify-center bg-black text-white px-4 sm:px-6 py-10">
        <div className="relative w-full max-w-md mx-auto">
          <motion.div
            className="backdrop-blur-sm bg-dashboard-sidebar border border-dashboard p-8 rounded-2xl shadow-dashboard-elevated text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* ── Loading ── */}
            {status === "loading" && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="flex justify-center mb-4">
                  <div className="w-12 h-12 border-4 border-dashboard-accent border-t-transparent rounded-full animate-spin" />
                </div>
                <p className="text-gray-400 text-sm">{t("toast.info.verifying")}</p>
              </motion.div>
            )}

            {/* ── Success ── */}
            {status === "success" && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
              >
                <motion.div
                  className="flex justify-center mb-4"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
                >
                  <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center">
                    <svg
                      className="w-7 h-7 text-green-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                </motion.div>

                <h1 className="text-xl sm:text-2xl font-bold text-white mb-3">
                  {t("reactivateAccount.confirmTitle")}
                </h1>
                <p className="text-sm text-gray-400 mb-6">
                  {t("reactivateAccount.confirmDescription")}
                </p>

                <motion.button
                  id="reactivate-go-to-login-btn"
                  type="button"
                  onClick={() => navigate("/login")}
                  className="w-full py-2.5 px-4 rounded-xl font-medium shadow-dashboard-elevated transition duration-200 text-sm bg-dashboard-accent hover:bg-dashboard-accent/90 text-dashboard"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {t("reactivateAccount.goToLogin")}
                </motion.button>
              </motion.div>
            )}

            {/* ── Error ── */}
            {status === "error" && (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
              >
                <motion.div
                  className="flex justify-center mb-4"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
                >
                  <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center">
                    <svg
                      className="w-7 h-7 text-red-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                </motion.div>

                <h1 className="text-xl sm:text-2xl font-bold text-white mb-3">
                  {t("reactivateAccount.confirmError")}
                </h1>
                <p className="text-sm text-red-400 mb-6">{errorMessage}</p>

                <motion.button
                  id="reactivate-try-again-btn"
                  type="button"
                  onClick={() => navigate("/reactivate")}
                  className="w-full py-2.5 px-4 rounded-xl font-medium shadow-dashboard-elevated transition duration-200 text-sm bg-dashboard-accent hover:bg-dashboard-accent/90 text-dashboard"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {t("reactivateAccount.tryAgain")}
                </motion.button>

                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="mt-3 text-sm text-dashboard-accent hover:underline"
                >
                  {t("reactivateAccount.backToLogin")}
                </button>
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default ReactivateConfirm;
