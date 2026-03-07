import { useState, useEffect } from "react";
import {
  ApolloQueryResult,
  OperationVariables,
  useMutation,
} from "@apollo/client";
import {
  DeleteRecommendedListMutation,
  deleteRecommendedPlaceMutation,
  updateRecommendationListVisiblity,
} from "../api/mutation";
import { toast } from "sonner";
import { useCityStore } from "../../../store/useCityStore";
import { recommendationListQuery, recommendedPlacesQuery } from "../api/query";
import { useTranslation } from "react-i18next";

export const useMenuItems = ({
  refetchCities,
  setShowConfirmDeleteModal,
  onDeleteSuccess,
  advanceToNextStep,
  advanceToNextStepRef,
}: {
  refetchCities: (
    variables?: Partial<OperationVariables> | undefined
  ) => Promise<ApolloQueryResult<unknown>>;
  setShowConfirmDeleteModal: (show: boolean) => void;
  onDeleteSuccess?: () => void;
  advanceToNextStep?: () => void;
  advanceToNextStepRef?: { current: (() => void) | null };
}) => {
  const { t } = useTranslation();
  const { selectedCity, setSelectedCity } = useCityStore();
  const [isPublished, setIsPublished] = useState<boolean>(
    selectedCity?.Visibility || false
  );

  useEffect(() => {
    setIsPublished(selectedCity?.Visibility || false);
  }, [selectedCity]);

  const [updateRecommendationListVisibility] = useMutation(
    updateRecommendationListVisiblity,
    {
      refetchQueries: [recommendationListQuery, recommendedPlacesQuery],
      fetchPolicy: "network-only",
    }
  );

  const [deleteRecommendedList] = useMutation(DeleteRecommendedListMutation, {
    refetchQueries: [recommendationListQuery],
    fetchPolicy: "network-only",
  });
  const [deleteRecommendedPlace] = useMutation(deleteRecommendedPlaceMutation);

  const handleDeleteRecommendedList = async () => {
    try {
      // First, delete all individual places in the list
      if (selectedCity?.recommended_places && selectedCity.recommended_places.length > 0) {
        const deletePromises = selectedCity.recommended_places.map((place: any) => 
          deleteRecommendedPlace({ 
            variables: { 
              documentId: place.documentId 
            } 
          })
        );
        
        try {
          await Promise.all(deletePromises);
        } catch (placeError) {
          console.error("Error deleting individual places:", placeError);
          // Continue with list deletion even if some places fail
        }
      }

      // Then delete the recommendation list itself
      const response = await deleteRecommendedList({
        variables: {
          documentId: selectedCity?.documentId,
        },
      });

      if (response) {
        // Refetch cities to get the updated list
        const refetchResult = await refetchCities();
        
        // Set the next available city or clear if no cities left
        const updatedLists = (refetchResult as any)?.data?.recommendationLists;
        
        if (updatedLists && updatedLists.length > 0) {
          // Set to the first available list after deletion
          setSelectedCity(updatedLists[0]);
        } else {
          // No lists left, clear the selected city
          setSelectedCity(null);
        }

        toast.success(t("toast.success.recommendedCityDeleted"));
        setShowConfirmDeleteModal(false);
        
        // Call the success callback to switch to Recommendations tab
        if (onDeleteSuccess) {
          onDeleteSuccess();
        }
      }
    } catch (error) {
      console.error("Error deleting recommendation list:", error);
      toast.error(t("toast.error.failedToDeleteRecommendationList"));
    }
  };

  const handleRecommendationListVisibility = async () => {
    if (
      selectedCity?.recommended_places?.length &&
      selectedCity?.recommended_places?.length >= 1
    ) {
      try {
        const response = await updateRecommendationListVisibility({
          variables: {
            documentId: selectedCity?.documentId,
            data: {
              Visibility: !isPublished,
            },
          },
        });

        if (response) {
          const newVisibility = response.data.updateRecommendationList.Visibility;
          
          // Update local state immediately
          setIsPublished(newVisibility);
          
          // Update the useCityStore with the new Visibility value
          setSelectedCity({
            ...selectedCity,
            Visibility: newVisibility,
          });

          // Refetch cities to ensure data consistency
          refetchCities();

          toast.success(
            t(
              !isPublished
                ? "dashboard.recommendations.toastMessages.listPublished"
                : "dashboard.recommendations.toastMessages.listUnpublished"
            )
          );
          
          // Advance walkthrough to next step after successful publish toggle
          // Use the same pattern as useAddRecommendation (window.__walkthrough)
          if (newVisibility) {
            console.log('🚀 Calling advanceToNextStep() after publish toggle success');
            // Small delay to ensure state is updated and UI is ready
            setTimeout(() => {
              // Use window.__walkthrough pattern (same as working steps 0→1, 1→2)
              if (window.__walkthrough?.advanceToNextStepRef?.current) {
                window.__walkthrough.advanceToNextStepRef.current();
              } else if (advanceToNextStepRef?.current) {
                advanceToNextStepRef.current();
              } else if (advanceToNextStep) {
                advanceToNextStep();
              } else {
                console.warn('⚠️ advanceToNextStep is not available, cannot advance walkthrough');
              }
            }, 300);
          }
        }
      } catch (error) {
        console.error("Error updating visibility:", error);
        toast.error(t("dashboard.recommendations.toastMessages.listVisibilityError"));
      }
    } else {
      toast.error(
        t("dashboard.recommendations.toastMessages.listPublishError")
      );
    }
  };

  return {
    handleDeleteRecommendedList,
    handleRecommendationListVisibility,
    isPublished,
  };
};
