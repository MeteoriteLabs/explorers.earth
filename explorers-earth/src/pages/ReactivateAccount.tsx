import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import SEO from "../components/SEO";
import { createCanonicalUrl } from "../utils/getCurrentDomain";

const TUNES_API = import.meta.env.VITE_LOCAL_TUNES_API_URL || "http://localhost:5000";

const ReactivateAccount = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [submitted, setSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);

  // Countdown timer
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (cooldown > 0) {
      timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldown]);

  const validationSchema = Yup.object({
    email: Yup.string()
      .email(t("auth.validations.email.invalidFormat"))
      .required(t("auth.validations.email.required")),
  });

  const handleSubmit = async (values: { email: string }) => {
    try {
      const response = await fetch(`${TUNES_API}/api/user/request-reactivation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: values.email.trim().toLowerCase() }),
      });

      if (response.ok) {
        setSubmittedEmail(values.email.trim().toLowerCase());
        setSubmitted(true);
        setCooldown(120); // 2 min cooldown before resend
      } else {
        toast.error(t("toast.error.somethingWentWrong"));
      }
    } catch {
      toast.error(t("toast.error.networkError"));
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    try {
      await fetch(`${TUNES_API}/api/user/request-reactivation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: submittedEmail }),
      });
      toast.success(t("reactivateAccount.emailSent"));
      setCooldown(120);
    } catch {
      toast.error(t("toast.error.networkError"));
    } finally {
      setResending(false);
    }
  };

  return (
    <>
      <SEO
        title="Reactivate Account – explorers"
        description="Reactivate your deactivated explorers account using your email address."
        canonical={createCanonicalUrl("/reactivate")}
        noIndex={true}
      />

      <div className="dashboard-theme min-h-screen flex font-poppins items-center justify-center bg-black text-white px-4 sm:px-6 py-10">
        <div className="relative w-full max-w-md mx-auto">
          <motion.div
            className="backdrop-blur-sm bg-dashboard-sidebar border border-dashboard p-6 sm:p-8 rounded-2xl shadow-dashboard-elevated text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Icon */}
            <motion.div
              className="flex justify-center mb-4"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
            >
              <div className="w-14 h-14 rounded-full bg-dashboard-accent/20 flex items-center justify-center">
                <svg
                  className="w-7 h-7 text-dashboard-accent"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
            </motion.div>

            <AnimatePresence mode="wait">
              {/* ── After submit: success state ── */}
              {submitted ? (
                <motion.div
                  key="sent"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.3 }}
                >
                  <h1 className="text-xl sm:text-2xl font-bold text-white mb-3">
                    {t("reactivateAccount.emailSent")}
                  </h1>
                  <p className="text-sm text-gray-400 mb-6">
                    {t("reactivateAccount.emailSentDescription")}
                  </p>

                  {/* Resend button */}
                  <motion.button
                    onClick={handleResend}
                    disabled={cooldown > 0 || resending}
                    className={`w-full py-2.5 px-4 rounded-xl font-medium shadow-dashboard-elevated transition duration-200 text-sm
                      ${cooldown > 0 || resending
                        ? "bg-dashboard-muted text-gray-400 cursor-not-allowed"
                        : "bg-dashboard-accent hover:bg-dashboard-accent/90 text-dashboard"
                      }`}
                    whileHover={cooldown === 0 && !resending ? { scale: 1.02 } : {}}
                    whileTap={cooldown === 0 && !resending ? { scale: 0.98 } : {}}
                  >
                    {resending
                      ? t("toast.info.sending")
                      : cooldown > 0
                      ? `${t("reactivateAccount.resendIn")} ${Math.floor(cooldown / 60)}:${(cooldown % 60).toString().padStart(2, "0")}`
                      : t("reactivateAccount.resendButton")}
                  </motion.button>

                  <button
                    type="button"
                    onClick={() => navigate("/login")}
                    className="mt-4 text-sm text-dashboard-accent hover:underline"
                  >
                    {t("reactivateAccount.backToLogin")}
                  </button>
                </motion.div>
              ) : (
                /* ── Initial form state ── */
                <motion.div
                  key="form"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.3 }}
                >
                  <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">
                    {t("reactivateAccount.title")}
                  </h1>
                  <p className="text-sm text-gray-400 mb-6">
                    {t("reactivateAccount.subtitle")}
                  </p>

                  <Formik
                    initialValues={{ email: "" }}
                    validationSchema={validationSchema}
                    onSubmit={handleSubmit}
                  >
                    {({ isSubmitting }) => (
                      <Form className="space-y-4 text-left">
                        <div>
                          <label htmlFor="reactivate-email" className="block text-sm font-medium text-white mb-1">
                            {t("auth.validations.forgotPassword.emailLabel")}
                          </label>
                          <Field
                            id="reactivate-email"
                            name="email"
                            type="email"
                            placeholder={t("reactivateAccount.emailPlaceholder")}
                            className="w-full px-3 py-2 border border-dashboard bg-dashboard-muted rounded-lg focus:outline-none focus:ring-2 focus:ring-dashboard-accent text-dashboard placeholder-dashboard-light"
                          />
                          <ErrorMessage
                            name="email"
                            component="div"
                            className="text-red-400 text-sm mt-1"
                          />
                        </div>

                        <motion.button
                          id="reactivate-submit-btn"
                          type="submit"
                          disabled={isSubmitting}
                          className="w-full py-2.5 px-4 rounded-xl font-medium shadow-dashboard-elevated transition duration-200 text-sm bg-dashboard-accent hover:bg-dashboard-accent/90 text-dashboard disabled:opacity-60 disabled:cursor-not-allowed"
                          whileHover={!isSubmitting ? { scale: 1.02 } : {}}
                          whileTap={!isSubmitting ? { scale: 0.98 } : {}}
                        >
                          {isSubmitting ? t("toast.info.sending") : t("reactivateAccount.sendButton")}
                        </motion.button>

                        <div className="text-center mt-2">
                          <button
                            type="button"
                            onClick={() => navigate("/login")}
                            className="text-sm text-dashboard-accent hover:underline"
                          >
                            {t("reactivateAccount.backToLogin")}
                          </button>
                        </div>
                      </Form>
                    )}
                  </Formik>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default ReactivateAccount;
