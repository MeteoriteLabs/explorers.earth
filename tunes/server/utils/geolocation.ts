import geoip from 'geoip-lite';

// Define interfaces for geo data
export interface GeoLocation {
  country: string;
  region: string;
  city?: string;
  ll: [number, number]; // latitude, longitude
  timezone?: string;
}

// Map country codes to regions
const countryToRegionMap: Record<string, string> = {
  // North America
  'US': 'North America',
  'CA': 'North America',
  'MX': 'North America',
  
  // Europe
  'GB': 'Europe',
  'DE': 'Europe',
  'FR': 'Europe',
  'IT': 'Europe',
  'ES': 'Europe',
  'NL': 'Europe',
  'BE': 'Europe',
  'SE': 'Europe',
  'CH': 'Europe',
  'AT': 'Europe',
  'DK': 'Europe',
  'FI': 'Europe',
  'NO': 'Europe',
  'IE': 'Europe',
  'PT': 'Europe',
  'GR': 'Europe',
  'PL': 'Europe',
  'RO': 'Europe',
  'CZ': 'Europe',
  'HU': 'Europe',
  
  // Asia
  'CN': 'Asia',
  'JP': 'Asia',
  'KR': 'Asia',
  'IN': 'Asia',
  'SG': 'Asia',
  'TH': 'Asia',
  'MY': 'Asia',
  'ID': 'Asia',
  'PH': 'Asia',
  'VN': 'Asia',
  'HK': 'Asia',
  'TW': 'Asia',
  
  // South America
  'BR': 'South America',
  'AR': 'South America',
  'CO': 'South America',
  'CL': 'South America',
  'PE': 'South America',
  'VE': 'South America',
  
  // Africa
  'ZA': 'Africa',
  'NG': 'Africa',
  'EG': 'Africa',
  'MA': 'Africa',
  'KE': 'Africa',
  
  // Australia/Oceania
  'AU': 'Australia',
  'NZ': 'Australia'
};

/**
 * Get geolocation information from an IP address
 * @param ip IP address to lookup
 * @returns GeoLocation object or null if IP couldn't be located
 */
export function getLocationFromIp(ip: string): GeoLocation | null {
  try {
    // Skip private or local IPs
    if (ip === '127.0.0.1' || ip === 'localhost' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
      return null;
    }
    
    // Handle potential IPv6 format from proxies
    if (ip.includes(':')) {
      // Extract the first part which is usually the actual IP
      const cleanedIp = ip.split(':')[0];
      if (cleanedIp) ip = cleanedIp;
    }
    
    // Check for X-Forwarded-For format with multiple IPs
    if (ip.includes(',')) {
      // The first IP is the client's true IP
      ip = ip.split(',')[0].trim();
    }
    
    // Lookup IP
    const geo = geoip.lookup(ip);
    return geo as GeoLocation | null;
  } catch (error) {
    console.error('Error looking up IP location:', error);
    return null;
  }
}

/**
 * Map a country code to its broader region
 * @param countryCode ISO 2-letter country code
 * @returns Region name or "Unknown" if not mapped
 */
export function mapCountryToRegion(countryCode: string): string {
  return countryToRegionMap[countryCode] || 'Unknown';
}

/**
 * Get full geolocation info with region mapping from an IP address
 * @param ip IP address to lookup
 * @returns Object containing country, region and original geo data
 */
export function getGeoInfo(ip: string): { 
  countryCode: string; 
  region: string; 
  geoData: GeoLocation | null; 
} {
  const geoData = getLocationFromIp(ip);
  
  if (!geoData) {
    return {
      countryCode: 'Unknown',
      region: 'Unknown',
      geoData: null
    };
  }
  
  const countryCode = geoData.country;
  const region = mapCountryToRegion(countryCode);
  
  return {
    countryCode,
    region,
    geoData
  };
}