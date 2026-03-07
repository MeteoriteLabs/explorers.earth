import axios from 'axios';

const PAYMENT_API_URL = import.meta.env.VITE_PAYMENT_API_URL || import.meta.env.VITE_REST_API_URL;

export interface SubscriptionPlan {
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
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
}

export interface SubscriptionPlansResponse {
  success: boolean;
  data: SubscriptionPlan[];
  count: number;
}

export interface SubscriptionPlanResponse {
  success: boolean;
  data: SubscriptionPlan;
}

/**
 * Get all subscription plans from backend
 */
export const getSubscriptionPlans = async (): Promise<SubscriptionPlan[]> => {
  try {
    const response = await axios.get<SubscriptionPlansResponse>(
      `${PAYMENT_API_URL}/api/subscriptions/plans`
    );

    if (!response.data.success) {
      throw new Error('Failed to fetch subscription plans');
    }

    return response.data.data;
  } catch (error: any) {
    console.error('Error fetching subscription plans:', error);
    if (error.response?.data?.error) {
      throw new Error(error.response.data.error);
    }
    throw new Error(error.message || 'Failed to fetch subscription plans');
  }
};

/**
 * Get a single subscription plan by ID from backend
 */
export const getSubscriptionPlanById = async (planId: string): Promise<SubscriptionPlan> => {
  try {
    const response = await axios.get<SubscriptionPlanResponse>(
      `${PAYMENT_API_URL}/api/subscriptions/plans/${planId}`
    );

    if (!response.data.success) {
      throw new Error('Failed to fetch subscription plan');
    }

    return response.data.data;
  } catch (error: any) {
    console.error('Error fetching subscription plan:', error);
    if (error.response?.data?.error) {
      throw new Error(error.response.data.error);
    }
    throw new Error(error.message || 'Failed to fetch subscription plan');
  }
};

export interface UserSubscriptionPlan {
  documentId: string;
  user_id: string;
  start_date: string;
  end_date: string;
  plan_id: string;
  razorpay_sub_id?: string;
  razorpay_plan_id?: string;
  razorpay_customer_id?: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
}

export interface UserSubscriptionPlansResponse {
  success: boolean;
  data: UserSubscriptionPlan[];
  count: number;
}

/**
 * Get user subscription plans by user ID from backend
 */
export const getUserSubscriptionPlans = async (userId: string): Promise<UserSubscriptionPlan[]> => {
  try {
    const response = await axios.get<UserSubscriptionPlansResponse>(
      `${PAYMENT_API_URL}/api/subscriptions/user-plans/${userId}`
    );

    if (!response.data.success) {
      throw new Error('Failed to fetch user subscription plans');
    }

    return response.data.data;
  } catch (error: any) {
    console.error('Error fetching user subscription plans:', error);
    if (error.response?.data?.error) {
      throw new Error(error.response.data.error);
    }
    throw new Error(error.message || 'Failed to fetch user subscription plans');
  }
};

export interface SongLimit {
  documentId: string;
  username: string;
  song_requests: number;
  ai_guide_requests: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
}

export interface SongLimitsResponse {
  success: boolean;
  data: SongLimit[];
  count: number;
}

export interface SongLimitResponse {
  success: boolean;
  data: SongLimit;
}

export interface CreateSongLimitRequest {
  username: string;
  song_requests: number;
  ai_guide_requests: number;
}

export interface UpdateSongLimitRequest {
  song_requests?: number;
  ai_guide_requests?: number;
  username?: string;
}

/**
 * Get song limits by username from backend
 */
export const getSongLimits = async (username: string): Promise<SongLimit[]> => {
  try {
    const response = await axios.get<SongLimitsResponse>(
      `${PAYMENT_API_URL}/api/subscriptions/song-limits/${username}`
    );

    if (!response.data.success) {
      throw new Error('Failed to fetch song limits');
    }

    return response.data.data;
  } catch (error: any) {
    console.error('Error fetching song limits:', error);
    if (error.response?.data?.error) {
      throw new Error(error.response.data.error);
    }
    throw new Error(error.message || 'Failed to fetch song limits');
  }
};

/**
 * Create song limit via backend API
 */
export const createSongLimit = async (data: CreateSongLimitRequest): Promise<SongLimit> => {
  try {
    const response = await axios.post<SongLimitResponse>(
      `${PAYMENT_API_URL}/api/subscriptions/song-limits`,
      data
    );

    if (!response.data.success) {
      throw new Error('Failed to create song limit');
    }

    return response.data.data;
  } catch (error: any) {
    console.error('Error creating song limit:', error);
    if (error.response?.data?.error) {
      throw new Error(error.response.data.error);
    }
    throw new Error(error.message || 'Failed to create song limit');
  }
};

/**
 * Update song limit via backend API
 */
export const updateSongLimit = async (documentId: string, data: UpdateSongLimitRequest): Promise<SongLimit> => {
  try {
    const response = await axios.put<SongLimitResponse>(
      `${PAYMENT_API_URL}/api/subscriptions/song-limits/${documentId}`,
      data
    );

    if (!response.data.success) {
      throw new Error('Failed to update song limit');
    }

    return response.data.data;
  } catch (error: any) {
    console.error('Error updating song limit:', error);
    if (error.response?.data?.error) {
      throw new Error(error.response.data.error);
    }
    throw new Error(error.message || 'Failed to update song limit');
  }
};

export interface CreateUserSubscriptionPlanRequest {
  user_id: string;
  plan_id: string;
  start_date: string;
  end_date: string;
  razorpay_sub_id?: string;
  razorpay_plan_id?: string;
  razorpay_customer_id?: string;
}

export interface CreateUserSubscriptionPlanResponse {
  success: boolean;
  data: UserSubscriptionPlan;
}

/**
 * Create user subscription plan via backend API
 */
export const createUserSubscriptionPlan = async (data: CreateUserSubscriptionPlanRequest): Promise<UserSubscriptionPlan> => {
  try {
    const response = await axios.post<CreateUserSubscriptionPlanResponse>(
      `${PAYMENT_API_URL}/api/subscriptions/user-plans`,
      data
    );

    if (!response.data.success) {
      throw new Error('Failed to create user subscription plan');
    }

    return response.data.data;
  } catch (error: any) {
    console.error('Error creating user subscription plan:', error);
    if (error.response?.data?.error) {
      throw new Error(error.response.data.error);
    }
    throw new Error(error.message || 'Failed to create user subscription plan');
  }
};

