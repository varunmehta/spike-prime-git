/**
 * SpikePrimeGit Popup JavaScript
 * Handles popup UI and user interactions
 */

// Get references to DOM elements
const screens = {
  loading: document.getElementById('loading-screen'),
  setup: document.getElementById('setup-screen'),
  notConnected: document.getElementById('not-connected-screen'),
  connected: document.getElementById('connected-screen')
};

const elements = {
  redirectUri: document.getElementById('redirect-uri'),
  copyRedirectBtn: document.getElementById('copy-redirect-btn'),
  callbackUrlDisplay: document.getElementById('callback-url-display'),
  copyCallbackBtn: document.getElementById('copy-callback-btn'),
  clientIdInput: document.getElementById('client-id-input'),
  clientSecretInput: document.getElementById('client-secret-input'),
  saveClientIdBtn: document.getElementById('save-client-id-btn'),
  connectBtn: document.getElementById('connect-btn'),
  reconfigureLink: document.getElementById('reconfigure-link'),
  userAvatar: document.getElementById('user-avatar'),
  userName: document.getElementById('user-name'),
  repoSelect: document.getElementById('repo-select'),
  branchSelect: document.getElementById('branch-select'),
  projectPath: document.getElementById('project-path'),
  syncInterval: document.getElementById('sync-interval'),
  refreshReposBtn: document.getElementById('refresh-repos-btn'),
  saveSettingsBtn: document.getElementById('save-settings-btn'),
  disconnectBtn: document.getElementById('disconnect-btn'),
  syncHistory: document.getElementById('sync-history'),
  errorMessage: document.getElementById('error-message'),
  successMessage: document.getElementById('success-message')
};

// State
let currentRepos = [];
let currentBranches = [];
let currentSettings = {};

/**
 * Show a specific screen
 */
function showScreen(screenName) {
  Object.values(screens).forEach(screen => screen.classList.add('hidden'));
  if (screens[screenName]) {
    screens[screenName].classList.remove('hidden');
  }
}

/**
 * Show error message
 */
function showError(message) {
  elements.errorMessage.textContent = message;
  elements.errorMessage.classList.remove('hidden');
  setTimeout(() => {
    elements.errorMessage.classList.add('hidden');
  }, 5000);
}

/**
 * Show success message
 */
function showSuccess(message) {
  elements.successMessage.textContent = message;
  elements.successMessage.classList.remove('hidden');
  setTimeout(() => {
    elements.successMessage.classList.add('hidden');
  }, 3000);
}

/**
 * Send message to background script with timeout
 */
