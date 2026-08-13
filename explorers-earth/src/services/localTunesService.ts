import localTunesClient from '../lib/apiClient';

const LOCAL_TUNES_CONFIG = {
  apiUrl: import.meta.env.VITE_LOCAL_TUNES_API_URL || 'https://localtunes.earth',
  enabled: import.meta.env.VITE_LOCAL_TUNES_ENABLED === 'true',
  timeout: parseInt(import.meta.env.VITE_LOCAL_TUNES_TIMEOUT || '10000'),
  retryAttempts: parseInt(import.meta.env.VITE_LOCAL_TUNES_RETRY_ATTEMPTS || '3'),
};

export interface LocalTunesUserData {
  username: string;
  email: string;
  password: string;
  venueName: string;
}

export interface LocalTunesUserResponse {
  id: number;
  username: string;
  guestUrl: string;
  message?: string;
}

export interface LocalTunesError {
  message: string;
  status?: number;
  code?: string;
  requestId?: string;
}

export interface SyncUserData {
  id: string;
  username: string;
  email: string;
}

export async function syncLocalTunesUser(
  _strapiUser: SyncUserData
): Promise<{ success: boolean; user?: any; message?: string; code?: string; requestId?: string }> {
  if (!LOCAL_TUNES_CONFIG.enabled) {
    return { success: true, message: 'Integration disabled' };
  }

  try {
    const response = await localTunesClient.post('/api/auth/sync', undefined, {
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      timeout: LOCAL_TUNES_CONFIG.timeout,
    });
    return { success: true, user: response.data.user, message: 'User synced with LocalTunes' };
  } catch (error: any) {
    const safeError = error.response?.data?.error;
    return {
      success: false,
      message: safeError?.message || 'Sync failed',
      code: safeError?.code,
      requestId: safeError?.requestId,
    };
  }
}

function legacyRegistrationDisabled(): Error {
  return Object.assign(new Error('Music account setup is temporarily unavailable.'), {
    code: 'LEGACY_MUSIC_REGISTRATION_DISABLED',
    retryable: false,
  });
}

/** @deprecated Automatic server-side provisioning will replace this password path. */
export async function createLocalTunesUser(
  _userData: LocalTunesUserData
): Promise<LocalTunesUserResponse | null> {
  throw legacyRegistrationDisabled();
}

/** @deprecated Automatic server-side provisioning will replace this password path. */
export async function createLocalTunesUserWithRetry(
  _userData: LocalTunesUserData,
  _maxRetries: number = LOCAL_TUNES_CONFIG.retryAttempts
): Promise<LocalTunesUserResponse | null> {
  throw legacyRegistrationDisabled();
}

/** @deprecated Only retained as a typed compatibility seam for old integrations. */
export function prepareLocalTunesUserData(strapiUserData: {
  username: string;
  email: string;
  password: string;
  accountName?: string;
  businessName?: string;
}): LocalTunesUserData {
  if (!strapiUserData.username || !strapiUserData.email || !strapiUserData.password) {
    throw new Error('Missing required fields: username, email, and password are required');
  }

  const venueName = strapiUserData.accountName || strapiUserData.businessName ||
    strapiUserData.username || strapiUserData.email;
  if (!venueName.trim()) {
    throw new Error('venueName cannot be empty');
  }

  return {
    username: strapiUserData.username.trim(),
    email: strapiUserData.email.trim(),
    password: strapiUserData.password,
    venueName: venueName.trim(),
  };
}

export function logUserCreation(
  _strapiUserId: string,
  _localTunesResult: LocalTunesUserResponse | null
): void {
  // Deliberately silent: identifiers and upstream responses are not client logs.
}

export function isLocalTunesEnabled(): boolean {
  return LOCAL_TUNES_CONFIG.enabled;
}

export async function checkLocalTunesAccountExists(_username: string): Promise<boolean> {
  return false;
}

export function getLocalTunesConfig() {
  return { ...LOCAL_TUNES_CONFIG };
}

export async function changeLocalTunesPassword(): Promise<{ success: boolean; message?: string }> {
  return { success: false, message: 'Music password synchronization is disabled' };
}

export async function updateLocalTunesUsername(
  _newUsername: string,
  _currentUsername: string
): Promise<{ success: boolean; message?: string }> {
  return { success: false, message: 'Music username synchronization is disabled' };
}
