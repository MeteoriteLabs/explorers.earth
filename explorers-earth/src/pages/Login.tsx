import { useMutation } from "@apollo/client";
import {
  getLoginFormFields,
  loginInitialValues,
  FormValues,
  createLoginValidationSchema,
} from "../features/Authentication/data";
import { useNavigate } from "react-router-dom";
import AuthForm from "../features/Authentication/components/AuthForm";
import useAuthStore from "../store/store";
import { loginQuery } from "../features/Authentication/api/mutation";
import { EarthLoader } from "../components/EarthLoader";
import { ApolloError } from "@apollo/client";
import { FormikHelpers } from "formik";
import SEO from "../components/SEO";
import { createCanonicalUrl } from "../utils/getCurrentDomain";
import { createWebPageGEOData } from "../utils/geoHelpers";
import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";
import useToast from "../hooks/useToast";
import { isManualAuthEnabled } from "../config/featureFlags";
import Button from "../components/ui/Button";
import GoogleIcon from "../assets/icons/GoogleIcon";
import { storeUserCredentials } from "../utils/sessionCredentials";

const Login = () => {
  const { t, i18n } = useTranslation();
  const [login, { loading }] = useMutation(loginQuery);
  const navigate = useNavigate();
  const loginState = useAuthStore((state) => state.login);
  const { toast, toastError } = useToast();

  // Track complete login flow including SSO
  const [isCompletingLogin, setIsCompletingLogin] = useState(false);
  const [loginStatus, setLoginStatus] = useState<string>('');

  // Create validation schema that updates when language changes
  const validationSchema = useMemo(() => {
    return createLoginValidationSchema(t);
  }, [t, i18n.language]);

  // Enhanced submit with field-level error handling
  const handleSubmit = async (
    values: FormValues,
    formikHelpers: FormikHelpers<FormValues>
  ) => {
    try {
      setIsCompletingLogin(true);
      setLoginStatus(t('auth.status.authenticating') || 'Authenticating...');

      const response = await login({
        variables: {
          input: {
            identifier: values.username,
            password: values.password,
          },
        },
      });

      if (response.data) {
        const userData = {
          token: response.data.login.jwt,
          documentId: response.data.login.user.documentId,
          blocked: response.data.login.user.blocked,
          id: response.data.login.user.id,
          email: response.data.login.user.email,
          username: response.data.login.user.username,
        };

        // Store user credentials in session storage for Local Tunes integration
        storeUserCredentials({
          username: String(values.username),
          email: String(userData.email),
          password: String(values.password)
        });

        loginState(userData);
        localStorage.setItem("qrtoken", response.data.login.jwt);



        // Show success toast only after all operations complete
        toast(t("toast.success.loginSuccessful"));

        // Small delay to ensure user sees the success message
        await new Promise(resolve => setTimeout(resolve, 500));

        navigate("/home");
      }
    } catch (err) {
      setIsCompletingLogin(false);
      setLoginStatus('');
      let errorMessage = t("toast.error.loginFailed");

      if (err instanceof ApolloError) {
        const serverError = err?.graphQLErrors?.[0]?.message;

        if (serverError) {
          // Map server errors to localized messages
          if (
            serverError.toLowerCase().includes("invalid identifier") ||
            serverError.toLowerCase().includes("invalid credentials")
          ) {
            errorMessage = t("toast.error.invalidCredentials");
            formikHelpers.setErrors({
              username: t("auth.validations.login.invalidCredentials"),
            });
          } else if (
            serverError.toLowerCase().includes("invalid password") ||
            serverError.toLowerCase().includes("incorrect password")
          ) {
            errorMessage = t("toast.error.invalidCredentials");
            formikHelpers.setErrors({
              password: t("auth.validations.login.incorrectPassword"),
            });
          } else if (serverError.toLowerCase().includes("account not found")) {
            errorMessage = t("toast.error.invalidCredentials");
            formikHelpers.setErrors({
              username: t("auth.validations.login.invalidCredentials"),
            });
          } else if (serverError.toLowerCase().includes("too many attempts")) {
            errorMessage = t("toast.error.tooManyAttempts");
          } else if (serverError.toLowerCase().includes("account locked")) {
            errorMessage = t("toast.error.accountLocked");
          } else if (serverError.toLowerCase().includes("account suspended")) {
            errorMessage = t("toast.error.accountSuspended");
          } else if (serverError.toLowerCase().includes("session expired")) {
            errorMessage = t("toast.error.sessionExpired");
          } else {
            errorMessage = t("toast.error.loginFailed");
          }
        }
      }

      toastError(errorMessage, { id: "login-error" });
      console.error(err);
    } finally {
      formikHelpers.setSubmitting(false);
    }
  };

  const handleGoogleSignIn = () => {
    // Initiation must happen on the backend domain (api.localqr.earth)
    // so the session cookie is correctly bound for the Google callback.
    const backendBase = "https://api.localqr.earth/api";
    window.location.href = `${backendBase}/connect/google`;
  };

  // Generate GEO data for login page
  const geoData = createWebPageGEOData({
    pageType: "login",
    title: "Login to explorers",
    description:
      "Sign in to your explorers account to access your personalized QR codes and local recommendations",
    keywords: ["login", "sign in", "user account", "authentication"],
    purpose:
      "sign in to access personalized local recommendations and QR codes",
  });

  if (loading || isCompletingLogin)
    return (
      <div className="dashboard-theme bg-dashboard-bg">
        <EarthLoader context="login" statusMessage={loginStatus || undefined} />
      </div>
    );

  return (
    <>
      <SEO
        title={t("seo.loginTitle")}
        description="Sign in to your explorers account to view and manage your personalized QR codes and local recommendations. Access your favorite location list places anytime and share them with the world."
        keywords={[
          "login explorers",
          "sign in to recommendations app",
          "access personalized travel guides",
          "view favorite places account",
          "location based login",
          "user account explorers",
          "my travel recommendations login",
          "manage local spots",
          "curated places login",
          "discover and share places",
          "local guide app sign in",
          "travel app user login",
          "access my recommendations",
          "city guide account access",
          "explorers account login",
          "sign in",
          "QR code account",
          "local recommendations login",
          "access account",
          "user login",
          "explorers signin",
          "account access",
          "QR recommendations",
        ]}
        canonical={createCanonicalUrl("/login")}
        type="website"
        noIndex={true}
        enableGEO={true}
        geoData={geoData}
      />

      <div className="relative flex items-center justify-center min-h-screen bg-black w-full px-4 py-8">
        <div className="w-full max-w-md md:max-w-lg lg:max-w-xl">
          {/* MANUAL AUTH DISABLED - OAuth Only Mode */}
          {isManualAuthEnabled() ? (
            // Original manual authentication form (currently disabled)
            <AuthForm
              initialValues={loginInitialValues}
              validationSchema={validationSchema}
              onSubmit={handleSubmit}
              formFields={getLoginFormFields(t)}
              submitButtonLabel={t("auth.loginTitle")}
              heading={t("auth.loginTitle")}
              description={t("auth.loginSubtitle")}
              GoogleAuthHandler={handleGoogleSignIn}
              googleButtonLabel={t("auth.signInWithGoogle")}
              isRegistration={false}
              children={
                <div className="flex flex-col items-center gap-2 mt-2">
                  <div className="flex justify-center items-center gap-1">
                    <p className="text-xs">{t("auth.newToExplorers")}</p>
                    <a
                      href="/register"
                      className="text-dashboard-accent underline text-xs"
                    >
                      {t("auth.register")}
                    </a>
                  </div>
                  <div className="flex justify-center items-center gap-4">
                    <a
                      href="/forgot-password"
                      className="text-dashboard-accent underline text-xs"
                    >
                      {t("auth.forgotPassword")}
                    </a>
                    <a
                      href="/claimaccount"
                      className="text-dashboard-accent underline text-xs"
                    >
                      {t("auth.claimAccount")}
                    </a>
                  </div>
                </div>
              }
            />
          ) : (
            // OAuth-only authentication (currently active)
            <div className="dashboard-theme">
              <div className="flex flex-col items-center justify-center mb-4 md:mb-6 w-3/4 max-w-[75%] mx-auto">
                <img
                  src="/logo.svg"
                  alt="explorers.earth"
                  className="object-contain w-full"
                  style={{
                    height: "auto",
                    maxHeight: "60px",
                    filter: "brightness(0) invert(1)",
                  }}
                />
              </div>
              <div className="font-poppins flex flex-col gap-6 w-full bg-dashboard-sidebar p-6 md:p-8 rounded-3xl shadow-dashboard-elevated text-dashboard">
                <div className="font-poppins text-center">
                  <h1 className="font-semibold text-2xl md:text-3xl text-white">{t('auth.loginTitle')}</h1>
                  <p className="text-sm mt-2 text-gray-300">{t('auth.loginSubtitle')}</p>
                </div>

                <div className="flex flex-col gap-4">
                  <Button
                    btnText={t('auth.signInWithGoogle')}
                    size="small"
                    type="button"
                    endIcon={<GoogleIcon />}
                    variant="google"
                    onClickHandler={handleGoogleSignIn}
                  />

                  <div className="text-center mt-2">
                    <p className="text-xs text-gray-400">
                      Sign in with your Google account to continue
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Login;
