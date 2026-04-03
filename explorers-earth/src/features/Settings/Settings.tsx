import { memo, useState } from "react";
import BillingTab from "./components/BillingTab";
import EyeOffIcon from "../../assets/icons/EyeOffIcon";
import EyeOnIcon from "../../assets/icons/EyeOnIcon";
import Button from "../../components/ui/Button";
import { gql, useMutation, useQuery } from "@apollo/client";
import {
  updatePasswordMutation,
  deleteAccountMutation,
  accountQuery,
  addReasonForLeavingMutation,
  updateBlockedStatusMutation,
  updateTabVisibilityMutation,
} from "./api/mutation";
import useAuthStore from "../../store/store";
import { toast } from "sonner";
import Modal from "../../components/ui/Modal";
import { useNavigate } from "react-router-dom";
import { loginQuery } from "../Authentication/api/mutation";
import { EarthLoader } from "../../components/EarthLoader";
import PasswordInput from "../../components/ui/PasswordInput";
import { validatePassword } from "../../utils/passwordValidator";
import { useTranslation } from "react-i18next";
import Accordion from "../../components/ui/Accordian";
import LanguageSelector from "./components/LanguageSelector";
import ConnectedAccounts from "./components/ConnectedAccounts";


const providerQuery = gql`
  query UsersPermissionsUser($documentId: ID!) {
    usersPermissionsUser(documentId: $documentId) {
      provider
    }
  }
`;

