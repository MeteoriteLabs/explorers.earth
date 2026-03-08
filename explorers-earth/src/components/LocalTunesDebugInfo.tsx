/**
 * Debug component to check Local Tunes configuration
 * Add this temporarily to your onboarding page to debug the issue
 */

import { getLocalTunesConfig, isLocalTunesEnabled } from '../services/localTunesService';

export const LocalTunesDebugInfo = () => {
  const config = getLocalTunesConfig();
  
  return (
    <div className="bg-red-900 border border-red-500 rounded p-4 m-4">
      <h3 className="text-red-200 font-bold mb-2">Local Tunes Debug Info</h3>
      <div className="text-red-100 text-sm space-y-1">
        <div>Environment Variables:</div>
        <div>• VITE_LOCAL_TUNES_API_URL: {import.meta.env.VITE_LOCAL_TUNES_API_URL || 'NOT SET'}</div>
        <div>• VITE_LOCAL_TUNES_ENABLED: {import.meta.env.VITE_LOCAL_TUNES_ENABLED || 'NOT SET'}</div>
        <div>• VITE_LOCAL_TUNES_TIMEOUT: {import.meta.env.VITE_LOCAL_TUNES_TIMEOUT || 'NOT SET'}</div>
        <div>• VITE_LOCAL_TUNES_RETRY_ATTEMPTS: {import.meta.env.VITE_LOCAL_TUNES_RETRY_ATTEMPTS || 'NOT SET'}</div>
        <div className="mt-2">Parsed Configuration:</div>
        <div>• API URL: {config.apiUrl}</div>
        <div>• Enabled: {config.enabled ? 'YES' : 'NO'}</div>
        <div>• Timeout: {config.timeout}ms</div>
        <div>• Retry Attempts: {config.retryAttempts}</div>
        <div className="mt-2">Function Results:</div>
        <div>• isLocalTunesEnabled(): {isLocalTunesEnabled() ? 'TRUE' : 'FALSE'}</div>
      </div>
    </div>
  );
};
