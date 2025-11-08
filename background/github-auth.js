/**
 * GitHub OAuth Authentication Module
 * Implements OAuth flow for secure authentication
 */

import { generateState } from '../lib/pkce.js';

const STORAGE_KEYS = {
  TOKENS: 'github_tokens',
  AUTH_STATE: 'auth_state',
  CLIENT_ID: 'github_client_id',
  CLIENT_SECRET: 'github_client_secret'
};

const TOKEN_REFRESH_THRESHOLD = 5 * 60 * 1000;
const GITHUB_CLIENT_ID = 'SET_ME_UP';

export function getRedirectURI() {
  return chrome.identity.getRedirectURL();
}

/**
 * Store authentication tokens
 * @param {Object} tokens - Token data
 * @param {string} tokens.accessToken - Access token
 * @param {string} tokens.refreshToken - Refresh token
 * @param {number} tokens.expiresIn - Expiry time in seconds
 * @param {string} tokens.scope - Token scope
 */
async function storeTokens(tokens) {
  const expiresAt = Date.now() + (tokens.expiresIn * 1000);
  const tokenData = {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: expiresAt,
    scope: tokens.scope
  };
  await chrome.storage.local.set({ [STORAGE_KEYS.TOKENS]: tokenData });
}

/**
 * Get stored tokens
 * @returns {Promise<Object|null>} Token data or null
 */
export async function getTokens() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.TOKENS);
  return result[STORAGE_KEYS.TOKENS] || null;
}

/**
 * Clear all stored authentication data
 */
export async function clearAuth() {
  await chrome.storage.local.remove([
    STORAGE_KEYS.TOKENS,
    STORAGE_KEYS.AUTH_STATE
  ]);
}

/**
 * Check if user is authenticated and token is valid
 * @returns {Promise<boolean>}
 */
export async function isAuthenticated() {
  const tokens = await getTokens();
  if (!tokens) return false;

  // Check if token is expired or about to expire
  const timeUntilExpiry = tokens.expiresAt - Date.now();
  return timeUntilExpiry > TOKEN_REFRESH_THRESHOLD;
}

/**
 * Start GitHub App authentication flow with repository selection
 * @returns {Promise<Object>} Token data
 * @throws {Error} If authentication fails
 */
export async function authenticate() {
  // Get stored client ID
  const clientId = await getClientId();
  if (!clientId) {
    throw new Error('No Client ID configured. Please configure OAuth credentials first.');
  }

  // Generate state for CSRF protection
  const state = generateState();

  // Store state for later verification
  await chrome.storage.local.set({
    [STORAGE_KEYS.AUTH_STATE]: state
  });

  const redirectUri = getRedirectURI();
  const authUrl = new URL('https://github.com/login/oauth/authorize');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('scope', 'repo');

  try {
    const responseUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl.toString(),
      interactive: true
    });

    // Parse response URL
    const url = new URL(responseUrl);
    const code = url.searchParams.get('code');
    const returnedState = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) {
      throw new Error(`GitHub authorization failed: ${error}`);
    }

    if (!code) {
      throw new Error('No authorization code received');
    }

    // Verify state to prevent CSRF
    const storedState = (await chrome.storage.local.get(STORAGE_KEYS.AUTH_STATE))[STORAGE_KEYS.AUTH_STATE];
    if (returnedState !== storedState) {
      throw new Error('State mismatch - possible CSRF attack');
    }

    // Exchange code for token via backend
    const tokens = await exchangeCodeForToken(code, redirectUri);

    // Store tokens
    await storeTokens(tokens);

    await chrome.storage.local.remove([STORAGE_KEYS.AUTH_STATE]);
    return tokens;

  } catch (error) {
    await chrome.storage.local.remove([STORAGE_KEYS.AUTH_STATE]);
    throw error;
  }
}

/**
 * Exchange authorization code for access token
 * @param {string} code - Authorization code
 * @param {string} redirectUri - Redirect URI
 * @returns {Promise<Object>} Token data
 */