const Settings = memo(() => {
  // Tab state
  const [activeTab, setActiveTab] = useState<'account' | 'billing'>('account');
  // navigate hook
  const navigate = useNavigate();
  // State for toggling password visibility
  const [currentPasswordVisible, setCurrentPasswordVisible] = useState(false);
  // state for handling password modal
  const [showPasswordModal, setShowPasswordModal] = useState<boolean>(false);
  // accessing the data form the global state
  const { user, logout, updateUserBlocked } = useAuthStore();
  // local state for handling the password
  const [newPassword, setNewPassword] = useState<string>("");
  // local state for handling the password
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  // local state for handling the password
  const [currentPassword, setCurrentPassword] = useState<string>("");
  // Password validation states
  const [isNewPasswordValid, setIsNewPasswordValid] = useState<boolean>(false);
  // update password mutation
  const [updatePassword] = useMutation(updatePasswordMutation);
  const [login] = useMutation(loginQuery);
  // accessing user status
  const userBlocked = user?.blocked;
  // status update mutation
  const [updateBlockedStatus] = useMutation(updateBlockedStatusMutation);
  // local state for modal
  const [showModal, setShowModal] = useState<boolean>(false);
  const [password, setPassword] = useState<string>("");
  const [loginPassword, setLoginPassword] = useState<boolean>(false);
  const [username, setUsername] = useState<string>("");
  const [showDeleteAccountModal, setShowDeleteAccountModal] =
    useState<boolean>(false);
  const [deleteStep, setDeleteStep] = useState<number>(1); // 1: confirm, 2: user details, 3: reason, 4: confirm delete
  const [deleteUsername, setDeleteUsername] = useState<string>("");
  const [deletePassword, setDeletePassword] = useState<string>("");
  const [deletePasswordConfirm, setDeletePasswordConfirm] =
    useState<string>("");
  const [deleteReason, setDeleteReason] = useState<string>("");
  const [deleteConfirmation, setDeleteConfirmation] = useState<string>("");
  const [deleteAccountLoading, setDeleteAccountLoading] =
    useState<boolean>(false);
  // Password visibility states for delete account modal
  const [deletePasswordVisible, setDeletePasswordVisible] = useState<boolean>(false);
  const [deletePasswordConfirmVisible, setDeletePasswordConfirmVisible] = useState<boolean>(false);
  // State for tracking password change redirect loading
  const [
    isRedirectingAfterPasswordChange,
    setIsRedirectingAfterPasswordChange,
  ] = useState<boolean>(false);
  const [addReasonForLeaving] = useMutation(addReasonForLeavingMutation);
  const [updateTabVisibility] = useMutation(updateTabVisibilityMutation);
  // Optimistic UI state for tab visibility toggles
  const [tabVisibilityOverrides, setTabVisibilityOverrides] = useState<Record<string, any>>({});
  const [tabVisibilityLoading, setTabVisibilityLoading] = useState<Record<string, boolean>>({});

  const { data } = useQuery(providerQuery, {
    variables: {
      documentId: user?.documentId,
    },
    skip: !user?.documentId,
  });

  const { data: accountData } = useQuery(accountQuery, {
    variables: {
      filters: {
        username: {
          eq: deleteUsername,
        },
      },
    },
    skip: !deleteUsername,
  });

  // Query for current user's account data for tab visibility settings
  const { data: currentUserAccountData, refetch: refetchAccountData } = useQuery(accountQuery, {
    variables: {
      filters: {
        username: {
          eq: user?.username,
        },
      },
    },
    skip: !user?.username,
  });

  const [deleteAccount] = useMutation(deleteAccountMutation);
  const { t } = useTranslation();

  // Helper to get the effective toggle value (optimistic override > server data)
  const getTabVisibility = (tabType: string): boolean => {
    if (tabType in tabVisibilityOverrides) {
      return tabVisibilityOverrides[tabType] as boolean;
    }
    return currentUserAccountData?.accounts[0]?.[tabType] === "Yes";
  };

  const getPinnedNavTabs = (): string[] => {
    if ('pinned_nav_tabs' in tabVisibilityOverrides) {
      return tabVisibilityOverrides['pinned_nav_tabs'] || [];
    }
    return currentUserAccountData?.accounts[0]?.pinned_nav_tabs || [];
  };

  const isTabPinned = (tabType: string): boolean => {
    return getPinnedNavTabs().includes(tabType);
  };

  const handleNavPinUpdate = async (tabType: string, isPinned: boolean) => {
    const currentAccount = currentUserAccountData?.accounts[0];
    if (!currentAccount?.documentId) {
      toast.error("Account not found");
      return;
    }

    let currentPinned = getPinnedNavTabs();

    if (isPinned) {
      if (currentPinned.length >= 5) {
        toast.error("You can only select up to 5 tabs for the navigation menu");
        return;
      }
      currentPinned = [...currentPinned, tabType];
    } else {
      currentPinned = currentPinned.filter(t => t !== tabType);
    }

    setTabVisibilityOverrides(prev => ({ ...prev, pinned_nav_tabs: currentPinned }));
    setTabVisibilityLoading(prev => ({ ...prev, [`pin_${tabType}`]: true }));

    try {
      await updateTabVisibility({
        variables: {
          documentId: currentAccount.documentId,
          data: {
            pinned_nav_tabs: currentPinned
          }
        }
      });
      toast.success("Navigation tabs updated successfully");
      await refetchAccountData();
    } catch (error) {
      console.error("Error updating pinned tabs:", error);
      toast.error("Failed to update navigation menu settings");
    } finally {
      setTabVisibilityOverrides(prev => {
        const next = { ...prev };
        delete next['pinned_nav_tabs'];
        return next;
      });
      setTabVisibilityLoading(prev => ({ ...prev, [`pin_${tabType}`]: false }));
    }
  };

  // Function to update tab visibility with optimistic UI
  const handleTabVisibilityUpdate = async (tabType: string, isVisible: boolean) => {
    const currentAccount = currentUserAccountData?.accounts[0];
    if (!currentAccount?.documentId) {
      toast.error("Account not found");
      return;
    }

    // Automatically unpin the tab if it is being hidden
    let newPinnedTabs = getPinnedNavTabs();
    let unpinned = false;
    if (!isVisible && newPinnedTabs.includes(tabType)) {
      newPinnedTabs = newPinnedTabs.filter(t => t !== tabType);
      unpinned = true;
    }

    // Optimistic: toggle immediately + show loading
    setTabVisibilityOverrides(prev => ({ 
      ...prev, 
      [tabType]: isVisible,
      ...(unpinned ? { pinned_nav_tabs: newPinnedTabs } : {}) 
    }));
    setTabVisibilityLoading(prev => ({ ...prev, [tabType]: true }));

    try {
      const updateData: any = { [tabType]: isVisible ? "Yes" : "No" };
      if (unpinned) {
        updateData.pinned_nav_tabs = newPinnedTabs;
      }

      await updateTabVisibility({
        variables: {
          documentId: currentAccount.documentId,
          data: updateData
        }
      });

      toast.success(`Tab visibility updated successfully`);
      await refetchAccountData(); // Refresh the data
      // Clear override since server data is now up-to-date
      setTabVisibilityOverrides(prev => {
        const next = { ...prev };
        delete next[tabType];
        if (unpinned) delete next['pinned_nav_tabs'];
        return next;
      });
    } catch (error) {
      console.error("Error updating tab visibility:", error);
      toast.error("Failed to update tab visibility");
      // Revert optimistic update on failure
      setTabVisibilityOverrides(prev => {
        const next = { ...prev };
        delete next[tabType];
        if (unpinned) delete next['pinned_nav_tabs'];
        return next;
      });
    } finally {
      setTabVisibilityLoading(prev => ({ ...prev, [tabType]: false }));
    }
  };

  // function to update password
  const handleUpdatePassword = async () => {
    // Validate current password is provided
    if (!currentPassword.trim()) {
      toast.error(t("settings.account.changePassword.currentPasswordRequired"));
      return;
    }

    // Validate new password using centralized validator
    const newPasswordValidation = validatePassword(newPassword, {
      currentPassword: currentPassword,
    });

    if (!newPasswordValidation.isValid) {
      toast.error(t("auth.validations.general.fillRequiredFields"));
      return;
    }

    // Validate password confirmation
    if (newPassword !== confirmPassword) {
      toast.error(t("auth.validations.confirmPassword.mustMatch"));
      return;
    }

    try {
      // mutation
      await updatePassword({
        variables: {
          currentPassword: currentPassword,
          password: newPassword,
          passwordConfirmation: confirmPassword,
        },
      });

      // success handling
      toast.success(t("settings.account.changePassword.successMessage"));



      // reseting the local state
      setNewPassword("");
      setCurrentPassword("");
      setConfirmPassword("");
      setShowPasswordModal(false);

      // Show loading state during redirect delay
      setIsRedirectingAfterPasswordChange(true);

      // Security: Log out user and redirect to login after password change
      // This ensures the old session is invalidated and user must re-authenticate
      setTimeout(() => {
        // Clear any stored tokens
        localStorage.removeItem("qrtoken");
        // Log out from global state
        logout();
        // Redirect to login page
        navigate("/login");
        // Reset loading state (though component will unmount)
        setIsRedirectingAfterPasswordChange(false);
      }, 2000); // Give user time to see the success message
    } catch (err) {
      // error handling
      const errorMessage =
        (err as any)?.graphQLErrors?.[0]?.message ||
        t("toast.error.failedToUpdatePassword");
      toast.error(errorMessage);
      setShowPasswordModal(false);
    }
  };

  // deactive user account
  const handleConfirmDeactivateAccount = async () => {


    const isGoogleUser = data?.usersPermissionsUser?.provider === "google";

    if (!username) {
      toast.error(t("settings.account.changePassword.accountDetailsRequired"));
      return;
    }

    // Only validate password for manual auth users
    if (!isGoogleUser && !password) {
      toast.error(t("settings.account.changePassword.accountDetailsRequired"));
      return;
    }

    try {
      // Only validate password by login for manual auth users
      if (!isGoogleUser) {
        // login
        const response = await login({
          // passing variables
          variables: {
            input: {
              identifier: username,
              password: password,
            },
          },
        });

        if (!response.data) {
          return;
        }
      }

      // Proceed with account deactivation/activation
      try {
        const response = await updateBlockedStatus({
          variables: {
            updateUsersPermissionsUserId: user?.id,
            data: { blocked: !userBlocked },
          },
        });
        if (response.data) {
          toast.success(
            userBlocked
              ? t("settings.account.deactivateAccount.activatedMessage")
              : t("settings.account.deactivateAccount.successMessage")
          );
          updateUserBlocked(!userBlocked);
          setShowModal(false);
          navigate("/");
          logout();
        }
      } catch (error) {
        console.error(error);
        toast.error(t("settings.account.changePassword.updateAccountStatusFailed"));
      }
    } catch (error) {
      const errorMessage =
        (error as any)?.graphQLErrors?.[0]?.message || t("toast.error.somethingWentWrong");
      toast.error(errorMessage);
      // logging the error as well
    }
  };

  // Multi-step modal handlers
  const handleDeleteAccountStep2 = () => {
    const isGoogleUser = data?.usersPermissionsUser?.provider === "google";

    if (!deleteUsername) {
      toast.error(t("auth.validations.general.fillRequiredFields"));
      return;
    }

    // Only validate password for manual auth users
    if (!isGoogleUser) {
      if (!deletePassword || !deletePasswordConfirm) {
        toast.error(t("auth.validations.general.fillRequiredFields"));
        return;
      }
      if (deletePassword !== deletePasswordConfirm) {
        toast.error(t("auth.validations.confirmPassword.mustMatch"));
        return;
      }
    }

    setDeleteStep(3);
  };

  const handleDeleteAccountStep3 = async () => {
    if (!deleteReason.trim()) {
      toast.error(t("settings.account.deleteAccount.step4.reasonRequired"));
      return;
    }
    try {
      await addReasonForLeaving({
        variables: {
          Reasons: { reason: deleteReason },
          User_Details: {
            username: deleteUsername,
            userID: user?.id,
            email: user?.email,
            address: accountData?.accounts?.[0]?.Addresss,
          },
        },
      });
      setDeleteStep(4);
    } catch (error) {
      toast.error(t("settings.account.changePassword.saveReasonFailed"));
    }
  };

  const handleDeleteAccountFinal = async () => {
    if (deleteConfirmation.trim() !== t("settings.account.deleteAccount.step4.confirmTextValue")) {
      toast.error(
        t("settings.account.deleteAccount.step4.confirmationRequired")
      );
      return;
    }

    const isGoogleUser = data?.usersPermissionsUser?.provider === "google";

    setDeleteAccountLoading(true);
    try {
      // Only validate password for manual auth users
      if (!isGoogleUser) {
        // Validate password before proceeding with deletion
        if (!deletePassword.trim()) {
          toast.error(t("settings.account.changePassword.passwordRequiredForDeletion"));
          setDeleteAccountLoading(false);
          return;
        }

        // First, validate the password by attempting to login
        const loginResponse = await login({
          variables: {
            input: {
              identifier: deleteUsername,
              password: deletePassword,
            },
          },
        });

        if (!loginResponse.data?.login?.jwt) {
          toast.error(t("settings.account.changePassword.invalidPassword"));
          setDeleteAccountLoading(false);
          return;
        }
      }

      // Proceed with account deletion
      if (
        !accountData ||
        !accountData.accounts ||
        !accountData.accounts[0]?.documentId
      ) {
        toast.error(
          t("settings.account.changePassword.accountDocumentIdNotFound")
        );
        setDeleteAccountLoading(false);
        return;
      }

      await deleteAccount({
        variables: {
          deleteUsersPermissionsUserId: user?.id,
          filters: {
            documentId: {
              eq: user?.documentId,
            },
          },
          deleteAccountDocumentId2: accountData.accounts[0].documentId,
          documentId: user?.documentId,
        },
      });
      toast.success(t("settings.account.deleteAccount.step4.successMessage"));
      setShowDeleteAccountModal(false);
      setDeleteStep(1);

      // Clear all storage on account deletion
      logout();

      localStorage.removeItem("auth-storage");
      localStorage.removeItem("qrtoken");
      localStorage.removeItem("localTunes_session");
      sessionStorage.removeItem("explorers_user_credentials");
      localStorage.clear();
      sessionStorage.clear();

      // Clear all cookies
      document.cookie.split(";").forEach(function (c) {
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });

      navigate("/login");
    } catch (error) {
      console.error(error);
      // Check if it's a login error (invalid password) - only for manual auth users
      if (!isGoogleUser && error instanceof Error && error.message.includes('Invalid identifier or password')) {
        toast.error(t("settings.account.changePassword.invalidPassword"));
      } else {
        toast.error(t("settings.account.changePassword.deleteAccountFailed"));
      }
    } finally {
      setDeleteAccountLoading(false);
    }
  };

  // Show loading screen during password change redirect
  if (isRedirectingAfterPasswordChange) {
    return (
      <div className="bg-dashboard-bg">
        <EarthLoader context="login" statusMessage={t("settings.account.changePassword.redirectMessage")} />
      </div>
    );
  }

  return (
    <div className="dashboard-theme min-h-screen bg-dashboard-bg">
      <div className="bg-dashboard-bg w-full h-full mx-auto max-w-3xl min-h-screen px-4 md:px-6 pt-8 md:pt-5 pb-24 md:pb-6">
        {/* Tab Switcher - Sticky positioning below header on scroll */}
        <div className="z-[50] sticky top-[73px] md:top-0 w-full -mx-4 md:-mx-6 mb-6 bg-dashboard-bg py-2">
          <div className="flex items-center justify-center bg-white font-poppins rounded-3xl mx-auto w-fit">
            <button
              onClick={() => setActiveTab('account')}
              className={`px-4 py-2 text-xs font-medium transition-all duration-300 whitespace-nowrap ${activeTab === 'account'
                ? 'bg-gradient-to-r bg-dashboard-accent rounded-2xl text-dashboard'
                : 'bg-white rounded-2xl text-black'
                }`}
            >
              Account
            </button>
            <button
              onClick={() => setActiveTab('billing')}
              className={`px-4 py-2 text-xs font-medium transition-all duration-300 whitespace-nowrap ${activeTab === 'billing'
                ? 'bg-gradient-to-r bg-dashboard-accent rounded-2xl text-dashboard'
                : 'bg-white rounded-2xl text-black'
                }`}
            >
              Billing
            </button>
          </div>
        </div>

        {/* Account Tab Content */}
        {activeTab === 'account' && (
          <div className="bg-dashboard-sidebar/30 backdrop-blur-sm rounded-2xl px-4 py-4 sm:px-6 sm:py-6 space-y-6 border border-white/20 shadow-xl">
            {/* Account & Security Accordion */}
            <Accordion heading={t("settings.account.security.title")} defaultOpen={false}>
              <div className="space-y-6">
                {/* Change Password Section */}
                {data?.usersPermissionsUser?.provider !== "google" && (
                  <div className="bg-dashboard-sidebar rounded-xl p-4 border-b border-white/10 sm:border-b-0">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex-1">
                        <h3 className="text-white font-semibold font-poppins mb-1">
                          {t("settings.account.changePassword.text")}
                        </h3>
                        <p className="text-white/60 text-sm font-poppins">
                          {t("settings.account.changePassword.description")}
                        </p>
                      </div>
                      <div className="sm:flex-shrink-0">
                        <Button
                          btnText={t("settings.account.changePassword.button")}
                          size="small"
                          variant="primary"
                          onClickHandler={() => setShowPasswordModal(true)}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Deactivate Account Section */}
                <div className="bg-dashboard-sidebar rounded-xl p-4 border-b border-white/10 sm:border-b-0">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex-1">
                      <h3 className="text-white font-semibold font-poppins mb-1">
                        {t("settings.account.deactivateAccount.text")}
                      </h3>
                      <p className="text-red-400 text-sm font-poppins">
                        {t("settings.account.deactivateAccount.description")}
                      </p>
                    </div>
                    <div className="sm:flex-shrink-0">
                      <Button
                        btnText={t("settings.account.deactivateAccount.button")}
                        type="button"
                        variant="danger"
                        size="small"
                        onClickHandler={() => {
                          setUsername(user?.username || "");
                          setShowModal(true);
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Delete Account Section */}
                <div className="bg-dashboard-sidebar rounded-xl p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex-1">
                      <h3 className="text-white font-semibold font-poppins mb-1">
                        {t("settings.account.deleteAccount.text")}
                      </h3>
                      <p className="text-red-400 text-sm font-poppins">
                        {t("settings.account.deleteAccount.description")}
                      </p>
                    </div>
                    <div className="sm:flex-shrink-0">
                      <Button
                        btnText={t("settings.account.deleteAccount.button")}
                        type="button"
                        variant="danger"
                        size="small"
                        onClickHandler={() => {
                          setDeleteUsername(user?.username || "");
                          setShowDeleteAccountModal(true);
                          setDeleteStep(1);
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Accordion>

            {/* Language Preference Accordion */}
            <Accordion heading={t("settings.languagePreference.heading")} defaultOpen={false}>
              <div className="bg-dashboard-sidebar rounded-xl p-6">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="flex-1">
                    <h3 className="text-white font-semibold font-poppins mb-2 text-lg">
                      {t("settings.languagePreference.heading")}
                    </h3>
                    <p className="text-white/70 text-sm font-poppins mb-4 lg:mb-0">
                      {t("settings.languagePreference.description")}
                    </p>
                  </div>
                  <div className="w-full lg:w-80 xl:w-96">
                    <LanguageSelector />
                  </div>
                </div>
              </div>
            </Accordion>

            {/* Public Profile Settings Accordion */}
            <Accordion heading="Public Profile Settings" defaultOpen={false}>
              <div className="bg-dashboard-sidebar rounded-xl p-6">
                <div className="space-y-6">
                  {/* Pinned Navigation Tabs Selector */}
                  <div className="mb-4">
                    <div className="flex flex-col mb-4">
                      <h3 className="text-white font-semibold font-poppins text-lg mb-1">Pinned Navigation Tabs</h3>
                      <p className="text-white/70 text-sm font-poppins">Select up to 5 enabled tabs to show on your public profile's bottom navigation. Click a tab to pin or unpin it.</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {Object.entries({
                        public_profile: "Profile",
                        public_recommendations: "Recommendations", 
                        public_music: "Music",
                        public_guides: "Guides",
                        public_movie: "Movies & Shows",
                        public_books: "Books",
                        public_games: "Games"
                      }).map(([key, label]) => {
                        const isEnabled = getTabVisibility(key);
                        if (!isEnabled) return null;
                        const pinned = isTabPinned(key);
                        
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => handleNavPinUpdate(key, !pinned)}
                            disabled={tabVisibilityLoading[`pin_${key}`]}
                            className={`relative px-4 py-2 rounded-full text-sm font-poppins font-medium transition-all ${
                              pinned 
                                ? 'bg-[hsl(var(--blue-cta))] text-white border border-[hsl(var(--blue-cta))]' 
                                : 'bg-dashboard-muted text-dashboard-light hover:text-white border border-white/10 hover:border-white/30'
                            } ${tabVisibilityLoading[`pin_${key}`] ? 'opacity-70 cursor-not-allowed' : ''}`}
                          >
                            {tabVisibilityLoading[`pin_${key}`] && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-full">
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              </div>
                            )}
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-6 border-t border-white/10">
                    <h3 className="text-white font-semibold font-poppins mb-2 text-lg">
                      Tab Visibility
                    </h3>
                    <p className="text-white/70 text-sm font-poppins mb-4">
                      Control which tabs are visible on your public profile page.
                    </p>
                  </div>

                  <div className="space-y-4">
                    {/* Gallery Tab Toggle */}
                    <div className="flex items-center justify-between p-4 bg-dashboard-muted rounded-lg border border-white/10">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="text-white font-medium font-poppins">Profile Tab</h4>
                          <p className="hidden sm:block text-white/60 text-sm font-poppins">Show your name, social links, photos, and videos on your public profile</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-3">
                        <div className="flex items-center gap-2">
                          
                          {tabVisibilityLoading['public_profile'] && (
                            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                          )}
                          <label className={`relative inline-flex items-center ${tabVisibilityLoading['public_profile'] ? 'pointer-events-none opacity-70' : 'cursor-pointer'}`}>
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={getTabVisibility('public_profile')}
                              onChange={(e) => handleTabVisibilityUpdate('public_profile', e.target.checked)}
                            />
                            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Business Tab Toggle */}
                    <div className="flex items-center justify-between p-4 bg-dashboard-muted rounded-lg border border-white/10">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="text-white font-medium font-poppins">Recommendation Tab</h4>
                          <p className="hidden sm:block text-white/60 text-sm font-poppins">Show recommendations and business details on your public profile</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-3">
                        <div className="flex items-center gap-2">
                          
                          {tabVisibilityLoading['public_recommendations'] && (
                            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                          )}
                          <label className={`relative inline-flex items-center ${tabVisibilityLoading['public_recommendations'] ? 'pointer-events-none opacity-70' : 'cursor-pointer'}`}>
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={getTabVisibility('public_recommendations')}
                              onChange={(e) => handleTabVisibilityUpdate('public_recommendations', e.target.checked)}
                            />
                            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Music Tab Toggle */}
                    <div className="flex items-center justify-between p-4 bg-dashboard-muted rounded-lg border border-white/10">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM15.657 6.343a1 1 0 011.414 0A9.972 9.972 0 0119 12a9.972 9.972 0 01-1.929 5.657 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 12a7.971 7.971 0 00-1.343-4.243 1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="text-white font-medium font-poppins">Music Tab</h4>
                          <p className="hidden sm:block text-white/60 text-sm font-poppins">Show music preferences and playlists on your public profile</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-3">
                        <div className="flex items-center gap-2">
                          
                          {tabVisibilityLoading['public_music'] && (
                            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                          )}
                          <label className={`relative inline-flex items-center ${tabVisibilityLoading['public_music'] ? 'pointer-events-none opacity-70' : 'cursor-pointer'}`}>
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={getTabVisibility('public_music')}
                              onChange={(e) => handleTabVisibilityUpdate('public_music', e.target.checked)}
                            />
                            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Guides Tab Toggle */}
                    <div className="flex items-center justify-between p-4 bg-dashboard-muted rounded-lg border border-white/10">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="text-white font-medium font-poppins">Guides Tab</h4>
                          <p className="hidden sm:block text-white/60 text-sm font-poppins">Show guides and travel recommendations on your public profile</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-3">
                        <div className="flex items-center gap-2">
                          
                          {tabVisibilityLoading['public_guides'] && (
                            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                          )}
                          <label className={`relative inline-flex items-center ${tabVisibilityLoading['public_guides'] ? 'pointer-events-none opacity-70' : 'cursor-pointer'}`}>
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={getTabVisibility('public_guides')}
                              onChange={(e) => handleTabVisibilityUpdate('public_guides', e.target.checked)}
                            />
                            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Movies & Shows Tab Toggle */}
                    <div className="flex items-center justify-between p-4 bg-dashboard-muted rounded-lg border border-white/10">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="text-white font-medium font-poppins">Movies & Shows Tab</h4>
                          <p className="hidden sm:block text-white/60 text-sm font-poppins">Show your curated movies and TV shows on your public profile</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-3">
                        <div className="flex items-center gap-2">
                          
                          {tabVisibilityLoading['public_movie'] && (
                            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                          )}
                          <label className={`relative inline-flex items-center ${tabVisibilityLoading['public_movie'] ? 'pointer-events-none opacity-70' : 'cursor-pointer'}`}>
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={getTabVisibility('public_movie')}
                              onChange={(e) => handleTabVisibilityUpdate('public_movie', e.target.checked)}
                            />
                            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Books Tab Toggle */}
                    <div className="flex items-center justify-between p-4 bg-dashboard-muted rounded-lg border border-white/10">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="text-white font-medium font-poppins">Books Tab</h4>
                          <p className="hidden sm:block text-white/60 text-sm font-poppins">Show your curated book recommendations on your public profile</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-3">
                        <div className="flex items-center gap-2">
                          
                          {tabVisibilityLoading['public_books'] && (
                            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                          )}
                          <label className={`relative inline-flex items-center ${tabVisibilityLoading['public_books'] ? 'pointer-events-none opacity-70' : 'cursor-pointer'}`}>
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={getTabVisibility('public_books')}
                              onChange={(e) => handleTabVisibilityUpdate('public_books', e.target.checked)}
                            />
                            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Games Tab Toggle */}
                    <div className="flex items-center justify-between p-4 bg-dashboard-muted rounded-lg border border-white/10">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="text-white font-medium font-poppins">Games Tab</h4>
                          <p className="hidden sm:block text-white/60 text-sm font-poppins">Show your curated game lists on your public profile</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-3">
                        <div className="flex items-center gap-2">
                          
                          {tabVisibilityLoading['public_games'] && (
                            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                          )}
                          <label className={`relative inline-flex items-center ${tabVisibilityLoading['public_games'] ? 'pointer-events-none opacity-70' : 'cursor-pointer'}`}>
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={getTabVisibility('public_games')}
                              onChange={(e) => handleTabVisibilityUpdate('public_games', e.target.checked)}
                            />
                            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                          </label>
                        </div>
                      </div>
                    </div>


                  </div>
                </div>
              </div>
            </Accordion>


            {/* Connected Accounts Accordion */}
            <Accordion heading="Connected Accounts" defaultOpen={false}>
              <ConnectedAccounts />
            </Accordion>
          </div>
        )}

        {/* Billing Tab Content */}
        {activeTab === 'billing' && (
          <div className="bg-dashboard-sidebar/30 backdrop-blur-sm rounded-2xl px-4 py-4 sm:px-6 sm:py-6 border border-white/20 shadow-xl">
            <BillingTab />
          </div>
        )}
      </div>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <Modal
          isOpen={showPasswordModal}
          onClose={() => setShowPasswordModal(false)}
        >
          <div className="dashboard-theme flex flex-col gap-6 w-full mx-auto min-w-[300px] sm:min-w-[500px] md:min-w-[600px] max-w-2xl py-4 sm:py-6 md:py-8 px-6 sm:px-8 md:px-12">
            <h2 className="dt-heading mb-2">
              {t("settings.account.changePassword.modalTitle")}
            </h2>

            {/* Current Password */}
            <div className="flex flex-col gap-2">
              <label className="dt-label text-sm font-medium">
                {t("settings.account.changePassword.currentPassword")}
              </label>
              <div className="relative w-full">
                <input
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  type={currentPasswordVisible ? "text" : "password"}
                  placeholder={t(
                    "settings.account.changePassword.currentPasswordPlaceholder"
                  )}
                  className="w-full dt-input"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() =>
                    setCurrentPasswordVisible(!currentPasswordVisible)
                  }
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 cursor-pointer text-gray-400 hover:text-white transition-colors"
                >
                  {currentPasswordVisible ? <EyeOnIcon /> : <EyeOffIcon />}
                </button>
              </div>
            </div>

            {/* New Password with Validation */}
            <div className="w-full">
              <PasswordInput
                value={newPassword}
                onChange={setNewPassword}
                label={t("settings.account.changePassword.newPassword")}
                labelColor="white"
                placeholder={t(
                  "settings.account.changePassword.newPasswordPlaceholder"
                )}
                currentPassword={currentPassword}
                showStrengthMeter={true}
                onValidationChange={(isValid) => setIsNewPasswordValid(isValid)}
                data-testid="new-password-input"
              />
            </div>

            {/* Confirm Password */}
            <div className="w-full">
              <PasswordInput
                value={confirmPassword}
                onChange={setConfirmPassword}
                label={t("settings.account.changePassword.confirmPassword")}
                labelColor="white"
                placeholder={t(
                  "settings.account.changePassword.confirmPasswordPlaceholder"
                )}
                showStrengthMeter={false}
                showValidationStatus={false}
                data-testid="confirm-password-input"
              />

              {/* Password match indicator */}
              {confirmPassword && (
                <div className="mt-2">
                  {newPassword === confirmPassword ? (
                    <div className="flex items-center text-green-500 dt-subtext">
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
                      <span>{t("auth.validations.confirmPassword.match")}</span>
                    </div>
                  ) : (
                    <div className="flex items-center text-white-danger dt-subtext">
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
                      <span>{t("auth.validations.confirmPassword.mustMatch")}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Update Button */}
            <div className="flex justify-end mt-6">
              <Button
                btnText={t("settings.account.changePassword.updateButton")}
                size="small"
                variant="primary"
                onClickHandler={handleUpdatePassword}
                disabled={
                  !isNewPasswordValid ||
                  newPassword !== confirmPassword ||
                  !currentPassword.trim()
                }
              />
            </div>
          </div>
        </Modal>
      )
      }

      {/* Deactivate Account Modal */}
      {
        showModal && (
          <Modal isOpen={showModal} onClose={() => setShowModal(false)}>
            <div className="dashboard-theme flex flex-col gap-6 w-full mx-auto min-w-[300px] sm:min-w-[500px] md:min-w-[600px] max-w-2xl py-4 sm:py-6 md:py-8 px-6 sm:px-8 md:px-12">
              <h1 className="dt-heading">{t("settings.account.deactivateAccount.modalTitle")}</h1>
              <p className="dt-label text-white-muted">
                {t("settings.account.deactivateAccount.modalDescription")}
              </p>

              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label className="dt-label text-sm font-medium">
                    {t("settings.account.deactivateAccount.enterUsername")}
                  </label>
                  <div className="relative w-full">
                    <input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      type={"text"}
                      placeholder={t(
                        "settings.account.deactivateAccount.usernamePlaceholder"
                      )}
                      className="dt-input w-full"
                      readOnly
                    />
                  </div>
                </div>
                {/* Only show password field for manual auth users */}
                {data?.usersPermissionsUser?.provider !== "google" && (
                  <div className="flex flex-col gap-2">
                    <label className="dt-label text-sm font-medium">
                      {t("settings.account.deactivateAccount.enterPassword")}
                    </label>
                    <div className="relative w-full">
                      <input
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        type={loginPassword ? "text" : "password"}
                        placeholder={t(
                          "settings.account.deactivateAccount.passwordPlaceholder"
                        )}
                        className="dt-input w-full"
                      />
                      <button
                        type="button"
                        onClick={() => setLoginPassword(!loginPassword)}
                        className="absolute right-4 top-1/2 transform -translate-y-1/2 cursor-pointer text-gray-400 hover:text-white transition-colors"
                      >
                        {loginPassword ? <EyeOnIcon /> : <EyeOffIcon />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-end mt-6">
                <Button
                  btnText={`${userBlocked
                    ? t(
                      "settings.account.deactivateAccount.deactivatedButton"
                    )
                    : t("settings.account.deactivateAccount.confirmButton")
                    }`}
                  type="button"
                  size="small"
                  variant="danger"
                  onClickHandler={handleConfirmDeactivateAccount}
                />
              </div>
            </div>
          </Modal>
        )
      }

      {/* Multi-step Delete Account Modals */}
      {
        showDeleteAccountModal && deleteStep === 1 && (
          <Modal
            isOpen={showDeleteAccountModal}
            onClose={() => setShowDeleteAccountModal(false)}
          >
            <div className="dashboard-theme w-full mx-auto min-w-[300px] sm:min-w-[500px] md:min-w-[600px] max-w-2xl py-4 sm:py-6 md:py-8 px-6 sm:px-8 md:px-12">
              <h1 className="dt-heading">{t("settings.account.deleteAccount.step1.modalTitle")}</h1>
              <p className="dt-label w-3/4 text-white-muted mt-6">
                {t("settings.account.deleteAccount.step1.modalDescription")}
              </p>
              <p className="dt-label w-3/4 text-white-muted mt-2">
                {t("settings.account.deleteAccount.step1.modalDescription2")}
              </p>
              <div className="flex flex-col sm:flex-row gap-2 mt-6">
                <Button
                  btnText={t("common.cancel")}
                  type="button"
                  size="xsmall"
                  variant="green"
                  onClickHandler={() => {
                    setShowDeleteAccountModal(false);
                    setUsername(user?.username || "");
                    setShowModal(true);
                  }}
                />
                <Button
                  btnText={t(
                    "settings.account.deleteAccount.step1.continueButton"
                  )}
                  type="button"
                  size="xsmall"
                  variant="dashAccent"
                  onClickHandler={() => setDeleteStep(2)}
                />
              </div>
            </div>
          </Modal>
        )
      }

      {
        showDeleteAccountModal && deleteStep === 2 && (
          <Modal
            isOpen={showDeleteAccountModal}
            onClose={() => setShowDeleteAccountModal(false)}
          >
            <div className="dashboard-theme w-full mx-auto min-w-[300px] sm:min-w-[500px] md:min-w-[600px] max-w-2xl py-4 sm:py-6 md:py-8 px-6 sm:px-8 md:px-12">
              <h1 className="dt-heading">{t("settings.account.deleteAccount.step2.modalTitle")}</h1>
              <div className="flex flex-col mt-6 gap-2 md:justify-center mx-auto">
                <div className="flex flex-col gap-1 dt-subtext">
                  <h1> {t("settings.account.deleteAccount.step2.enterUsername")}</h1>
                  <div className="relative w-full">
                    <input
                      value={deleteUsername}
                      onChange={(e) => setDeleteUsername(e.target.value)}
                      type="text"
                      placeholder={t(
                        "settings.account.deleteAccount.step2.usernamePlaceholder"
                      )}
                      className="dt-input w-full"
                      readOnly
                    />
                  </div>
                </div>

                {/* Only show password fields for manual auth users */}
                {data?.usersPermissionsUser?.provider !== "google" && (
                  <>
                    <div className="flex flex-col gap-1 dt-subtext">
                      <h1> {t("settings.account.deleteAccount.step2.enterPassword")}</h1>
                      <div className="relative w-full">
                        <input
                          value={deletePassword}
                          onChange={(e) => setDeletePassword(e.target.value)}
                          type={deletePasswordVisible ? "text" : "password"}
                          placeholder={t(
                            "settings.account.deleteAccount.step2.passwordPlaceholder"
                          )}
                          className="dt-input w-full"
                        />
                        <button
                          type="button"
                          onClick={() => setDeletePasswordVisible(!deletePasswordVisible)}
                          className="absolute right-4 top-1/2 transform -translate-y-1/2 cursor-pointer text-gray-400 hover:text-white transition-colors"
                          aria-label={deletePasswordVisible ? t('common.hidePassword') : t('common.showPassword')}
                        >
                          {deletePasswordVisible ? <EyeOnIcon /> : <EyeOffIcon />}
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1 dt-subtext">
                      <h1>
                        {t("settings.account.deleteAccount.step2.confirmPassword")}
                      </h1>
                      <div className="relative w-full">
                        <input
                          value={deletePasswordConfirm}
                          onChange={(e) => setDeletePasswordConfirm(e.target.value)}
                          type={deletePasswordConfirmVisible ? "text" : "password"}
                          placeholder={t(
                            "settings.account.deleteAccount.step2.confirmPasswordPlaceholder"
                          )}
                          className="dt-input w-full"
                        />
                        <button
                          type="button"
                          onClick={() => setDeletePasswordConfirmVisible(!deletePasswordConfirmVisible)}
                          className="absolute right-4 top-1/2 transform -translate-y-1/2 cursor-pointer text-gray-400 hover:text-white transition-colors"
                          aria-label={deletePasswordConfirmVisible ? t('common.hidePassword') : t('common.showPassword')}
                        >
                          {deletePasswordConfirmVisible ? <EyeOnIcon /> : <EyeOffIcon />}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="flex justify-end mt-8">
                <Button
                  btnText={t(
                    "settings.account.deleteAccount.step2.continueButton"
                  )}
                  type="button"
                  size="xsmall"
                  variant="primary"
                  onClickHandler={handleDeleteAccountStep2}
                />
              </div>
            </div>
          </Modal>
        )
      }

      {
        showDeleteAccountModal && deleteStep === 3 && (
          <Modal
            isOpen={showDeleteAccountModal}
            onClose={() => setShowDeleteAccountModal(false)}
          >
            <div className="dashboard-theme w-full mx-auto min-w-[300px] sm:min-w-[500px] md:min-w-[600px] max-w-2xl py-4 sm:py-6 md:py-8 px-6 sm:px-8 md:px-12">
              <h1 className="dt-heading">{t("settings.account.deleteAccount.step3.modalTitle")}</h1>
              <div className="flex flex-col mt-6 gap-2 md:justify-center mx-auto">
                <textarea
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder={t(
                    "settings.account.deleteAccount.step3.reasonPlaceholder"
                  )}
                  className="dt-input w-full min-h-[100px]"
                />
              </div>
              <div className="flex justify-end mt-8">
                <Button
                  btnText={t(
                    "settings.account.deleteAccount.step3.continueButton"
                  )}
                  type="button"
                  size="xsmall"
                  variant="primary"
                  onClickHandler={handleDeleteAccountStep3}
                />
              </div>
            </div>
          </Modal>
        )
      }

      {
        showDeleteAccountModal && deleteStep === 4 && (
          <Modal
            isOpen={showDeleteAccountModal}
            onClose={() => setShowDeleteAccountModal(false)}
          >
            <div className="dashboard-theme w-full mx-auto min-w-[300px] sm:min-w-[500px] md:min-w-[600px] max-w-2xl py-4 sm:py-6 md:py-8 px-6 sm:px-8 md:px-12">
              <h1 className="dt-heading"> {t("settings.account.deleteAccount.step4.modalTitle")}</h1>
              <div className="flex flex-col mt-8 gap-4 md:justify-center mx-auto">
                <h1 className="dt-subtext">{t("settings.account.deleteAccount.step4.confirmText")}</h1>
                <div className="relative w-full">
                  <input
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    type="text"
                    placeholder={t(
                      "settings.account.deleteAccount.step4.confirmPlaceholder"
                    )}
                    className="dt-input w-full"
                  />
                </div>
              </div>
              <div className="flex justify-end mt-8">
                <Button
                  btnText={t(
                    "settings.account.deleteAccount.step4.deleteButton"
                  )}
                  type="button"
                  size="xsmall"
                  variant="danger"
                  onClickHandler={handleDeleteAccountFinal}
                  isLoading={deleteAccountLoading}
                  disabled={deleteAccountLoading}
                />
              </div>
            </div>
          </Modal>
        )
      }
    </div >
  );
});

export default Settings;