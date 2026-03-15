import { useState } from "react";
import { useTunesDashboard } from "../hooks/useTunesDashboard";
import { gql, useQuery, useMutation } from "@apollo/client";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { EarthLoader } from "../components/EarthLoader";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import SEO from "../components/SEO";
import { createCanonicalUrl } from "../utils/getCurrentDomain";
import useAuthStore from "../store/store";
import {
  createLocalTunesUserWithRetry,
  prepareLocalTunesUserData,
  isLocalTunesEnabled
} from "../services/localTunesService";
import {
  getCredentialsForLocalTunes
} from "../utils/sessionCredentials";
import { loginQuery } from "../features/Authentication/api/mutation";
import MusicDashboard from "../components/MusicDashboard";

const getUserAccountQuery = gql`
  query UsersPermissionsUser($documentId: ID!) {
    usersPermissionsUser(documentId: $documentId) {
      username
      email
      razorpay_customer_id
      accounts {
        username
        documentId
        localtunes_integrated
        localtunes_public
      }
    }
  }
`;

const updateAccountMutation = gql`
  mutation UpdateAccount($documentId: ID!, $data: AccountInput!) {
    updateAccount(documentId: $documentId, data: $data) {
      documentId
      localtunes_integrated
      localtunes_public
    }
  }
`;

