import axios from 'axios';
import type { Request, Response, NextFunction } from 'express';
import { strapiService } from '../services/strapi-service';

/**
 * Get all subscription plans from Strapi
 * GET /api/subscriptions/plans
 */
export const getSubscriptionPlans = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const strapiUrl = process.env.STRAPI_URL;
    const strapiToken = process.env.STRAPI_ACCESS_TOKEN;

    if (!strapiUrl || !strapiToken) {
      res.status(500).json({
        success: false,
        error: 'Strapi API configuration missing. Please set STRAPI_URL and STRAPI_ACCESS_TOKEN in environment variables.',
      });
      return;
    }

    // GraphQL query to get all subscription plans
    const query = `
      query SubscriptionPlanBases {
        subscriptionPlanBases {
          documentId
          plan_name
          cost
          songs_quota
          ai_guide_quota
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

    const response = await axios.post(
      `${strapiUrl}/graphql`,
      {
        query: query,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${strapiToken}`,
        },
      }
    );

    if (response.data.errors) {
      console.error('Strapi GraphQL errors:', response.data.errors);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch subscription plans from Strapi',
        details: response.data.errors,
      });
      return;
    }

    const plans = response.data.data?.subscriptionPlanBases || [];

    res.status(200).json({
      success: true,
      data: plans,
      count: plans.length,
    });
  } catch (error: any) {
    console.error('Error fetching subscription plans:', error);

    if (error.response) {
      res.status(error.response.status || 500).json({
        success: false,
        error: 'Failed to fetch subscription plans',
        details: error.response.data,
      });
      return;
    }

    next(error);
  }
};

/**
 * Get a single subscription plan by documentId
 * GET /api/subscriptions/plans/:planId
 */
export const getSubscriptionPlanById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { planId } = req.params;

    if (!planId) {
      res.status(400).json({
        success: false,
        error: 'Plan ID is required',
      });
      return;
    }

    const strapiUrl = process.env.STRAPI_URL;
    const strapiToken = process.env.STRAPI_ACCESS_TOKEN;

    if (!strapiUrl || !strapiToken) {
      res.status(500).json({
        success: false,
        error: 'Strapi API configuration missing. Please set STRAPI_URL and STRAPI_ACCESS_TOKEN in environment variables.',
      });
      return;
    }

    // GraphQL query to get a single subscription plan by documentId
    const query = `
      query SubscriptionPlanBase($documentId: ID!) {
        subscriptionPlanBase(documentId: $documentId) {
          documentId
          plan_name
          cost
          songs_quota
          ai_guide_quota
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

    const response = await axios.post(
      `${strapiUrl}/graphql`,
      {
        query: query,
        variables: {
          documentId: planId,
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${strapiToken}`,
        },
      }
    );

    if (response.data.errors) {
      console.error('Strapi GraphQL errors:', response.data.errors);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch subscription plan from Strapi',
        details: response.data.errors,
      });
      return;
    }

    const plan = response.data.data?.subscriptionPlanBase;

    if (!plan) {
      res.status(404).json({
        success: false,
        error: 'Subscription plan not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: plan,
    });
  } catch (error: any) {
    console.error('Error fetching subscription plan:', error);

    if (error.response) {
      res.status(error.response.status || 500).json({
        success: false,
        error: 'Failed to fetch subscription plan',
        details: error.response.data,
      });
      return;
    }

    next(error);
  }
};

/**
 * Get user subscription plans by user ID
 * GET /api/subscriptions/user-plans/:userId
 */
