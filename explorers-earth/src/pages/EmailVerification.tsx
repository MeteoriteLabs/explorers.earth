import { memo, useState, useEffect } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import useEmailStore from "../store/useEmailStore";
import { useTranslation } from "react-i18next";

const EmailVerification = () => {
  const { t } = useTranslation();
  const [emailSent, setEmailSent] = useState(false);
  const [timer, setTimer] = useState(0);
  const [loading, setLoading] = useState(false);
  const { email } = useEmailStore();
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleResendEmail = async () => {
    if (timer > 0) return;

    setLoading(true);
    try {
      const response = await axios.post(
        `${`${import.meta.env.VITE_REST_API_URL}/send-email-confirmation`}`,
        {
          email: email,
        }
      );

      if (response.data) {
        setEmailSent(true);
        setTimer(120);
        toast.success(t('toast.success.emailVerificationSent'));
      }
    } catch (error) {
      console.error("Error resending email:", error);
      toast.error(t('toast.error.emailVerificationFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-theme dashboard-theme-dark min-h-screen flex font-poppins items-center justify-center bg-black text-white px-4 sm:px-6 py-6 sm:py-10">
      <div className="relative w-full max-w-md mx-auto">
        <motion.div
          className="bg-dashboard-sidebar border border-dashboard p-6 sm:p-8 rounded-2xl shadow-dashboard-elevated"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <AnimatePresence mode="wait">
            {emailSent ? (
              <motion.div
                key="sent"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="text-center"
              >
                <h2 className="text-xl sm:text-2xl font-bold text-dashboard-accent">
                  {t('emailVerification.emailSent')}
                </h2>
                <p className="text-sm sm:text-base text-gray-300 mt-2 sm:mt-3 mb-4 sm:mb-6">
                  {t('emailVerification.description')}
                </p>
                <motion.button
                  onClick={() => setEmailSent(false)}
                  className="text-sm text-gray-400 hover:text-white transition-colors duration-200"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {t('emailVerification.backToLogin')}
                </motion.button>
              </motion.div>
            ) : (
              <motion.div
                key="verify"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="text-center"
              >
                <h2 className="text-xl sm:text-2xl font-bold text-dashboard-accent">
                  {t('emailVerification.title')}
                </h2>
                <p className="text-sm sm:text-base text-gray-300 mt-2 sm:mt-3 mb-4 sm:mb-6">
                  {t('emailVerification.description')}
                </p>
                <motion.button
                  onClick={handleResendEmail}
                  className={`w-full py-2.5 sm:py-3 px-4 rounded-xl font-medium shadow-lg transition duration-200 text-sm sm:text-base ${
                    timer > 0 || loading
                      ? "bg-dashboard-muted text-gray-400 cursor-not-allowed"
                      : "bg-dashboard-accent hover:bg-blue-600 text-white"
                  }`}
                  disabled={timer > 0 || loading}
                  whileHover={timer === 0 && !loading ? { scale: 1.02 } : {}}
                  whileTap={timer === 0 && !loading ? { scale: 0.98 } : {}}
                >
                  {loading
                    ? t('toast.info.sending')
                    : timer > 0
                    ? `${t('emailVerification.resendIn')} ${Math.floor(timer / 60)}:${(timer % 60)
                        .toString()
                        .padStart(2, "0")}`
                    : t('emailVerification.resendEmail')}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
};

export default memo(EmailVerification);
