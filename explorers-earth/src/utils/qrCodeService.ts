import { getCurrentDomain } from './getCurrentDomain';
import { QR_CONSTANTS } from '../config/qrConfig';
import { appendUtmParams, UTMParameters } from './urlHelpers';

// QR Code configuration constants
export const QR_CONFIG = {
  level: QR_CONSTANTS.DEFAULT_LEVEL,
  size: {
    small: 100,
    medium: 144,
    large: 200,
    xl: 288
  },
  styles: {
    small: { height: '100px', width: '100px' },
    medium: { height: '144px', width: '144px' },
    large: { height: '200px', width: '200px' },
    xl: { height: '288px', width: '288px' }
  },
  classNames: {
    small: 'w-20 h-20',
    medium: 'w-36 h-36',
    large: 'w-48 h-48',
    xl: 'w-72 h-72'
  },
  // Logo settings for different QR sizes
  logo: {
    src: '/LogoQR.svg', // Path to your logo
    sizes: {
      small: { height: 16, width: 40 },  // Adjusted for wide aspect ratio (~2.3:1)
      medium: { height: 32, width: 74 }, // Adjusted for max logo size in medium size QR
      large: { height: 28, width: 68 },  // Adjusted for wide aspect ratio (~2.3:1)
      xl: { height: 36, width: 88 }      // Adjusted for wide aspect ratio (~2.3:1)
    },
    // Logo positioning and styling
    excavate: true, // Remove QR code dots behind the logo for better visibility
    x: undefined, // Center horizontally (default)
    y: undefined, // Center vertically (default)
  }
} as const;

export type QRSize = keyof typeof QR_CONFIG.size;

// Generate user profile QR URL - handles different contexts
export const generateUserProfileQRUrl = (username: string, utmParams?: UTMParameters): string => {
  const domain = getCurrentDomain();
  const baseUrl = `${domain}/${username}`;
  return utmParams ? appendUtmParams(baseUrl, utmParams) : baseUrl;
};

// Generate user places QR URL
export const generateUserPlacesQRUrl = (username: string, citySlug?: string, utmParams?: UTMParameters): string => {
  const domain = getCurrentDomain();
  let baseUrl: string;
  if (citySlug) {
    baseUrl = `${domain}/${username}/places/${citySlug}`;
  } else {
    baseUrl = `${domain}/${username}/places`;
  }
  return utmParams ? appendUtmParams(baseUrl, utmParams) : baseUrl;
};

// Generate recommendation QR URL
export const generateRecommendationQRUrl = (username: string, citySlug: string, utmParams?: UTMParameters): string => {
  const domain = getCurrentDomain();
  const baseUrl = `${domain}/${username}/places/${citySlug}`;
  return utmParams ? appendUtmParams(baseUrl, utmParams) : baseUrl;
};

// Generate image settings for QR code logo
export const generateLogoImageSettings = (
  size: QRSize, 
  customLogoSize?: { width: number; height: number },
  customLogoSrc?: string
) => {
  const logoConfig = QR_CONFIG.logo;
  
  return {
    src: customLogoSrc || logoConfig.src,
    height: customLogoSize?.height || logoConfig.sizes[size].height,
    width: customLogoSize?.width || logoConfig.sizes[size].width,
    excavate: logoConfig.excavate,
    x: logoConfig.x,
    y: logoConfig.y,
  };
};

// Get QR code size configuration
export const getQRSizeConfig = (size: QRSize) => {
  return {
    size: QR_CONFIG.size[size],
    style: QR_CONFIG.styles[size],
    className: QR_CONFIG.classNames[size],
  };
};

// Get QR code value based on current route context
export const getContextualQRValue = (
  username: string, 
  context: 'profile' | 'places' | 'recommendation',
  citySlug?: string,
  utmParams?: UTMParameters
): string => {
  switch (context) {
    case 'profile':
      return generateUserProfileQRUrl(username, utmParams);
    case 'places':
      return generateUserPlacesQRUrl(username, citySlug, utmParams);
    case 'recommendation':
      if (!citySlug) {
        throw new Error('City slug is required for recommendation QR codes');
      }
      return generateRecommendationQRUrl(username, citySlug, utmParams);
    default:
      return generateUserProfileQRUrl(username, utmParams);
  }
};