async function sendMessage(type, data = {}, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Message ${type} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    chrome.runtime.sendMessage({ type, data }, response => {
      clearTimeout(timeout);
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Initialize popup
 */
async function initialize() {
  console.log('[SpikePrimeGit Popup] Initializing...');

  try {
    // Get redirect URI for both setup and not-connected screens
    const redirectUriResponse = await sendMessage('GET_REDIRECT_URI');
    if (redirectUriResponse && redirectUriResponse.success) {
      const uri = redirectUriResponse.redirectUri;
      elements.redirectUri.value = uri;
      elements.callbackUrlDisplay.value = uri;
    }

    // Check if client ID is configured
    const clientIdResponse = await sendMessage('GET_CLIENT_ID');
    const hasClientId = clientIdResponse && clientIdResponse.success && clientIdResponse.clientId;

    if (!hasClientId) {
      // Show setup screen
      showScreen('setup');
      return;
    }

    // Check connection status
    const connectionResponse = await sendMessage('CHECK_CONNECTION');

    if (connectionResponse && connectionResponse.connected) {
      // Show connected screen
      await showConnectedScreen(connectionResponse.user);
    } else {
      // Show not connected screen
      showScreen('notConnected');
    }

  } catch (error) {
    console.error('[SpikePrimeGit Popup] Initialization error:', error);
    showError('Failed to initialize: ' + error.message);
    // Always show a screen even on error - default to setup if we can't determine state
    showScreen('setup');
  }
}

/**
 * Show connected screen and load data
 */
async function showConnectedScreen(user) {
  showScreen('connected');

  // Set user info
  if (user) {
    elements.userAvatar.src = user.avatar_url || '';
    elements.userName.textContent = user.name || user.login || 'User';
  }

  // Load settings
  await loadSettings();

  // Load repositories
  await loadRepositories();

  // Load sync history
  await loadSyncHistory();
}

/**
 * Load user settings
 */
async function loadSettings() {
  try {
    const response = await sendMessage('GET_SETTINGS');

    if (response.success) {
      currentSettings = response.settings;

      // Set project path
      elements.projectPath.value = currentSettings.projectPath || 'projects/';

      // Set sync interval (default 15 minutes)
      elements.syncInterval.value = currentSettings.syncInterval || 15;

      // Commit message is always empty - user must enter fresh message
      // elements.commitMessage.value = '';

      // Selected repo will be set after repos are loaded
    }
  } catch (error) {
    console.error('[SpikePrimeGit Popup] Error loading settings:', error);
  }
}

/**
 * Load repositories
 */
async function loadRepositories() {
  try {
    elements.repoSelect.innerHTML = '<option value="">Loading repositories...</option>';
    elements.repoSelect.disabled = true;

    const response = await sendMessage('GET_REPOS');

    if (response.success) {
      currentRepos = response.repos;

      // Check if no repositories found
      if (response.repos.length === 0) {
        elements.repoSelect.innerHTML = '<option value="">No repositories available</option>';
        showInstallationHelp(response.installUrl || 'https://github.com/apps/spikeprimegit');
        return;
      }

      elements.repoSelect.innerHTML = '<option value="">Select a repository</option>';

      response.repos.forEach(repo => {
        const option = document.createElement('option');
        option.value = repo.full_name;
        option.textContent = repo.full_name;
        elements.repoSelect.appendChild(option);
      });

      // Auto-select if only one repository
      if (response.repos.length === 1) {
        elements.repoSelect.value = response.repos[0].full_name;
        await loadBranches(response.repos[0].full_name);
      } else if (currentSettings.selectedRepo) {
        // Set previously selected repo if available
        elements.repoSelect.value = currentSettings.selectedRepo;
        await loadBranches(currentSettings.selectedRepo);
      }

      elements.repoSelect.disabled = false;
    } else {
      // Check if this is an installation error
      if (response.installUrl) {
        elements.repoSelect.innerHTML = '<option value="">No repositories available</option>';
        showInstallationHelp(response.installUrl);
        showError(response.error || 'GitHub App not installed');
      } else {
        throw new Error(response.error || 'Failed to load repositories');
      }
    }
  } catch (error) {
    console.error('[SpikePrimeGit Popup] Error loading repositories:', error);
    showError('Failed to load repositories: ' + error.message);
    elements.repoSelect.innerHTML = '<option value="">Error loading repositories</option>';
  }
}

/**
 * Show help UI when no repositories are in the installation
 */
function showInstallationHelp(installUrl) {
  // Remove any existing help box
  const existingHelp = document.getElementById('installation-help');
  if (existingHelp) {
    existingHelp.remove();
  }

  const helpDiv = document.createElement('div');
  helpDiv.id = 'installation-help';
  helpDiv.className = 'info-box';
  helpDiv.style.marginTop = '16px';

  // Create elements safely to prevent XSS
  const h3 = document.createElement('h3');
  h3.textContent = '⚠️ No Repository Access';

  const p1 = document.createElement('p');
  p1.style.margin = '12px 0';
  p1.textContent = "SpikePrimeGit doesn't have access to any repositories yet.";

  const p2 = document.createElement('p');
  p2.style.margin = '12px 0';
  p2.style.fontSize = '13px';
  p2.style.color = '#4a5568';
  p2.textContent = 'You need to add at least one repository to your SpikePrimeGit installation.';

  const link = document.createElement('a');
  link.href = installUrl;
  link.target = '_blank';
  link.className = 'btn-primary';
  link.style.display = 'inline-block';
  link.style.marginTop = '8px';
  link.style.textDecoration = 'none';
  link.style.textAlign = 'center';
  link.textContent = 'Add Repository Access';

  const p3 = document.createElement('p');
  p3.style.fontSize = '12px';
  p3.style.marginTop = '12px';
  p3.style.color = '#6b7280';
  p3.textContent = 'After adding repository access, click the refresh button (↻) above to reload.';

  helpDiv.appendChild(h3);
  helpDiv.appendChild(p1);
  helpDiv.appendChild(p2);
  helpDiv.appendChild(link);
  helpDiv.appendChild(p3);

  // Insert after repo select form section
  const repoFormSection = elements.repoSelect.closest('.form-section');
  repoFormSection.parentNode.insertBefore(helpDiv, repoFormSection.nextSibling);
}

/**
 * Load branches for selected repository
 */
async function loadBranches(repository) {
  try {
    elements.branchSelect.innerHTML = '<option value="">Loading branches...</option>';
    elements.branchSelect.disabled = true;

    const response = await sendMessage('GET_BRANCHES', { repository });

    if (response.success) {
      currentBranches = response.branches;

      elements.branchSelect.innerHTML = '<option value="">Select a branch</option>';

      response.branches.forEach(branch => {
        const option = document.createElement('option');
        option.value = branch.name;
        option.textContent = branch.name + (branch.protected ? ' 🔒' : '');
        elements.branchSelect.appendChild(option);
      });

      // Set selected branch if available
      if (currentSettings.selectedBranch) {
        elements.branchSelect.value = currentSettings.selectedBranch;
      }

      elements.branchSelect.disabled = false;
    } else {
      throw new Error(response.error || 'Failed to load branches');
    }
  } catch (error) {
    console.error('[SpikePrimeGit Popup] Error loading branches:', error);
    showError('Failed to load branches: ' + error.message);
    elements.branchSelect.innerHTML = '<option value="">Error loading branches</option>';
  }
}

/**
 * Load sync history
 */
async function loadSyncHistory() {
  try {
    const response = await sendMessage('GET_SYNC_HISTORY', { limit: 10 });

    if (response.success && response.history.length > 0) {
      elements.syncHistory.innerHTML = '';

      response.history.forEach(item => {
        const div = document.createElement('div');
        div.className = 'sync-item';

        const date = new Date(item.timestamp);
        const timeAgo = getTimeAgo(date);

        // Create elements safely to prevent XSS
        const projectNameDiv = document.createElement('div');
        projectNameDiv.className = 'sync-project-name';
        projectNameDiv.textContent = item.projectName;

        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'sync-details';
        detailsDiv.textContent = `${item.repository} (${item.branch}) • ${timeAgo}`;

        div.appendChild(projectNameDiv);
        div.appendChild(detailsDiv);

        elements.syncHistory.appendChild(div);
      });
    } else {
      elements.syncHistory.textContent = '';
      const emptyState = document.createElement('p');
      emptyState.className = 'empty-state';
      emptyState.textContent = 'No syncs yet';
      elements.syncHistory.appendChild(emptyState);
    }
  } catch (error) {
    console.error('[SpikePrimeGit Popup] Error loading sync history:', error);
  }
}

/**
 * Get time ago string
 */
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return Math.floor(seconds / 60) + ' min ago';
  if (seconds < 86400) return Math.floor(seconds / 3600) + ' hr ago';
  return Math.floor(seconds / 86400) + ' days ago';
}

/**
 * Save settings
 */
async function saveSettings() {
  try {
    elements.saveSettingsBtn.disabled = true;
    elements.saveSettingsBtn.textContent = 'Saving...';

    // Validate sync interval
    const syncInterval = parseInt(elements.syncInterval.value);
    if (isNaN(syncInterval) || syncInterval < 1 || syncInterval > 120) {
      showError('Sync interval must be between 1 and 120 minutes');
      return;
    }

    const settings = {
      selectedRepo: elements.repoSelect.value,
      selectedBranch: elements.branchSelect.value,
      projectPath: elements.projectPath.value,
      syncInterval: syncInterval
    };

    const response = await sendMessage('SAVE_SETTINGS', { settings });

    if (response.success) {
      currentSettings = settings;
      showSuccess('Settings saved successfully!');

      // Notify content script to update UI and sync interval
      const tabs = await chrome.tabs.query({ url: 'https://spike.legoeducation.com/*' });
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          type: 'UPDATE_SETTINGS',
          settings: settings
        });
      });
    } else {
      throw new Error(response.error || 'Failed to save settings');
    }
  } catch (error) {
    console.error('[SpikePrimeGit Popup] Error saving settings:', error);
    showError('Failed to save settings: ' + error.message);
  } finally {
    elements.saveSettingsBtn.disabled = false;
    elements.saveSettingsBtn.textContent = 'Save Settings';
  }
}

