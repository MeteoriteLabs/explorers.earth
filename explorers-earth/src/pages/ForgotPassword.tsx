import { useMutation } from "@apollo/client";
import { forgotPasswordMutation } from "../features/Authentication/api/mutation";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import { toast } from "sonner";
import { EarthLoader } from "../components/EarthLoader";
import { ApolloError } from "@apollo/client";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import SEO from "../components/SEO";
import { createCanonicalUrl } from "../utils/getCurrentDomain";

import { isManualAuthEnabled } from "../config/featureFlags";
import { useEffect } from "react";

const ForgotPassword = () => {
  const { t } = useTranslation();
  const [forgotPassword, { loading }] = useMutation(forgotPasswordMutation);
  const navigate = useNavigate();

  // MANUAL AUTH DISABLED - Redirect to login for OAuth-only mode
  useEffect(() => {
    if (!isManualAuthEnabled()) {
      toast.error(t('auth.manualAuthDisabled') || 'Password reset is not available. Please sign in with Google.');
      navigate('/login', { replace: true });
    }
  }, [navigate, t]);

  const initialValues = { email: "" };

  const validationSchema = Yup.object({
    email: Yup.string().email(t('auth.validations.email.invalidFormat')).required(t('auth.validations.email.required')),
  });

  const handleSubmit = async (values: typeof initialValues) => {
    try {
      const response = await forgotPassword({
        variables: { email: values.email },
      });

      if (response.data.forgotPassword.ok) {
        toast.success(t('toast.success.resetLinkSent'));
        navigate("/reset-link-sent", { state: { email: values.email } });
      } else {
        toast.error(t('toast.error.resetLinkFailed'));
      }
    } catch (error: unknown) {
      if (error instanceof ApolloError) {
        const serverError = error.graphQLErrors?.[0]?.message;
        if (serverError) {
          if (serverError.toLowerCase().includes("email not found")) {
            toast.error(t('toast.error.emailNotFound'));
          } else if (serverError.toLowerCase().includes("invalid email")) {
            toast.error(t('toast.error.invalidEmailFormat'));
          } else if (serverError.toLowerCase().includes("rate limit")) {
            toast.error(t('toast.error.rateLimitExceeded'));
          } else {
            toast.error(t('toast.error.resetLinkFailed'));
          }
        } else {
          toast.error(t('toast.error.resetLinkFailed'));
        }
      } else {
        toast.error(t('toast.error.resetLinkFailed'));
      }
      console.error(error);
    }
  };

  if (loading)
    return (
      <div className="bg-black">
        <EarthLoader context="login" />
      </div>
    );

  return (
    <>
      <SEO
        title="Forgot Password - explorers"
        description="Reset your explorers password"
        canonical={createCanonicalUrl("/forgot-password")}
        noIndex={true}
      />

      <div className="dashboard-theme min-h-screen flex font-poppins items-center justify-center bg-black text-white px-4 sm:px-6 py-6 sm:py-10">
        <div className="relative w-full max-w-md mx-auto">
          <motion.div
            className="backdrop-blur-sm bg-dashboard-sidebar border border-dashboard p-6 sm:p-8 rounded-2xl shadow-dashboard-elevated text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <motion.h2
              className="text-xl sm:text-2xl font-bold text-white"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              {t('auth.validations.forgotPassword.title')}
            </motion.h2>

            <p className="text-sm sm:text-base text-gray-400 mt-2 sm:mt-3 mb-4 sm:mb-6">
              {t('auth.validations.forgotPassword.description')}
            </p>

            <Formik
              initialValues={initialValues}
              validationSchema={validationSchema}
              onSubmit={handleSubmit}
            >
              <Form className="space-y-4 text-left">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-white mb-1"
                  >
                    {t('auth.validations.forgotPassword.emailLabel')}
                  </label>
                  <Field
                    id="email"
                    name="email"
                    type="email"
                    placeholder={t('auth.validations.forgotPassword.emailPlaceholder')}
                    className="w-full px-3 py-2 border border-dashboard bg-dashboard-muted rounded focus:outline-none focus:ring-2 focus:ring-dashboard-accent text-dashboard placeholder-dashboard-light"
                  />
                  <ErrorMessage
                    name="email"
                    component="div"
                    className="text-red-400 text-sm mt-1"
                  />
                </div>

                <motion.button
                  type="submit"
                  className="w-full py-2.5 sm:py-3 px-4 rounded-xl font-medium shadow-dashboard-elevated transition duration-200 text-sm sm:text-base bg-dashboard-accent hover:bg-dashboard-accent/90 text-dashboard"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {t('auth.validations.forgotPassword.sendResetLink')}
                </motion.button>

                <div className="text-center mt-4">
                  <button
                    type="button"
                    onClick={() => navigate("/login")}
                    className="text-sm text-dashboard-accent hover:underline"
                  >
                    {t('auth.validations.forgotPassword.backToLogin')}
                  </button>
                </div>
              </Form>
            </Formik>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default ForgotPassword;
