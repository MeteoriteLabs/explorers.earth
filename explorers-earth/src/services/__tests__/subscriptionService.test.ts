import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import {
  getSubscriptionPlans,
  getSubscriptionPlanById,
  getUserSubscriptionPlans,
  getSongLimits,
  createSongLimit,
  updateSongLimit,
  createUserSubscriptionPlan,
} from '../subscriptionService';

vi.mock('axios');

describe('subscriptionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSubscriptionPlans', () => {
    it('fetches subscription plans successfully', async () => {
      const mockPlans = [{ documentId: 'plan_1', plan_name: 'Pro' }];
      (axios.get as any).mockResolvedValue({
        data: { success: true, data: mockPlans }
      });

      const res = await getSubscriptionPlans();
      expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/api/subscriptions/plans'));
      expect(res).toEqual(mockPlans);
    });

    it('throws error if success is false', async () => {
      (axios.get as any).mockResolvedValue({
        data: { success: false }
      });

      await expect(getSubscriptionPlans()).rejects.toThrow('Failed to fetch subscription plans');
    });

    it('throws backend error if present', async () => {
      (axios.get as any).mockRejectedValue({
        response: { data: { error: 'Database error' } }
      });

      await expect(getSubscriptionPlans()).rejects.toThrow('Database error');
    });
  });

  describe('getSubscriptionPlanById', () => {
    it('fetches plan by id', async () => {
      const mockPlan = { documentId: 'plan_1', plan_name: 'Pro' };
      (axios.get as any).mockResolvedValue({
        data: { success: true, data: mockPlan }
      });

      const res = await getSubscriptionPlanById('plan_1');
      expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/api/subscriptions/plans/plan_1'));
      expect(res).toEqual(mockPlan);
    });
  });

  describe('getUserSubscriptionPlans', () => {
    it('fetches user plans', async () => {
      const mockUserPlans = [{ documentId: 'user_plan_1', user_id: 'user_1' }];
      (axios.get as any).mockResolvedValue({
        data: { success: true, data: mockUserPlans }
      });

      const res = await getUserSubscriptionPlans('user_1');
      expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/api/subscriptions/user-plans/user_1'));
      expect(res).toEqual(mockUserPlans);
    });
  });

  describe('getSongLimits', () => {
    it('fetches song limits', async () => {
      const mockLimits = [{ documentId: 'limit_1', song_requests: 10 }];
      (axios.get as any).mockResolvedValue({
        data: { success: true, data: mockLimits }
      });

      const res = await getSongLimits('john_doe');
      expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/api/subscriptions/song-limits/john_doe'));
      expect(res).toEqual(mockLimits);
    });
  });

  describe('createSongLimit', () => {
    it('creates song limit', async () => {
      const payload = { username: 'john', song_requests: 10, ai_guide_requests: 5 };
      const mockResponse = { documentId: 'limit_1', ...payload };
      
      (axios.post as any).mockResolvedValue({
        data: { success: true, data: mockResponse }
      });

      const res = await createSongLimit(payload);
      expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/api/subscriptions/song-limits'), payload);
      expect(res).toEqual(mockResponse);
    });
  });

  describe('updateSongLimit', () => {
    it('updates song limit', async () => {
      const payload = { song_requests: 5 };
      const mockResponse = { documentId: 'limit_1', song_requests: 5 };
      
      (axios.put as any).mockResolvedValue({
        data: { success: true, data: mockResponse }
      });

      const res = await updateSongLimit('limit_1', payload);
      expect(axios.put).toHaveBeenCalledWith(expect.stringContaining('/api/subscriptions/song-limits/limit_1'), payload);
      expect(res).toEqual(mockResponse);
    });
  });

  describe('createUserSubscriptionPlan', () => {
    it('creates user subscription plan', async () => {
      const payload = { user_id: '1', plan_id: '1', start_date: '2023-01-01', end_date: '2023-12-31' };
      const mockResponse = { documentId: 'up_1', ...payload };
      
      (axios.post as any).mockResolvedValue({
        data: { success: true, data: mockResponse }
      });

      const res = await createUserSubscriptionPlan(payload);
      expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/api/subscriptions/user-plans'), payload);
      expect(res).toEqual(mockResponse);
    });
  });
});
