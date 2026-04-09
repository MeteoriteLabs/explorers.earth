import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios, { AxiosError } from "axios";
import useAuthStore from "../store/store";
import { EarthLoader } from "../components/EarthLoader";
import { storeUserCredentials } from "../utils/sessionCredentials";

/**
 * GoogleAuthRedirect — handles /google-auth/callback
 *
 * Strapi OAuth flow for production (explorers.earth):
 *
 *  1. User clicks "Sign in with Google"
 *     → browser navigates to https://api.localqr.earth/api/connect/google
 *
 *  2. Strapi redirects to Google consent page.
 *
 *  3. Google calls the Strapi backend callback:
 *     https://api.localqr.earth/api/connect/google/callback
 *
 *  4. Strapi validates the Google code, creates/finds the user, mints a JWT,
 *     then redirects the browser to the configured "front-end URL":
 *     https://explorers.earth/google-auth/callback?access_token=<JWT>
 *     ↑ the access_token here IS the Strapi JWT — NOT a Google token.
 *
 *  5. This component reads that JWT, fetches the user profile, stores
 *     credentials, and navigates to /home.
 *
 * IMPORTANT: No second OAuth exchange is performed here. The access_token
 * provided by Strapi's redirect is already the final authentication token.
 */
const GoogleAuthRedirect = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const loginState = useAuthStore((state) => state.login);
  const [authStatus, setAuthStatus] = useState<string>("Authenticating with Google...");

  useEffect(() => {
    const handleGoogleAuth = async () => {
      const params = new URLSearchParams(location.search);

      // This token is already the Strapi JWT — Strapi mints it server-side
      // before redirecting here. No further exchange with Google is needed.
      const strapiJwt = params.get("access_token");

      if (!strapiJwt) {
        console.error("[GoogleAuthRedirect] No access_token in URL", location.search);
        navigate("/login?error=oauth_failed");
        return;
      }

      try {
        setAuthStatus("Verifying your account...");

        // Fetch the user's profile with the Strapi JWT
        // VITE_REST_API_URL = https://api.localqr.earth/api (already includes /api)
        const backendBase = import.meta.env.VITE_REST_API_URL || "https://api.localqr.earth/api";
        const response = await axios.get(`${backendBase}/users/me`, {
          headers: {
            Authorization: `Bearer ${strapiJwt}`,
          },
        });

        const user = response.data;

        if (!user || !user.id) {
          console.error("[GoogleAuthRedirect] Unexpected /users/me response:", user);
          navigate("/login?error=oauth_failed");
          return;
        }

        setAuthStatus("Setting up your account...");

        const userData = {
          token: strapiJwt,
          documentId: user.documentId ?? String(user.id),
          blocked: user.blocked ?? false,
          id: user.id,
          email: user.email,
          username: user.username,
        };

        // Store credentials (Google users have no plaintext password)
        storeUserCredentials({
          username: userData.username,
          email: userData.email,
          password: "google_auth_user",
        });

        // Persist token and update global auth state
        localStorage.setItem("qrtoken", strapiJwt);
        loginState(userData);

        setAuthStatus("Redirecting...");
        await new Promise((resolve) => setTimeout(resolve, 400));

        // ProtectedRoute handles the onboarding check from here
        navigate("/home");
      } catch (error) {
        console.error("[GoogleAuthRedirect] Error fetching user profile:", error);
        if (error instanceof AxiosError && error.response) {
          console.error("[GoogleAuthRedirect] Status:", error.response.status);
          console.error("[GoogleAuthRedirect] Data:", error.response.data);
        }
        navigate("/login?error=oauth_failed");
      }
    };

    handleGoogleAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="bg-black">
      <EarthLoader context="login" statusMessage={authStatus} />
    </div>
  );
};

export default GoogleAuthRedirect;
