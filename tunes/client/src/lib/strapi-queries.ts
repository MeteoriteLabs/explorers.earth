/**
 * Strapi GraphQL Queries
 * All queries for fetching data from Strapi CMS
 */

import { useQuery } from "@tanstack/react-query";
import { strapiRequest } from "./strapi-client";

// Types
export interface Faq {
  documentId: string;
  Question: string;
  Answer: string;
  Sequence: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
  locale: string;
}

export interface SubscriptionPlanBase {
  documentId: string;
  plan_name: string;
  cost: string;
  songs_quota: string;
  features: Array<{ feature: string }>;
  duration: string;
  plan_code: string;
  feature_control?: {
    features: string[];
  };
  max_devices: number;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
}

export interface Account {
  documentId: string;
  username: string;
  email: string;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
}

export interface UsersPermissionsUser {
  documentId: string;
  username: string;
  email: string;
  is_subscribed: boolean;
}

export interface UserSubscriptionPlan {
  documentId: string;
  user_id: string;
  plan_id: string;
  start_date: string;
  end_date?: string;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
}

export interface SongLimit {
  documentId: string;
  username: string;
  song_requests: number;
  ai_guide_requests?: number;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
}

// Query responses
interface FaqsQueryResponse {
  faqs: Faq[];
}

interface SubscriptionPlanBasesQueryResponse {
  subscriptionPlanBases: SubscriptionPlanBase[];
}

interface AccountsQueryResponse {
  accounts: Account[];
}

interface UserSubscriptionPlansQueryResponse {
  userSubscriptionPlans: UserSubscriptionPlan[];
}

interface SongLimitsQueryResponse {
  songLimits: SongLimit[];
}

interface UsersPermissionsUsersQueryResponse {
  usersPermissionsUsers: UsersPermissionsUser[];
}

// GraphQL Queries
const FAQS_QUERY = `
  query Faqs($filters: FaqFiltersInput, $pagination: PaginationArg, $sort: [String], $status: PublicationStatus, $locale: I18NLocaleCode) {
    faqs(filters: $filters, pagination: $pagination, sort: $sort, status: $status, locale: $locale) {
      documentId
      Question
      Answer
      Sequence
      createdAt
      updatedAt
      publishedAt
      locale
    }
  }
`;

const SUBSCRIPTION_PLAN_BASES_QUERY = `
  query SubscriptionPlanBases($filters: SubscriptionPlanBaseFiltersInput, $pagination: PaginationArg, $sort: [String], $status: PublicationStatus) {
    subscriptionPlanBases(filters: $filters, pagination: $pagination, sort: $sort, status: $status) {
      documentId
      plan_name
      cost
      songs_quota
      features
      duration
      plan_code
      feature_control
      max_devices
      createdAt
      updatedAt
      publishedAt
    }
  }
`;

const USERS_PERMISSIONS_USERS_QUERY = `
  query UsersPermissionsUsers($filters: UsersPermissionsUserFiltersInput) {
    usersPermissionsUsers(filters: $filters) {
      documentId
      username
      email
      is_subscribed
    }
  }
`;

const ACCOUNTS_QUERY = `
  query Accounts($filters: AccountFiltersInput, $pagination: PaginationArg, $sort: [String], $status: PublicationStatus) {
    accounts(filters: $filters, pagination: $pagination, sort: $sort, status: $status) {
      documentId
      username
      email
      createdAt
      updatedAt
      publishedAt
    }
  }
`;

const USER_SUBSCRIPTION_PLANS_QUERY = `
  query UserSubscriptionPlans($filters: UserSubscriptionPlanFiltersInput, $pagination: PaginationArg, $sort: [String], $status: PublicationStatus) {
    userSubscriptionPlans(filters: $filters, pagination: $pagination, sort: $sort, status: $status) {
      documentId
      user_id
      plan_id
      start_date
      end_date
      createdAt
      updatedAt
      publishedAt
    }
  }
`;

