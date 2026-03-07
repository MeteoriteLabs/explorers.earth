import { motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation } from "@apollo/client";
import { forgotPasswordMutation } from "../features/Authentication/api/mutation";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { isManualAuthEnabled } from "../config/featureFlags";

const ResetLinkSent = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const email = location.state?.email;

  const [forgotPassword, { loading }] = useMutation(forgotPasswordMutation);

  // Cooldown state
  const [cooldown, setCooldown] = useState(0);

  // MANUAL AUTH DISABLED - Redirect to login for OAuth-only mode
  useEffect(() => {
    if (!isManualAuthEnabled()) {
      toast.error(t('auth.manualAuthDisabled') || 'Password reset is not available. Please sign in with Google.');
      navigate('/login', { replace: true });
    }
  }, [navigate, t]);

  // Countdown timer logic
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (cooldown > 0) {
      timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleResend = async () => {
    if (!email) {
      toast.error(t('toast.error.emailNotFound'));
      navigate("/forgot-password");
      return;
    }

    try {
      const response = await forgotPassword({
        variables: { email },
      });

      if (response.data.forgotPassword.ok) {
        toast.success(t('toast.success.resetLinkResent'));
        setCooldown(30); // Start 30 sec cooldown
      } else {
        toast.error(t('toast.error.resetLinkResendFailed'));
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast.error(t('toast.error.resetLinkResendFailed'));
      } else {
        toast.error(t('toast.error.resetLinkResendFailed'));
      }
    }
  };

  return (
    <div className="min-h-screen flex font-poppins items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white px-4 sm:px-6 py-6 sm:py-10">
      <div className="relative w-full max-w-md mx-auto">
        <motion.div
          className="backdrop-blur-sm bg-gray-900/80 border border-gray-800 p-6 sm:p-8 rounded-2xl shadow-2xl text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <motion.h2
            className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple to-purple-500"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            {t('auth.resetLinkSent.title')}
          </motion.h2>

          <p className="text-sm sm:text-base text-gray-400 mt-2 sm:mt-3 mb-4 sm:mb-6">
            {t('auth.resetLinkSent.description')}
          </p>

          <motion.button
            onClick={handleResend}
            disabled={loading || cooldown > 0}
            className="w-full py-2.5 sm:py-3 px-4 rounded-xl font-medium shadow-lg transition duration-200 text-sm sm:text-base bg-gradient-to-r from-purple to-purple-600 hover:from-purple hover:to-purple-700 text-white disabled:opacity-50"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {loading
              ? t('auth.resetLinkSent.resending')
              : cooldown > 0
              ? t('auth.resetLinkSent.resendWithCooldown', { cooldown })
              : t('auth.resetLinkSent.resendMail')}
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
};

export default ResetLinkSent;
