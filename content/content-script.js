/**
 * SpikePrimeGit Content Script
 * Coordinator for SPIKE Prime page integration
 */

let uiInjector = null;
let capturedProject = null; // Store captured project data from MAIN world

/**
 * Initialize SpikePrimeGit on SPIKE page
 */
function initialize() {
  uiInjector = new UIInjector(handleSync);
  uiInjector.inject();
  uiInjector.listenForChanges();

  window.addEventListener('spikeprimegit:project-captured', async (event) => {

    // Store the captured project data (sent from MAIN world interceptor)
    capturedProject = {
      name: event.detail.projectName,
      content: event.detail.content,
      size: event.detail.size,
      timestamp: event.detail.timestamp
    };

    // Check if auto-sync is enabled
    const settings = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });

    if (settings.success && settings.settings.autoSync) {
      uiInjector.showNotification(
        `Project "${event.detail.projectName}" captured - syncing to GitHub...`,
        'info',
        2000
      );
      setTimeout(() => handleSync(true), 500);
    } else {
      uiInjector.showNotification(
        `Project "${event.detail.projectName}" ready to sync`,
        'info',
        3000
      );
    }
  });
}

async function handleSync(isAutoSync = false) {

  try {
    // Check if already connected
    const connectionStatus = await chrome.runtime.sendMessage({
      type: 'CHECK_CONNECTION'
    });

    if (!connectionStatus.connected) {
      uiInjector.showNotification(
        'Please connect to GitHub first. Click the SpikePrimeGit extension icon.',
        'error'
      );
      return;
    }

    // Get user settings
    const settingsResponse = await chrome.runtime.sendMessage({
      type: 'GET_SETTINGS'
    });

    if (!settingsResponse.success) {
      throw new Error('Failed to get settings');
    }

    const settings = settingsResponse.settings;

    if (!settings.selectedRepo || !settings.selectedBranch) {
      uiInjector.showNotification(
        'Please select a repository and branch in settings',
        'error'
      );
      return;
    }

    if (!capturedProject) {
      if (isAutoSync) {
        uiInjector.showNotification(
          'Auto-sync skipped - download project first to enable',
          'info',
          3000
        );
        return;
      }
      uiInjector.showNotification(
        '⚠️ No project captured yet.\n\n' +
        '📝 Please Download/Export your project from SPIKE Prime first, then click Sync again.',
        'error',
        10000
      );
      return;
    }

    uiInjector.showLoading('Syncing to GitHub...');
    const base64Content = arrayBufferToBase64(capturedProject.content);

    const response = await chrome.runtime.sendMessage({
      type: 'PUSH_PROJECT',
      data: {
        projectName: capturedProject.name,
        zipContent: base64Content,
        repository: settings.selectedRepo,
        branch: settings.selectedBranch
      }
    });

    if (response.success) {
      const successMessage = isAutoSync
        ? `✅ Auto-synced "${capturedProject.name}" to GitHub`
        : `✅ Synced "${capturedProject.name}" to GitHub`;

      uiInjector.updateSyncStatus({
        success: true,
        projectName: capturedProject.name,
        commitSha: response.commitSha,
        fileUrl: response.fileUrl,
        isAutoSync: isAutoSync
      });

      uiInjector.showNotification(successMessage, 'success', 5000);
      if (!isAutoSync) {
        capturedProject = null;
      }
    } else {
      throw new Error(response.error || 'Unknown error');
    }

  } catch (error) {
    uiInjector.updateSyncStatus({
      success: false,
      error: error.message
    });
  }
}

/**
 * Convert ArrayBuffer to base64
 * @param {ArrayBuffer} buffer
 * @returns {string}
 */
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'SYNC_NOW':
      handleSync().then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true; // Async response

    case 'GET_PROJECT_INFO':
      sendResponse({
        success: true,
        project: capturedProject ? {
          name: capturedProject.name,
          size: capturedProject.size,
          timestamp: capturedProject.timestamp
        } : null
      });
      break;

    case 'UPDATE_UI':
      if (uiInjector) {
        uiInjector.updateConnectionStatus();
      }
      sendResponse({ success: true });
      break;

    default:
      sendResponse({ success: false, error: 'Unknown message type' });
  }
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

window.addEventListener('unload', () => {
  if (uiInjector) uiInjector.remove();
  capturedProject = null;
});