const MusicPage = () => {
  const { user: authUser } = useAuthStore();
  const [isConnecting, setIsConnecting] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);

  // Query to get current user's account with localtunes_integrated status
  const { data: userData, loading: accountLoading, refetch } = useQuery(getUserAccountQuery, {
    variables: {
      documentId: authUser?.documentId
    },
    skip: !authUser?.documentId,
    fetchPolicy: 'cache-and-network'
  });

  // Mutation to update localtunes_integrated field
  const [updateAccount] = useMutation(updateAccountMutation);

  // Mutation for password validation
  const [validatePassword] = useMutation(loginQuery);

  // Get the localtunes_integrated status from the user's account data
  const localTunesIntegratedValue = userData?.usersPermissionsUser?.accounts?.[0]?.localtunes_integrated;
  const localTunesConnected = localTunesIntegratedValue === "Yes";
  const accountDocumentId = userData?.usersPermissionsUser?.accounts?.[0]?.documentId;

  // Phase 1: sync with tunes Neon DB and fetch dashboard data when connected
  const tunesDashboard = useTunesDashboard();

  const handleConnectLocalTunes = async () => {
    if (!authUser) {
      toast.error('User information not available');
      return;
    }

    if (!accountDocumentId) {
      toast.error('Account information not available');
      return;
    }

    if (localTunesConnected) {
      toast.info('Already connected to Local Tunes');
      return;
    }

    const storedCredentials = getCredentialsForLocalTunes();

    if (storedCredentials) {
      await connectWithStoredCredentialsAndShowPlans(storedCredentials);
    } else {
      setShowPasswordModal(true);
    }
  };

  const connectWithStoredCredentialsAndShowPlans = async (storedCredentials: any) => {
    setIsConnecting(true);
    try {

      console.log('Registering with Local Tunes from Music page with stored credentials...');

      // Prepare Local Tunes user data
      // Username should be same as explorers username

      const localTunesUserData = prepareLocalTunesUserData({
        username: authUser!.username,
        email: authUser!.email,
        password: storedCredentials.password,
        accountName: authUser!.username,
        businessName: authUser!.username,
      });

      const result = await createLocalTunesUserWithRetry(localTunesUserData);

      if (result) {
        await updateAccount({
          variables: {
            documentId: accountDocumentId,
            data: {
              localtunes_integrated: "Yes"
            }
          }
        });

        await refetch();
        toast.success('Local Tunes account created successfully!');
      } else {
        toast.error('Failed to register with Local Tunes. Please try again.');
      }
    } catch (error) {
      console.error('Failed to connect to Local Tunes:', error);
      toast.error('Failed to connect to Local Tunes. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  };


  // Function to validate explorers password
  const validateexplorersPassword = async (username: string, password: string): Promise<boolean> => {
    try {
      await validatePassword({
        variables: {
          input: {
            identifier: username,
            password: password
          }
        }
      });
      return true;
    } catch (error: any) {
      console.log('Password validation failed:', error.message);
      return false;
    }
  };

  const connectWithManualPassword = async () => {
    if (!password.trim()) {
      toast.error('Please enter your password');
      return;
    }

    setIsConnecting(true);
    try {
      console.log('Validating explorers password before connecting to Local Tunes...');

      const isPasswordValid = await validateexplorersPassword(authUser!.username, password);

      if (!isPasswordValid) {
        toast.error('Invalid password. Please check your explorers password and try again.');
        setIsConnecting(false);
        return;
      }

      console.log('Password validated successfully. Registering with Local Tunes...');

      // Prepare Local Tunes user data with validated password
      // Username should be same as explorers username
      const localTunesUserData = prepareLocalTunesUserData({
        username: authUser!.username,
        email: authUser!.email,
        password: password,
        accountName: authUser!.username,
        businessName: authUser!.username,
      });

      const result = await createLocalTunesUserWithRetry(localTunesUserData);

      if (result) {
        await updateAccount({
          variables: {
            documentId: accountDocumentId,
            data: {
              localtunes_integrated: "Yes"
            }
          }
        });

        setShowPasswordModal(false);
        setPassword("");
        await refetch();
        toast.success('Local Tunes account created successfully!');
      } else {
        toast.error('Failed to register with Local Tunes. Please try again.');
      }
    } catch (error) {
      console.error('Failed to connect to Local Tunes:', error);
      toast.error('Failed to connect to Local Tunes. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  if (!isLocalTunesEnabled()) {
    return (
      <div className="dashboard-theme flex items-center justify-center h-full">
        <div className="bg-dashboard-sidebar rounded-xl p-6 max-w-md w-full mx-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="text-white font-semibold font-poppins mb-2">
                Local Tunes Integration
              </h3>
              <p className="text-gray-300 text-sm">
                Local Tunes integration is currently disabled.
              </p>
            </div>
            <div className="text-gray-400 text-sm">
              Disabled
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (accountLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-dashboard-bg">
        <EarthLoader context="general" size="small" />
      </div>
    );
  }

  const isIntegrated = userData?.usersPermissionsUser?.accounts?.[0]?.localtunes_integrated || false;

  return (
    <>
      <SEO
        title={`Local Tunes - Music Discovery & Playlists | explorers`}
        description={`Discover and share local sounds, tunes, and city-based music playlists with explorers. Create personalized music experiences, explore culture-based music discovery, and connect with local sounds from around the world. ${isIntegrated ? `Manage your music playlists and discover new tracks.` : 'Get started with Local Tunes integration.'}`}
        keywords={[
          "local tunes",
          "local music discovery",
          "city-based music",
          "culture-based music",
          "local sounds",
          "music playlists",
          "local music exploration",
          "regional music",
          "city music playlists",
          "cultural music discovery",
          "local music sharing",
          "music recommendations",
          "explorers music",
          "local music platform",
          "music discovery app",
          "city soundtracks",
          "cultural soundtracks",
          "local music curation",
          "music exploration",
          "regional soundtracks"
        ]}
        canonical={createCanonicalUrl("/music")}
        type="website"
        noIndex={true}
        siteName="explorers"
      />
      <div className="dashboard-theme h-full bg-dashboard-bg">
        <div className="container mx-auto px-2 sm:px-4 py-4 h-full overflow-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-4xl mx-auto"
          >
            {/* Main Content */}
            {localTunesConnected ? (
              /* Full-width embedded dashboard */
              <MusicDashboard data={tunesDashboard} />
            ) : (
              /* Two-column connect view */
              <div className="bg-dashboard-sidebar rounded-xl p-4">
                <div className="flex flex-col lg:flex-row gap-8">
                  {/* Left Side - Info */}
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold text-white mb-3">What is Local Tunes?</h2>
                    <p className="text-gray-300 mb-4">
                      Create collaborative music experiences where guests can contribute to your space's atmosphere in real-time.
                    </p>

                    {/* Features */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-dashboard-accent flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-gray-300 text-sm">Real-time guest contributions</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-dashboard-accent flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-gray-300 text-sm">Uses your existing explorers account</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-dashboard-accent flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-gray-300 text-sm">Enhanced engagement through shared discovery</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Side - Connection Status (not connected state only) */}
                  <div className="lg:w-80">
                    <div className="bg-dashboard-bg rounded-lg p-6">
                      <h3 className="text-white font-semibold mb-4">Connection Status</h3>

                      <div className="flex items-center gap-2 mb-6">
                        <div className="flex items-center gap-2 text-gray-400">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                          <span className="font-medium">Not Connected</span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Button
                          btnText={isConnecting ? "Connecting..." : "Connect to Local Tunes"}
                          size="medium"
                          variant="primary"
                          onClickHandler={handleConnectLocalTunes}
                          isLoading={isConnecting}
                          disabled={isConnecting || accountLoading}
                          className="w-full"
                        />
                      </div>

                      <p className="text-gray-400 text-xs mt-4 text-center">
                        Your explorers account information will be used to create your Local Tunes account.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* Password Modal for Manual Connection */}
        {showPasswordModal && (
          <Modal
            isOpen={showPasswordModal}
            onClose={() => {
              setShowPasswordModal(false);
              setPassword("");
            }}
          >
            <div className="dashboard-theme flex flex-col gap-6 w-full mx-auto min-w-[300px] sm:min-w-[500px] md:min-w-[600px] max-w-2xl py-4 sm:py-6 md:py-8 px-6 sm:px-8 md:px-12">
              <h2 className="dt-heading mb-2">
                Connect to Local Tunes
              </h2>

              <p className="dt-label text-white-muted">
                Enter your explorers password to create your Local Tunes account. We'll use your existing username and email.
              </p>

              <div className="flex flex-col gap-2">
                <label className="dt-label">Password</label>
                <div className="relative">
                  <input
                    type={passwordVisible ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full p-3 border border-dashboard bg-dashboard-muted rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-dashboard-accent"
                  />
                  <button
                    type="button"
                    onClick={() => setPasswordVisible(!passwordVisible)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {passwordVisible ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <Button
                  btnText="Cancel"
                  size="small"
                  variant="secondary"
                  onClickHandler={() => {
                    setShowPasswordModal(false);
                    setPassword("");
                  }}
                />
                <Button
                  btnText={isConnecting ? "Connecting..." : "Connect"}
                  size="small"
                  variant="primary"
                  onClickHandler={connectWithManualPassword}
                  isLoading={isConnecting}
                  disabled={isConnecting || !password.trim()}
                />
              </div>
            </div>
          </Modal>
        )}
      </div>
    </>
  );
};

export default MusicPage;