/**
 * Connect to GitHub
 */
async function connectToGitHub() {
  try {
    elements.connectBtn.disabled = true;
    elements.connectBtn.textContent = 'Connecting...';

    const response = await sendMessage('AUTHENTICATE');

    if (response.success) {
      showSuccess('Connected successfully!');
      await showConnectedScreen(response.user);
    } else {
      throw new Error(response.error || 'Authentication failed');
    }
  } catch (error) {
    console.error('[SpikePrimeGit Popup] Connection error:', error);
    showError('Failed to connect: ' + error.message);
  } finally {
    elements.connectBtn.disabled = false;
    elements.connectBtn.textContent = 'Connect to GitHub';
  }
}

/**
 * Disconnect from GitHub
 */
async function disconnect() {
  if (!confirm('Are you sure you want to disconnect from GitHub?')) {
    return;
  }

  try {
    const response = await sendMessage('DISCONNECT');

    if (response.success) {
      showSuccess('Disconnected successfully');
      showScreen('notConnected');
    } else {
      throw new Error(response.error || 'Disconnect failed');
    }
  } catch (error) {
    console.error('[SpikePrimeGit Popup] Disconnect error:', error);
    showError('Failed to disconnect: ' + error.message);
  }
}

/**
 * Save client credentials
 */
