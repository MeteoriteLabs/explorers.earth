/**
 * URL utility functions for handling UTM parameters and URL manipulation
 */

export interface UTMParameters {
  utm_source?: string;
  utm_medium?: string;
}

/**
 * Appends UTM parameters to a URL while preserving existing query parameters
 * @param url - The base URL to append UTM parameters to
 * @param utmParams - Object containing UTM parameters
 * @returns URL with UTM parameters appended
 */
export const appendUtmParams = (url: string, utmParams: UTMParameters): string => {
  if (!url || Object.keys(utmParams).length === 0) {
    return url;
  }

  try {
    const urlObj = new URL(url);
    
    // Add UTM parameters to the URL
    Object.entries(utmParams).forEach(([key, value]) => {
      if (value && value.trim() !== '') {
        urlObj.searchParams.set(key, value.trim());
      }
    });

    return urlObj.toString();
  } catch (error) {
    console.error('Error appending UTM parameters:', error);
    return url; // Return original URL if parsing fails
  }
};

/**
 * Extracts UTM parameters from a URL
 * @param url - The URL to extract UTM parameters from
 * @returns Object containing UTM parameters found in the URL
 */
export const extractUtmParams = (url: string): UTMParameters => {
  if (!url) {
    return {};
  }

  try {
    const urlObj = new URL(url);
    const utmParams: UTMParameters = {};

    // Extract UTM parameters from URL
    const utmKeys: (keyof UTMParameters)[] = ['utm_source', 'utm_medium'];
    
    utmKeys.forEach(key => {
      const value = urlObj.searchParams.get(key);
      if (value) {
        utmParams[key] = value;
      }
    });

    return utmParams;
  } catch (error) {
    console.error('Error extracting UTM parameters:', error);
    return {};
  }
};

/**
 * Extracts UTM parameters from the current page URL
 * @returns Object containing UTM parameters from the current page
 */
export const extractUtmParamsFromCurrentUrl = (): UTMParameters => {
  return extractUtmParams(window.location.href);
};

/**
 * Creates predefined UTM parameter sets for common use cases
 */
export const createUtmParams = {
  /**
   * UTM parameters for QR code scans
   */
  qrCode: (): UTMParameters => ({
    utm_source: 'qr_code_scan',
    utm_medium: 'qr_code',
  }),

  /**
   * UTM parameters for social media sharing
   */
  socialMedia: (platform: string): UTMParameters => ({
    utm_source: platform.toLowerCase(),
    utm_medium: 'social',
  }),

  /**
   * UTM parameters for direct sharing
   */
  directShare: (): UTMParameters => ({
    utm_source: 'direct',
    utm_medium: 'share',
  }),

  /**
   * UTM parameters for email sharing
   */
  email: (): UTMParameters => ({
    utm_source: 'email',
    utm_medium: 'email',
  }),

  /**
   * UTM parameters for referral links
   */
  referral: (referrer: string): UTMParameters => ({
    utm_source: referrer,
    utm_medium: 'referral',
  }),
};

/**
 * Validates UTM parameters to ensure they meet standard requirements
 * @param utmParams - UTM parameters to validate
 * @returns Object with validation results
 */
export const validateUtmParams = (utmParams: UTMParameters): {
  isValid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];

  // Check for required parameters (source and medium are typically required)
  if (!utmParams.utm_source) {
    errors.push('utm_source is required');
  }
  if (!utmParams.utm_medium) {
    errors.push('utm_medium is required');
  }

  // Check parameter lengths (Google Analytics has limits)
  Object.entries(utmParams).forEach(([key, value]) => {
    if (value && value.length > 100) {
      errors.push(`${key} exceeds maximum length of 100 characters`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Sanitizes UTM parameters by trimming whitespace and removing invalid characters
 * @param utmParams - UTM parameters to sanitize
 * @returns Sanitized UTM parameters
 */
export const sanitizeUtmParams = (utmParams: UTMParameters): UTMParameters => {
  const sanitized: UTMParameters = {};

  Object.entries(utmParams).forEach(([key, value]) => {
    if (value) {
      // Trim whitespace and remove any characters that might cause issues in URLs
      const sanitizedValue = value.trim().replace(/[<>"']/g, '');
      if (sanitizedValue) {
        sanitized[key as keyof UTMParameters] = sanitizedValue;
      }
    }
  });

  return sanitized;
};
