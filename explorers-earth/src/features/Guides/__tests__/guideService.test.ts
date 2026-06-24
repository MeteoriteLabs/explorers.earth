import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { deleteGuideMedia, uploadGuideMedia, getGuideById } from '../guideService';
import { generateRandomFileName, generateGuideUploadPath } from '../../../utils/uploadPathGenerator';

vi.mock('axios');
vi.mock('../../../utils/uploadPathGenerator', () => ({
  generateRandomFileName: vi.fn(),
  generateGuideUploadPath: vi.fn(),
}));

describe('guideService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('qrtoken', 'fake-token');
  });

  describe('deleteGuideMedia', () => {
    it('returns early if no fileId is provided', async () => {
      await deleteGuideMedia('');
      expect(axios.delete).not.toHaveBeenCalled();
    });

    it('deletes media successfully', async () => {
      (axios.delete as any).mockResolvedValue({});
      
      await deleteGuideMedia('123');
      
      expect(axios.delete).toHaveBeenCalledWith(
        expect.stringContaining('/upload/files/123'),
        expect.objectContaining({
          headers: { Authorization: 'Bearer fake-token' }
        })
      );
    });

    it('throws error if delete fails', async () => {
      (axios.delete as any).mockRejectedValue(new Error('Delete failed'));
      
      await expect(deleteGuideMedia('123')).rejects.toThrow('Delete failed');
    });
  });

  describe('uploadGuideMedia', () => {
    it('deletes existing media and uploads new file', async () => {
      (generateRandomFileName as any).mockReturnValue('random.jpg');
      (generateGuideUploadPath as any).mockReturnValue('path/to/random.jpg');
      (axios.delete as any).mockResolvedValue({});
      (axios.post as any).mockResolvedValue({ data: [{ id: 1 }] });

      const file = new File([''], 'test.jpg', { type: 'image/jpeg' });
      
      const result = await uploadGuideMedia('guide_1', 'doc_1', file, 'user1', ['old_1']);
      
      // Should delete old media
      expect(axios.delete).toHaveBeenCalledWith(
        expect.stringContaining('/upload/files/old_1'),
        expect.any(Object)
      );

      // Should upload new media
      expect(axios.post).toHaveBeenCalled();
      const formData = (axios.post as any).mock.calls[0][1];
      expect(formData.get('refId')).toBe('guide_1');
      expect(formData.get('ref')).toBe('api::guide.guide');
      expect(formData.get('field')).toBe('Guide_Media');
      expect(formData.get('path')).toBe('path/to/random.jpg');
      expect(formData.get('files')).toBe(file);
      
      expect(result).toEqual([{ id: 1 }]);
    });
    
    it('ignores delete failures when uploading', async () => {
      (generateRandomFileName as any).mockReturnValue('random.jpg');
      (generateGuideUploadPath as any).mockReturnValue('path/to/random.jpg');
      (axios.delete as any).mockRejectedValue(new Error('Delete error'));
      (axios.post as any).mockResolvedValue({ data: [{ id: 1 }] });

      const file = new File([''], 'test.jpg', { type: 'image/jpeg' });
      
      // Should not throw
      const result = await uploadGuideMedia('guide_1', 'doc_1', file, 'user1', ['old_1']);
      expect(result).toEqual([{ id: 1 }]);
    });
  });

  describe('getGuideById', () => {
    it('fetches guide by documentId', async () => {
      (axios.get as any).mockResolvedValue({
        data: { data: [{ documentId: 'doc_1', title: 'Test Guide' }] }
      });

      const result = await getGuideById('doc_1');

      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/guides'),
        expect.objectContaining({
          params: {
            filters: { documentId: { $eq: 'doc_1' } },
            populate: { Guide_Media: true }
          },
          headers: { Authorization: 'Bearer fake-token' }
        })
      );
      
      expect(result).toEqual({ documentId: 'doc_1', title: 'Test Guide' });
    });

    it('returns null if no guide found', async () => {
      (axios.get as any).mockResolvedValue({
        data: { data: [] }
      });

      const result = await getGuideById('doc_1');
      expect(result).toBeNull();
    });
  });
});