export const getUserSubscriptionPlans = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;

    if (!userId) {
      res.status(400).json({
        success: false,
        error: 'User ID is required',
      });
      return;
    }

    const strapiUrl = process.env.STRAPI_URL;
    const strapiToken = process.env.STRAPI_ACCESS_TOKEN;

    if (!strapiUrl || !strapiToken) {
      res.status(500).json({
        success: false,
        error: 'Strapi API configuration missing. Please set STRAPI_URL and STRAPI_ACCESS_TOKEN in environment variables.',
      });
      return;
    }

    // GraphQL query to get user subscription plans filtered by user_id
    const query = `
      query UserSubscriptionPlans($filters: UserSubscriptionPlanFiltersInput) {
        userSubscriptionPlans(filters: $filters) {
          documentId
          user_id
          start_date
          end_date
          plan_id
          createdAt
          updatedAt
          publishedAt
        }
      }
    `;

    const response = await axios.post(
      `${strapiUrl}/graphql`,
      {
        query: query,
        variables: {
          filters: {
            user_id: {
              eq: userId,
            },
          },
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${strapiToken}`,
        },
      }
    );

    if (response.data.errors) {
      console.error('Strapi GraphQL errors:', response.data.errors);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch user subscription plans from Strapi',
        details: response.data.errors,
      });
      return;
    }

    const plans = response.data.data?.userSubscriptionPlans || [];

    res.status(200).json({
      success: true,
      data: plans,
      count: plans.length,
    });
  } catch (error: any) {
    console.error('Error fetching user subscription plans:', error);

    if (error.response) {
      res.status(error.response.status || 500).json({
        success: false,
        error: 'Failed to fetch user subscription plans',
        details: error.response.data,
      });
      return;
    }

    next(error);
  }
};

/**
 * Create user subscription plan
 * POST /api/subscriptions/user-plans
 */
export const createUserSubscriptionPlan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { user_id, plan_id, start_date, end_date, razorpay_sub_id, razorpay_plan_id, razorpay_customer_id } = req.body;

    if (!user_id || !plan_id || !start_date || !end_date) {
      res.status(400).json({
        success: false,
        error: 'user_id, plan_id, start_date, and end_date are required',
      });
      return;
    }

    const strapiUrl = process.env.STRAPI_URL;
    const strapiToken = process.env.STRAPI_ACCESS_TOKEN;

    if (!strapiUrl || !strapiToken) {
      res.status(500).json({
        success: false,
        error: 'Strapi API configuration missing. Please set STRAPI_URL and STRAPI_ACCESS_TOKEN in environment variables.',
      });
      return;
    }

    // GraphQL mutation to create user subscription plan
    const mutation = `
      mutation CreateUserSubscriptionPlan($data: UserSubscriptionPlanInput!) {
        createUserSubscriptionPlan(data: $data) {
          documentId
          user_id
          plan_id
          start_date
          end_date
          razorpay_sub_id
          razorpay_plan_id
          razorpay_customer_id
          createdAt
          updatedAt
          publishedAt
        }
      }
    `;

    // Build data object
    const data: any = {
      user_id,
      plan_id,
      start_date,
      end_date,
    };

    // Add optional Razorpay fields if provided
    if (razorpay_sub_id) {
      data.razorpay_sub_id = razorpay_sub_id;
    }
    if (razorpay_plan_id) {
      data.razorpay_plan_id = razorpay_plan_id;
    }
    if (razorpay_customer_id) {
      data.razorpay_customer_id = razorpay_customer_id;
    }

    const response = await axios.post(
      `${strapiUrl}/graphql`,
      {
        query: mutation,
        variables: {
          data: data,
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${strapiToken}`,
        },
      }
    );

    if (response.data.errors) {
      console.error('Strapi GraphQL errors:', response.data.errors);
      res.status(500).json({
        success: false,
        error: 'Failed to create user subscription plan in Strapi',
        details: response.data.errors,
      });
      return;
    }

    const userSubscriptionPlan = response.data.data?.createUserSubscriptionPlan;

    if (!userSubscriptionPlan) {
      res.status(500).json({
        success: false,
        error: 'Failed to create user subscription plan',
      });
      return;
    }

    // Reset song limits (song_requests and ai_guide_requests) to 0 for the user
    // This ensures the user starts fresh with their new subscription quota
    try {
      console.log(`🔄 Resetting song limits for user: ${user_id} after subscription creation`);
      await strapiService.resetSongLimits(String(user_id));
      console.log(`✅ Successfully reset song limits for user: ${user_id}`);
    } catch (resetError) {
      // Log the error but don't fail the subscription creation
      console.error(`⚠️ Failed to reset song limits for user ${user_id}:`, resetError);
    }

    res.status(201).json({
      success: true,
      data: userSubscriptionPlan,
    });
  } catch (error: any) {
    console.error('Error creating user subscription plan:', error);

    if (error.response) {
      res.status(error.response.status || 500).json({
        success: false,
        error: 'Failed to create user subscription plan',
        details: error.response.data,
      });
      return;
    }

    next(error);
  }
};

/**
 * Get song limits by username
 * GET /api/subscriptions/song-limits/:username
 */
export const getSongLimits = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { username } = req.params;

    if (!username) {
      res.status(400).json({
        success: false,
        error: 'Username is required',
      });
      return;
    }

    const strapiUrl = process.env.STRAPI_URL;
    const strapiToken = process.env.STRAPI_ACCESS_TOKEN;

    if (!strapiUrl || !strapiToken) {
      res.status(500).json({
        success: false,
        error: 'Strapi API configuration missing. Please set STRAPI_URL and STRAPI_ACCESS_TOKEN in environment variables.',
      });
      return;
    }

    // GraphQL query to get song limits filtered by username
    const query = `
      query SongLimits($filters: SongLimitFiltersInput) {
        songLimits(filters: $filters) {
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

    const response = await axios.post(
      `${strapiUrl}/graphql`,
      {
        query: query,
        variables: {
          filters: {
            username: {
              eq: username,
            },
          },
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${strapiToken}`,
        },
      }
    );

    if (response.data.errors) {
      console.error('Strapi GraphQL errors:', response.data.errors);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch song limits from Strapi',
        details: response.data.errors,
      });
      return;
    }

    const songLimits = response.data.data?.songLimits || [];

    res.status(200).json({
      success: true,
      data: songLimits,
      count: songLimits.length,
    });
  } catch (error: any) {
    console.error('Error fetching song limits:', error);

    if (error.response) {
      res.status(error.response.status || 500).json({
        success: false,
        error: 'Failed to fetch song limits',
        details: error.response.data,
      });
      return;
    }

    next(error);
  }
};