const SONG_LIMITS_QUERY = `
  query SongLimits($filters: SongLimitFiltersInput, $pagination: PaginationArg, $sort: [String], $status: PublicationStatus) {
    songLimits(filters: $filters, pagination: $pagination, sort: $sort, status: $status) {
      documentId
      username
      song_requests
      ai_guide_requests
      createdAt
      updatedAt
      publishedAt
    }
  }
`;

// React Query Hooks
export function useFaqs(options?: {
  filters?: any;
  pagination?: any;
  sort?: string[];
  status?: "PUBLISHED" | "DRAFT";
  locale?: string;
  enabled?: boolean;
}) {
  return useQuery<Faq[]>({
    queryKey: ["strapi", "faqs", options],
    queryFn: async () => {
      const data = await strapiRequest<FaqsQueryResponse>(FAQS_QUERY, {
        filters: options?.filters,
        pagination: options?.pagination,
        sort: options?.sort || ["Sequence:asc"],
        status: options?.status || "PUBLISHED",
        locale: options?.locale,
      });
      return data.faqs;
    },
    enabled: options?.enabled !== false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useSubscriptionPlanBases(options?: {
  filters?: any;
  pagination?: any;
  sort?: string[];
  status?: "PUBLISHED" | "DRAFT";
  enabled?: boolean;
}) {
  return useQuery<SubscriptionPlanBase[]>({
    queryKey: ["strapi", "subscriptionPlanBases", options],
    queryFn: async () => {
      // Extract planId from filters if provided
      const planId = options?.filters?.documentId?.eq;

      if (planId) {
        // Get single plan by ID
        const response = await fetch(`/api/subscriptions/plans/${planId}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch subscription plan: ${response.statusText}`);
        }
        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch subscription plan');
        }
        return [result.data]; // Return as array for consistency
      } else {
        // Get all plans
        const response = await fetch('/api/subscriptions/plans');
        if (!response.ok) {
          throw new Error(`Failed to fetch subscription plans: ${response.statusText}`);
        }
        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch subscription plans');
        }
        return result.data || [];
      }
    },
    enabled: options?.enabled !== false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useAccounts(options?: {
  filters?: any;
  pagination?: any;
  sort?: string[];
  status?: "PUBLISHED" | "DRAFT";
  enabled?: boolean;
}) {
  return useQuery<Account[]>({
    queryKey: ["strapi", "accounts", options],
    queryFn: async () => {
      const data = await strapiRequest<AccountsQueryResponse>(ACCOUNTS_QUERY, {
        filters: options?.filters,
        pagination: options?.pagination,
        sort: options?.sort,
        status: options?.status || "PUBLISHED",
      });
      return data.accounts;
    },
    enabled: options?.enabled !== false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUserSubscriptionPlans(options?: {
  filters?: any;
  pagination?: any;
  sort?: string[];
  status?: "PUBLISHED" | "DRAFT";
  enabled?: boolean;
}) {
  return useQuery<UserSubscriptionPlan[]>({
    queryKey: ["strapi", "userSubscriptionPlans", options],
    queryFn: async () => {
      // Extract userId from filters
      const userId = options?.filters?.user_id?.eq;

      if (!userId) {
        return []; // Return empty array if no userId provided
      }

      const response = await fetch(`/api/subscriptions/user-plans/${userId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch user subscription plans: ${response.statusText}`);
      }
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch user subscription plans');
      }

      let plans = result.data || [];

      // Apply sorting if provided (backend doesn't support sort, so we do it client-side)
      if (options?.sort && plans.length > 0) {
        plans = [...plans].sort((a, b) => {
          for (const sortField of options.sort || []) {
            const [field, direction] = sortField.split(':');
            const aVal = a[field as keyof UserSubscriptionPlan];
            const bVal = b[field as keyof UserSubscriptionPlan];

            if (aVal === bVal) continue;

            const comparison = aVal < bVal ? -1 : 1;
            return direction === 'desc' ? -comparison : comparison;
          }
          return 0;
        });
      }

      return plans;
    },
    enabled: options?.enabled !== false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSongLimits(options?: {
  filters?: any;
  pagination?: any;
  sort?: string[];
  status?: "PUBLISHED" | "DRAFT";
  enabled?: boolean;
}) {
  return useQuery<SongLimit[]>({
    queryKey: ["strapi", "songLimits", options],
    queryFn: async () => {
      // Extract username from filters
      const username = options?.filters?.username?.eq;

      if (!username) {
        return []; // Return empty array if no username provided
      }

      const response = await fetch(`/api/subscriptions/song-limits/${username}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch song limits: ${response.statusText}`);
      }
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch song limits');
      }
      return result.data || [];
    },
    enabled: options?.enabled !== false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUsersPermissionsUsers(options?: {
  filters?: any;
  enabled?: boolean;
}) {
  return useQuery<UsersPermissionsUser[]>({
    queryKey: ["strapi", "usersPermissionsUsers", options],
    queryFn: async () => {
      const data = await strapiRequest<UsersPermissionsUsersQueryResponse>(
        USERS_PERMISSIONS_USERS_QUERY,
        {
          filters: options?.filters,
        }
      );
      return data.usersPermissionsUsers;
    },
    enabled: options?.enabled !== false,
    staleTime: 5 * 60 * 1000,
  });
}

// Combined hook for subscription plan info
export interface SubscriptionPlanInfo {
  plan: SubscriptionPlanBase | null;
  songRequests: number;
  songsQuota: number;
  isLoading: boolean;
  error: Error | null;
  latestSubscription: UserSubscriptionPlan | null;
  isActivePlan: boolean;
}

export function useUserSubscriptionPlanInfo(username: string | null | undefined) {
  // Step 1: Get user by username
  const { data: users, isLoading: isLoadingUser } = useUsersPermissionsUsers({
    filters: username ? { username: { eq: username } } : undefined,
    enabled: !!username,
  });

  const userDocumentId = users?.[0]?.documentId;

  // Step 2: Get user subscription plans
  const { data: userSubscriptions, isLoading: isLoadingSubscriptions } = useUserSubscriptionPlans({
    filters: userDocumentId ? { user_id: { eq: userDocumentId } } : undefined,
    sort: ["start_date:desc"], // Get latest first
    enabled: !!userDocumentId,
  });

  // Get the latest subscription (first one after sorting by start_date desc)
  const latestSubscription = userSubscriptions?.[0] || null;
  const planId = latestSubscription?.plan_id;

  // Step 3: Get subscription plan details
  const { data: plans, isLoading: isLoadingPlan } = useSubscriptionPlanBases({
    filters: planId ? { documentId: { eq: planId } } : undefined,
    enabled: !!planId,
  });

  const plan = plans?.[0] || null;

  // Step 4: Get song requests count
  const { data: songLimits, isLoading: isLoadingSongLimits } = useSongLimits({
    filters: username ? { username: { eq: username } } : undefined,
    enabled: !!username,
  });

  const songRequests = songLimits?.[0]?.song_requests || 0;
  const songsQuota = plan ? parseInt(plan.songs_quota) || 0 : 0;

  // Step 5: Check if plan is active (end_date >= today)
  const isActivePlan = (() => {
    if (!latestSubscription || !latestSubscription.end_date) {
      return false; // No subscription or no end_date means no active plan
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to start of day
    const endDate = new Date(latestSubscription.end_date);
    endDate.setHours(0, 0, 0, 0); // Reset time to start of day
    return endDate >= today;
  })();

  return {
    plan,
    songRequests,
    songsQuota,
    isLoading: isLoadingUser || isLoadingSubscriptions || isLoadingPlan || isLoadingSongLimits,
    error: null, // Could be enhanced to track errors from individual queries
    latestSubscription,
    isActivePlan,
  };
}

