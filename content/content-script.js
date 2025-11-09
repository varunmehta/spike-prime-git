/**
 * SpikePrimeGit Content Script
 * Coordinator for SPIKE Prime page integration
 */

// Initialize logger with unique variable name (fallback if logger.js not loaded)
const csLogger = (typeof window.createLogger === 'function')
  ? window.createLogger('contentScript')
  : {
      info: (...args) => console.log('[SpikePrimeGit:contentScript]', ...args),
      warn: (...args) => console.warn('[SpikePrimeGit:contentScript]', ...args),
      error: (...args) => console.error('[SpikePrimeGit:contentScript]', ...args),
      debug: (...args) => console.debug('[SpikePrimeGit:contentScript]', ...args),
      success: (...args) => console.log('%c[SpikePrimeGit:contentScript]', 'color: green; font-weight: bold;', ...args),
      state: (label, obj) => { console.log('%c[SpikePrimeGit:contentScript] [STATE: ' + label + ']', 'color: blue; font-weight: bold;'); console.log(obj); },
      separator: () => console.log('%c[SpikePrimeGit:contentScript] ' + '='.repeat(60), 'color: gray;'),
      group: (label) => console.group('[SpikePrimeGit:contentScript] ' + label),
      groupCollapsed: (label) => console.groupCollapsed('[SpikePrimeGit:contentScript] ' + label),
      groupEnd: () => console.groupEnd()
    };

let uiInjector = null;
let capturedProject = null; // Store captured project data from MAIN world

/**
 * Initialize SpikePrimeGit on SPIKE page
 */
function initialize() {
  csLogger.info('Initializing SpikePrimeGit Content Script...');
  uiInjector = new UIInjector(handleSync);
  uiInjector.inject();
  uiInjector.listenForChanges();
  csLogger.success('UI Injector initialized');

  window.addEventListener('spikeprimegit:project-captured', async (event) => {
    csLogger.group('Project Captured Event Received');
    csLogger.state('Event Detail', event.detail);

    // Store the captured project data (sent from MAIN world interceptor)
    capturedProject = {
      name: event.detail.projectName,
      content: event.detail.content,
      size: event.detail.size,
      timestamp: event.detail.timestamp
    };

    csLogger.success(`Project stored in ISOLATED world: ${capturedProject.name} (${capturedProject.size} bytes)`);

    // Check if auto-sync is enabled
    csLogger.info('Checking auto-sync settings...');
    const settings = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });

    if (settings.success && settings.settings.autoSync) {
      csLogger.info('Auto-sync is ENABLED - initiating sync');
      uiInjector.showNotification(
        `Project "${event.detail.projectName}" captured - syncing to GitHub...`,
        'info',
        2000
      );
      setTimeout(() => handleSync(`Auto-synced ${event.detail.projectName}`, true), 500);
    } else {
      csLogger.info('Auto-sync is DISABLED - waiting for manual trigger');
      uiInjector.showNotification(
        `Project "${event.detail.projectName}" ready to sync`,
        'info',
        3000
      );
    }
    csLogger.groupEnd();
  });

  csLogger.success('Content script initialization complete');
}

