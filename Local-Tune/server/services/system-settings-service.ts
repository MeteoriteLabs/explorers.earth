import { storage } from '../storage';

class SystemSettingsService {
  /**
   * Get a system setting value with optional fallback to environment variable
   * @param key The system setting key
   * @param envFallbackKey Optional environment variable name to use as fallback
   * @returns The setting value or undefined if not found
   */
  async getSettingValue(key: string, envFallbackKey?: string): Promise<string | undefined> {
    try {
      // First try to get from database
      const setting = await storage.getSystemSetting(key);
      
      if (setting) {
        return setting.value;
      }
      
      // Fallback to environment variable if specified
      if (envFallbackKey && process.env[envFallbackKey]) {
        return process.env[envFallbackKey];
      }
      
      return undefined;
    } catch (error) {
      console.error(`Error getting system setting ${key}:`, error);
      
      // Fallback to environment variable if specified
      if (envFallbackKey && process.env[envFallbackKey]) {
        return process.env[envFallbackKey];
      }
      
      return undefined;
    }
  }

  /**
   * Get the application URL from system settings or environment
   * @returns The application URL
   */
  async getAppUrl(): Promise<string> {
    const appUrl = await this.getSettingValue('app_url', 'BASE_URL');
    
    if (!appUrl) {
      console.warn('No app_url setting or BASE_URL environment variable found');
      // Return a fallback URL - this should be updated with proper domain in production
      return 'http://localhost:3000';
    }
    
    // Ensure appUrl doesn't have a trailing slash for consistent URL building
    return appUrl.endsWith('/') ? appUrl.slice(0, -1) : appUrl;
  }
}

export const systemSettingsService = new SystemSettingsService();