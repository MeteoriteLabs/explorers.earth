import { useMemo } from "react";
import { useQuery as useReactQuery } from "@tanstack/react-query";

import useAuthStore from "../store/store";
import { getSongLimits, getUserSubscriptionPlans, getSubscriptionPlanById } from "../services/subscriptionService";



export interface AIGuideQuotaResult {
    /** Whether data is still loading */
    isLoading: boolean;
    /** Whether user has reached their AI guide quota */
    isQuotaReached: boolean;
    /** Whether user has an active non-expired subscription */
    hasActiveSubscription: boolean;
    /** Whether AI generation should be disabled */
    shouldDisableGeneration: boolean;
    /** Current AI guide requests count */
    guideRequestsCount: number;
    /** Maximum AI guide quota allowed */
    aiGuideQuota: number;
    /** Reason for disabling generation (for display in UI) */
    disableReason: string | null;
    /** Refetch function to update data */
    refetch: () => Promise<void>;
}

/**
 * Hook to check AI guide generation quota for the current user
 * Returns quota status and whether generation should be disabled
 * 
 * Usage:
 * const { shouldDisableGeneration, disableReason, isLoading } = useAIGuideQuota();
 */
export function useAIGuideQuota(): AIGuideQuotaResult {
    const { user: authUser } = useAuthStore();
    const username = authUser?.username;
    const userDocumentId = authUser?.documentId;

    // Fetch user subscription plans to get plan_id
    const {
        data: subscriptionData,
        isLoading: subscriptionsLoading,
        refetch: refetchSubscriptions
    } = useReactQuery({
        queryKey: ['userSubscriptionPlans', userDocumentId],
        queryFn: () => getUserSubscriptionPlans(userDocumentId!),
        enabled: !!userDocumentId,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    // Get latest subscription plan (by start_date)
    const activeSubscription = useMemo(() => {
        if (!subscriptionData || subscriptionData.length === 0) return null;
        return [...subscriptionData].sort((a: any, b: any) => {
            const dateA = new Date(a.start_date).getTime();
            const dateB = new Date(b.start_date).getTime();
            return dateB - dateA;
        })[0];
    }, [subscriptionData]);

    // Fetch subscription plan details to get ai_guide_quota
    const {
        data: planDetailsData,
        isLoading: planDetailsLoading,
        refetch: refetchPlanDetails
    } = useReactQuery({
        queryKey: ['subscriptionPlan', activeSubscription?.plan_id],
        queryFn: () => getSubscriptionPlanById(activeSubscription!.plan_id),
        enabled: !!activeSubscription?.plan_id,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    // Fetch song limits (which also includes ai_guide_requests)
    const {
        data: songLimitsData,
        isLoading: songLimitsLoading,
        refetch: refetchSongLimits
    } = useReactQuery({
        queryKey: ['songLimits', username],
        queryFn: () => getSongLimits(username!),
        enabled: !!username,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    // Check if there's an active non-expired subscription plan
    const hasActiveSubscription = useMemo(() => {
        if (!activeSubscription?.end_date) return false;
        const today = new Date();
        const endDate = new Date(activeSubscription.end_date);
        return endDate >= today;
    }, [activeSubscription]);

    // Calculate quota values
    const guideRequestsCount = songLimitsData?.[0]?.ai_guide_requests || 0;
    const aiGuideQuota = planDetailsData?.ai_guide_quota
        ? Number(planDetailsData.ai_guide_quota)
        : 0;

    // Check if quota is reached
    const isQuotaReached = aiGuideQuota > 0 && guideRequestsCount >= aiGuideQuota;

    // Determine if generation should be disabled and why
    const { shouldDisableGeneration, disableReason } = useMemo(() => {
        if (!hasActiveSubscription) {
            return {
                shouldDisableGeneration: true,
                disableReason: "No active subscription plan"
            };
        }
        if (isQuotaReached) {
            return {
                shouldDisableGeneration: true,
                disableReason: `AI guide limit reached (${guideRequestsCount}/${aiGuideQuota})`
            };
        }
        return {
            shouldDisableGeneration: false,
            disableReason: null
        };
    }, [hasActiveSubscription, isQuotaReached, guideRequestsCount, aiGuideQuota]);

    const isLoading = subscriptionsLoading || planDetailsLoading || songLimitsLoading;

    // Combined refetch function
    const refetch = async () => {
        await Promise.all([
            refetchSubscriptions(),
            refetchPlanDetails(),
            refetchSongLimits()
        ]);
    };

    return {
        isLoading,
        isQuotaReached,
        hasActiveSubscription,
        shouldDisableGeneration,
        guideRequestsCount,
        aiGuideQuota,
        disableReason,
        refetch
    };
}

export default useAIGuideQuota;