async function saveClientId() {
  const clientId = elements.clientIdInput.value.trim();
  const clientSecret = elements.clientSecretInput.value.trim();

  if (!clientId) {
    showError('Please enter a Client ID');
    return;
  }

  if (!clientSecret) {
    showError('Please enter a Client Secret');
    return;
  }

  try {
    elements.saveClientIdBtn.disabled = true;
    elements.saveClientIdBtn.textContent = 'Saving...';

    const response = await sendMessage('SET_CREDENTIALS', { clientId, clientSecret });

    if (response.success) {
      showSuccess('Credentials saved!');
      setTimeout(() => {
        showScreen('notConnected');
      }, 1000);
    } else {
      throw new Error(response.error || 'Failed to save credentials');
    }
  } catch (error) {
    console.error('[SpikePrimeGit Popup] Error saving credentials:', error);
    showError('Failed to save credentials: ' + error.message);
  } finally {
    elements.saveClientIdBtn.disabled = false;
    elements.saveClientIdBtn.textContent = 'Save & Continue';
  }
}

/**
 * Copy redirect URI to clipboard
 */
async function copyRedirectUri() {
  try {
    await navigator.clipboard.writeText(elements.redirectUri.value);
    elements.copyRedirectBtn.textContent = 'Copied!';
    setTimeout(() => {
      elements.copyRedirectBtn.textContent = 'Copy';
    }, 2000);
  } catch (error) {
    console.error('[SpikePrimeGit Popup] Copy error:', error);
    showError('Failed to copy to clipboard');
  }
}

/**
 * Copy callback URL to clipboard
 */
async function copyCallbackUrl() {
  try {
    await navigator.clipboard.writeText(elements.callbackUrlDisplay.value);
    elements.copyCallbackBtn.textContent = 'Copied!';
    setTimeout(() => {
      elements.copyCallbackBtn.textContent = 'Copy';
    }, 2000);
  } catch (error) {
    console.error('[SpikePrimeGit Popup] Copy error:', error);
    showError('Failed to copy to clipboard');
  }
}

// Event Listeners
elements.copyRedirectBtn.addEventListener('click', copyRedirectUri);
elements.copyCallbackBtn.addEventListener('click', copyCallbackUrl);
elements.saveClientIdBtn.addEventListener('click', saveClientId);
elements.connectBtn.addEventListener('click', connectToGitHub);
elements.disconnectBtn.addEventListener('click', disconnect);
elements.saveSettingsBtn.addEventListener('click', saveSettings);
elements.refreshReposBtn.addEventListener('click', loadRepositories);

elements.reconfigureLink.addEventListener('click', (e) => {
  e.preventDefault();
  if (confirm('This will clear your current configuration. Continue?')) {
    sendMessage('SET_CREDENTIALS', { clientId: '', clientSecret: '' }).then(() => {
      showScreen('setup');
    });
  }
});

elements.repoSelect.addEventListener('change', async (e) => {
  const repository = e.target.value;
  if (repository) {
    await loadBranches(repository);
  } else {
    elements.branchSelect.innerHTML = '<option value="">Select repository first</option>';
  }
});

// Initialize on load
initialize();
