import { gql, useMutation, useQuery } from "@apollo/client";
import AuthForm from "../features/Authentication/components/AuthForm";
import {
  FormValues,
  onboardingInitialValues,
} from "../features/Authentication/data";
import useAuthStore from "../store/store";
import { toast } from "sonner";
import { useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import Button from "../components/ui/Button";
import * as Yup from "yup";
import ImageCropper from "../components/ImageCropper";
import axios from "axios";
import { IMAGE_CONFIG } from "../config";
import AddressInput from "../features/Profile/components/AddressInput";
import { useReverseGeocoding } from "../features/Profile/hooks/useReverseGeocoding";
import { Places } from "../features/Profile/types/types";
import { mapAddressComponents } from "../utils/mapAddress";
import CurrLocation from "../assets/icons/CurrLocation";
import { AuthFormField } from "../features/Authentication/components/AuthForm";
import { GOOGLE_GEOCODING_BASE_URL } from "../config";
import {
  generateProfileUploadPath,
  generateRandomFileName,
  sanitizeUsername,
} from "../utils/uploadPathGenerator";
import { createUsernameValidation } from "../features/Authentication/data";
import {
  isLocalTunesEnabled,
  syncLocalTunesUser,
} from "../services/localTunesService";
import {
  autoUpdateLocalTunesPublicLink
} from "../services/ssoService";
import { useApolloClient } from "@apollo/client";
import {
  isFreePlan
} from "../services/paymentService";
import {
  removeUserCredentials,
  storeUserCredentials
} from "../utils/sessionCredentials";
import { createUserSubscriptionPlan, getSongLimits, updateSongLimit as updateSongLimitAPI, createSongLimit, getSubscriptionPlans } from "../services/subscriptionService";
import Modal from "../components/ui/Modal";
import { loginQuery } from "../features/Authentication/api/mutation";

//import { usernameValidation } from "../features/Authentication/data";

import { useUserForOnboarding } from "../features/Authentication/hooks/useCurrentUser";
import { EarthLoader } from "../components/EarthLoader";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { Check, Sparkles, Zap, Crown, LogOut } from "lucide-react";
import { useQuery as useReactQuery } from "@tanstack/react-query";

const onboardingQuery = gql`
  mutation createAccount($data: AccountInput!) {
    createAccount(data: $data) {
      documentId
      Account_Name
      Account_Type
      username
      Bio
      Addresss
      mobile_number
      Primary_Address
    }
  }
`;

/**
 * GraphQL mutation to update user details during onboarding.
 * Note: Only queries username and documentId as 'id' field is not available on UsersPermissionsUser type.
 */
const updateUserMutation = gql`
  mutation UpdateUsersPermissionsUser(
    $id: ID!
    $data: UsersPermissionsUserInput!
  ) {
    updateUsersPermissionsUser(id: $id, data: $data) {
      data {
        username
        documentId
      }
    }
  }
`;

const checkAccountQuery = gql`
  query CheckAccount($documentId: ID!) {
    usersPermissionsUser(documentId: $documentId) {
      accounts {
        Account_Name
        Account_Type
        mobile_number
      }
    }
  }
`;



const UPDATE_USER_IS_SUBSCRIBED_MUTATION = gql`
  mutation UpdateUsersPermissionsUser($id: ID!, $data: UsersPermissionsUserInput!) {
    updateUsersPermissionsUser(id: $id, data: $data) {
      data {
        documentId
        is_subscribed
      }
    }
  }
`;

const UPDATE_ACCOUNT_MUTATION = gql`
  mutation UpdateAccount($documentId: ID!, $data: AccountInput!) {
    updateAccount(documentId: $documentId, data: $data) {
      documentId
      localtunes_integrated
    }
  }
`;


// Get account fields with i18n translations
const getAccountFields = (t: any) => [
  {
    name: "accountName",
    label: t("auth.onboarding.accountDetails.displayName"),
    type: "text",
    placeholder: t("auth.onboarding.accountDetails.displayNamePlaceholder"),
  },
  {
    name: "username",
    label: t("auth.onboarding.accountDetails.username"),
    type: "text",
    placeholder: t("auth.onboarding.accountDetails.usernamePlaceholder"),
    helperText: t("auth.onboarding.accountDetails.usernameDescription"),
  },
  {
    name: "bio",
    label: t("auth.onboarding.accountDetails.bio"),
    type: "textarea",
    as: "textarea",
    placeholder: t("auth.onboarding.accountDetails.bioPlaceholder"),
  },
  {
    name: "accountType",
    label: t("auth.onboarding.accountDetails.accountType"),
    type: "customRadio",
    options: [
      {
        value: t("auth.validations.accountType.personal"),
        label: t("auth.onboarding.accountDetails.personal"),
      },
      {
        value: t("auth.validations.accountType.creator"),
        label: t("auth.onboarding.accountDetails.creator"),
      },
      {
        value: t("auth.validations.accountType.business"),
        label: t("auth.onboarding.accountDetails.business"),
      },
    ],
  },
];

// Get contact fields with i18n translations
const getContactFields = (t: any) => [
  {
    name: "mobile_number",
    label: t("auth.onboarding.contactDetails.mobileNumber"),
    type: "text",
    placeholder: t("auth.onboarding.contactDetails.mobileNumberPlaceholder"),
  },
];

// Extended address fields to match profile - will be updated with i18n in component
const getAddressFields = (t: any) => [
  {
    name: "address",
    label: t("auth.onboarding.addressDetails.address"),
    type: "address",
    placeholder: t("auth.onboarding.addressDetails.addressPlaceholder"),
    isRequired: true,
  },
  {
    name: "streetName",
    label: t("auth.onboarding.addressDetails.streetName"),
    type: "text",
    placeholder: t("auth.onboarding.addressDetails.streetNamePlaceholder"),
  },
  {
    name: "city",
    label: t("auth.onboarding.addressDetails.city"),
    type: "text",
    placeholder: t("auth.onboarding.addressDetails.cityPlaceholder"),
    isRequired: true,
  },
  {
    name: "state",
    label: t("auth.onboarding.addressDetails.state"),
    type: "text",
    placeholder: t("auth.onboarding.addressDetails.statePlaceholder"),
    isRequired: true,
  },
  {
    name: "country",
    label: t("auth.onboarding.addressDetails.country"),
    type: "text",
    placeholder: t("auth.onboarding.addressDetails.countryPlaceholder"),
    isRequired: true,
  },
  {
    name: "postalCode",
    label: t("auth.onboarding.addressDetails.postalCode"),
    type: "text",
    placeholder: t("auth.onboarding.addressDetails.postalCodePlaceholder"),
    isRequired: true,
  },
  // Separator item
  {
    name: "separator",
    type: "separator",
  },
  // Primary address fields
  {
    name: "primaryAddress",
    label: t("auth.onboarding.addressDetails.primaryAddressDescription"),
    type: "primaryAddressCombined",
    placeholder: t("auth.onboarding.addressDetails.primaryAddressPlaceholder"),
    isRequired: true,
  },
];

// Step-specific validation schemas
const createAccountValidationSchema = (t: any) =>
  Yup.object({
    accountName: Yup.string()
      .required(t("auth.validations.onboarding.displayNameRequired"))
      .min(2, t("auth.validations.onboarding.displayNameMinLength"))
      .max(50, t("auth.validations.onboarding.displayNameMaxLength")),
    username: createUsernameValidation(t),
    bio: Yup.string()
      .required(t("auth.validations.onboarding.bioRequired"))
      .max(250, t("auth.validations.onboarding.bioMaxLength")),
    accountType: Yup.string()
      .oneOf(
        [
          t("auth.validations.accountType.personal"),
          t("auth.validations.accountType.creator"),
          t("auth.validations.accountType.business"),
        ],
        t("auth.validations.accountType.invalid")
      )
      .required(t("auth.validations.accountType.required")),
  });

const contactValidationSchema = (t: any) =>
  Yup.object({
    mobile_number: Yup.string()
      .required(t("auth.validations.onboarding.mobileNumberRequired"))
      .test(
        "phone-validation",
        t("auth.validations.onboarding.mobileNumberInvalid"),
        function (value) {
          if (!value) return false;

          console.log("Validating phone number:", value);

          try {
            // Use libphonenumber-js to validate the phone number
            const phoneNumber = parsePhoneNumberFromString(value);
            console.log("Parsed phone number:", phoneNumber);

            if (phoneNumber && phoneNumber.isValid()) {
              console.log("Phone number is valid");
              return true;
            }

            // If the phone number is not valid, try to provide a more specific error
            if (phoneNumber) {
              const error = phoneNumber.getPossibleCountries();
              console.log("Possible countries:", error);
              if (error.length === 0) {
                return this.createError({
                  message: t("auth.validations.onboarding.mobileNumberInvalid"),
                });
              }
            }

            console.log("Phone number validation failed");
            return false;
          } catch (error) {
            console.warn("Phone number validation error:", error);

            // Fallback: basic validation for international format
            const internationalFormat = /^\+[1-9]\d{1,14}$/;
            if (internationalFormat.test(value)) {
              console.log("Phone number passed fallback validation");
              return true;
            }

            return false;
          }
        }
      ),
  });

const addressValidationSchema = (t: any) =>
  Yup.object({
    address: Yup.string().required(
      t("auth.validations.onboarding.addressRequired")
    ),
    primaryAddress: Yup.string().required(
      t("auth.validations.onboarding.primaryAddressRequired")
    ),
    city: Yup.string().required(t("auth.validations.onboarding.cityRequired")),
    country: Yup.string().required(
      t("auth.validations.onboarding.countryRequired")
    ),
    streetName: Yup.string().default(""),
    state: Yup.string().required(
      t("auth.validations.onboarding.stateRequired")
    ),
    postalCode: Yup.string().required(
      t("auth.validations.onboarding.postalCodeRequired")
    ),
  });

interface SubscriptionPlan {
  documentId: string;
  plan_name: string;
  cost: string;
  songs_quota: string;
  ai_guide_quota: string;
  features: Array<{ feature: string }> | string;
  duration: string;
  plan_code: string;
  feature_control: any;
  max_devices: number;
}

/**
 * ONBOARDING COMPONENT - REFACTORED FOR USERNAME SYNCHRONIZATION
 *
 * This component has been refactored to implement proper username handling:
 *
 * 1. USERNAME PRE-POPULATION:
 *    - Fetches user's registered username from Strapi using useUserForOnboarding hook
 *    - Automatically pre-fills username field in the first onboarding step
 *    - Provides visual indicator to user that field was pre-filled from registration
 *
 * 2. USERNAME VALIDATION & EDITING:
 *    - Uses OnboardingUsernameInput component with real-time validation
 *    - Allows users to edit username if needed during onboarding
 *    - Validates username availability and format in real-time
 *    - Provides suggestions for invalid usernames
 *
 * 3. USERNAME SYNCHRONIZATION:
 *    - If username is edited during onboarding, updates both:
 *      a) User collection (users-permissions-users) via GraphQL mutation
 *      b) Account document via the account creation mutation
 *    - Updates auth store with new username for consistent state
 *    - Maintains data integrity between user collection and account documents
 *
 * 4. ERROR HANDLING:
 *    - Graceful fallback if user data can't be fetched
 *    - Proper error messages if username update fails
 *    - Maintains original username if update operations fail
 *
 * 5. UX IMPROVEMENTS:
 *    - Loading state while fetching user data
 *    - Visual indicators for pre-filled fields
 *    - Helper text explaining username pre-population
 *    - Comprehensive validation feedback
 *
 * DEPENDENCIES:
 * - useUserForOnboarding: Centralized hook for fetching user data
 * - OnboardingUsernameInput: Specialized component for username input with validation
 * - updateUserMutation: GraphQL mutation for updating user collection
 * - Auth store: Global state management for user authentication
 */

const OnBoarding = () => {
  const { t } = useTranslation();
  const [activeStep, setActiveStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [hasShownAccountExistsToast, setHasShownAccountExistsToast] =
    useState(false);
  const [loadingTimeout, setLoadingTimeout] = useState(false);

  const [createAccount] = useMutation(onboardingQuery);
  const [updateUser] = useMutation(updateUserMutation);
  const [validatePassword] = useMutation(loginQuery);
  const storedUsername = useAuthStore((state) => state.user?.username);
  const userEmail = useAuthStore((state) => state.user?.email);
  const documentId = useAuthStore((state) => state.user?.documentId);
  const logout = useAuthStore((state) => state.logout);
  // const { isAuthenticated } = useAuthStore();
  const apolloClient = useApolloClient();
  const token = useAuthStore((state) => state.token);
  const navigate = useNavigate();
  const location = useLocation();
 
  // Password modal state for Local Tunes registration
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
 
  const handleLogout = async () => {
    setShowLogoutModal(false);
    logout();
 
    // Clear all explorers storage
    localStorage.removeItem("auth-storage");
    localStorage.removeItem("qrtoken");
 
    // Clear Local Tunes session
    localStorage.removeItem("localTunes_session");
 
    // Clear session storage (user credentials)
    sessionStorage.removeItem("explorers_user_credentials");
 
    // Clear all other possible storage
    localStorage.clear();
    sessionStorage.clear();
 
    // Clear all cookies
    document.cookie.split(";").forEach(function (c) {
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
 
    navigate("/login");
    toast(t("toast.success.loggedOutSuccessfully", "Logged out successfully!"));
  };
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [isValidatingPassword, setIsValidatingPassword] = useState(false);


  // Subscription plan state
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [selectedPlanData, setSelectedPlanData] = useState<SubscriptionPlan | null>(null);
  const [_localTunesRegistrationResult, setLocalTunesRegistrationResult] = useState<any>(null);
  const [isCreatingSubscription, setIsCreatingSubscription] = useState(false);
  const [accountDocumentId, setAccountDocumentId] = useState<string | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

  // Subscription plan queries and mutations - using backend API
  const { data: subscriptionPlansData, isLoading: subscriptionPlansLoading } = useReactQuery({
    queryKey: ['subscriptionPlans'],
    queryFn: getSubscriptionPlans,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
  const [updateUserIsSubscribed] = useMutation(UPDATE_USER_IS_SUBSCRIBED_MUTATION);

  // Auto-select Free plan by default when subscription plans are loaded
  useEffect(() => {
    if (subscriptionPlansData && subscriptionPlansData.length > 0 && !selectedPlan) {
      const freePlan = subscriptionPlansData.find(
        (plan: SubscriptionPlan) => plan.plan_name?.toLowerCase() === 'free'
      );
      if (freePlan) {
        setSelectedPlan(freePlan.documentId);
        setSelectedPlanData(freePlan);
      }
    }
  }, [subscriptionPlansData, selectedPlan]);
  const [_updateAccount] = useMutation(UPDATE_ACCOUNT_MUTATION);

  // Only fetch user data if we don't already have a username and haven't submitted
  const shouldFetchUser =
    !storedUsername && !hasShownAccountExistsToast && !hasSubmitted;

  /**
   * Fetch current user data from Strapi for pre-populating the username field.
   * This ensures the username displayed in onboarding matches the registered username.
   * Only fetch if we don't already have a username and we're authenticated.
   */
  const {
    username: fetchedUsername,
    loading: userLoading,
    error: userError,
  } = useUserForOnboarding(!shouldFetchUser);

  const [formData, setFormData] = useState({
    ...onboardingInitialValues,
    address: "",
    primaryAddress: "",
    streetName: "",
    city: "",
    state: "",
    country: "",
    postalCode: "",
  });

  // Initialize form data with user data when available
  useEffect(() => {
    if (fetchedUsername && !formData.username) {
      setFormData((prev) => ({
        ...prev,
        username: fetchedUsername,
      }));
    }
  }, [fetchedUsername]);

  // Initialize form data with stored user data as fallback
  useEffect(() => {
    if (storedUsername && !formData.username && !fetchedUsername) {
      setFormData((prev) => ({
        ...prev,
        username: storedUsername,
      }));
    }
  }, [storedUsername, fetchedUsername]);

  // Handle returning from subscription page
  useEffect(() => {
    const state = location.state as any;
    if (state?.continueWithLocalTunes && state?.selectedPlan && !hasSubmitted && !isSubmitting) {
      // User selected a plan, restore form data and continue with submission
      const updatedFormData = {
        ...formData,
        ...(state.formData || {}),
        localTunesConsent: true,
      };
      setFormData(updatedFormData);
      // Automatically submit the form
      setTimeout(() => {
        handleSubmit(updatedFormData);
      }, 100);
    } else if (state?.skipSubscription && !hasSubmitted && !isSubmitting) {
      // User skipped subscription, proceed without Local Tunes
      const updatedFormData = {
        ...formData,
        ...(state.formData || {}),
        localTunesConsent: false,
      };
      setFormData(updatedFormData);
      // Automatically submit the form
      setTimeout(() => {
        handleSubmit(updatedFormData);
      }, 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  // Cleanup effect to prevent queries from running after component unmounts
  useEffect(() => {
    return () => {
      // This cleanup runs when component unmounts
      // Apollo Client will automatically cancel pending queries
    };
  }, []);

  // Loading timeout effect for user data fetching
  useEffect(() => {
    if (userLoading) {
      const timer = setTimeout(() => {
        setLoadingTimeout(true);
      }, 3000); // 3 second timeout

      return () => clearTimeout(timer);
    } else {
      setLoadingTimeout(false);
    }
  }, [userLoading]);

  /**
   * Cross-browser duplicate prevention using server-side checks
   * This works across different browsers and devices
   */
  useEffect(() => {
    const checkExistingAccount = async () => {
      if (!documentId || !token || hasShownAccountExistsToast) return;


      try {
        // Check if account already exists on the server
        const existingAccountCheck = await axios.get(
          `${import.meta.env.VITE_REST_API_URL
          }/accounts?filters%5Busers_permissions_users%5D%5BdocumentId%5D%5B%24eq%5D=${documentId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (existingAccountCheck.data?.data?.length > 0) {
          console.log("Account already exists on server, redirecting to home");
          if (!hasShownAccountExistsToast) {
            setHasShownAccountExistsToast(true);
            toast.error(t('toast.error.accountAlreadyExists'));
            setTimeout(() => navigate('/home'), 2000);
          }
          return;
        }
      } catch (error) {
        console.warn("Could not check existing accounts:", error);
        // Continue with onboarding if check fails
      }
    };

    checkExistingAccount();
  }, [documentId, token, navigate, hasShownAccountExistsToast, t]);

  /**
   * Handle errors when fetching user data
   * Only show toast for critical errors, not authentication issues
   */
  useEffect(() => {
    if (userError && userError.networkError) {
      // Only show toast for network errors, not 401 authentication errors
      if (!userError.networkError.message?.includes("401")) {
        toast.error(t("toast.error.onboardingFailed"));
      }
    }
  }, [userError]);

  // Image states
  const [tempProfileImage, setTempProfileImage] = useState<File | null>(null);
  const [tempBackgroundImage, setTempBackgroundImage] = useState<File | null>(
    null
  );
  const [previewProfileImage, setPreviewProfileImage] = useState<string>("");
  const [previewBackgroundImage, setPreviewBackgroundImage] =
    useState<string>("");

  // Address states
  const [places, setPlaces] = useState<Places | null>(null);
  const { currentLocation, handleGetCurrentLocation } = useReverseGeocoding();

  // Check for existing accounts to prevent duplicates - only run on onboarding page
  const {
    data: existingAccountData,
    loading: accountCheckLoading,
    refetch,
  } = useQuery(checkAccountQuery, {
    variables: { documentId },
    skip: !documentId || !token || hasShownAccountExistsToast || hasSubmitted,
    fetchPolicy: "network-only", // Always check fresh data
    errorPolicy: "ignore", // Ignore errors to prevent UI disruption
  });

  // Check if user already has a complete account
  const existingAccount =
    existingAccountData?.usersPermissionsUser?.accounts?.[0];
  const hasCompleteAccount =
    existingAccount &&
    existingAccount.Account_Name &&
    existingAccount.Account_Type &&
    existingAccount.mobile_number;

  // Redirect if account already exists and is complete
  useEffect(() => {
    if (!accountCheckLoading && hasCompleteAccount) {
      toast.info(t('toast.error.accountAlreadyExists'));
      navigate("/home");
    }
  }, [accountCheckLoading, hasCompleteAccount, navigate]);

  // Map address components for auto-fill
  const mappedAddressData = useMemo(() => {
    if (currentLocation?.address_components?.length) {
      return mapAddressComponents(currentLocation.address_components);
    }
    if (places?.address_components?.length) {
      return mapAddressComponents(places.address_components);
    }
    return {};
  }, [currentLocation, places]);

  const handleImageUpload = async (file: File) => {
    setTempProfileImage(file);
    const previewUrl = URL.createObjectURL(file);
    setPreviewProfileImage(previewUrl);
  };

  const handleBackgroundUpload = async (file: File) => {
    setTempBackgroundImage(file);
    const previewUrl = URL.createObjectURL(file);
    setPreviewBackgroundImage(previewUrl);
  };

  const handleAddressChange = (newAddress: string) => {
    setFormData((prev) => ({
      ...prev,
      address: newAddress,
      // Don't auto-fill primaryAddress with full address
      // Let it be filled from the useEffect when location data is processed
    }));
  };

  const handleDetectLocation = () => {
    handleGetCurrentLocation();
  };

  // Function to get postal code via reverse geocoding when missing
  const getPostalCodeFromCoordinates = async (lat: number, lng: number) => {
    try {
      const response = await axios.get(
        `${GOOGLE_GEOCODING_BASE_URL}?latlng=${lat},${lng}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY
        }`
      );

      if (response.data.results && response.data.results.length > 0) {
        const geocodedResult = response.data.results[0];
        const mappedData = mapAddressComponents(
          geocodedResult.address_components
        );
        return mappedData.postal_code;
      }
    } catch (error) {
      // Handle postal code fetch error silently
    }
    return null;
  };

  const [sameAsAddress, setSameAsAddress] = useState(false);

  const handleSameAsAddressChange = (checked: boolean) => {
    setSameAsAddress(checked);
    if (checked) {
      // Extract city and country from address fields
      const city = formData.city || "";
      const country = formData.country || "";
      setFormData((prev) => ({
        ...prev,
        primaryAddress:
          city && country ? `${city}, ${country}` : city || country,
      }));
    }
  };

  useEffect(() => {
    if (sameAsAddress) {
      const city = formData.city || "";
      const country = formData.country || "";
      setFormData((prev) => ({
        ...prev,
        primaryAddress:
          city && country ? `${city}, ${country}` : city || country,
      }));
    }
  }, [formData.city, formData.country, sameAsAddress]);

  // Auto-fill address fields when location is detected
  useEffect(() => {
    if (currentLocation || places) {
      const updateFormData = async () => {
        let postalCode = mappedAddressData.postal_code;

        // If postal code is missing and we have coordinates from places, try reverse geocoding
        if (!postalCode && places?.geometry?.location) {
          const lat = places.geometry.location.lat();
          const lng = places.geometry.location.lng();
          const reversedPostalCode = await getPostalCodeFromCoordinates(
            lat,
            lng
          );
          postalCode = reversedPostalCode || undefined;
        }

        setFormData((prev) => {
          const newFormData = {
            ...prev,
            address: currentLocation?.formatted_address || prev.address,
            streetName: mappedAddressData.street_name || prev.streetName,
            city: mappedAddressData.city || prev.city,
            state: mappedAddressData.state || prev.state,
            country: mappedAddressData.country || prev.country,
            postalCode: postalCode || prev.postalCode,
            // Don't auto-populate primaryAddress - let user control it explicitly
          };

          // Only update if there are actual changes
          if (JSON.stringify(newFormData) !== JSON.stringify(prev)) {
            return newFormData;
          }
          return prev;
        });
      };

      updateFormData();
    }
  }, [currentLocation, places, mappedAddressData]);

  const uploadImage = async (
    file: File,
    field: string,
    accountId: string,
    usernameForPath: string
  ) => {
    const formData = new FormData();

    // Generate structured path for organized storage
    const sanitizedUsername = sanitizeUsername(usernameForPath || "user");
    const uploadType = field === "profile_picture" ? "profile" : "background";
    const randomFileName = generateRandomFileName(file.name);
    const structuredPath = generateProfileUploadPath(
      sanitizedUsername,
      uploadType,
      randomFileName
    );

    formData.append("files", file);
    formData.append("refId", accountId);
    formData.append("field", field);
    formData.append("ref", "api::account.account");
    formData.append("path", structuredPath);

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_REST_API_URL}/upload`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data && response.data[0]?.url) {
        return response.data[0].url;
      }
      throw new Error("No URL in response");
    } catch (error) {
      console.error("Onboarding media upload failed:", error);
      throw error;
    }
  };

  // Validate explorers password
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

  // Handle password submission for Local Tunes registration
  const handlePasswordSubmit = async (_accountName?: string) => {
    if (!password.trim()) {
      toast.error('Please enter your password');
      return;
    }

    if (!storedUsername || !userEmail) {
      toast.error('User information not available');
      return;
    }

    setIsValidatingPassword(true);
    try {
      console.log('Validating explorers password for Local Tunes registration...');

      const isPasswordValid = await validateexplorersPassword(storedUsername, password);

      if (!isPasswordValid) {
        toast.error('Invalid password. Please check your password and try again.');
        setIsValidatingPassword(false);
        return;
      }

      console.log('Password validated successfully. Storing credentials for Local Tunes registration...');

      // Store credentials for Local Tunes registration (will be used in Step 5)
      storeUserCredentials({
        username: storedUsername,
        email: userEmail,
        password: password
      });

      console.log('Credentials stored. Local Tunes registration will happen after subscription plan selection in Step 5.');

      // Don't register on Local Tunes yet - wait until Step 5
      // Just advance to Step 5 (subscription plans)
      console.log('Advancing to Step 5 (Subscription Plans)...');
      setShowPasswordModal(false);
      setPassword("");
      setIsValidatingPassword(false);
      // Update formData to ensure step 5 is included in steps array
      setFormData(prev => ({ ...prev, localTunesConsent: true }));
      // Advance to step 5 (index 4)
      setActiveStep(4);

      // Don't register on Local Tunes yet - wait until Step 5
      // Just advance to Step 5 (subscription plans)
      console.log('Advancing to Step 5 (Subscription Plans)...');
      console.log('Local Tunes registration will happen after subscription plan selection');
      setShowPasswordModal(false);
      setPassword("");
      setIsValidatingPassword(false);
      // Update formData to ensure step 5 is included in steps array
      setFormData(prev => ({ ...prev, localTunesConsent: true }));
      // Advance to step 5 (index 4)
      setActiveStep(4);

    } catch (error) {
      console.error('Failed to validate password:', error);
      toast.error('Failed to validate password. Please try again.');
      setIsValidatingPassword(false);
    }
  };

  const handleSubmit = async (values: FormValues) => {
    console.log("handleSubmit called with values:", values);
    console.log("Local Tunes consent in handleSubmit:", values.localTunesConsent);
    console.log("hasCompleteAccount:", hasCompleteAccount);

    // Prevent duplicate submissions
    if (isSubmitting || hasSubmitted) {
      console.log("Submission already in progress or completed");
      toast.error(t('toast.error.submissionInProgress'));
      return;
    }

    // Check if account already exists to prevent duplicates
    if (hasCompleteAccount) {
      console.log("Account already exists, showing error");
      toast.error(t('toast.error.accountExistsRefresh'));
      return;
    }

    // Prevent submission if we've already shown the account exists toast
    if (hasShownAccountExistsToast) {
      console.log("Account exists toast already shown, preventing submission");
      return;
    }

    setIsSubmitting(true);

    try {
      // Always advance to Step 5 (Subscription Plans) - subscription is now mandatory for all registrations
      // Account creation will happen after subscription plan selection in handleSubscriptionSubmit
      console.log('Advancing to Step 5 (Subscription Plans)...');
      console.log('Account creation will happen after subscription plan selection');

      // Just advance to Step 5 (subscription plans)
      setActiveStep(4);
      setIsSubmitting(false); // Reset submitting state since we're not creating account yet
      return;
    } catch (err) {
      console.error("Onboarding error:", err);
      toast.error(t("toast.error.onboardingFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStepSubmit = async (values: FormValues, formikHelpers: any) => {
    console.log("handleStepSubmit called with:", {
      values,
      formikHelpers,
      activeStep,
      stepsLength: steps.length,
    });
    console.log("Local Tunes consent in values:", values.localTunesConsent);
    console.log("Local Tunes consent in formData:", formData.localTunesConsent);

    // Prevent submission if already submitted or in progress
    if (hasSubmitted || isSubmitting) {
      console.log("Submission already completed or in progress");
      return;
    }

    // Validate the current step using the appropriate validation schema
    try {
      const currentStepSchema = steps[activeStep].validationSchema;
      await currentStepSchema.validate(values, { abortEarly: false });

      // Update form data with current step values, ensuring localTunesConsent is preserved
      // Merge values, but prioritize localTunesConsent from formData if it exists
      const updatedFormData = {
        ...formData,
        ...values,
        // Preserve localTunesConsent from formData if it was set (don't let undefined overwrite it)
        localTunesConsent: (values.localTunesConsent !== undefined
          ? (typeof values.localTunesConsent === 'boolean' ? (values.localTunesConsent ? 'true' : 'false') : values.localTunesConsent)
          : (typeof formData.localTunesConsent === 'boolean' ? (formData.localTunesConsent ? 'true' : 'false') : formData.localTunesConsent)) as any
      } as typeof formData;
      setFormData(updatedFormData);

      // Step 4 (index 3) is Local Tunes consent - should advance to Step 5 (Subscription Plans)
      // Step 5 (index 4) is Subscription Plans - handled separately via handleSubscriptionSubmit
      if (activeStep === 3) {
        // TEMPORARILY SKIPPING subscription plan step — auto-register with free plan.
        // To re-enable the plan selection UI, restore handleNext() here and
        // uncomment the 'Subscription Plans' step in the steps array below.
        console.log("Step 4 (Local Tunes), auto-registering with free plan...");
        console.log("Step 4 - localTunesConsent:", updatedFormData.localTunesConsent);
        await handleSubscriptionSubmitWithFreePlan(updatedFormData);
      } else if (activeStep === 4) {
        // Step 5 (Subscription Plans) - don't call handleSubmit, handled by handleSubscriptionSubmit
        console.log("Step 5 (Subscription Plans) - handled separately");
        // Do nothing here, the button in Step 5 UI calls handleSubscriptionSubmit directly
      } else if (activeStep === steps.length - 1) {
        // Fallback for other final steps
        console.log("Final step, calling handleSubmit with:", updatedFormData);
        await handleSubmit(updatedFormData as any);
      } else {
        console.log("Not final step, calling handleNext");
        handleNext();
      }
    } catch (error) {
      console.log("Validation failed:", error);
      if (error instanceof Yup.ValidationError) {
        // Set field errors in Formik
        const errors: { [key: string]: string } = {};
        error.inner.forEach((err) => {
          if (err.path) {
            errors[err.path] = err.message;
          }
        });
        formikHelpers.setErrors(errors);

        // Show toast for validation errors
        toast.error(t("toast.error.validationError"));
      }
    }
  };

  const handleNext = () => {
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  // Helper functions for subscription plans
  const plans: SubscriptionPlan[] = subscriptionPlansData || [];

  // Parse features if it's a string
  const parseFeatures = (features: Array<{ feature: string }> | string): Array<{ feature: string }> => {
    if (Array.isArray(features)) {
      return features;
    }
    if (typeof features === 'string') {
      try {
        const parsed = JSON.parse(features);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  // Format cost with commas
  const formatCost = (cost: string) => {
    const numCost = parseInt(cost);
    return numCost.toLocaleString();
  };

  // Get plan icon based on plan name
  const getPlanIcon = (planName: string) => {
    if (planName?.toLowerCase() === 'free') return <Sparkles className="w-5 h-5" />;
    if (planName?.toLowerCase() === 'paid') return <Crown className="w-5 h-5" />;
    return <Zap className="w-5 h-5" />;
  };

  // Filter plans by billing period and sort: Free first, then by cost
  const sortedPlans = [...plans]
    .filter(plan => {
      const isFree = plan.plan_name?.toLowerCase() === 'free';
      return isFree || plan.duration?.toLowerCase() === billingPeriod;
    })
    .sort((a, b) => {
      if (a.plan_name === 'Free') return -1;
      if (b.plan_name === 'Free') return 1;
      // Sort by cost (lower first) for same duration
      return parseInt(a.cost) - parseInt(b.cost);
    });

  // Calculate subscription dates based on duration
  const calculateSubscriptionDates = (duration: string) => {
    const startDate = new Date();
    const endDate = new Date();

    if (duration === 'monthly') {
      endDate.setMonth(endDate.getMonth() + 1);
    } else if (duration === 'yearly') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    return {
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString()
    };
  };

  // Handle plan selection
  const handlePlanSelect = (planId: string) => {
    setSelectedPlan(planId);
    const plan = plans.find(p => p.documentId === planId);
    if (plan) {
      setSelectedPlanData(plan);
    }
  };

  // Handle Step 5 submission (subscription plan selection)
  // Accepts optional explicit plan/formData for programmatic calls (e.g. auto-free-plan).
  // When called from the plan selection UI, these params are undefined and state values are used.
  const handleSubscriptionSubmit = async (
    explicitPlanId?: string,
    explicitPlanData?: SubscriptionPlan,
    explicitFormData?: typeof formData
  ) => {
    const planId = explicitPlanId ?? selectedPlan;
    const planData = explicitPlanData ?? selectedPlanData;
    const currentFormData = explicitFormData ?? formData;

    if (!planId || !planData) {
      toast.error("Please select a subscription plan");
      return;
    }

    const authUser = useAuthStore.getState().user;
    if (!authUser?.id || !authUser?.documentId) {
      toast.error("User information not available");
      return;
    }

    // Check if plan is free - if free, create subscription directly
    // If paid, navigate to checkout page
    if (!isFreePlan(planData)) {
      // Navigate to checkout for paid plans with currentFormData
      navigate('/checkout', {
        state: {
          plan: planData,
          fromOnboarding: true,
          formData: currentFormData,
        },
      });
      return;
    }

    // For free plans, proceed with existing subscription creation flow
    setIsCreatingSubscription(true);

    try {
      // Step 0: Create explorers account (if not already created)
      console.log('Step 0: Checking if account exists, then creating if needed...');

      // Check if account already exists
      let accountDocId = accountDocumentId;
      let accountId: string | null = null;

      if (!accountDocId) {
        try {
          const existingAccountCheck = await axios.get(
            `${import.meta.env.VITE_REST_API_URL}/accounts?filters%5Busers_permissions_users%5D%5BdocumentId%5D%5B%24eq%5D=${documentId}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );

          if (existingAccountCheck.data?.data?.length > 0) {
            console.log('Account already exists, using existing account');
            accountDocId = existingAccountCheck.data.data[0]?.documentId;
            accountId = existingAccountCheck.data.data[0]?.id?.toString();
            if (accountDocId) {
              setAccountDocumentId(accountDocId);
            }
          }
        } catch (checkError) {
          console.warn("Could not verify existing accounts:", checkError);
        }
      }

      // Resolved username — may be updated below if user changed it during onboarding.
      // Declared here so it's accessible in the LocalTunes sync step after account creation.
      let usernameToUse = currentFormData.username || storedUsername || "user";

      // Create account only if it doesn't exist
      if (!accountDocId) {

        console.log('Creating new explorers account...');

        if (!currentFormData.primaryAddress || currentFormData.primaryAddress.trim() === "") {
          toast.error(t('toast.error.primaryAddressRequired'));
          setIsCreatingSubscription(false);
          return;
        }

        // Format phone number to E.164 format before saving
        let formattedPhoneNumber = currentFormData.mobile_number;
        try {
          const phoneNumber = parsePhoneNumberFromString(currentFormData.mobile_number);
          if (phoneNumber && phoneNumber.isValid()) {
            formattedPhoneNumber = phoneNumber.format('E.164');
          }
        } catch (error) {
          console.warn('Could not format phone number:', error);
        }

        // Check if username was changed during onboarding and update user record if needed
        if (currentFormData.username && currentFormData.username !== storedUsername) {
          try {
            const updateUserResponse = await updateUser({
              variables: {
                id: authUser.id,
                data: { username: currentFormData.username },
              },
            });

            if (updateUserResponse.data?.updateUsersPermissionsUser?.data) {
              usernameToUse = currentFormData.username;
              const currentUser = useAuthStore.getState().user;
              if (currentUser) {
                useAuthStore.getState().login({
                  ...currentUser,
                  username: currentFormData.username,
                  token: token!,
                });
              }
            }
          } catch (error) {
            toast.error(t('toast.error.usernameUpdateFailed'));
            usernameToUse = storedUsername || "user";
          }
        }

        const primaryAddressObject = {
          address: currentFormData.primaryAddress,
        };
        const addressObject = {
          address: currentFormData.address || "",
          streetName: currentFormData.streetName || "",
          city: currentFormData.city || "",
          state: currentFormData.state || "",
          country: currentFormData.country || "",
          postalCode: currentFormData.postalCode || "",
        };

        const accountResponse = await createAccount({
          variables: {
            data: {
              Account_Name: currentFormData.accountName,
              Account_Type: currentFormData.accountType,
              Primary_Address: JSON.stringify(primaryAddressObject),
              Addresss: JSON.stringify(addressObject),
              Bio: currentFormData.bio,
              mobile_number: formattedPhoneNumber,
              username: usernameToUse,
              users_permissions_users: documentId,
              localtunes_integrated: currentFormData.localTunesConsent ? "Yes" : "No",
            },
          },
        });

        if (!accountResponse.data?.createAccount) {
          throw new Error("Failed to create account");
        }

        console.log('explorers account created successfully');

        // Get account ID and document ID
        const accountFetchResponse = await axios.get(
          `${import.meta.env.VITE_REST_API_URL}/accounts?filters%5Busername%5D=${usernameToUse}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        accountId = accountFetchResponse.data.data[0]?.id?.toString();
        accountDocId = accountFetchResponse.data.data[0]?.documentId;

        if (accountDocId) {
          setAccountDocumentId(accountDocId);
        } else {
          const createdAccountDocId = accountResponse.data?.createAccount?.documentId;
          if (createdAccountDocId) {
            setAccountDocumentId(createdAccountDocId);
            accountDocId = createdAccountDocId;
          }
        }

        // Upload images if available
        if (accountId) {
          try {
            if (tempProfileImage) {
              await uploadImage(
                tempProfileImage,
                "profile_picture",
                accountId,
                usernameToUse
              );
              toast.success(t('toast.success.imageUploaded'));
            }
            if (tempBackgroundImage) {
              await uploadImage(
                tempBackgroundImage,
                "bg_picture",
                accountId,
                usernameToUse
              );
              toast.success(t('toast.success.imageUploaded'));
            }
          } catch (imageError) {
            console.warn("Image upload failed, but account was created:", imageError);
            toast.error(t('toast.error.imageUploadFailed'));
          }
        }

        await refetch();
        toast.success(t('toast.success.accountCreated'));
        setHasSubmitted(true);
      } else {
        console.log('Using existing account, skipping account creation');
      }

      // Step 1: Sync with LocalTunes (create Neon user or fetch existing)
      // IMPORTANT: This runs AFTER the Strapi account is created, so guestUrl
      // can be written back to the account immediately. AuthSyncManager is
      // blocked on /onboarding so this is the FIRST time the sync fires.
      console.log('Step 1: Syncing with LocalTunes...');

      if (currentFormData.localTunesConsent && isLocalTunesEnabled()) {
        try {
          // Use usernameToUse (the final resolved username after any edits)
          // This must match what was saved to the Strapi account record.
          const localTunesResult = await syncLocalTunesUser({
            id: authUser.documentId,
            username: usernameToUse,
            email: authUser.email
          });

          console.log('LocalTunes sync result:', localTunesResult);

          if (localTunesResult.success) {
            console.log('✅ LocalTunes account synced successfully');
            toast.success('LocalTunes account connected successfully!');
            setLocalTunesRegistrationResult(localTunesResult.user);

            // Write guestUrl back to Strapi account immediately.
            // accountDocId is guaranteed to exist at this point (just created above).
            // We use authUser.documentId (Strapi user, not account) for the lookup.
            const guestUrl = localTunesResult.user?.guestUrl;
            if (guestUrl && accountDocId) {
              console.log('🔗 Writing guestUrl to Strapi account:', guestUrl);
              try {
                await autoUpdateLocalTunesPublicLink(
                  apolloClient,
                  authUser.documentId,
                  guestUrl
                );
                console.log('✅ guestUrl saved to account:', guestUrl);
              } catch (linkError) {
                console.error('❌ Failed to save guestUrl to account:', linkError);
                // Non-fatal — user can reconnect from Settings
              }
            } else if (!guestUrl) {
              console.warn('⚠️ LocalTunes sync succeeded but no guestUrl in response');
            }
          } else {
            console.warn('⚠️ LocalTunes sync warning:', localTunesResult.message);
            // Non-fatal — flow continues without LocalTunes connection
          }
        } catch (localTunesError: any) {
          console.error('❌ LocalTunes sync failed:', localTunesError);
          toast.warning(`LocalTunes connection issue: ${localTunesError?.message || 'unknown error'}`);
          setLocalTunesRegistrationResult(null);
        }
      }

      // Step 2: Create subscription entry
      console.log('Step 2: Creating subscription entry...');
      const { start_date, end_date } = calculateSubscriptionDates(planData.duration);

      const subscriptionResponse = await createUserSubscriptionPlan({
        user_id: authUser.documentId,
        plan_id: planId,
        start_date: start_date,
        end_date: end_date
      });

      if (!subscriptionResponse) {
        throw new Error("Failed to create subscription entry");
      }

      console.log('Subscription entry created successfully');

      // Create or reset song_requests and ai_guide_requests for the user
      if (authUser?.username) {
        try {
          // Get the songLimit record for this user using API
          const songLimits = await getSongLimits(authUser.username);
          const songLimitRecord = songLimits?.[0];

          if (songLimitRecord?.documentId) {
            // Record exists - reset song_requests and ai_guide_requests to 0
            await updateSongLimitAPI(songLimitRecord.documentId, {
              song_requests: 0,
              ai_guide_requests: 0
            });
            console.log('Song requests and AI guide requests reset to 0');
          } else {
            // Record doesn't exist - create a new one with default values
            await createSongLimit({
              username: authUser.username,
              song_requests: 0,
              ai_guide_requests: 0
            });
            console.log('Song limit record created with default values (0/0)');
          }
        } catch (error) {
          // If getSongLimits fails (404), try to create a new record
          console.log('Song limit record not found, attempting to create...', error);
          try {
            await createSongLimit({
              username: authUser.username,
              song_requests: 0,
              ai_guide_requests: 0
            });
            console.log('Song limit record created with default values (0/0)');
          } catch (createError) {
            console.log('Could not create song limit record:', createError);
          }
        }
      }

      // Step 3: Update is_subscribed to true
      console.log('Step 3: Updating is_subscribed...');

      await updateUserIsSubscribed({
        variables: {
          id: authUser.id,
          data: {
            is_subscribed: true
          }
        }
      });

      // Note: localtunes_integrated is already set to "Yes" during account creation if user opted in
      console.log('All updates completed successfully');

      // Mark onboarding as completed
      const userId = useAuthStore.getState().user?.documentId;
      if (userId) {
        const onboardingKey = `onboarding_${userId}`;
        const tabIdKey = `onboarding_tab_${userId}`;
        const currentTabId = sessionStorage.getItem(tabIdKey);
        localStorage.setItem(
          onboardingKey,
          JSON.stringify({
            status: "completed",
            timestamp: Date.now(),
            tabId: currentTabId,
          })
        );
      }

      toast.success("Account created, Local Tunes registered, and subscription activated successfully!");

      // Navigate to home after successful completion
      removeUserCredentials();
      setHasSubmitted(true);
      navigate("/home");
    } catch (error: any) {
      console.error("Error processing subscription:", error);
      toast.error(error.message || "Failed to process subscription. Please try again.");
    } finally {
      setIsCreatingSubscription(false);
    }
  };

  /**
   * AUTO-FREE-PLAN: Programmatically registers the user with the free plan.
   * Called from Step 4 (Local Tunes) "Continue" button instead of advancing to
   * the plan selection UI (Step 5), which is temporarily hidden.
   *
   * To re-enable the plan selection step:
   *   1. In handleStepSubmit (activeStep === 3), replace this call with handleNext()
   *   2. Uncomment the 'Subscription Plans' entry in the steps array below
   */
  const handleSubscriptionSubmitWithFreePlan = async (currentFormData: typeof formData) => {
    const freePlan = subscriptionPlansData?.find(
      (plan: SubscriptionPlan) => plan.plan_name?.toLowerCase() === 'free'
    );

    if (!freePlan) {
      if (subscriptionPlansLoading) {
        toast.error("Subscription plans are still loading. Please wait a moment and try again.");
      } else {
        toast.error("Free plan not available. Please contact support.");
      }
      return;
    }

    console.log('Auto-selecting free plan:', freePlan.plan_name, freePlan.documentId);
    // Pass plan explicitly to avoid stale-state race condition
    await handleSubscriptionSubmit(freePlan.documentId, freePlan, currentFormData);
  };

  const steps = useMemo(() => {
    const baseSteps = [
      {
        title: t('auth.onboarding.accountDetails.title'),
        fields: getAccountFields(t),
        description: t('auth.onboarding.accountDetails.description'),
        validationSchema: createAccountValidationSchema(t),
      },
      {
        title: t('auth.onboarding.contactDetails.title'),
        fields: getContactFields(t),
        description: t('auth.onboarding.contactDetails.description'),
        validationSchema: contactValidationSchema(t),
      },
      {
        title: t('auth.onboarding.addressDetails.title'),
        fields: getAddressFields(t),
        description: t('auth.onboarding.addressDetails.description'),
        validationSchema: addressValidationSchema(t),
      },
      {
        title: 'Local Tunes',
        fields: [],
        description: 'Join Local Tunes music platform',
        validationSchema: Yup.object({}),
      },
      // TEMPORARILY DISABLED: Subscription Plans step (onboarding final step)
      // Users are now automatically registered with the free plan after Step 4 (Local Tunes).
      // To re-enable this step:
      //   1. Uncomment the block below
      //   2. In handleStepSubmit (activeStep === 3), replace handleSubscriptionSubmitWithFreePlan
      //      with handleNext()
      // {
      //   title: 'Subscription Plans',
      //   fields: [],
      //   description: 'Choose your subscription plan',
      //   validationSchema: Yup.object({}),
      // },
    ];

    return baseSteps;
  }, [t]);

  const renderAddressField = (field: any) => {
    // Handle separator
    if (field.type === "separator") {
      return (
        <div key={field.name} className="my-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-600 font-medium">
                {t("auth.onboarding.addressDetails.primaryAddress")}
              </span>
            </div>
          </div>
        </div>
      );
    }

    if (field.type === "address") {
      return (
        <div key={field.name} className="flex flex-col gap-2">
          <div className="flex flex-row items-center justify-between">
            <div className="flex flex-row gap-1 items-center">
              <label className="block text-xs text-white">{field.label}</label>
              {field.isRequired && (
                <span className="font-poppins text-red-500">*</span>
              )}
            </div>
            <button
              type="button"
              onClick={handleDetectLocation}
              className="flex items-center gap-2 bg-dashboard-accent text-dashboard hover:bg-dashboard-accent/90 shadow-dashboard-elevated border border-dashboard-accent rounded-full px-3 py-1.5 transition-colors duration-200 text-xs font-medium"
            >
              <CurrLocation size="14px" fill="currentColor" />
              <span>{t("auth.onboarding.addressDetails.detectLocation")}</span>
            </button>
          </div>
          <AddressInput
            setPlaces={setPlaces}
            label={field.label}
            initalValue={formData.address}
            value={formData.address}
            onChange={handleAddressChange}
            placeHolder={field.placeholder}
          />
        </div>
      );
    }

    if (field.type === "primaryAddressCombined") {
      return (
        <div key={field.name} className="flex flex-col gap-2">
          <div className="flex flex-row justify-between gap-2 items-center">
            {/* Label with asterisk grouped together */}
            <div className="flex flex-row gap-1 items-center">
              <label className="block text-xs text-white ">{field.label}</label>
              {field.isRequired && (
                <span className="font-poppins text-red-500">*</span>
              )}
            </div>

            {/* "Same as Address" checkbox stays on the right */}
            <div className="flex items-center gap-1">
              <label htmlFor="same-as-address" className="text-xs text-white ">
                {t("auth.onboarding.addressDetails.sameAsAddress")}
              </label>
              <input
                type="checkbox"
                checked={sameAsAddress}
                onChange={(e) => handleSameAsAddressChange(e.target.checked)}
                id="same-as-address"
                className="accent-dashboard-accent w-4 h-4 mt-0.5"
              />
            </div>
          </div>
          <AddressInput
            key={`${sameAsAddress}-${formData.primaryAddress}`}
            type="primaryAddressCombined"
            label={field.label}
            value={formData.primaryAddress}
            initalValue={formData.primaryAddress}
            onChange={(val) => {
              if (!sameAsAddress) {
                // Only allow manual changes when checkbox is unchecked
                setFormData((prev) => ({ ...prev, primaryAddress: val }));
              }
            }}
            placeHolder={field.placeholder}
            setPlaces={(places) => {
              if (!sameAsAddress && places && places.address_components) {
                const cityObj = places.address_components.find(
                  (comp: any) =>
                    comp.types.includes("locality") ||
                    comp.types.includes("administrative_area_level_2")
                );
                const countryObj = places.address_components.find((comp: any) =>
                  comp.types.includes("country")
                );
                const city = cityObj ? cityObj.long_name : "";
                const country = countryObj ? countryObj.long_name : "";
                setFormData((prev) => ({
                  ...prev,
                  primaryAddress:
                    city && country ? `${city}, ${country}` : city || country,
                }));
              }
            }}
            disabled={sameAsAddress}
          />
        </div>
      );
    }

    return (
      <div key={field.name} className="flex flex-col gap-1 sm:gap-2">
        <div className="flex flex-row gap-1 items-center">
          <label className="block text-xs sm:text-sm text-white font-medium">
            {field.label}
          </label>
          {field.isRequired && (
            <span className="font-poppins text-red-500 text-xs sm:text-sm">
              *
            </span>
          )}
        </div>
        <input
          name={field.name}
          type={field.type}
          placeholder={field.placeholder}
          value={field.name === 'localTunesConsent'
            ? (formData[field.name as keyof typeof formData] ? 'true' : 'false')
            : String(formData[field.name as keyof typeof formData] || "")}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              [field.name]: field.name === 'localTunesConsent'
                ? (e.target.value === 'true' || e.target.checked)
                : e.target.value
            }))
          }
          className="w-full placeholder:text-gray-400 outline-none p-2 sm:p-3 border border-dashboard bg-dashboard-muted font-poppins rounded-md text-sm text-dashboard focus:outline-none focus:ring-2 focus:ring-dashboard-accent hover:border-dashboard-accent"
        />
      </div>
    );
  };

  /**
   * Show loading state while checking for existing accounts
   */
  if (accountCheckLoading) {
    console.log("OnBoarding: Showing account check loading");
    return (
      <div className="bg-black">
        <EarthLoader context="onboarding" />
      </div>
    );
  }

  /**
   * Don't render onboarding form if account already exists and is complete
   * But show a loading state instead of null to prevent blank page
   */
  if (hasCompleteAccount) {
    console.log("OnBoarding: Account already exists, showing redirect message");
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-white">{t('toast.error.accountAlreadyExists')}</p>
        </div>
      </div>
    );
  }

  // Only show loading if we're actually loading and haven't timed out
  // AND we don't already have a username (which means we don't need to fetch)
  if (userLoading && !loadingTimeout && !storedUsername) {
    console.log("OnBoarding: Showing user loading");
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-white">{t("toast.info.loading")}</p>
        </div>
      </div>
    );
  }

  console.log("OnBoarding: Rendering main component", {
    accountCheckLoading,
    hasCompleteAccount,
    userLoading,
    loadingTimeout,
    storedUsername,
    fetchedUsername,
    hasShownAccountExistsToast,
    hasSubmitted,
  });

  // Fallback: If we somehow get here without any of the above conditions,
  // show a basic loading state to prevent blank page
  if (!accountCheckLoading && !hasCompleteAccount && !userLoading) {
    console.log("OnBoarding: Rendering onboarding form");
  }

  // Ensure we always render something
  if (!documentId || !token) {
    console.log("OnBoarding: Missing required data, showing error");
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="text-center">
          <p className="text-white">
            Missing authentication data. Please log in again.
          </p>
        </div>
      </div>
    );
  }

  // Final fallback - if we somehow get here, show the onboarding form
  console.log("OnBoarding: Rendering onboarding form - all conditions passed");

  return (
    <div className="dashboard-theme flex items-center justify-center min-h-screen bg-black p-1 sm:p-4">
      <div className="relative w-full max-w-md sm:max-w-md md:max-w-lg lg:max-w-2xl bg-dashboard-sidebar rounded-lg shadow-dashboard-elevated flex flex-col max-h-screen">
        {/* Sticky Top Bar */}
        <div className="sticky top-0 z-20 bg-dashboard-sidebar/95 backdrop-blur-md rounded-t-lg border-b border-dashboard">
          {/* Header Row */}
          <div className="flex items-center justify-between px-4 py-3.5 sm:px-6 border-b border-dashboard/30">
            <div className="flex items-center gap-3">
              <img
                src="/logo.svg"
                alt="explorers.earth"
                className="object-contain h-6 sm:h-7 w-auto"
                style={{
                  filter: "brightness(0) invert(1)",
                }}
              />
              <div className="w-[1px] h-4 bg-dashboard-muted" />
              <span className="text-[10px] sm:text-xs font-semibold text-dashboard-light tracking-widest uppercase">
                Onboarding
              </span>
            </div>
            <button
              onClick={() => setShowLogoutModal(true)}
              type="button"
              className="text-[11px] sm:text-xs text-dashboard hover:text-white transition-all duration-200 font-medium flex items-center gap-1.5 bg-dashboard-muted hover:bg-dashboard-card border border-dashboard rounded-full px-2.5 py-1.5 sm:px-3 sm:py-1.5 cursor-pointer outline-none focus:outline-none"
            >
              <span>Log out</span>
              <LogOut size={12} />
            </button>
          </div>
          
          {/* Step Indicators */}
          <div className="p-3 sm:p-4 md:p-6 pb-4 sm:pb-5">
            <div className="flex justify-between gap-2">
              {steps.map((step, index) => (
                <div
                  key={step.title}
                  className={`flex-1 text-center ${index <= activeStep
                    ? "text-dashboard-accent"
                    : "text-dashboard-light"
                    }`}
                >
                  <div
                    className={`w-6 h-6 sm:w-8 sm:h-8 mx-auto rounded-full flex items-center justify-center mb-1 sm:mb-2 text-xs sm:text-sm ${index <= activeStep
                      ? "bg-dashboard-accent text-dashboard"
                      : "bg-dashboard-muted text-dashboard-light"
                      }`}
                  >
                    {index + 1}
                  </div>
                  <div className="text-[10px] sm:text-xs font-medium leading-tight">
                    {step.title}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-4 md:px-6 pb-3 sm:pb-4 md:pb-6 scrollbar-hide">
          <div className="flex justify-center w-full">
            <div className="w-full md:max-w-md">
              {activeStep === 0 && (
                <div className="mb-6">
                  <div
                    className={`relative flex flex-col sm:flex-row justify-center items-center sm:justify-between h-32 sm:h-40 md:h-48 w-full rounded-xl p-3 sm:p-4 ${previewBackgroundImage ? "" : "bg-dashboard-bg"
                      }`}
                    style={{
                      backgroundImage: previewBackgroundImage
                        ? `url('${previewBackgroundImage}')`
                        : `url('${IMAGE_CONFIG.defaultImages.background}')`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  >
                    <div className="absolute inset-0 bg-black bg-opacity-50 z-0 rounded-xl"></div>
                    <div className="relative w-20 h-20 sm:w-24 sm:h-24 md:w-36 md:h-36 mx-auto z-10">
                      <img
                        src={
                          previewProfileImage ||
                          IMAGE_CONFIG.defaultImages.profile
                        }
                        alt={t("auth.validations.onboarding.profileImageAlt")}
                        className="w-full h-full object-cover rounded-full shadow-md"
                      />
                      <div className="absolute bottom-0 right-0">
                        <ImageCropper
                          onFileUpload={handleImageUpload}
                          cropType="profileCrop"
                          buttonTitle="Edit Profile Picture"
                        />
                      </div>
                    </div>
                    <div className="absolute -bottom-2 -right-2 sm:-bottom-3 sm:-right-3 z-10">
                      <ImageCropper
                        onFileUpload={handleBackgroundUpload}
                        cropType="backgroundCrop"
                        buttonTitle="Edit Background"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeStep === 2 ? (
                // Custom address form for step 3
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <h2 className="text-xl font-semibold text-white mb-2">
                      {t("auth.onboarding.addressDetails.title")}
                    </h2>
                    <p className="text-gray-300 text-sm">
                      {t("auth.onboarding.addressDetails.description")}
                    </p>
                  </div>

                  <div className="space-y-4">
                    {getAddressFields(t).map((field: any) =>
                      renderAddressField(field)
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        // Validate the address step data
                        await addressValidationSchema(t).validate(formData, {
                          abortEarly: false,
                        });
                        console.log(
                          "Validation passed, calling handleStepSubmit"
                        );
                        await handleStepSubmit(formData, { errors: {} });
                        // handleStepSubmit already handles advancing to the next step
                      } catch (error) {
                        console.log("Validation failed:", error);
                        if (error instanceof Yup.ValidationError) {
                          // Show specific validation errors
                          error.errors.forEach((errorMessage) => {
                            toast.error(errorMessage);
                          });
                        } else {
                          toast.error(t("toast.error.validationError"));
                        }
                      }
                    }}
                    disabled={isSubmitting || hasSubmitted}
                    className={`w-full py-2 sm:py-3 px-4 rounded-md font-medium transition-colors text-sm sm:text-base ${isSubmitting || hasSubmitted
                      ? "bg-gray-400 text-gray-200 cursor-not-allowed"
                      : "bg-dashboard-accent text-dashboard hover:bg-dashboard-accent/90"
                      }`}
                  >
                    {isSubmitting
                      ? t("auth.validations.general.processing")
                      : t("auth.onboarding.addressDetails.confirmDetails")}
                  </button>
                </div>
              ) : activeStep === 3 ? (
                // Local Tunes integration step (mandatory)
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <h2 className="text-xl font-semibold text-white mb-2">
                      Welcome to Local Tunes
                    </h2>
                    <p className="text-gray-300 text-sm">
                      Your explorers account includes access to Local Tunes music platform
                    </p>
                  </div>

                  <div className="bg-dashboard-bg rounded-lg p-6 space-y-4">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        {/* Local Tunes Logo */}
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-black flex items-center justify-center">
                          <img
                            src="/locar-tunes.png"
                            alt="Local Tunes Logo"
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              // Fallback to music icon if logo fails to load
                              e.currentTarget.style.display = 'none';
                              const nextSibling = e.currentTarget.nextElementSibling as HTMLElement;
                              if (nextSibling) {
                                nextSibling.style.display = 'flex';
                              }
                            }}
                          />
                          {/* Fallback music icon */}
                          <div className="w-full h-full bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 flex items-center justify-center" style={{ display: 'none' }}>
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                            </svg>
                          </div>
                        </div>
                      </div>
                      <div>
                        <h3 className="text-white font-medium mb-2">What is Local Tunes?</h3>
                        <p className="text-gray-300 text-sm">
                          Create collaborative music experiences that let your guests contribute to your space's atmosphere in real-time, fostering deeper connections through shared musical discovery.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <svg className="w-6 h-6 text-dashboard-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-gray-300 text-sm">
                          Your explorers account information will be used to create your Local Tunes account.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <svg className="w-6 h-6 text-dashboard-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-gray-300 text-sm">
                          Access curated playlists and music features with your subscription plan.
                        </p>
                      </div>
                    </div>

                    {/* Mandatory notice */}
                    <div className="mt-4 p-3 bg-dashboard-accent/10 border border-dashboard-accent/30 rounded-lg">
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-dashboard-accent flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-dashboard-accent text-sm font-medium">
                          Local Tunes is included with your explorers account
                        </p>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      console.log("=== Step 4 Button Clicked ===");
                      console.log("isLocalTunesEnabled:", isLocalTunesEnabled());

                      // LocalTunes consent is mandatory - set to true
                      setFormData((prev) => ({
                        ...prev,
                        localTunesConsent: true,
                      }));

                      // Ensure localTunesConsent is true in the values being passed
                      const valuesToSubmit: FormValues = {
                        ...formData,
                        localTunesConsent: 'true' as any
                      };
                      console.log("Values to submit:", valuesToSubmit);

                      // Proceed to password modal or next step
                      await handleStepSubmit(valuesToSubmit, { errors: {} });
                    }}
                    disabled={isSubmitting || hasSubmitted || isCreatingSubscription}
                    className={`w-full py-2 sm:py-3 px-4 rounded-md font-medium transition-colors text-sm sm:text-base ${isSubmitting || hasSubmitted || isCreatingSubscription
                      ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                      : 'bg-dashboard-accent text-dashboard hover:bg-dashboard-accent/90'
                      }`}
                  >
                    {isSubmitting || isCreatingSubscription ? 'Completing Registration...' : 'Complete Registration'}
                  </button>
                </div>
              ) : activeStep === 4 ? (
                // Step 5: Subscription Plans
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <h2 className="text-xl font-semibold text-white mb-2">
                      Choose Your Plan
                    </h2>
                    <p className="text-gray-300 text-sm">
                      Select the perfect subscription plan to unlock Local Tunes features
                    </p>
                  </div>

                  {/* Monthly/Yearly Tab Switcher */}
                  <div className="flex items-center justify-center mb-4">
                    <div className="flex bg-dashboard-bg rounded-full p-1 border border-gray-700">
                      <button
                        type="button"
                        onClick={() => setBillingPeriod('monthly')}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${billingPeriod === 'monthly'
                          ? 'bg-dashboard-accent text-dashboard shadow-lg'
                          : 'text-gray-400 hover:text-white'
                          }`}
                      >
                        Monthly
                      </button>
                      <button
                        type="button"
                        onClick={() => setBillingPeriod('yearly')}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${billingPeriod === 'yearly'
                          ? 'bg-dashboard-accent text-dashboard shadow-lg'
                          : 'text-gray-400 hover:text-white'
                          }`}
                      >
                        Yearly
                      </button>
                    </div>
                  </div>

                  {subscriptionPlansLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <EarthLoader context="subscription" size="small" />
                    </div>
                  ) : sortedPlans.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-gray-400">No subscription plans available at the moment</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {sortedPlans.map((plan) => {
                        const features = parseFeatures(plan.features);
                        const isSelected = selectedPlan === plan.documentId;
                        const isFree = plan.plan_name?.toLowerCase() === 'free';
                        const isYearly = plan.duration === 'yearly';

                        return (
                          <div
                            key={plan.documentId}
                            onClick={() => handlePlanSelect(plan.documentId)}
                            className={`relative cursor-pointer transition-all duration-300 ${isSelected
                              ? 'transform scale-[1.02]'
                              : 'hover:scale-[1.01]'
                              }`}
                          >
                            <div
                              className={`relative bg-dashboard-sidebar rounded-2xl p-4 sm:p-6 border-2 transition-all duration-300 ${isSelected
                                ? 'border-dashboard-accent shadow-2xl shadow-dashboard-accent/30 bg-gradient-to-br from-dashboard-sidebar to-dashboard-sidebar/80'
                                : isFree
                                  ? 'border-gray-700 hover:border-gray-600'
                                  : 'border-gray-700 hover:border-dashboard-accent/50'
                                }`}
                            >
                              {/* Selected Badge */}
                              {isSelected && (
                                <div className="absolute -top-3 right-4 bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg border-2 border-blue-300/50">
                                  Selected
                                </div>
                              )}

                              {/* Popular Badge for Yearly */}
                              {isYearly && !isSelected && (
                                <div className="absolute -top-3 right-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-black text-xs font-bold px-3 py-1 rounded-full shadow-lg border-2 border-yellow-300/50">
                                  Best Value
                                </div>
                              )}

                              {/* Plan Header */}
                              <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3 flex-1">
                                  <div className={`p-2 rounded-xl ${isFree
                                    ? 'bg-gray-700/50 text-gray-300'
                                    : 'bg-dashboard-accent/20 text-dashboard-accent'
                                    }`}>
                                    {getPlanIcon(plan.plan_name)}
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-1">
                                      <h3 className="text-lg sm:text-xl font-bold text-white">
                                        {plan.plan_name}
                                      </h3>
                                      <p className="text-xs text-gray-400 uppercase tracking-wider">
                                        {plan.duration}
                                      </p>
                                    </div>
                                    {/* Price */}
                                    <div className="flex items-baseline gap-2">
                                      <span className="text-2xl sm:text-3xl font-bold text-white">
                                        ₹{formatCost(plan.cost)}
                                      </span>
                                      {!isFree && (
                                        <span className="text-gray-400 text-sm sm:text-base">
                                          /{plan.duration === 'monthly' ? 'mo' : 'yr'}
                                        </span>
                                      )}
                                    </div>
                                    {isYearly && (
                                      <p className="text-xs text-gray-400 mt-0.5">
                                        ₹{formatCost((parseInt(plan.cost) / 12).toFixed(0))} per month
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Key Features */}
                              <div className="grid grid-cols-2 gap-2 mb-4">
                                {plan.songs_quota && (
                                  <div className="flex items-center gap-2 p-2.5 bg-dashboard-bg/50 rounded-lg">
                                    <div className="flex-shrink-0 w-4 h-4 bg-dashboard-accent/20 rounded flex items-center justify-center">
                                      <Check className="w-2.5 h-2.5 text-dashboard-accent" />
                                    </div>
                                    <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold text-white bg-gray-800 rounded-full shadow-md border border-gray-700">
                                      {plan.songs_quota} Songs
                                    </span>
                                  </div>
                                )}
                                {plan.ai_guide_quota && (
                                  <div className="flex items-center gap-2 p-2.5 bg-dashboard-bg/50 rounded-lg">
                                    <div className="flex-shrink-0 w-4 h-4 bg-dashboard-accent/20 rounded flex items-center justify-center">
                                      <Check className="w-2.5 h-2.5 text-dashboard-accent" />
                                    </div>
                                    <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold text-white bg-gray-800 rounded-full shadow-md border border-gray-700">
                                      {plan.ai_guide_quota} AI Guides
                                    </span>
                                  </div>
                                )}
                                {plan.max_devices && (
                                  <div className="flex items-center gap-2 p-2.5 bg-dashboard-bg/50 rounded-lg">
                                    <div className="flex-shrink-0 w-4 h-4 bg-dashboard-accent/20 rounded flex items-center justify-center">
                                      <Check className="w-2.5 h-2.5 text-dashboard-accent" />
                                    </div>
                                    <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold text-white bg-gray-800 rounded-full shadow-md border border-gray-700">
                                      Up to {plan.max_devices} Devices
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Features List - Show only 3 */}
                              {features.length > 0 && (
                                <div className="mb-4">
                                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                                    Features
                                  </h4>
                                  <div className="space-y-1.5">
                                    {features.slice(0, 3).map((feature, idx) => (
                                      <div
                                        key={idx}
                                        className="flex items-start gap-2"
                                      >
                                        <div className="flex-shrink-0 w-4 h-4 mt-0.5 bg-dashboard-accent/20 rounded flex items-center justify-center">
                                          <Check className="w-2.5 h-2.5 text-dashboard-accent" />
                                        </div>
                                        <span className="text-gray-300 text-xs leading-relaxed">
                                          {typeof feature === 'object' ? feature.feature : feature}
                                        </span>
                                      </div>
                                    ))}
                                    {features.length > 3 && (
                                      <div className="flex items-center gap-2 pt-1">
                                        <span className="text-gray-400 text-xs font-medium">
                                          +{features.length - 3} more features
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => handleSubscriptionSubmit()}
                    disabled={!selectedPlan || isCreatingSubscription}
                    className={`w-full py-2 sm:py-3 px-4 rounded-md font-medium transition-colors text-sm sm:text-base ${!selectedPlan || isCreatingSubscription
                      ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                      : 'bg-dashboard-accent text-dashboard hover:bg-dashboard-accent/90'
                      }`}
                  >
                    {isCreatingSubscription ? 'Processing...' : 'Proceed to Pay'}
                  </button>
                </div>
              ) : (
                <AuthForm
                  initialValues={formData as unknown as FormValues}
                  validationSchema={steps[activeStep].validationSchema}
                  onSubmit={handleStepSubmit}
                  heading={steps[activeStep].title}
                  description={steps[activeStep].description}
                  formFields={
                    steps[activeStep].fields.filter(
                      (field: any) => typeof field.label === "string"
                    ) as AuthFormField[]
                  }
                  submitButtonLabel={
                    activeStep === steps.length - 1
                      ? t("auth.onboarding.addressDetails.confirmDetails")
                      : t("auth.onboarding.accountDetails.next")
                  }
                  isLoading={isSubmitting}
                  isOnboarding={true}
                />
              )}
            </div>
          </div>

          {/* Back Button - Inside Scrollable Area */}
          {activeStep > 0 && (
            <div className="mt-4">
              <Button
                type="button"
                onClick={handleBack}
                variant="secondary"
                btnText={t("auth.onboarding.contactDetails.back")}
              />
            </div>
          )}
        </div>
      </div>

      {/* Password Modal for Local Tunes Registration */}
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
              <label className="dt-label text-sm font-medium">
                Password
              </label>
              <div className="relative w-full">
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={passwordVisible ? "text" : "password"}
                  placeholder="Enter your password"
                  className="w-full dt-input"
                  autoComplete="current-password"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isValidatingPassword) {
                      handlePasswordSubmit();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => setPasswordVisible(!passwordVisible)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 cursor-pointer text-gray-400 hover:text-white transition-colors"
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
                onClick={() => {
                  setShowPasswordModal(false);
                  setPassword("");
                }}
                variant="secondary"
                disabled={isValidatingPassword}
                btnText={t("auth.onboarding.logoutModal.cancel", "Cancel")}
              />
              <Button
                onClick={() => handlePasswordSubmit()}
                variant="primary"
                disabled={isValidatingPassword || !password.trim()}
                isLoading={isValidatingPassword}
                btnText={isValidatingPassword ? 'Creating Account...' : 'Create Local Tunes Account'}
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <Modal
          isOpen={showLogoutModal}
          onClose={() => setShowLogoutModal(false)}
        >
          <div className="dashboard-theme flex flex-col gap-6 w-full mx-auto min-w-[300px] sm:min-w-[500px] md:min-w-[600px] max-w-2xl py-4 sm:py-6 md:py-8 px-6 sm:px-8 md:px-12">
            <h2 className="dt-heading mb-2">
              {t("auth.onboarding.logoutModal.title", "Logout from explorers")}
            </h2>

            <p className="dt-label text-white-muted">
              {t("auth.onboarding.logoutModal.description", "Are you sure you want to log out? You can resume your onboarding later, but any unsaved changes on this page will be lost.")}
            </p>

            <div className="flex justify-end gap-3 mt-6">
              <Button
                onClick={() => setShowLogoutModal(false)}
                variant="secondary"
                btnText={t("auth.onboarding.logoutModal.cancel", "Cancel")}
              />
              <Button
                onClick={handleLogout}
                variant="danger"
                btnText={t("auth.onboarding.logoutModal.logout", "Log out")}
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default OnBoarding;
