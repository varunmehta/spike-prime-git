/**
 * UI Injector for SPIKE Prime Page
 * Injects sync button and status indicators
 */

// Initialize logger with unique variable name
const uiLogger = (typeof window.createLogger === 'function')
  ? window.createLogger('uiInjector')
  : {
      info: (...args) => console.log('[SpikePrimeGit:uiInjector]', ...args),
      warn: (...args) => console.warn('[SpikePrimeGit:uiInjector]', ...args),
      error: (...args) => console.error('[SpikePrimeGit:uiInjector]', ...args),
      debug: (...args) => console.debug('[SpikePrimeGit:uiInjector]', ...args),
      success: (...args) => console.log('%c[SpikePrimeGit:uiInjector]', 'color: green; font-weight: bold;', ...args),
      state: (label, obj) => { console.log('%c[SpikePrimeGit:uiInjector] [STATE: ' + label + ']', 'color: blue; font-weight: bold;'); console.log(obj); },
      separator: () => console.log('%c[SpikePrimeGit:uiInjector] ' + '='.repeat(60), 'color: gray;'),
      group: (label) => console.group('[SpikePrimeGit:uiInjector] ' + label),
      groupCollapsed: (label) => console.groupCollapsed('[SpikePrimeGit:uiInjector] ' + label),
      groupEnd: () => console.groupEnd()
    };

class UIInjector {
  constructor(onSyncClick) {
    uiLogger.info('UIInjector constructor called');
    this.onSyncClick = onSyncClick;
    this.syncButton = null;
    this.statusIndicator = null;
    this.notificationContainer = null;
    this.isInjected = false;
  }

