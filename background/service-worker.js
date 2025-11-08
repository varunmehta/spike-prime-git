/**
 * SpikePrimeGit Service Worker
 * Coordinates between content scripts, popup, and GitHub API
 */

import * as auth from './github-auth.js';
import * as api from './github-api.js';

// Message handlers
const messageHandlers = {
  // Check GitHub connection status
  CHECK_CONNECTION: async () => {
    try {
      const isAuth = await auth.isAuthenticated();
      if (!isAuth) {
        return { connected: false };
      }

      const user = await auth.getAuthenticatedUser();
      return {
        connected: true,
        user: {
          login: user.login,
          name: user.name,
          avatar_url: user.avatar_url
        }
      };
    } catch (error) {
      console.error('[SpikePrimeGit] Connection check failed:', error);
      return { connected: false, error: error.message };
    }
  },

  // Start GitHub authentication flow
  AUTHENTICATE: async () => {
    try {
      await auth.authenticate();
      const user = await auth.getAuthenticatedUser();
      return {
        success: true,
        user: {
          login: user.login,
          name: user.name,
          avatar_url: user.avatar_url
        }
      };
    } catch (error) {
      console.error('[SpikePrimeGit] Authentication failed:', error);
      return { success: false, error: error.message };
    }
  },

  // Disconnect from GitHub
  DISCONNECT: async () => {
    try {
      await auth.clearAuth();
      // Also clear user settings
      await chrome.storage.local.remove('user_settings');
      return { success: true };
    } catch (error) {
      console.error('[SpikePrimeGit] Disconnect failed:', error);
      return { success: false, error: error.message };
    }
  },

  // Get list of user repositories
  // For GitHub Apps: Only returns repositories the user granted access to
  // For OAuth Apps: Returns all user repositories
  GET_REPOS: async () => {
    try {
      // First try to get accessible repositories (GitHub App)
      const accessibleRepos = await auth.getAccessibleRepositories();

      if (accessibleRepos.length > 0) {
        // GitHub App - user has selected specific repositories
        console.log('[SpikePrimeGit] Using GitHub App accessible repositories:', accessibleRepos.length);
        return {
          success: true,
          repos: accessibleRepos.map(repo => ({
            full_name: repo.full_name,
            name: repo.name,
            owner: repo.owner.login,
            private: repo.private,
            default_branch: repo.default_branch,
            updated_at: repo.updated_at
          })),
          source: 'github_app' // Indicates repository-level access
        };
      }

      // Fallback to all user repos (OAuth App)
      console.log('[SpikePrimeGit] Using user repositories (OAuth App)');
      const repos = await api.listUserRepos();
      return {
        success: true,
        repos: repos.map(repo => ({
          full_name: repo.full_name,
          name: repo.name,
          owner: repo.owner.login,
          private: repo.private,
          default_branch: repo.default_branch,
          updated_at: repo.updated_at
        })),
        source: 'oauth_app' // Indicates user-level access
      };
    } catch (error) {
      console.error('[SpikePrimeGit] Get repos failed:', error);
      return { success: false, error: error.message };
    }
  },

  // Get branches for a repository
  GET_BRANCHES: async ({ repository }) => {
    try {
      const [owner, repo] = repository.split('/');
      const branches = await api.getBranches(owner, repo);
      return {
        success: true,
        branches: branches.map(b => ({
          name: b.name,
          protected: b.protected
        }))
      };
    } catch (error) {
      console.error('[SpikePrimeGit] Get branches failed:', error);
      return { success: false, error: error.message };
    }
  },

  // Push SPIKE project to GitHub
  PUSH_PROJECT: async ({ projectName, zipContent, repository, branch }) => {
    try {
      console.log('[SpikePrimeGit] Pushing project:', projectName);

      // Convert base64 back to ArrayBuffer if needed
      let arrayBuffer;
      if (typeof zipContent === 'string') {
        // Assume base64
        const binaryString = atob(zipContent);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        arrayBuffer = bytes.buffer;
      } else {
        arrayBuffer = zipContent;
      }

      const result = await api.pushSpikeProject({
        repository,
        branch,
        projectName,
        zipContent: arrayBuffer
      });

      return {
        success: true,
        commitSha: result.commitSha,
        fileUrl: result.fileUrl,
        action: result.action
      };
    } catch (error) {
      console.error('[SpikePrimeGit] Push project failed:', error);
      return { success: false, error: error.message };
    }
  },

  // Get sync history
  GET_SYNC_HISTORY: async ({ limit = 10 }) => {
    try {
      const history = await api.getSyncHistory(limit);
      return { success: true, history };
    } catch (error) {
      console.error('[SpikePrimeGit] Get sync history failed:', error);
      return { success: false, error: error.message };
    }
  },

  // Get user settings
  GET_SETTINGS: async () => {
    try {
      const result = await chrome.storage.local.get('user_settings');
      return {
        success: true,
        settings: result.user_settings || {
          selectedRepo: null,
          selectedBranch: null,
          projectPath: 'projects/',
          autoSync: false
        }
      };
    } catch (error) {
      console.error('[SpikePrimeGit] Get settings failed:', error);
      return { success: false, error: error.message };
    }
  },

  // Save user settings
  SAVE_SETTINGS: async ({ settings }) => {
    try {
      await chrome.storage.local.set({ user_settings: settings });
      return { success: true };
    } catch (error) {
      console.error('[SpikePrimeGit] Save settings failed:', error);
      return { success: false, error: error.message };
    }
  },

  // Get redirect URI for OAuth
  GET_REDIRECT_URI: async () => {
    try {
      const redirectUri = auth.getRedirectURI();
      return { success: true, redirectUri };
    } catch (error) {
      console.error('[SpikePrimeGit] Get redirect URI failed:', error);
      return { success: false, error: error.message };
    }
  },

  // Get GitHub Client ID
  GET_CLIENT_ID: async () => {
    try {
      const clientId = await auth.getClientId();
      return { success: true, clientId };
    } catch (error) {
      console.error('[SpikePrimeGit] Get client ID failed:', error);
      return { success: false, error: error.message };
    }
  },

  // Set OAuth credentials
  SET_CREDENTIALS: async ({ clientId, clientSecret }) => {
    try {
      await auth.setCredentials(clientId, clientSecret);
      return { success: true };
    } catch (error) {
      console.error('[SpikePrimeGit] Set credentials failed:', error);
      return { success: false, error: error.message };
    }
  }
};

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = messageHandlers[message.type];

  if (handler) {
    handler(message.data || {})
      .then(sendResponse)
      .catch(error => {
        console.error('[SpikePrimeGit] Handler error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  } else {
    sendResponse({ success: false, error: 'Unknown message type' });
    return false;
  }
});

// Handle extension installation
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await chrome.storage.local.set({
      user_settings: {
        selectedRepo: null,
        selectedBranch: null,
        projectPath: 'projects/',
        autoSync: false
      }
    });
  }
});

// Update badge based on connection status
async function updateBadge() {
  try {
    const isAuth = await auth.isAuthenticated();
    if (isAuth) {
      chrome.action.setBadgeBackgroundColor({ color: '#22C55E' }); // Green
      chrome.action.setBadgeText({ text: '✓' });
    } else {
      chrome.action.setBadgeBackgroundColor({ color: '#EF4444' }); // Red
      chrome.action.setBadgeText({ text: '!' });
    }
  } catch (error) {
    chrome.action.setBadgeBackgroundColor({ color: '#EF4444' });
    chrome.action.setBadgeText({ text: '!' });
  }
}

// Update badge periodically
updateBadge();
setInterval(updateBadge, 60000); // Every minute

// Listen for storage changes to update badge
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.github_tokens) {
    updateBadge();
  }
});
