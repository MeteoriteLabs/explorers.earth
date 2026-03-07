import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios, { AxiosError } from "axios";
import useAuthStore from "../store/store";
import { EarthLoader } from "../components/EarthLoader";


import { storeUserCredentials } from "../utils/sessionCredentials";

const GoogleAuthRedirect = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<string>('Authenticating with Google...');
  // global state for user details
  const loginState = useAuthStore((state) => state.login);
  useEffect(() => {
    // Extract the access_token from the query string
    const params = new URLSearchParams(location.search);
    const accessToken = params.get("access_token");

    if (accessToken) {
      setAccessToken(accessToken);
    } else {
      console.error("No access_token found in query params");
      navigate("/login");
    }
  }, [location.search, navigate]);

  useEffect(() => {
    const handleGoogleAuth = async () => {
      if (!accessToken) return;

      try {
        setAuthStatus('Verifying Google credentials...');
        const response = await axios.get(
          `${import.meta.env.VITE_REST_API_URL}/auth/google/callback`,
          {
            params: { access_token: accessToken },
          }
        );

        if (response.data && response.data.jwt && response.data.user) {
          setAuthStatus('Setting up your account...');

          const userData = {
            token: response.data.jwt,
            documentId: response.data.user.documentId,
            blocked: response.data.user.blocked,
            id: response.data.user.id,
            email: response.data.user.email,
            username: response.data.user.username,
          };

          // Store user credentials in session storage for Local Tunes integration
          // Note: For Google auth, we don't have the password, so we'll use a placeholder
          storeUserCredentials({
            username: userData.username,
            email: userData.email,
            password: 'google_auth_user' // Placeholder for Google-authenticated users
          });

          // Update auth state
          loginState(userData);
          localStorage.setItem("qrtoken", response.data.jwt);



          setAuthStatus('Redirecting...');
          // Small delay to show status
          await new Promise(resolve => setTimeout(resolve, 500));

          // Navigate to home - ProtectedRoute will handle onboarding check
          navigate("/home");
        } else {
          console.error("Unexpected response structure:", response.data);
          navigate("/login");
        }
      } catch (error) {
        console.error("Google Auth Error:", error);
        if (error instanceof AxiosError && error.response) {
          console.error("Error Response Status:", error.response.status);
          console.error("Error Response Data:", error.response.data);
        }
        navigate("/login");
      }
    };

    if (accessToken) {
      handleGoogleAuth();
    }
  }, [accessToken, loginState, navigate]);

  return (
    <div className="bg-black">
      <EarthLoader context="login" statusMessage={authStatus || undefined} />
    </div>
  );
};

export default GoogleAuthRedirect;
