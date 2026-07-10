import * as Yup from "yup";
import { Places } from "../../Profile/types/types";
import { useTranslation } from "react-i18next";
import { useMemo } from "react";
type MediaItem = {
  __typename: string;
  url: string;
};

interface PlaceDetails {
  Title: string;
  Rating: number;
  Place_Id: string;
  Place_Name: string;
  Geometry?: {
    lat: number;
    lng: number;
  };
  Place_Address?: string;
  Rating_Count?: number;
}

type RecommendationSubCategory = {
  __typename: string;
  sub_category: string;
  documentId: string;
};

type RecommendationCategory = {
  Category_Name: string;
  documentId: string;
};

interface FetchedPlace {
  recommendedPlace: {
    Contact_Name: string;
    Contact_Number: string;
    Media: MediaItem[];
    recommendation_category: RecommendationCategory;
    Place_Details: PlaceDetails;
    Places_Social_Link: string | null;
    Places_Website: string | null;
    Users_Place_Note: string | null;
    Users_Social_URL: string;
    documentId: string;
    media_details: string | null;
    recommendation_sub_category: RecommendationSubCategory;
    user_recommendation_note: string;
    user_rating?: number | null;
    google_rating?: number | null;
  };
}
export const useRecommendationFields = ({
  places,
  isCustom,
  fetchedPlace,
  recommendationType = "place",
  instagramLink = null,
  instagramCaption = null,
  personName = null,
}: {
  places?: Places | null;
  isCustom: boolean;
  fetchedPlace?: FetchedPlace;
  recommendationType?: "place" | "person";
  instagramLink?: string | null;
  instagramCaption?: string | null;
  personName?: string | null;
}) => {
  const { t } = useTranslation();

  // inital values for recommended place
  const initialValues = useMemo(() => {
    // For person recommendations, never use places data
    if (recommendationType === "person") {
      return {
        title: personName || "",
        address: "",
        recommendation: instagramLink || "",
        subcategory: "",
        contactName: personName || "",
        contactNumber: "",
        socialLink: instagramLink || "",
        recommendationLink: instagramLink || "",
        reason: instagramCaption || "",
      };
    }

    // For place recommendations, use places data when available
    return {
      title: places?.name || "",
      address: places?.formatted_address || "",
      recommendation: "",
      subcategory: "",
      contactName: "",
      contactNumber: places?.formatted_phone_number || "",
      socialLink: places?.website || "",
      recommendationLink: instagramLink || "",
      reason: instagramCaption || "",
      userRating: null,
      googleRating: (places as any)?.rating ? ((places as any).rating * 2).toFixed(1) : "",
    };
  }, [places, recommendationType, instagramLink, instagramCaption, personName]);

  const editInitialValues = useMemo(() => ({
    title: fetchedPlace?.recommendedPlace?.Place_Details?.Title || "",
    address: fetchedPlace?.recommendedPlace?.Place_Details?.Place_Address || "",
    recommendation: "",
    subcategory:
      fetchedPlace?.recommendedPlace?.recommendation_sub_category
        ?.documentId || "",
    category:
      fetchedPlace?.recommendedPlace?.recommendation_category
        ?.documentId || "",
    contactName: fetchedPlace?.recommendedPlace?.Contact_Name || "",
    contactNumber: fetchedPlace?.recommendedPlace?.Contact_Number || "",
    socialLink:
      fetchedPlace?.recommendedPlace?.Places_Website ||
      fetchedPlace?.recommendedPlace?.Places_Social_Link ||
      "",
    lat: fetchedPlace?.recommendedPlace?.Place_Details?.Geometry?.lat,
    lng: fetchedPlace?.recommendedPlace?.Place_Details?.Geometry?.lng,
    recommendationLink: fetchedPlace?.recommendedPlace?.Users_Social_URL || "",
    reason: fetchedPlace?.recommendedPlace?.user_recommendation_note || "",
    userRating: fetchedPlace?.recommendedPlace?.user_rating ?? null,
    googleRating: fetchedPlace?.recommendedPlace?.google_rating
      ? (fetchedPlace.recommendedPlace.google_rating * 2).toFixed(1)
      : (fetchedPlace?.recommendedPlace?.Place_Details?.Rating
        ? (fetchedPlace.recommendedPlace.Place_Details.Rating * 2).toFixed(1)
        : ""),
  }), [fetchedPlace]);

  // validation schema for recommended Place - memoized to update when language changes
  const validationSchema = useMemo(() => Yup.object({
    subcategory: Yup.string().required(t("dashboard.recommendations.addRecommendationForm.validationMessages.categoryRequired")),
    recommendationLink: Yup.string(),
    reason: Yup.string(),
    // Address is required for places, optional for persons
    address: recommendationType === "place"
      ? Yup.string().required(t("dashboard.recommendations.addRecommendationForm.validationMessages.addressRequired"))
      : Yup.string(),
    // Title is required for places, optional for persons (they use recommendation field instead)
    title: recommendationType === "place"
      ? Yup.string().required(t("dashboard.recommendations.addRecommendationForm.validationMessages.titleRequired"))
      : Yup.string(),
    // Recommendation field (Instagram/LinkedIn) is required for persons
    recommendation: recommendationType === "person"
      ? Yup.string()
        .required(t("dashboard.recommendations.addRecommendationForm.validationMessages.socialUrlRequired"))
        .test('is-valid-social-url', 'Please enter a valid Instagram or LinkedIn URL or username (e.g., instagram.com/username, @username, or linkedin.com/in/username)', (value) => {
          if (!value) return false;

          // Normalize the value
          const normalizedValue = value.trim();

          // Check for full Instagram URL (with or without protocol)
          const instagramUrlPattern = /^(https?:\/\/)?(www\.)?instagram\.com\/[\w.-]+\/?$/i;

          // Check for full LinkedIn URL (with or without protocol)
          const linkedinUrlPattern = /^(https?:\/\/)?(www\.)?linkedin\.com\/(in|company)\/[\w-]+\/?$/i;

          // Accept Instagram usernames starting with @ (convert to URL format)
          const instagramUsernamePattern = /^@([\w](?!.*?\.\.)[\w.]{0,28}[\w])$/;

          // Accept plain usernames (alphanumeric, underscore, dot) for Instagram
          const plainUsernamePattern = /^[\w](?!.*?\.\.)[\w.]{0,28}[\w]$/;

          return instagramUrlPattern.test(normalizedValue) ||
            linkedinUrlPattern.test(normalizedValue) ||
            instagramUsernamePattern.test(normalizedValue) ||
            plainUsernamePattern.test(normalizedValue);
        })
      : Yup.string(),
  }), [t, recommendationType]);

  const formFields = useMemo(() => {
    const commonFields = [
      {
        name: "address",
        label: recommendationType === "person"
          ? "Address"
          : t("dashboard.recommendations.addRecommendationForm.taggableFields.address"),
        type: "text",
        placeholder: recommendationType === "person"
          ? "Enter city or location (e.g., New York, USA)"
          : t("dashboard.recommendations.addRecommendationForm.taggableFieldsPlaceholders.address"),
        isRequired: recommendationType === "place",
      },
      {
        name: "contactNumber",
        label: "Contact Number",
        type: "text",
        placeholder: recommendationType === "person"
          ? "Enter phone number (optional)"
          : t("dashboard.recommendations.addRecommendationForm.taggableFieldsPlaceholders.contactNumber"),
      },
      {
        name: "subcategory",
        label: "Category",
        type: "dropdown",
        placeholder: t("dashboard.recommendations.addRecommendationForm.taggableFieldsPlaceholders.category"),
        isRequired: true,
      },
      {
        name: "socialLink",
        label: recommendationType === "person"
          ? "Website/Portfolio Link"
          : t("dashboard.recommendations.addRecommendationForm.taggableFields.socialLink"),
        type: "text",
        placeholder: recommendationType === "person"
          ? "Enter website or portfolio URL (optional)"
          : t("dashboard.recommendations.addRecommendationForm.taggableFieldsPlaceholders.socialLink"),
      },
      {
        name: "recommendationDetails",
        label: t("dashboard.recommendations.addRecommendationForm.accordionSection.heading"),
        type: "custom",
        components: [
          {
            name: "recommendationLink",
            label: t("dashboard.recommendations.addRecommendationForm.accordionSection.recommendationLink.label"),
            type: "text",
            placeholder: t("dashboard.recommendations.addRecommendationForm.accordionSection.recommendationLink.placeholder"),
          },
          {
            name: "reason",
            label: t("dashboard.recommendations.addRecommendationForm.accordionSection.whyRecommend.label"),
            type: "textarea",
            placeholder: t("dashboard.recommendations.addRecommendationForm.accordionSection.whyRecommend.placeholder"),
            as: "textarea",
          },
        ],
      },
      {
        name: "userRating",
        label: "Your Rating",
        type: "rating",
      },
      {
        name: "googleRating",
        label: "Google Rating",
        type: "text",
        placeholder: "e.g. 8.4/10",
      },
    ];

    const recommendationField = isCustom
      ? [
        {
          name: "recommendation",
          label: t("dashboard.recommendations.addRecommendationForm.searchField.label"),
          type: "text",
        },
      ]
      : [];

    // Different fields for place vs person
    if (recommendationType === "person") {
      return [
        ...recommendationField,
        {
          name: "contactName",
          label: t("dashboard.recommendations.addRecommendationForm.taggableFields.personName"),
          type: "text",
          placeholder: t("dashboard.recommendations.addRecommendationForm.taggableFieldsPlaceholders.personName"),
          isRequired: false,
        },
        ...commonFields,
      ];
    } else {
      // Place recommendation fields
      return [
        ...recommendationField,
        {
          name: "title",
          label: t("dashboard.recommendations.addRecommendationForm.taggableFields.title"),
          type: "text",
          placeholder: t("dashboard.recommendations.addRecommendationForm.taggableFieldsPlaceholders.title"),
          isRequired: true,
        },
        ...commonFields,
      ];
    }
  }, [t, isCustom, recommendationType]);

  return { formFields, validationSchema, initialValues, editInitialValues };
};