async function exchangeCodeForToken(code, redirectUri) {
  // Get stored credentials
  const clientId = await getClientId();
  const clientSecret = await getClientSecret();

  if (!clientId || !clientSecret) {
    throw new Error('OAuth credentials not configured. Please set up Client ID and Secret in extension settings.');
  }

  try {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        redirect_uri: redirectUri
      })
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`GitHub error: ${data.error} - ${data.error_description || ''}`);
    }

    if (!data.access_token) {
      throw new Error('No access token received from GitHub');
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || null,
      expiresIn: data.expires_in || 28800, // OAuth tokens don't expire by default, set to 8 hours
      scope: data.scope
    };
  } catch (error) {
    console.error('[SpikePrimeGit Auth] Token exchange error:', error);
    throw new Error(`Failed to exchange token: ${error.message}`);
  }
}

/**
 * Refresh access token using refresh token
 * @returns {Promise<Object>} New token data
 * @throws {Error} If refresh fails
 */
export async function refreshAccessToken() {
  const tokens = await getTokens();
  if (!tokens || !tokens.refreshToken) {
    throw new Error('No refresh token available');
  }

  const clientId = await getClientId();
  if (!clientId) {
    throw new Error('GitHub Client ID not configured');
  }

  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      client_id: clientId,
      grant_type: 'refresh_token',
      refresh_token: tokens.refreshToken
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token refresh failed: ${response.status} ${text}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(`Token refresh error: ${data.error_description || data.error}`);
  }

  const newTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in || 28800,
    scope: data.scope
  };

  await storeTokens(newTokens);
  return newTokens;
}

/**
 * Get valid access token, refreshing if necessary
 * @returns {Promise<string>} Valid access token
 * @throws {Error} If unable to get valid token
 */
export async function getValidAccessToken() {
  const tokens = await getTokens();

  if (!tokens) {
    throw new Error('Not authenticated');
  }

  // Check if token needs refresh
  const timeUntilExpiry = tokens.expiresAt - Date.now();

  if (timeUntilExpiry <= TOKEN_REFRESH_THRESHOLD) {
    try {
      const newTokens = await refreshAccessToken();
      return newTokens.accessToken;
    } catch (error) {
      console.error('[SpikePrimeGit Auth] Token refresh failed:', error);
      // Clear invalid tokens
      await clearAuth();
      throw new Error('Token expired and refresh failed. Please re-authenticate.');
    }
  }

  return tokens.accessToken;
}

/**
 * Get authenticated user information
 * @returns {Promise<Object>} User data
 */
export async function getAuthenticatedUser() {
  const token = await getValidAccessToken();

  const response = await fetch('https://api.github.com/user', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to get user info: ${response.status}`);
  }

  return await response.json();
}

/**
 * Get GitHub Client ID
 * @returns {Promise<string>} Client ID
 */
export async function getClientId() {
  // Try to get from storage first
  const result = await chrome.storage.local.get(STORAGE_KEYS.CLIENT_ID);
  if (result[STORAGE_KEYS.CLIENT_ID]) {
    return result[STORAGE_KEYS.CLIENT_ID];
  }
  // Fallback to hardcoded (for backward compatibility)
  return GITHUB_CLIENT_ID;
}

/**
 * Get GitHub Client Secret
 * @returns {Promise<string|null>} Client Secret or null
 */
export async function getClientSecret() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.CLIENT_SECRET);
  return result[STORAGE_KEYS.CLIENT_SECRET] || null;
}

/**
 * Set OAuth credentials (for setup screen)
 * @param {string} clientId - GitHub OAuth App Client ID
 * @param {string} clientSecret - GitHub OAuth App Client Secret
 */
export async function setCredentials(clientId, clientSecret) {
  await chrome.storage.local.set({
    [STORAGE_KEYS.CLIENT_ID]: clientId,
    [STORAGE_KEYS.CLIENT_SECRET]: clientSecret
  });
}

/**
 * Get list of repositories accessible to the GitHub App installation
 * This shows which repositories the user granted access to
 * @returns {Promise<Array>} List of accessible repositories
 */
export async function getAccessibleRepositories() {
  const token = await getValidAccessToken();

  const response = await fetch('https://api.github.com/installation/repositories', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json'
    }
  });

  if (!response.ok) {
    // If this endpoint fails, it might be an OAuth App token instead of GitHub App
    // Fallback to user repos
    console.warn('[SpikePrimeGit Auth] Not a GitHub App token, using user repos instead');
    return [];
  }

  const data = await response.json();
  return data.repositories || [];
}
