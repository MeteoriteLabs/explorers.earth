/**
 * IP Geolocation Service
 * 
 * This service provides IP-to-country resolution using multiple fallback services
 * Uses CORS proxy for development and multiple services for production
 */

interface GeolocationResponse {
  country?: string;
  country_name?: string;
  country_code?: string;
  error?: string;
}

/**
 * Resolves IP address to country using multiple geolocation services
 * @param ipAddress - The IP address to resolve
 * @returns Promise<string | null> - Country name or null if resolution fails
 */
export const resolveIPToCountry = async (ipAddress: string): Promise<string | null> => {
  try {
    // Skip local/private IP addresses
    if (isPrivateIP(ipAddress)) {
      return 'Local';
    }

    // Try ipinfo.io first (most reliable for CORS)
    try {
      const response = await fetch(`https://ipinfo.io/${ipAddress}/json`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (response.ok) {
        const data: GeolocationResponse = await response.json();
        if (data.country) {
          return data.country;
        }
      }
    } catch (error) {
      console.warn(`ipinfo.io failed for ${ipAddress}:`, error);
    }

    // Try ipapi.co (may have CORS issues in development)
    try {
      const response = await fetch(`https://ipapi.co/${ipAddress}/json/`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (response.ok) {
        const data: GeolocationResponse = await response.json();
        if (data.error) {
          console.warn(`IP resolution error for ${ipAddress}: ${data.error}`);
          return null;
        }
        return data.country_name || null;
      }
    } catch (error) {
      console.warn(`ipapi.co failed for ${ipAddress}:`, error);
    }

    return null;
  } catch (error) {
    console.warn(`Error resolving IP ${ipAddress}:`, error);
    return null;
  }
};

/**
 * Checks if an IP address is private/local
 * @param ipAddress - The IP address to check
 * @returns boolean - True if private IP
 */
const isPrivateIP = (ipAddress: string): boolean => {
  const privateRanges = [
    /^10\./,                    // 10.0.0.0/8
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
    /^192\.168\./,              // 192.168.0.0/16
    /^127\./,                    // 127.0.0.0/8 (localhost)
    /^169\.254\./,               // 169.254.0.0/16 (link-local)
    /^::1$/,                     // IPv6 localhost
    /^fe80:/,                    // IPv6 link-local
  ];

  return privateRanges.some(range => range.test(ipAddress));
};

// Cache for resolved IP addresses to avoid duplicate API calls
const ipCache = new Map<string, string>();

/**
 * Batch resolves multiple IP addresses to countries
 * Includes caching to avoid duplicate API calls and rate limiting
 * @param ipAddresses - Array of IP addresses to resolve
 * @returns Promise<Map<string, string>> - Map of IP to country
 */
export const batchResolveIPsToCountries = async (ipAddresses: string[]): Promise<Map<string, string>> => {
  const uniqueIPs = [...new Set(ipAddresses)];
  const results = new Map<string, string>();
  
  // Check cache first
  const uncachedIPs: string[] = [];
  uniqueIPs.forEach(ip => {
    if (ipCache.has(ip)) {
      results.set(ip, ipCache.get(ip)!);
    } else {
      uncachedIPs.push(ip);
    }
  });

  // Only resolve uncached IPs
  if (uncachedIPs.length === 0) {
    return results;
  }

  // Process in smaller batches with longer delays to avoid rate limiting
  const batchSize = 3; // Reduced batch size
  for (let i = 0; i < uncachedIPs.length; i += batchSize) {
    const batch = uncachedIPs.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (ip) => {
      const country = await resolveIPToCountry(ip);
      if (country) {
        // Cache the result
        ipCache.set(ip, country);
        results.set(ip, country);
      }
    });
    
    await Promise.all(batchPromises);
    
    // Longer delay between batches to avoid rate limiting
    if (i + batchSize < uncachedIPs.length) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
    }
  }
  
  return results;
};
