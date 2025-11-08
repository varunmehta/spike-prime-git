/**
 * GitHub API Integration Module
 * Handles all GitHub API operations for repository management
 */

import { getValidAccessToken } from './github-auth.js';

const GITHUB_API_BASE = 'https://api.github.com';

/**
 * Make authenticated request to GitHub API
 * @param {string} endpoint - API endpoint (without base URL)
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} Response data
 */
async function githubRequest(endpoint, options = {}) {
  const token = await getValidAccessToken();

  const url = `${GITHUB_API_BASE}${endpoint}`;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
    ...options.headers
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  // Handle rate limiting
  if (response.status === 403) {
    const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
    if (rateLimitRemaining === '0') {
      const resetTime = response.headers.get('X-RateLimit-Reset');
      throw new Error(`GitHub API rate limit exceeded. Resets at ${new Date(resetTime * 1000).toLocaleString()}`);
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.message || response.statusText || `HTTP ${response.status}`;
    const detailedError = `${errorMessage} (${response.status} on ${options.method || 'GET'} ${endpoint})`;
    throw new Error(detailedError);
  }

  // Some endpoints return 204 No Content
  if (response.status === 204) {
    return null;
  }

  return await response.json();
}

/**
 * List repositories accessible to the authenticated user
 * @param {Object} options - Filter options
 * @param {string} options.sort - Sort by (created, updated, pushed, full_name)
 * @param {number} options.perPage - Results per page (max 100)
 * @returns {Promise<Array>} Array of repository objects
 */
export async function listUserRepos(options = {}) {
  const { sort = 'updated', perPage = 100 } = options;

  const params = new URLSearchParams({
    per_page: perPage.toString(),
    sort: sort,
    affiliation: 'owner,collaborator' // Only repos user owns or has push access to
  });

  const repos = await githubRequest(`/user/repos?${params}`);

  // Filter to only repos where user has push access
  return repos.filter(repo => !repo.archived && repo.permissions?.push);
}

/**
 * Get branches for a repository
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {Promise<Array>} Array of branch objects
 */
export async function getBranches(owner, repo) {
  return await githubRequest(`/repos/${owner}/${repo}/branches`);
}

/**
 * Get default branch for a repository
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {Promise<string>} Default branch name
 */
export async function getDefaultBranch(owner, repo) {
  const repoData = await githubRequest(`/repos/${owner}/${repo}`);
  return repoData.default_branch;
}

/**
 * Check if file exists at path and get its SHA
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} path - File path
 * @param {string} branch - Branch name
 * @returns {Promise<Object|null>} File data with SHA or null if not found
 */
export async function getFileIfExists(owner, repo, path, branch) {
  try {
    const params = new URLSearchParams({ ref: branch });
    const data = await githubRequest(`/repos/${owner}/${repo}/contents/${path}?${params}`);
    return data;
  } catch (error) {
    if (error.message.includes('404') || error.message.toLowerCase().includes('not found')) {
      return null;
    }
    throw error;
  }
}

/**
 * Convert ArrayBuffer to Base64 string
 * @param {ArrayBuffer} buffer - Buffer to convert
 * @returns {string} Base64 encoded string
 */
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Push file to GitHub repository
 * @param {Object} params - Push parameters
 * @param {string} params.owner - Repository owner
 * @param {string} params.repo - Repository name
 * @param {string} params.branch - Branch name
 * @param {string} params.path - File path in repository
 * @param {ArrayBuffer} params.content - File content as ArrayBuffer
 * @param {string} params.message - Commit message
 * @param {string} [params.sha] - Existing file SHA (for updates)
 * @returns {Promise<Object>} Commit data
 */
export async function pushFile(params) {
  const { owner, repo, branch, path, content, message, sha } = params;

  // Convert content to base64
  const base64Content = arrayBufferToBase64(content);

  const body = {
    message: message,
    content: base64Content,
    branch: branch
  };

  if (sha) {
    body.sha = sha;
  }

  const result = await githubRequest(`/repos/${owner}/${repo}/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify(body)
  });

  return result;
}

/**
 * Push SPIKE Prime project to GitHub
 * @param {Object} params - Push parameters
 * @param {string} params.repository - Repository in "owner/repo" format
 * @param {string} params.branch - Branch name
 * @param {string} params.projectName - Project name (for file path)
 * @param {ArrayBuffer} params.zipContent - ZIP file content
 * @returns {Promise<Object>} Result with commit SHA and file URL
 */
export async function pushSpikeProject(params) {
  const { repository, branch, projectName, zipContent } = params;

  // Parse repository owner and name
  const [owner, repo] = repository.split('/');
  if (!owner || !repo) {
    throw new Error(`Invalid repository format "${repository}". Expected "owner/repo"`);
  }

  // Get user settings for project path
  const settings = await chrome.storage.local.get('user_settings');
  let projectPath = settings.user_settings?.projectPath || 'projects/';

  projectPath = projectPath.trim();
  if (projectPath.startsWith('/')) {
    projectPath = projectPath.substring(1);
  }
  if (projectPath && !projectPath.endsWith('/')) {
    projectPath += '/';
  }

  const sanitizedName = projectName.replace(/[^a-zA-Z0-9-_]/g, '_');
  const filePath = `${projectPath}${sanitizedName}.llsp3`;

  const existingFile = await getFileIfExists(owner, repo, filePath, branch);

  const timestamp = new Date().toISOString();
  const action = existingFile ? 'Update' : 'Add';
  const commitMessage = `${action} SPIKE project: ${projectName}\n\nSynced from LEGO SPIKE Prime web editor\nTimestamp: ${timestamp}`;

  // Push file
  const result = await pushFile({
    owner,
    repo,
    branch,
    path: filePath,
    content: zipContent,
    message: commitMessage,
    sha: existingFile?.sha
  });

  // Store sync history
  await storeSyncHistory({
    timestamp: Date.now(),
    projectName: projectName,
    repository: repository,
    branch: branch,
    filePath: filePath,
    commitSha: result.commit.sha,
    success: true
  });

  return {
    commitSha: result.commit.sha,
    fileUrl: result.content.html_url,
    action: action.toLowerCase()
  };
}

/**
 * Store sync history
 * @param {Object} syncRecord - Sync record to store
 */
async function storeSyncHistory(syncRecord) {
  const result = await chrome.storage.local.get('sync_history');
  const history = result.sync_history || [];

  // Keep last 50 syncs
  history.unshift(syncRecord);
  if (history.length > 50) {
    history.splice(50);
  }

  await chrome.storage.local.set({ sync_history: history });
}

/**
 * Get sync history
 * @param {number} limit - Maximum number of records to return
 * @returns {Promise<Array>} Array of sync records
 */
export async function getSyncHistory(limit = 10) {
  const result = await chrome.storage.local.get('sync_history');
  const history = result.sync_history || [];
  return history.slice(0, limit);
}

/**
 * Test GitHub API connection
 * @returns {Promise<Object>} User info if connected
 */
export async function testConnection() {
  try {
    const token = await getValidAccessToken();
    const response = await fetch(`${GITHUB_API_BASE}/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      throw new Error('Connection test failed');
    }

    return await response.json();
  } catch (error) {
    console.error('[SpikePrimeGit API] Connection test failed:', error);
    throw error;
  }
}
