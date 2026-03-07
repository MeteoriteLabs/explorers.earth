/**
 * Strapi GraphQL Mutations
 * All mutations for creating, updating, and deleting data in Strapi CMS
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { strapiRequest } from "./strapi-client";
import { Faq, SubscriptionPlanBase, Account, UserSubscriptionPlan, SongLimit } from "./strapi-queries";

// Mutation response types
interface CreateFaqResponse {
  createFaq: Faq;
}

interface UpdateFaqResponse {
  updateFaq: Faq;
}

interface DeleteFaqResponse {
  deleteFaq: Faq;
}

interface CreateSubscriptionPlanBaseResponse {
  createSubscriptionPlanBase: SubscriptionPlanBase;
}

interface UpdateSubscriptionPlanBaseResponse {
  updateSubscriptionPlanBase: SubscriptionPlanBase;
}

interface DeleteSubscriptionPlanBaseResponse {
  deleteSubscriptionPlanBase: SubscriptionPlanBase;
}

interface CreateAccountResponse {
  createAccount: Account;
}

interface UpdateAccountResponse {
  updateAccount: Account;
}

interface DeleteAccountResponse {
  deleteAccount: Account;
}

interface CreateUserSubscriptionPlanResponse {
  createUserSubscriptionPlan: UserSubscriptionPlan;
}

interface UpdateUserSubscriptionPlanResponse {
  updateUserSubscriptionPlan: UserSubscriptionPlan;
}

interface DeleteUserSubscriptionPlanResponse {
  deleteUserSubscriptionPlan: UserSubscriptionPlan;
}

interface CreateSongLimitResponse {
  createSongLimit: SongLimit;
}

interface UpdateSongLimitResponse {
  updateSongLimit: SongLimit;
}

interface DeleteSongLimitResponse {
  deleteSongLimit: SongLimit;
}

// GraphQL Mutations
const CREATE_FAQ_MUTATION = `
  mutation CreateFaq($data: FaqInput!) {
    createFaq(data: $data) {
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

const UPDATE_FAQ_MUTATION = `
  mutation UpdateFaq($documentId: ID!, $data: FaqInput!) {
    updateFaq(documentId: $documentId, data: $data) {
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

const DELETE_FAQ_MUTATION = `
  mutation DeleteFaq($documentId: ID!) {
    deleteFaq(documentId: $documentId) {
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

const CREATE_SUBSCRIPTION_PLAN_BASE_MUTATION = `
  mutation CreateSubscriptionPlanBase($data: SubscriptionPlanBaseInput!) {
    createSubscriptionPlanBase(data: $data) {
      documentId
      name
      price
      features
      createdAt
      updatedAt
      publishedAt
    }
  }
`;

const UPDATE_SUBSCRIPTION_PLAN_BASE_MUTATION = `
  mutation UpdateSubscriptionPlanBase($documentId: ID!, $data: SubscriptionPlanBaseInput!) {
    updateSubscriptionPlanBase(documentId: $documentId, data: $data) {
      documentId
      name
      price
      features
      createdAt
      updatedAt
      publishedAt
    }
  }
`;

const DELETE_SUBSCRIPTION_PLAN_BASE_MUTATION = `
  mutation DeleteSubscriptionPlanBase($documentId: ID!) {
    deleteSubscriptionPlanBase(documentId: $documentId) {
      documentId
      name
      price
      features
      createdAt
      updatedAt
      publishedAt
    }
  }
`;

const CREATE_ACCOUNT_MUTATION = `
  mutation CreateAccount($data: AccountInput!) {
    createAccount(data: $data) {
      documentId
      username
      email
      createdAt
      updatedAt
      publishedAt
    }
  }
`;

const UPDATE_ACCOUNT_MUTATION = `
  mutation UpdateAccount($documentId: ID!, $data: AccountInput!) {
    updateAccount(documentId: $documentId, data: $data) {
      documentId
      username
      email
      createdAt
      updatedAt
      publishedAt
    }
  }
`;

const DELETE_ACCOUNT_MUTATION = `
  mutation DeleteAccount($documentId: ID!) {
    deleteAccount(documentId: $documentId) {
      documentId
      username
      email
      createdAt
      updatedAt
      publishedAt
    }
  }
`;

const CREATE_USER_SUBSCRIPTION_PLAN_MUTATION = `
  mutation CreateUserSubscriptionPlan($data: UserSubscriptionPlanInput!) {
    createUserSubscriptionPlan(data: $data) {
      documentId
      userId
      planId
      startDate
      endDate
      createdAt
      updatedAt
      publishedAt
    }
  }
`;

const UPDATE_USER_SUBSCRIPTION_PLAN_MUTATION = `
  mutation UpdateUserSubscriptionPlan($documentId: ID!, $data: UserSubscriptionPlanInput!) {
    updateUserSubscriptionPlan(documentId: $documentId, data: $data) {
      documentId
      userId
      planId
      startDate
      endDate
      createdAt
      updatedAt
      publishedAt
    }
  }
`;

const DELETE_USER_SUBSCRIPTION_PLAN_MUTATION = `
  mutation DeleteUserSubscriptionPlan($documentId: ID!) {
    deleteUserSubscriptionPlan(documentId: $documentId) {
      documentId
      userId
      planId
      startDate
      endDate
      createdAt
      updatedAt
      publishedAt
    }
  }
`;

const CREATE_SONG_LIMIT_MUTATION = `
  mutation CreateSongLimit($data: SongLimitInput!) {
    createSongLimit(data: $data) {
      documentId
      username
      song_requests
      createdAt
      updatedAt
      publishedAt
    }
  }
`;

const UPDATE_SONG_LIMIT_MUTATION = `
  mutation UpdateSongLimit($documentId: ID!, $data: SongLimitInput!) {
    updateSongLimit(documentId: $documentId, data: $data) {
      documentId
      username
      song_requests
      createdAt
      updatedAt
      publishedAt
    }
  }
`;

const DELETE_SONG_LIMIT_MUTATION = `
  mutation DeleteSongLimit($documentId: ID!) {
    deleteSongLimit(documentId: $documentId) {
      documentId
      username
      song_requests
      createdAt
      updatedAt
      publishedAt
    }
  }
`;

// React Query Mutation Hooks

// FAQ Mutations
export function useCreateFaq() {
  const queryClient = useQueryClient();
  return useMutation<Faq, Error, { Question: string; Answer: string; Sequence?: number; locale?: string }>({
    mutationFn: async (data) => {
      const result = await strapiRequest<CreateFaqResponse>(CREATE_FAQ_MUTATION, { data });
      return result.createFaq;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strapi", "faqs"] });
    },
  });
}

export function useUpdateFaq() {
  const queryClient = useQueryClient();
  return useMutation<Faq, Error, { documentId: string; data: Partial<Faq> }>({
    mutationFn: async ({ documentId, data }) => {
      const result = await strapiRequest<UpdateFaqResponse>(UPDATE_FAQ_MUTATION, {
        documentId,
        data,
      });
      return result.updateFaq;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strapi", "faqs"] });
    },
  });
}

export function useDeleteFaq() {
  const queryClient = useQueryClient();
  return useMutation<Faq, Error, string>({
    mutationFn: async (documentId) => {
      const result = await strapiRequest<DeleteFaqResponse>(DELETE_FAQ_MUTATION, {
        documentId,
      });
      return result.deleteFaq;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strapi", "faqs"] });
    },
  });
}

// Subscription Plan Base Mutations
export function useCreateSubscriptionPlanBase() {
  const queryClient = useQueryClient();
  return useMutation<SubscriptionPlanBase, Error, { name: string; price: number; features: string[] }>({
    mutationFn: async (data) => {
      const result = await strapiRequest<CreateSubscriptionPlanBaseResponse>(
        CREATE_SUBSCRIPTION_PLAN_BASE_MUTATION,
        { data }
      );
      return result.createSubscriptionPlanBase;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strapi", "subscriptionPlanBases"] });
    },
  });
}

export function useUpdateSubscriptionPlanBase() {
  const queryClient = useQueryClient();
  return useMutation<SubscriptionPlanBase, Error, { documentId: string; data: Partial<SubscriptionPlanBase> }>({
    mutationFn: async ({ documentId, data }) => {
      const result = await strapiRequest<UpdateSubscriptionPlanBaseResponse>(
        UPDATE_SUBSCRIPTION_PLAN_BASE_MUTATION,
        { documentId, data }
      );
      return result.updateSubscriptionPlanBase;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strapi", "subscriptionPlanBases"] });
    },
  });
}

export function useDeleteSubscriptionPlanBase() {
  const queryClient = useQueryClient();
  return useMutation<SubscriptionPlanBase, Error, string>({
    mutationFn: async (documentId) => {
      const result = await strapiRequest<DeleteSubscriptionPlanBaseResponse>(
        DELETE_SUBSCRIPTION_PLAN_BASE_MUTATION,
        { documentId }
      );
      return result.deleteSubscriptionPlanBase;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strapi", "subscriptionPlanBases"] });
    },
  });
}

// Account Mutations
export function useCreateAccount() {
  const queryClient = useQueryClient();
  return useMutation<Account, Error, { username: string; email: string }>({
    mutationFn: async (data) => {
      const result = await strapiRequest<CreateAccountResponse>(CREATE_ACCOUNT_MUTATION, { data });
      return result.createAccount;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strapi", "accounts"] });
    },
  });
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();
  return useMutation<Account, Error, { documentId: string; data: Partial<Account> }>({
    mutationFn: async ({ documentId, data }) => {
      const result = await strapiRequest<UpdateAccountResponse>(UPDATE_ACCOUNT_MUTATION, {
        documentId,
        data,
      });
      return result.updateAccount;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strapi", "accounts"] });
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation<Account, Error, string>({
    mutationFn: async (documentId) => {
      const result = await strapiRequest<DeleteAccountResponse>(DELETE_ACCOUNT_MUTATION, {
        documentId,
      });
      return result.deleteAccount;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strapi", "accounts"] });
    },
  });
}

// User Subscription Plan Mutations
export function useCreateUserSubscriptionPlan() {
  const queryClient = useQueryClient();
  return useMutation<UserSubscriptionPlan, Error, { userId: string; planId: string; startDate: string; endDate?: string }>({
    mutationFn: async (data) => {
      const result = await strapiRequest<CreateUserSubscriptionPlanResponse>(
        CREATE_USER_SUBSCRIPTION_PLAN_MUTATION,
        { data }
      );
      return result.createUserSubscriptionPlan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strapi", "userSubscriptionPlans"] });
    },
  });
}

export function useUpdateUserSubscriptionPlan() {
  const queryClient = useQueryClient();
  return useMutation<UserSubscriptionPlan, Error, { documentId: string; data: Partial<UserSubscriptionPlan> }>({
    mutationFn: async ({ documentId, data }) => {
      const result = await strapiRequest<UpdateUserSubscriptionPlanResponse>(
        UPDATE_USER_SUBSCRIPTION_PLAN_MUTATION,
        { documentId, data }
      );
      return result.updateUserSubscriptionPlan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strapi", "userSubscriptionPlans"] });
    },
  });
}

export function useDeleteUserSubscriptionPlan() {
  const queryClient = useQueryClient();
  return useMutation<UserSubscriptionPlan, Error, string>({
    mutationFn: async (documentId) => {
      const result = await strapiRequest<DeleteUserSubscriptionPlanResponse>(
        DELETE_USER_SUBSCRIPTION_PLAN_MUTATION,
        { documentId }
      );
      return result.deleteUserSubscriptionPlan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strapi", "userSubscriptionPlans"] });
    },
  });
}

// Song Limit Mutations
export function useCreateSongLimit() {
  const queryClient = useQueryClient();
  return useMutation<SongLimit, Error, { username: string; song_requests: number }>({
    mutationFn: async (data) => {
      const result = await strapiRequest<CreateSongLimitResponse>(CREATE_SONG_LIMIT_MUTATION, { data });
      return result.createSongLimit;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strapi", "songLimits"] });
    },
  });
}

export function useUpdateSongLimit() {
  const queryClient = useQueryClient();
  return useMutation<SongLimit, Error, { documentId: string; data: Partial<SongLimit> }>({
    mutationFn: async ({ documentId, data }) => {
      const result = await strapiRequest<UpdateSongLimitResponse>(UPDATE_SONG_LIMIT_MUTATION, {
        documentId,
        data,
      });
      return result.updateSongLimit;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strapi", "songLimits"] });
    },
  });
}

export function useDeleteSongLimit() {
  const queryClient = useQueryClient();
  return useMutation<SongLimit, Error, string>({
    mutationFn: async (documentId) => {
      const result = await strapiRequest<DeleteSongLimitResponse>(DELETE_SONG_LIMIT_MUTATION, {
        documentId,
      });
      return result.deleteSongLimit;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strapi", "songLimits"] });
    },
  });
}

