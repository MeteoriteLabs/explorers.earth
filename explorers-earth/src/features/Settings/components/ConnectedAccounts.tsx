import { memo, useState, useEffect } from "react";
import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Button from "../../../components/ui/Button";
import { toast } from "sonner";
import { isLocalTunesEnabled } from "../../../services/localTunesService";

import { useQuery, useMutation } from "@apollo/client";
import { getUserAccountQuery, updateAccountMutation } from "../api/mutation";
import useAuthStore from "../../../store/store";

const ConnectedAccounts = memo(() => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isConnecting] = useState(false);
  const [localTunesPublicLink, setLocalTunesPublicLink] = useState("");
  const [isUpdatingLink, setIsUpdatingLink] = useState(false);

  // Get user data from auth store
  const { user: authUser } = useAuthStore();

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

  // Get the localtunes_integrated status from the user's account data
  const localTunesIntegratedValue = userData?.usersPermissionsUser?.accounts?.[0]?.localtunes_integrated;
  const localTunesConnected = localTunesIntegratedValue === "Yes";
  const accountDocumentId = userData?.usersPermissionsUser?.accounts?.[0]?.documentId;
  const currentLocalTunesPublicLink = userData?.usersPermissionsUser?.accounts?.[0]?.localtunes_public || "";

  // Update localTunesPublicLink when data loads
  React.useEffect(() => {
    if (currentLocalTunesPublicLink !== localTunesPublicLink) {
      setLocalTunesPublicLink(currentLocalTunesPublicLink);
    }
  }, [currentLocalTunesPublicLink]);

  const handleGoToLocalTunes = () => {
    window.open(`${import.meta.env.VITE_LOCAL_TUNES_API_URL}/auth?tab=login`, '_blank');
  };

  const handleUpdateLocalTunesPublicLink = async () => {
    if (!accountDocumentId) {
      toast.error('Account information not available');
      return;
    }

    setIsUpdatingLink(true);
    try {
      await updateAccount({
        variables: {
          documentId: accountDocumentId,
          data: {
            localtunes_public: localTunesPublicLink.trim()
          }
        }
      });

      toast.success('LocalTunes public profile link updated successfully!');
      refetch();
    } catch (error) {
      console.error('Failed to update LocalTunes public link:', error);
      toast.error('Failed to update LocalTunes public profile link. Please try again.');
    } finally {
      setIsUpdatingLink(false);
    }
  };

  // Note: Subscription page now handles everything (subscription creation, Local Tunes account creation)
  // When user returns from subscription page, they should already be connected
  // Just refetch to update the UI
  useEffect(() => {
    const state = location.state as any;
    if (state?.continueWithLocalTunes && state?.selectedPlan) {
      // User completed subscription, refresh data to show connected state
      refetch();
    }
  }, [location.state, refetch]);

  const handleConnectLocalTunesAfterPlanSelection = async () => {
    if (!authUser) {
      toast.error('User information not available');
      return;
    }

    if (!accountDocumentId) {
      toast.error('Account information not available');
      return;
    }

    toast.info('Music account setup is temporarily unavailable.');
  };

  const handleConnectLocalTunes = async () => {
    if (!authUser) {
      toast.error('User information not available');
      return;
    }

    if (!accountDocumentId) {
      toast.error('Account information not available');
      return;
    }

    // Check if user has selected a subscription plan
    const selectedPlan = localStorage.getItem('selectedSubscriptionPlan');

    if (!selectedPlan) {
      // Navigate to subscription plans page
      navigate("/subscription-plans", {
        state: {
          fromSettings: true
        }
      });
      return;
    }

    // User has selected a plan, proceed with connection
    await handleConnectLocalTunesAfterPlanSelection();
  };

  if (!isLocalTunesEnabled()) {
    return (
      <div className="bg-dashboard-sidebar rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h3 className="text-dashboard font-semibold font-poppins mb-2">
              Local Tunes
            </h3>
            <p className="text-dashboard-muted text-sm font-poppins">
              Local Tunes integration is currently disabled
            </p>
          </div>
          <div className="text-gray-400 text-sm">
            Disabled
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-dashboard-sidebar rounded-xl p-6">
        <div className="flex flex-col">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              {/* Local Tunes Logo */}
              <div className="w-10 h-10 rounded-lg overflow-hidden bg-black flex items-center justify-center">
                <img
                  src="/locar-tunes.png"
                  alt="Local Tunes Logo"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    // Fallback to gradient icon if logo fails to load
                    e.currentTarget.style.display = 'none';
                    (e.currentTarget.nextElementSibling as HTMLElement)!.style.display = 'flex';
                  }}
                />
                {/* Fallback gradient icon */}
                <div className="w-full h-full bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 flex items-center justify-center hidden">
                  <svg className="w-6 h-6 text-dashboard" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM15.657 6.343a1 1 0 011.414 0A9.972 9.972 0 0119 12a9.972 9.972 0 01-1.929 5.657 1 1 0 11-1.414-1.414A7.971 7.971 0 0017 12a7.971 7.971 0 00-1.343-4.243 1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
              <h3 className="text-dashboard font-semibold font-poppins">
                Local Tunes
              </h3>
            </div>

            {/* Dynamic description based on connection status */}
            <p className="text-dashboard-muted text-sm font-poppins mb-3">
              {localTunesConnected === true
                ? "Your explorers account is connected to Local Tunes music platform"
                : "Connect your explorers account to Local Tunes music platform"
              }
            </p>

            {/* Connection Status */}
            <div className="flex items-center gap-2 mb-4">
              {accountLoading ? (
                <div className="flex items-center gap-2 text-blue-400 text-sm">
                  <span className="inline-block w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  Loading...
                </div>
              ) : localTunesConnected === true ? (
                <div className="flex items-center gap-2 text-green-400 text-sm">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Connected
                </div>
              ) : (
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  Not Connected
                </div>
              )}
            </div>

            {/* LocalTunes Public Profile Link - Only show when connected */}
            {localTunesConnected && (
              <div className="mb-4">
                <label className="block text-dashboard text-sm font-medium mb-2">
                  LocalTunes Public Profile Link
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={localTunesPublicLink}
                    onChange={(e) => setLocalTunesPublicLink(e.target.value)}
                    placeholder="https://localtunes.earth/profile/yourusername"
                    disabled={!!currentLocalTunesPublicLink}
                    className={`flex-1 px-3 py-2 border rounded-lg text-dashboard placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${currentLocalTunesPublicLink
                      ? 'bg-dashboard-muted border-dashboard cursor-not-allowed opacity-60'
                      : 'bg-dashboard-muted border-dashboard'
                      }`}
                  />
                  {!currentLocalTunesPublicLink && (
                    <Button
                      btnText={isUpdatingLink ? "Saving..." : "Save"}
                      size="small"
                      variant="primary"
                      onClickHandler={handleUpdateLocalTunesPublicLink}
                      disabled={isUpdatingLink || localTunesPublicLink.trim() === currentLocalTunesPublicLink}
                    />
                  )}
                </div>
                <p className="text-dashboard-muted text-xs mt-1">
                  {currentLocalTunesPublicLink
                    ? "Your LocalTunes public profile link has been set and cannot be changed"
                    : "Add your LocalTunes public profile URL to share your music with others. You won't be able to edit it later."
                  }
                </p>
              </div>
            )}
          </div>

          {/* Buttons on separate line */}
          <div className="flex flex-row sm:flex-col gap-2 mt-4">
            {localTunesConnected === true ? (
              <Button
                btnText="Go to Local Tunes"
                size="small"
                variant="primary"
                onClickHandler={handleGoToLocalTunes}
              />
            ) : (
              <Button
                btnText={isConnecting ? "Connecting..." : "Connect"}
                size="small"
                variant="primary"
                onClickHandler={handleConnectLocalTunes}
                disabled={isConnecting || accountLoading}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
});

ConnectedAccounts.displayName = 'ConnectedAccounts';

export default ConnectedAccounts;
