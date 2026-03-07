import { Express } from 'express';
import { storage } from '../storage';

/**
 * Registers public page/system routes
 */
export function setupPageRoutes(app: Express) {
  const getPageContentBySlug = async (slug: string, req: any, res: any) => {
    try {
      const pageContent = await storage.getPageContentBySlug(slug);

      if (!pageContent) {
        return res.status(404).json({ error: 'Page content not found' });
      }

      if (!pageContent.isPublished && (!req.user || (req.user as any).role !== 'admin')) {
        return res.status(404).json({ error: 'Page content not found' });
      }

      return res.json(pageContent);
    } catch (error) {
      console.error('Error fetching page content:', error);
      return res.status(500).json({ error: 'Server error' });
    }
  };

  app.get('/api/page-contents', async (req, res) => {
    const slug = req.query.slug as string | undefined;
    if (!slug) {
      return res.status(400).json({ error: 'slug query parameter is required' });
    }
    return getPageContentBySlug(slug, req, res);
  });

  // Backward-compatible variant used by existing clients.
  app.get('/api/page-contents/:slug', async (req, res) => {
    return getPageContentBySlug(req.params.slug, req, res);
  });

  const getSystemSettingByKey = async (key: string, req: any, res: any) => {
    try {
      const setting = await storage.getSystemSetting(key);

      if (!setting) {
        return res.status(404).json({ message: `Setting with key "${key}" not found` });
      }

      if (setting.isSecret && (!req.isAuthenticated() || req.user!.username !== 'yapral27')) {
        return res.status(403).json({ message: 'Access to this setting is restricted' });
      }

      res.json(setting);
    } catch (error) {
      console.error('Error fetching system setting:', error);
      res.status(500).json({ message: 'Failed to fetch system setting' });
    }
  };

  app.get('/api/system-settings', async (req, res) => {
    const key = req.query.key as string | undefined;
    if (!key) {
      return res.status(400).json({ message: 'key query parameter is required' });
    }
    return getSystemSettingByKey(key, req, res);
  });

  // Backward-compatible variant used by existing clients.
  app.get('/api/system-settings/:key', async (req, res) => {
    return getSystemSettingByKey(req.params.key, req, res);
  });
}
