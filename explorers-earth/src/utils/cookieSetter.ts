/**
 * Manual Cookie Setter for Testing
 * 
 * This function allows you to manually set the localtunes_cross_domain_auth cookie
 * for both localhost:5173 and localtunes.earth domains.
 */

// Function to manually set the cross-domain auth cookie
export function setLocalTunesCrossDomainCookie() {
  console.log('🍪 Manually setting localtunes_cross_domain_auth cookie...');
  
  // The cookie data you want to store
  const cookieData = {
    auth_token: "c3a32nc5kri-16-1761414483315",
    auth_user: '{"id":16,"username":"localtunes","email":"localtunes@gmail.com","password":"9721fa9207a2e87d4d46d6fb7f8e3d78bda50f98c9cbe668d3be4cf29f6f1c4655.457bc8996862537d93d2e825dc4f3c17","otp":null,"verified":true,"createdAt":"2024-12-25T10:30:00.000Z","updatedAt":"2024-12-25T10:30:00.000Z"}',
    timestamp: Date.now(),
    expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
    domain: "https://localtunes.earth"
  };
  
  const cookieValue = JSON.stringify(cookieData);
  const expires = new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)); // 7 days
  
  // Set cookie for localhost:5173 (current domain)
  document.cookie = `localtunes_cross_domain_auth=${encodeURIComponent(cookieValue)}; Domain=localhost; Path=/; Expires=${expires.toUTCString()}; SameSite=Lax`;
  
  console.log('✅ Cookie set for localhost:5173');
  console.log('📦 Cookie value:', cookieValue.substring(0, 100) + '...');
  
  // Also store in localStorage for immediate access
  localStorage.setItem('localtunes_cross_domain_auth', cookieValue);
  sessionStorage.setItem('localtunes_cross_domain_auth', cookieValue);
  
  console.log('✅ Cross-domain auth data stored in localStorage and sessionStorage');
  
  // Try to set cookie for localtunes.earth via iframe
  setCookieForLocalTunes(cookieValue, expires);
  
  return cookieData;
}

// Function to set cookie for LocalTunes domain via iframe
function setCookieForLocalTunes(cookieValue: string, expires: Date) {
  try {
    console.log('🍪 Attempting to set cookie for localtunes.earth...');
    
    // Create a hidden iframe to set cookie for localtunes.earth
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = 'https://localtunes.earth/set-cookie';
    
    // Listen for response from LocalTunes
    const messageHandler = (event: MessageEvent) => {
      if (event.origin !== 'https://localtunes.earth') {
        return;
      }
      
      if (event.data.type === 'LOCALTUNES_COOKIE_READY') {
        console.log('✅ LocalTunes cookie setter ready');
        
        // Send cookie data to LocalTunes
        iframe.contentWindow?.postMessage({
          type: 'LOCALTUNES_SET_COOKIE',
          cookieName: 'localtunes_cross_domain_auth',
          cookieValue: cookieValue,
          expires: expires.toUTCString(),
          timestamp: Date.now()
        }, 'https://localtunes.earth');
        
        // Clean up
        window.removeEventListener('message', messageHandler);
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 2000);
      }
      
      if (event.data.type === 'LOCALTUNES_COOKIE_SET') {
        if (event.data.success) {
          console.log('✅ Cookie successfully set for localtunes.earth');
        } else {
          console.error('❌ Failed to set cookie for localtunes.earth:', event.data.error);
        }
      }
    };
    
    window.addEventListener('message', messageHandler);
    document.body.appendChild(iframe);
    
    // Cleanup after timeout
    setTimeout(() => {
      window.removeEventListener('message', messageHandler);
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 10000);
    
  } catch (error) {
    console.log('⚠️ Could not set cookie for localtunes.earth:', error);
  }
}

// Function to check if cookies are set
export function checkCrossDomainCookies() {
  console.log('🔍 Checking cross-domain cookies...');
  
  // Check localStorage
  const localAuth = localStorage.getItem('localtunes_cross_domain_auth');
  const sessionAuth = sessionStorage.getItem('localtunes_cross_domain_auth');
  
  console.log('📦 localStorage auth data:', localAuth ? 'Found' : 'Not found');
  console.log('📦 sessionStorage auth data:', sessionAuth ? 'Found' : 'Not found');
  
  // Check cookies
  const cookies = document.cookie.split(';');
  const crossDomainCookie = cookies.find(cookie => 
    cookie.trim().startsWith('localtunes_cross_domain_auth=')
  );
  
  console.log('🍪 Cross-domain cookie:', crossDomainCookie ? 'Found' : 'Not found');
  
  if (crossDomainCookie) {
    try {
      const cookieValue = decodeURIComponent(crossDomainCookie.split('=')[1]);
      const parsedData = JSON.parse(cookieValue);
      console.log('📦 Parsed cookie data:', parsedData);
    } catch (e) {
      console.log('⚠️ Could not parse cookie data');
    }
  }
  
  return {
    localStorage: !!localAuth,
    sessionStorage: !!sessionAuth,
    cookie: !!crossDomainCookie
  };
}

// Function to clear all cross-domain auth data
export function clearCrossDomainAuthData() {
  console.log('🧹 Clearing all cross-domain auth data...');
  
  // Clear localStorage
  localStorage.removeItem('localtunes_cross_domain_auth');
  sessionStorage.removeItem('localtunes_cross_domain_auth');
  
  // Clear cookie
  document.cookie = 'localtunes_cross_domain_auth=; Domain=localhost; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT';
  
  console.log('✅ All cross-domain auth data cleared');
}

// Export for browser console usage
if (typeof window !== 'undefined') {
  (window as any).setLocalTunesCrossDomainCookie = setLocalTunesCrossDomainCookie;
  (window as any).checkCrossDomainCookies = checkCrossDomainCookies;
  (window as any).clearCrossDomainAuthData = clearCrossDomainAuthData;
  
  console.log('🔧 Cross-domain cookie functions loaded:');
  console.log('- setLocalTunesCrossDomainCookie() - Set the cookie manually');
  console.log('- checkCrossDomainCookies() - Check if cookies are set');
  console.log('- clearCrossDomainAuthData() - Clear all auth data');
}

export default {
  setLocalTunesCrossDomainCookie,
  checkCrossDomainCookies,
  clearCrossDomainAuthData
};