/**
 * Create song limit
 * POST /api/subscriptions/song-limits
 */
export const createSongLimit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { username, song_requests } = req.body;

    if (!username) {
      res.status(400).json({
        success: false,
        error: 'Username is required',
      });
      return;
    }

    if (song_requests === undefined || song_requests === null) {
      res.status(400).json({
        success: false,
        error: 'song_requests is required',
      });
      return;
    }

    const strapiUrl = process.env.STRAPI_URL;
    const strapiToken = process.env.STRAPI_ACCESS_TOKEN;

    if (!strapiUrl || !strapiToken) {
      res.status(500).json({
        success: false,
        error: 'Strapi API configuration missing. Please set STRAPI_URL and STRAPI_ACCESS_TOKEN in environment variables.',
      });
      return;
    }

    // GraphQL mutation to create song limit
    const mutation = `
      mutation CreateSongLimit($data: SongLimitInput!) {
        createSongLimit(data: $data) {
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

    const response = await axios.post(
      `${strapiUrl}/graphql`,
      {
        query: mutation,
        variables: {
          data: {
            username,
            song_requests: parseInt(String(song_requests)) || 0,
          },
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${strapiToken}`,
        },
      }
    );

    if (response.data.errors) {
      console.error('Strapi GraphQL errors:', response.data.errors);
      res.status(500).json({
        success: false,
        error: 'Failed to create song limit in Strapi',
        details: response.data.errors,
      });
      return;
    }

    const songLimit = response.data.data?.createSongLimit;

    if (!songLimit) {
      res.status(500).json({
        success: false,
        error: 'Failed to create song limit',
      });
      return;
    }

    res.status(201).json({
      success: true,
      data: songLimit,
    });
  } catch (error: any) {
    console.error('Error creating song limit:', error);

    if (error.response) {
      res.status(error.response.status || 500).json({
        success: false,
        error: 'Failed to create song limit',
        details: error.response.data,
      });
      return;
    }

    next(error);
  }
};

/**
 * Update song limit
 * PUT /api/subscriptions/song-limits/:documentId
 */
export const updateSongLimit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { documentId } = req.params;
    const { song_requests, ai_guide_requests, username } = req.body;

    console.log('📝 [updateSongLimit] Received request:', {
      documentId,
      body: req.body,
      song_requests,
      ai_guide_requests,
      username,
      song_requests_type: typeof song_requests,
      ai_guide_requests_type: typeof ai_guide_requests,
    });

    if (!documentId) {
      res.status(400).json({
        success: false,
        error: 'Document ID is required',
      });
      return;
    }

    const strapiUrl = process.env.STRAPI_URL;
    const strapiToken = process.env.STRAPI_ACCESS_TOKEN;

    if (!strapiUrl || !strapiToken) {
      res.status(500).json({
        success: false,
        error: 'Strapi API configuration missing. Please set STRAPI_URL and STRAPI_ACCESS_TOKEN in environment variables.',
      });
      return;
    }

    // Build update data object
    const updateData: any = {};

    if (song_requests !== undefined && song_requests !== null) {
      updateData.song_requests = parseInt(String(song_requests));
    }

    if (ai_guide_requests !== undefined && ai_guide_requests !== null) {
      updateData.ai_guide_requests = parseInt(String(ai_guide_requests));
    }

    if (username !== undefined) {
      updateData.username = username;
    }

    if (Object.keys(updateData).length === 0) {
      res.status(400).json({
        success: false,
        error: 'At least one field (song_requests, ai_guide_requests, or username) must be provided for update',
      });
      return;
    }

    // GraphQL mutation to update song limit
    const mutation = `
      mutation UpdateSongLimit($documentId: ID!, $data: SongLimitInput!) {
        updateSongLimit(documentId: $documentId, data: $data) {
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

    console.log('📝 [updateSongLimit] Sending to Strapi:', {
      documentId,
      updateData,
    });

    const response = await axios.post(
      `${strapiUrl}/graphql`,
      {
        query: mutation,
        variables: {
          documentId,
          data: updateData,
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${strapiToken}`,
        },
      }
    );

    if (response.data.errors) {
      console.error('Strapi GraphQL errors:', response.data.errors);
      res.status(500).json({
        success: false,
        error: 'Failed to update song limit in Strapi',
        details: response.data.errors,
      });
      return;
    }

    const songLimit = response.data.data?.updateSongLimit;

    if (!songLimit) {
      res.status(404).json({
        success: false,
        error: 'Song limit not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: songLimit,
    });
  } catch (error: any) {
    console.error('Error updating song limit:', error);

    if (error.response) {
      res.status(error.response.status || 500).json({
        success: false,
        error: 'Failed to update song limit',
        details: error.response.data,
      });
      return;
    }

    next(error);
  }
};