  /**
   * Inject the UI into the page
   */
  inject() {
    if (this.isInjected) return;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.createUI());
    } else {
      this.createUI();
    }
  }

  /**
   * Create and inject UI elements
   */
  createUI() {
    uiLogger.info('Creating UI elements...');
    // Get icon URL
    const iconUrl = chrome.runtime.getURL('assets/icons/icon48.png');

    // Create container
    const container = document.createElement('div');
    container.id = 'spikeprimegit-container';
    container.innerHTML = `
      <div class="spikeprimegit-card">
        <div class="spikeprimegit-header">
          <div class="spikeprimegit-logo">
            <span class="spikeprimegit-icon"><img src="${iconUrl}" class="spikeprimegit-logo-img"/></span>
            <span class="spikeprimegit-title">SpikePrimeGit</span>
          </div>
          <div class="spikeprimegit-status" id="spikeprimegit-status">
            <span class="status-dot"></span>
            <span class="status-text">Checking...</span>
          </div>
        </div>
        <div class="spikeprimegit-commit-section">
          <textarea
            id="spikeprimegit-commit-message"
            class="spikeprimegit-commit-textarea"
            placeholder="add details about what did you change"
            rows="2"
          ></textarea>
          <small id="spikeprimegit-commit-error" class="spikeprimegit-error-text" style="display: none;">
            ⚠️ Commit message is required
          </small>
        </div>
        <button id="spikeprimegit-sync-btn" class="spikeprimegit-sync-btn">
          <span class="sync-icon">↻</span>
          <span class="sync-text">Sync to GitHub</span>
        </button>
        <button id="spikeprimegit-settings-btn" class="spikeprimegit-settings-btn" title="Open SpikePrimeGit Settings">
          ⚙️
        </button>
      </div>
    `;

    document.body.appendChild(container);

    // Create notification container
    this.notificationContainer = document.createElement('div');
    this.notificationContainer.id = 'spikeprimegit-notifications';
    document.body.appendChild(this.notificationContainer);

    // Get references
    this.syncButton = document.getElementById('spikeprimegit-sync-btn');
    this.statusIndicator = document.getElementById('spikeprimegit-status');
    this.commitMessage = document.getElementById('spikeprimegit-commit-message');
    this.commitError = document.getElementById('spikeprimegit-commit-error');
    const settingsButton = document.getElementById('spikeprimegit-settings-btn');

    // Attach event listeners
    this.syncButton.addEventListener('click', () => this.handleSyncClick());
    settingsButton.addEventListener('click', () => this.openSettings());

    // Clear error on input
    this.commitMessage.addEventListener('input', () => {
      if (this.commitMessage.value.trim()) {
        this.commitMessage.classList.remove('error');
        this.commitError.style.display = 'none';
      }
    });

    this.isInjected = true;
    uiLogger.success('UI elements created and injected successfully');
    this.updateConnectionStatus();
  }

  /**
   * Handle sync button click
   */
  async handleSyncClick() {
    uiLogger.separator();
    uiLogger.group('🔘 Sync Button Clicked');

    if (this.syncButton.disabled) {
      uiLogger.warn('Sync button is disabled - ignoring click');
      uiLogger.groupEnd();
      return;
    }

    // Validate commit message
    const commitMessage = this.commitMessage.value.trim();
    uiLogger.info(`Commit message: "${commitMessage}"`);

    if (!commitMessage) {
      uiLogger.warn('Commit message is empty - showing error');
      this.commitMessage.classList.add('error');
      this.commitError.style.display = 'block';
      this.showNotification('Please enter a commit message before syncing', 'error');
      uiLogger.groupEnd();
      return;
    }

    uiLogger.success('✓ Commit message validated');
    uiLogger.info('Setting button state to syncing...');
    this.setButtonState('syncing');

    try {
      if (this.onSyncClick) {
        uiLogger.info('Calling onSyncClick callback with commit message...');
        await this.onSyncClick(commitMessage);
        uiLogger.success('✓ onSyncClick callback completed');
      } else {
        uiLogger.error('onSyncClick callback is not defined!');
      }
      // Clear commit message after successful sync
      this.commitMessage.value = '';
      uiLogger.info('Commit message cleared');
    } catch (error) {
      uiLogger.error('Sync failed:', error);
      this.setButtonState('error');
      this.showNotification('Sync failed: ' + error.message, 'error');
    }

    uiLogger.groupEnd();
  }

  /**
   * Set button state
   * @param {string} state - 'default', 'syncing', 'success', 'error'
   */
  setButtonState(state) {
    if (!this.syncButton) return;

    this.syncButton.classList.remove('syncing', 'success', 'error');

    switch (state) {
      case 'syncing':
        this.syncButton.classList.add('syncing');
        this.syncButton.disabled = true;
        this.syncButton.querySelector('.sync-text').textContent = 'Syncing...';
        break;

      case 'success':
        this.syncButton.classList.add('success');
        this.syncButton.disabled = false;
        this.syncButton.querySelector('.sync-text').textContent = 'Synced!';
        setTimeout(() => {
          if (this.syncButton) {
            this.setButtonState('default');
          }
        }, 3000);
        break;

      case 'error':
        this.syncButton.classList.add('error');
        this.syncButton.disabled = false;
        this.syncButton.querySelector('.sync-text').textContent = 'Sync Failed';
        setTimeout(() => {
          if (this.syncButton) {
            this.setButtonState('default');
          }
        }, 3000);
        break;

      default: // 'default'
        this.syncButton.disabled = false;
        this.syncButton.querySelector('.sync-text').textContent = 'Sync to GitHub';
        break;
    }
  }

  /**
   * Update connection status indicator
   */
  async updateConnectionStatus() {
    if (!this.statusIndicator) {
      uiLogger.warn('updateConnectionStatus called but statusIndicator is null');
      return;
    }

    uiLogger.info('Updating connection status...');

    try {
      const response = await chrome.runtime.sendMessage({ type: 'CHECK_CONNECTION' });
      uiLogger.state('Connection Response', response);

      const dot = this.statusIndicator.querySelector('.status-dot');
      const text = this.statusIndicator.querySelector('.status-text');

      if (response.connected) {
        uiLogger.success('✓ Connected to GitHub');
        dot.className = 'status-dot connected';
        text.textContent = 'Connected';
        this.syncButton.disabled = false;
      } else {
        uiLogger.warn('Not connected to GitHub');
        dot.className = 'status-dot disconnected';
        text.textContent = 'Not Connected';
        this.syncButton.disabled = true;
      }
    } catch (error) {
      uiLogger.error('Error checking connection status:', error);
      const dot = this.statusIndicator.querySelector('.status-dot');
      const text = this.statusIndicator.querySelector('.status-text');
      dot.className = 'status-dot disconnected';
      text.textContent = 'Error';
    }
  }

  /**
   * Show notification toast
   * @param {string} message - Notification message
   * @param {string} type - 'success', 'error', 'info'
   * @param {number} duration - Duration in ms (default 5000)
   */
  showNotification(message, type = 'info', duration = 5000) {
    if (!this.notificationContainer) return;

    const notification = document.createElement('div');
    notification.className = `spikeprimegit-notification ${type}`;

    const icon = type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ';

    notification.innerHTML = `
      <span class="notification-icon">${icon}</span>
      <span class="notification-message">${message}</span>
      <button class="notification-close">×</button>
    `;

    this.notificationContainer.appendChild(notification);

    // Animate in
    setTimeout(() => notification.classList.add('show'), 10);

    // Close button
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => this.closeNotification(notification));

    // Auto-close
    setTimeout(() => this.closeNotification(notification), duration);
  }

  /**
   * Close notification
   * @param {HTMLElement} notification - Notification element
   */
  closeNotification(notification) {
    notification.classList.remove('show');
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }

  /**
   * Open extension settings (popup)
   */
  openSettings() {
    // Send message to open popup or navigate
    this.showNotification('Click the SpikePrimeGit extension icon to open settings', 'info');
  }

  /**
   * Update sync status with project info
   * @param {Object} info - Sync info
   */
  updateSyncStatus(info) {
    if (info.success) {
      this.setButtonState('success');
      this.showNotification(
        `Project "${info.projectName}" synced successfully!`,
        'success'
      );
    } else {
      this.setButtonState('error');
      this.showNotification(
        `Sync failed: ${info.error}`,
        'error'
      );
    }
  }

  /**
   * Show loading state
   * @param {string} message - Loading message
   */
  showLoading(message) {
    this.setButtonState('syncing');
    this.showNotification(message, 'info', 10000);
  }

  /**
   * Remove injected UI
   */
  remove() {
    const container = document.getElementById('spikeprimegit-container');
    if (container) {
      container.remove();
    }

    if (this.notificationContainer) {
      this.notificationContainer.remove();
    }

    this.isInjected = false;
  }

  /**
   * Listen for storage changes to update UI
   */
  listenForChanges() {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local') {
        if (changes.github_tokens || changes.user_settings) {
          this.updateConnectionStatus();
        }
      }
    });
  }
}
