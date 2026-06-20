import {
  ApolloQueryResult,
  OperationVariables,
  useMutation,
  useQuery,
} from "@apollo/client";
import { createRecommendationLinkMutation } from "../api/mutation";
import useAuthStore from "../../../store/store";
import { accountDataQuery } from "../api/query";
import { KeyValuePair } from "../components/RecommendForm";
import { toast } from "sonner";
import { selectedCity, useCityStore } from "../../../store/useCityStore";
import axios from "axios";
import { GOOGLE_PLACES_API_BASE_URL } from "../../../config";
import { toUrlSlug } from "../../../utils/formatAddress";
import { useTranslation } from "react-i18next";
import {
  generateLocationThumbnailPath,
  generateRandomFileName,
  sanitizeUsername,
} from "../../../utils/uploadPathGenerator";

interface UseCreateLocationProps {
  setIsLocationModalOpen: (isOpen: boolean) => void;
  refetchCities: (
    variables?: Partial<OperationVariables> | undefined
  ) => Promise<ApolloQueryResult<unknown>>;
  setIsLoading: (isloading: boolean) => void;
  cities?: any;
}

export const useCreateLocation = ({
  refetchCities,
  setIsLocationModalOpen,
  setIsLoading,
  cities,
}: UseCreateLocationProps) => {
  const { t } = useTranslation();
  const { setSelectedCity } = useCityStore();
  const [createRecommendationLink] = useMutation(
    createRecommendationLinkMutation
  );
  const { user, token } = useAuthStore();
  // accessing user document Id
  const documentId = user?.documentId;
  // form data query
  const { data } = useQuery(accountDataQuery, {
    variables: { documentId },
  });
  // account details
  const accountData = data?.usersPermissionsUser?.accounts[0];

  // const extractPlaces = (places: { slug: string; List_Name: string }[]) => {
  //   return places?.map(({ List_Name }) => ({ List_Name }));
  // };
  // const _existingPlaces = extractPlaces(cities?.recommendationLists);

  const handleLocationSubmit = async (values: KeyValuePair) => {

    // Duplicate check is now handled in AddLocationModal by place_id
    // This check is kept as a fallback but should not block valid different locations
    // with the same name but different place_id

    const placeDetails = await axios.get(
      `${GOOGLE_PLACES_API_BASE_URL}/${
        values.placeId
      }?fields=id,displayName,primaryType,primaryTypeDisplayName,priceRange,rating,userRatingCount,location,photos&key=${
        import.meta.env.VITE_GOOGLE_MAPS_API_KEY
      }`
    );
    const photoReferences = placeDetails.data.photos?.map(
      (photo: { name: string }) => photo.name.split(`${values.placeId}/`)[1]
    ) || [];

    let photoUrl: string | undefined;

    // Only upload to S3 if photos are available
    if (photoReferences.length > 0) {
      const googlePhotoResponse = await fetch(
        `${GOOGLE_PLACES_API_BASE_URL}/${values.placeId}/${
          photoReferences[0]
        }/media?maxWidthPx=400&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`,
        { redirect: "follow" }
      );
      
      if (!googlePhotoResponse.ok) {
        throw new Error("Failed to fetch Google photo");
      }

      // Download the image from Google
      const imageBlob = await googlePhotoResponse.blob();

      // Upload to S3
      const username = sanitizeUsername(user?.username || "user");
      const randomFileName = generateRandomFileName(
        `${values.listName || "location"}.jpg`
      );
      const structuredPath = generateLocationThumbnailPath(username);

      const formData = new FormData();
      formData.append(
        "files",
        new File([imageBlob], randomFileName, { type: imageBlob.type })
      );
      formData.append("path", structuredPath);

      const uploadResponse = await axios.post(
        `${import.meta.env.VITE_REST_API_URL}/upload`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );

      const uploadedImage = uploadResponse.data?.[0];
      if (!uploadedImage?.url) {
        throw new Error("Failed to upload image to S3");
      }

      photoUrl = uploadedImage.url;
    }

    // Calculate display_order (max + 1)
    const existingLists = cities?.recommendationLists || [];
    let nextDisplayOrder = 1;
    if (existingLists.length > 0) {
      const orders = existingLists
        .map((l: any) => l.display_order)
        .filter((o: any) => typeof o === "number");
      if (orders.length > 0) {
        nextDisplayOrder = Math.max(...orders) + 1;
      } else {
        nextDisplayOrder = existingLists.length + 1;
      }
    }

    try {
      setIsLoading(true);
      const response = await createRecommendationLink({
        variables: {
          data: {
            Instagram_Media_URL: values.recommendationSocialLink,
            List_Name: values.listName,
            Visibility: false,
            List_Name_Details: {
              note: values.note,
              thumbnail: photoUrl,
              location: placeDetails?.data?.location,
              place_id: values.placeId, // Store place_id for duplicate detection
            },
            slug: toUrlSlug(values.listName),
            account: accountData?.documentId,
            display_order: nextDisplayOrder,
            is_pinned: false,
          },
        },
      });
      if (response.data) {
        const { data } = await refetchCities();

        // Find the newly created city in the fetched data
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        const updatedCity = data?.recommendationLists?.find(
          (list: selectedCity) => list.List_Name === values.listName
        );

        // Update selected city if found
        if (updatedCity) {
          setSelectedCity(updatedCity);
        }

        toast(t("dashboard.recommendations.toastMessages.listCreated"));
        setIsLoading(false);
        setIsLocationModalOpen(false);
        // Note: Do NOT call advanceToNextStep() here - location creation is not part of the walkthrough
        // The walkthrough starts when user clicks Setup button, and should start from step 0
      }
    } catch (error) {
      setIsLoading(false);
    }
  };

  return { handleLocationSubmit, accountData };
};
