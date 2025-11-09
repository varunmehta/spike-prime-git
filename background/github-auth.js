/**
 * GitHub App Authentication Module
 * Implements GitHub App installation flow with repository-specific access
 */

import { generateState } from '../lib/pkce.js';

const STORAGE_KEYS = {
  TOKENS: 'github_tokens',
  AUTH_STATE: 'auth_state',
  INSTALLATION: 'github_installation',
  CLIENT_ID: 'github_client_id',
  CLIENT_SECRET: 'github_client_secret'
};

const TOKEN_REFRESH_THRESHOLD = 5 * 60 * 1000;

// GitHub App credentials (to be replaced with actual values)
// After creating GitHub App at https://github.com/settings/apps/new
const GITHUB_APP_CLIENT_ID = 'Iv23li5u3EhSyZ8px0hQ'; // GitHub App Client ID (Iv1.xxxx)
const GITHUB_APP_CLIENT_SECRET = '987c47405aff44323aa2fe7f1c0fb1251403866f'; // GitHub App Client Secret

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
    STORAGE_KEYS.AUTH_STATE,
    STORAGE_KEYS.INSTALLATION
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
 * User must install the GitHub App to specific repositories first
 * @returns {Promise<Object>} Token data and installation info
 * @throws {Error} If authentication fails
 */
export async function authenticate() {
  // Get stored client ID
  const clientId = await getClientId();

  // Check if credentials are configured
  if (!clientId || clientId === 'SET_ME_UP') {
    throw new Error(
      'GitHub App not configured. ' +
      'Please create a GitHub App at https://github.com/settings/apps/new ' +
      'and update the credentials in the extension popup, or edit background/github-auth.js'
    );
  }

  // Generate state for CSRF protection
  const state = generateState();

  // Store state for later verification
  await chrome.storage.local.set({
    [STORAGE_KEYS.AUTH_STATE]: state
  });

  const redirectUri = getRedirectURI();

  // GitHub App OAuth flow - no scope needed, permissions defined in app
  const authUrl = new URL('https://github.com/login/oauth/authorize');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', state);
  // Note: No scope parameter - GitHub App permissions come from app configuration

  console.log('[SpikePrimeGit Auth] Starting OAuth flow:', {
    clientId: clientId.substring(0, 8) + '...',
    redirectUri,
    authUrl: authUrl.toString()
  });

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

    // Exchange code for token
    const tokens = await exchangeCodeForToken(code, redirectUri);

    // Store tokens
    await storeTokens(tokens);

    // Get GitHub App installations to find which repositories user granted access to
    const installations = await getInstallations(tokens.accessToken);

    if (installations.length === 0) {
      // Clear tokens since installation is required
      await clearAuth();
      throw new Error(
        'No GitHub App installations found. ' +
        'Please complete the GitHub App installation by selecting repositories. ' +
        'Go to GitHub settings and install the app to at least one repository.'
      );
    }

    // Store the first installation (users typically have one)
    const installation = installations[0];
    await chrome.storage.local.set({
      [STORAGE_KEYS.INSTALLATION]: {
        id: installation.id,
        account: installation.account,
        repository_selection: installation.repository_selection,
        created_at: installation.created_at
      }
    });

    console.log('[SpikePrimeGit Auth] Authenticated with installation:', installation.id);

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
 * Get GitHub App Client ID
 * @returns {Promise<string>} Client ID
 */
export async function getClientId() {
  // Try to get from storage first (for user-configured apps)
  const result = await chrome.storage.local.get(STORAGE_KEYS.CLIENT_ID);
  if (result[STORAGE_KEYS.CLIENT_ID]) {
    return result[STORAGE_KEYS.CLIENT_ID];
  }
  // Fallback to hardcoded GitHub App client ID
  return GITHUB_APP_CLIENT_ID;
}

/**
 * Get GitHub App Client Secret
 * @returns {Promise<string|null>} Client Secret or null
 */
export async function getClientSecret() {
  // Try to get from storage first (for user-configured apps)
  const result = await chrome.storage.local.get(STORAGE_KEYS.CLIENT_SECRET);
  if (result[STORAGE_KEYS.CLIENT_SECRET]) {
    return result[STORAGE_KEYS.CLIENT_SECRET];
  }
  // Fallback to hardcoded GitHub App client secret
  return GITHUB_APP_CLIENT_SECRET;
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
 * Get user's GitHub App installations
 * @param {string} token - User access token
 * @returns {Promise<Array>} List of installations
 */
async function getInstallations(token) {
  const response = await fetch('https://api.github.com/user/installations', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to get installations: ${response.status}`);
  }

  const data = await response.json();
  return data.installations || [];
}

/**
 * Get repositories accessible via GitHub App installation
 * Only returns repositories user explicitly granted access to
 * @returns {Promise<Array>} List of accessible repositories
 */
export async function getInstallationRepositories() {
  const token = await getValidAccessToken();

  // Get stored installation
  const result = await chrome.storage.local.get(STORAGE_KEYS.INSTALLATION);
  const installation = result[STORAGE_KEYS.INSTALLATION];

  if (!installation) {
    throw new Error('No installation found. Please authenticate first.');
  }

  // Get repositories for this installation
  const response = await fetch(
    `https://api.github.com/user/installations/${installation.id}/repositories`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    }
  );

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        'Installation not found. Please reinstall the SpikePrimeGit app at ' +
        'https://github.com/apps/spikeprimegit/installations/new'
      );
    }
    throw new Error(`Failed to get installation repositories: ${response.status}`);
  }

  const data = await response.json();
  return data.repositories || [];
}

/**
 * Get list of repositories accessible to the GitHub App installation
 * This shows which repositories the user granted access to
 * @returns {Promise<Array>} List of accessible repositories
 * @deprecated Use getInstallationRepositories() instead
 */
export async function getAccessibleRepositories() {
  try {
    return await getInstallationRepositories();
  } catch (error) {
    console.warn('[SpikePrimeGit Auth] Failed to get installation repositories:', error);
    return [];
  }
}
