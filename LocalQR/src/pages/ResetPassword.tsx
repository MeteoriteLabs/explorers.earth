import { useMutation } from "@apollo/client";
import { resetPasswordMutation } from "../features/Authentication/api/mutation";
import { Formik, Form, ErrorMessage } from "formik";
import * as Yup from "yup";
import { toast } from "sonner";
import { useSearchParams, useNavigate } from "react-router-dom";
import { EarthLoader } from "../components/EarthLoader";
import { ApolloError } from "@apollo/client";
import { motion } from "framer-motion";
import PasswordInput from "../components/ui/PasswordInput";
import { validatePassword } from "../utils/passwordValidator";
import { useTranslation } from "react-i18next";
import { isManualAuthEnabled } from "../config/featureFlags";
import { useEffect } from "react";

const ResetPassword = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const code = searchParams.get("code");

  // MANUAL AUTH DISABLED - Redirect to login for OAuth-only mode
  useEffect(() => {
    if (!isManualAuthEnabled()) {
      toast.error(t('auth.manualAuthDisabled') || 'Password reset is not available. Please sign in with Google.');
      navigate('/login', { replace: true });
    }
  }, [navigate, t]);

  const [resetPassword, { loading }] = useMutation(resetPasswordMutation);

  const initialValues = {
    password: "",
    confirmPassword: "",
  };

  // Simplified validation schema - detailed validation is handled by PasswordInput
  const validationSchema = Yup.object({
    password: Yup.string().required(t('auth.validations.password.required')),
    confirmPassword: Yup.string()
      .oneOf([Yup.ref("password")], t('auth.validations.confirmPassword.mustMatch'))
      .required(t('auth.validations.confirmPassword.confirmRequired')),
  });

  const handleSubmit = async (values: typeof initialValues) => {
    if (!code) {
      toast.error(t('toast.error.invalidToken'));
      console.error("Code is missing from URL!");
      return;
    }

    // Validate password using centralized validator
    const passwordValidation = validatePassword(values.password, {}, t);
    if (!passwordValidation.isValid) {
      toast.error(t('toast.error.validationError'));
      return;
    }



    try {
      const variables = {
        password: values.password,
        passwordConfirmation: values.confirmPassword,
        code,
      };

      const response = await resetPassword({
        variables,
      });

      if (response.data?.resetPassword?.user) {
        // Adjusted to check user field instead of 'ok'
        toast.success(t('toast.success.passwordResetSuccessful'));
        navigate("/login");
      } else {
        const message = response.data?.resetPassword?.message || t('toast.error.passwordResetFailed');
        toast.error(message);
        console.error("Server message:", message);
      }
    } catch (error: unknown) {
      console.error("Caught Error object:", error);

      if (error instanceof ApolloError) {
        const serverError = error.graphQLErrors?.[0]?.message;
        if (serverError) {
          if (serverError.toLowerCase().includes("invalid token") ||
            serverError.toLowerCase().includes("expired token")) {
            toast.error(t('toast.error.expiredToken'));
          } else if (serverError.toLowerCase().includes("password") &&
            serverError.toLowerCase().includes("weak")) {
            toast.error(t('toast.error.passwordTooWeak'));
          } else if (serverError.toLowerCase().includes("validation")) {
            toast.error(t('toast.error.validationError'));
          } else {
            toast.error(t('toast.error.passwordResetFailed'));
          }
        } else {
          toast.error(t('toast.error.passwordResetFailed'));
        }
        console.error("GraphQL Error from Server:", serverError);
      } else {
        toast.error(t('toast.error.passwordResetFailed'));
      }
    }
  };

  if (loading) {
    return (
      <div className="bg-black">
        <EarthLoader context="login" />
      </div>
    );
  }

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
            className="text-xl sm:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple to-purple-500"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            Reset Password
          </motion.h2>

          <p className="text-sm sm:text-base text-gray-400 mt-2 sm:mt-3 mb-4 sm:mb-6">
            Enter your new password below.
          </p>

          <Formik
            initialValues={initialValues}
            validationSchema={validationSchema}
            onSubmit={handleSubmit}
          >
            {({ values, setFieldValue }) => (
              <Form className="space-y-4 text-left">
                {/* New Password Field */}
                <div>
                  <PasswordInput
                    value={values.password}
                    onChange={(value) => setFieldValue("password", value)}
                    label={t('auth.resetPassword.newPassword')}
                    labelColor="white"
                    placeholder={t('auth.resetPassword.newPasswordPlaceholder')}
                    showStrengthMeter={true}
                    className="w-full"
                    data-testid="new-password-input"
                  />
                  <ErrorMessage
                    name="password"
                    component="div"
                    className="text-red-500 text-sm mt-1"
                  />
                </div>

                {/* Confirm Password Field */}
                <div>
                  <PasswordInput
                    value={values.confirmPassword}
                    onChange={(value) =>
                      setFieldValue("confirmPassword", value)
                    }
                    label={t('auth.resetPassword.confirmPassword')}
                    labelColor="white"
                    placeholder={t('auth.resetPassword.confirmPasswordPlaceholder')}
                    showStrengthMeter={false}
                    showValidationStatus={false}
                    className="w-full"
                    data-testid="confirm-password-input"
                  />
                  <ErrorMessage
                    name="confirmPassword"
                    component="div"
                    className="text-red-500 text-sm mt-1"
                  />

                  {/* Password match indicator */}
                  {values.confirmPassword && (
                    <div className="mt-2">
                      {values.password === values.confirmPassword ? (
                        <div className="flex items-center text-green-600 text-xs">
                          <svg
                            className="w-3 h-3 mr-1"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span>{t('auth.validations.confirmPassword.match')}</span>
                        </div>
                      ) : (
                        <div className="flex items-center text-red-600 text-xs">
                          <svg
                            className="w-3 h-3 mr-1"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span>{t('auth.validations.confirmPassword.mustMatch')}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <motion.button
                  type="submit"
                  className="w-full py-2.5 sm:py-3 px-4 rounded-xl font-medium shadow-lg transition duration-200 text-sm sm:text-base bg-gradient-to-r from-purple to-purple-600 hover:from-purple hover:to-purple-700 text-white"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Reset Password
                </motion.button>
              </Form>
            )}
          </Formik>
        </motion.div>
      </div>
    </div>
  );
};

export default ResetPassword;