async function handleSync(commitMessage = null, isAutoSync = false) {
  csLogger.separator();
  csLogger.group(`🚀 Handle Sync ${isAutoSync ? '(AUTO)' : '(MANUAL)'}`);
  csLogger.info(`Commit message: "${commitMessage}"`);
  csLogger.state('Current capturedProject', capturedProject ? {
    name: capturedProject.name,
    size: capturedProject.size,
    timestamp: new Date(capturedProject.timestamp).toISOString()
  } : null);

  try {
    // Check if already connected
    csLogger.info('Step 1: Checking GitHub connection...');
    const connectionStatus = await chrome.runtime.sendMessage({
      type: 'CHECK_CONNECTION'
    });

    csLogger.state('Connection Status', connectionStatus);

    if (!connectionStatus.connected) {
      csLogger.warn('Not connected to GitHub');
      uiInjector.showNotification(
        'Please connect to GitHub first. Click the SpikePrimeGit extension icon.',
        'error'
      );
      csLogger.groupEnd();
      return;
    }

    csLogger.success('✓ Connected to GitHub');

    // Get user settings
    csLogger.info('Step 2: Getting user settings...');
    const settingsResponse = await chrome.runtime.sendMessage({
      type: 'GET_SETTINGS'
    });

    if (!settingsResponse.success) {
      csLogger.error('Failed to get settings');
      throw new Error('Failed to get settings');
    }

    const settings = settingsResponse.settings;
    csLogger.state('Settings', settings);

    if (!settings.selectedRepo || !settings.selectedBranch) {
      csLogger.warn('Repository or branch not selected');
      uiInjector.showNotification(
        'Please select a repository and branch in settings',
        'error'
      );
      csLogger.groupEnd();
      return;
    }

    csLogger.success(`✓ Using repo: ${settings.selectedRepo}, branch: ${settings.selectedBranch}`);

    csLogger.info('Step 3: Checking if project is captured...');
    if (!capturedProject) {
      csLogger.error('❌ NO PROJECT CAPTURED!');
      csLogger.warn('This is the issue - capturedProject is null/undefined');
      csLogger.info('User needs to download/export a project from SPIKE Prime first');

      if (isAutoSync) {
        csLogger.info('Auto-sync skipped - no project to sync');
        uiInjector.showNotification(
          'Auto-sync skipped - download project first to enable',
          'info',
          3000
        );
        csLogger.groupEnd();
        return;
      }
      uiInjector.showNotification(
        '⚠️ No project captured yet.\n\n' +
        '📝 Please Download/Export your project from SPIKE Prime first, then click Sync again.',
        'error',
        10000
      );
      csLogger.groupEnd();
      return;
    }

    csLogger.success(`✓ Project captured: ${capturedProject.name} (${capturedProject.size} bytes)`);

    // Validate commit message (required when not auto-syncing)
    csLogger.info('Step 4: Validating commit message...');
    if (!isAutoSync && (!commitMessage || !commitMessage.trim())) {
      csLogger.warn('Commit message is empty');
      uiInjector.showNotification(
        'Commit message is required. Please enter what you changed.',
        'error'
      );
      csLogger.groupEnd();
      return;
    }

    csLogger.success(`✓ Commit message: "${commitMessage || `Synced project: ${capturedProject.name}`}"`);

    csLogger.info('Step 5: Converting project to base64...');
    uiInjector.showLoading('Syncing to GitHub...');
    const base64Content = arrayBufferToBase64(capturedProject.content);
    csLogger.info(`Base64 content length: ${base64Content.length} chars`);

    csLogger.info('Step 6: Sending PUSH_PROJECT message to background...');
    const pushData = {
      projectName: capturedProject.name,
      zipContent: base64Content,
      repository: settings.selectedRepo,
      branch: settings.selectedBranch,
      commitMessage: commitMessage || `Synced project: ${capturedProject.name}`
    };
    csLogger.state('Push Data', {
      projectName: pushData.projectName,
      repository: pushData.repository,
      branch: pushData.branch,
      commitMessage: pushData.commitMessage,
      contentSize: pushData.zipContent.length
    });

    const response = await chrome.runtime.sendMessage({
      type: 'PUSH_PROJECT',
      data: pushData
    });

    csLogger.state('Push Response', response);

    if (response.success) {
      csLogger.success('✓ Project pushed successfully!');
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
        csLogger.info('Clearing captured project (manual sync)');
        capturedProject = null;
      }
    } else {
      csLogger.error('Push failed:', response.error);
      throw new Error(response.error || 'Unknown error');
    }

    csLogger.groupEnd();
  } catch (error) {
    csLogger.error('Sync error:', error);
    uiInjector.updateSyncStatus({
      success: false,
      error: error.message
    });
    csLogger.groupEnd();
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
  csLogger.info(`Message received: ${message.type}`);

  switch (message.type) {
    case 'SYNC_NOW':
      csLogger.info('SYNC_NOW triggered from popup');
      handleSync().then(() => {
        csLogger.success('SYNC_NOW completed successfully');
        sendResponse({ success: true });
      }).catch(error => {
        csLogger.error('SYNC_NOW failed:', error);
        sendResponse({ success: false, error: error.message });
      });
      return true; // Async response

    case 'GET_PROJECT_INFO':
      csLogger.info('GET_PROJECT_INFO requested');
      const projectInfo = capturedProject ? {
        name: capturedProject.name,
        size: capturedProject.size,
        timestamp: capturedProject.timestamp
      } : null;
      csLogger.state('Returning project info', projectInfo);
      sendResponse({
        success: true,
        project: projectInfo
      });
      break;

    case 'UPDATE_UI':
      csLogger.info('UPDATE_UI requested');
      if (uiInjector) {
        uiInjector.updateConnectionStatus();
      }
      sendResponse({ success: true });
      break;

    default:
      csLogger.warn(`Unknown message type: ${message.type}`);
      sendResponse({ success: false, error: 'Unknown message type' });
  }
});

// Initialize when DOM is ready
csLogger.info(`Document ready state: ${document.readyState}`);
if (document.readyState === 'loading') {
  csLogger.info('Waiting for DOMContentLoaded...');
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  csLogger.info('DOM already loaded, initializing immediately');
  initialize();
}

window.addEventListener('unload', () => {
  csLogger.info('Page unloading - cleaning up');
  if (uiInjector) uiInjector.remove();
  capturedProject = null;
});
