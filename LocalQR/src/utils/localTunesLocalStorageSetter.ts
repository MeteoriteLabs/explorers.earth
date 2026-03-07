/**
 * Manual LocalTunes localStorage Setter for Testing
 * 
 * This function allows you to manually set the LocalTunes authentication data
 * in localStorage for localtunes.earth in the exact format LocalTunes expects.
 */

// Function to manually set LocalTunes localStorage data
export function setLocalTunesLocalStorage() {
  console.log('💾 Manually setting LocalTunes localStorage data...');
  
  // The exact format LocalTunes expects (from your screenshots)
  const authTokenData = {
    value: "78df7bd7-cb21-4f78-a32f-c2f894fea8ff", // Example token
    expires: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
  };
  
  const userData = {
    id: 16,
    username: "localtunes",
    email: "localtunes@gmail.com",
    otp: null,
    otpExpiry: null,
    accountManagerId: null,
    allowGuestPlayOnDevice: true,
    allowPlaylistSharing: true,
    allowRecentlyPlayedVisibility: true,
    allowSongRequests: true,
    emailVerificationExpiry: "2025-10-25T16:47:27.428Z",
    emailVerificationToken: "ec296b9693ca8720f76cfb58f97841bb5ae442a1913cca592858049810a85af7",
    guestUrl: "a02ea50669d00d3e50cfa7aed99d746a",
    isEmailVerified: false,
    theme: { primary: "#6E56CF" },
    venueName: "localtunes"
  };
  
  // Try to set localStorage for localtunes.earth via iframe
  setLocalStorageForLocalTunes(authTokenData, userData);
  
  return { authTokenData, userData };
}

// Function to set localStorage for LocalTunes domain via iframe
function setLocalStorageForLocalTunes(authTokenData: any, userData: any) {
  try {
    console.log('💾 Attempting to set localStorage for localtunes.earth...');
    
    // Create a hidden iframe to set localStorage for localtunes.earth
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = 'https://localtunes.earth/sso-callback';
    
    // Listen for response from LocalTunes
    const messageHandler = (event: MessageEvent) => {
      if (event.origin !== 'https://localtunes.earth') {
        return;
      }
      
      if (event.data.type === 'LOCALTUNES_SSO_READY') {
        console.log('✅ LocalTunes SSO callback ready');
        
        // Send auth data to LocalTunes in the exact format it expects
        iframe.contentWindow?.postMessage({
          type: 'LOCALTUNES_SSO_AUTH',
          authData: {
            auth_token: authTokenData,
            auth_user: userData
          },
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
      
      if (event.data.type === 'LOCALTUNES_SSO_SUCCESS') {
        console.log('✅ LocalTunes localStorage data set successfully');
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
    console.log('⚠️ Could not set localStorage for localtunes.earth:', error);
  }
}

// Function to check LocalTunes localStorage (if accessible)
export function checkLocalTunesLocalStorage() {
  console.log('🔍 Checking LocalTunes localStorage...');
  
  // This will only work if we're on the same origin
  try {
    const authToken = localStorage.getItem('auth_token');
    const authUser = localStorage.getItem('auth_user');
    
    if (authToken && authUser) {
      console.log('✅ LocalTunes localStorage data found:');
      console.log('📦 auth_token:', JSON.parse(authToken));
      console.log('📦 auth_user:', JSON.parse(authUser));
      return true;
    } else {
      console.log('❌ No LocalTunes localStorage data found');
      return false;
    }
  } catch (error: unknown) {
    console.log('⚠️ Cannot access LocalTunes localStorage (cross-origin):', (error as Error).message);
    return false;
  }
}

// Function to clear LocalTunes localStorage
export function clearLocalTunesLocalStorage() {
  console.log('🧹 Clearing LocalTunes localStorage...');
  
  try {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('sso_timestamp');
    console.log('✅ LocalTunes localStorage cleared');
  } catch (error: unknown) {
    console.log('⚠️ Could not clear LocalTunes localStorage:', (error as Error).message);
  }
}

// Export for browser console usage
if (typeof window !== 'undefined') {
  (window as any).setLocalTunesLocalStorage = setLocalTunesLocalStorage;
  (window as any).checkLocalTunesLocalStorage = checkLocalTunesLocalStorage;
  (window as any).clearLocalTunesLocalStorage = clearLocalTunesLocalStorage;
  
  console.log('🔧 LocalTunes localStorage functions loaded:');
  console.log('- setLocalTunesLocalStorage() - Set LocalTunes localStorage manually');
  console.log('- checkLocalTunesLocalStorage() - Check LocalTunes localStorage');
  console.log('- clearLocalTunesLocalStorage() - Clear LocalTunes localStorage');
}

export default {
  setLocalTunesLocalStorage,
  checkLocalTunesLocalStorage,
  clearLocalTunesLocalStorage
};
