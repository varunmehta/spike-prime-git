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

    // Create card
    const card = document.createElement('div');
    card.className = 'spikeprimegit-card';

    // Create header
    const header = document.createElement('div');
    header.className = 'spikeprimegit-header';

    // Create logo section
    const logoDiv = document.createElement('div');
    logoDiv.className = 'spikeprimegit-logo';

    const iconSpan = document.createElement('span');
    iconSpan.className = 'spikeprimegit-icon';
    const logoImg = document.createElement('img');
    logoImg.src = iconUrl;
    logoImg.className = 'spikeprimegit-logo-img';
    iconSpan.appendChild(logoImg);

    const titleSpan = document.createElement('span');
    titleSpan.className = 'spikeprimegit-title';
    titleSpan.textContent = 'SpikePrimeGit';

    logoDiv.appendChild(iconSpan);
    logoDiv.appendChild(titleSpan);

    // Create status section
    const statusDiv = document.createElement('div');
    statusDiv.className = 'spikeprimegit-status';
    statusDiv.id = 'spikeprimegit-status';

    const statusDot = document.createElement('span');
    statusDot.className = 'status-dot';
    const statusText = document.createElement('span');
    statusText.className = 'status-text';
    statusText.textContent = 'Checking...';

    statusDiv.appendChild(statusDot);
    statusDiv.appendChild(statusText);

    header.appendChild(logoDiv);
    header.appendChild(statusDiv);

    // Create commit section
    const commitSection = document.createElement('div');
    commitSection.className = 'spikeprimegit-commit-section';

    const textarea = document.createElement('textarea');
    textarea.id = 'spikeprimegit-commit-message';
    textarea.className = 'spikeprimegit-commit-textarea';
    textarea.placeholder = 'add details about what did you change';
    textarea.rows = 2;

    const errorSmall = document.createElement('small');
    errorSmall.id = 'spikeprimegit-commit-error';
    errorSmall.className = 'spikeprimegit-error-text';
    errorSmall.style.display = 'none';
    errorSmall.textContent = '⚠️ Commit message is required';

    commitSection.appendChild(textarea);
    commitSection.appendChild(errorSmall);

    // Create sync button
    const syncButton = document.createElement('button');
    syncButton.id = 'spikeprimegit-sync-btn';
    syncButton.className = 'spikeprimegit-sync-btn';

    const syncIcon = document.createElement('span');
    syncIcon.className = 'sync-icon';
    syncIcon.textContent = '↻';
    const syncText = document.createElement('span');
    syncText.className = 'sync-text';
    syncText.textContent = 'Sync to GitHub';

    syncButton.appendChild(syncIcon);
    syncButton.appendChild(syncText);

    // Create settings button
    const settingsButton = document.createElement('button');
    settingsButton.id = 'spikeprimegit-settings-btn';
    settingsButton.className = 'spikeprimegit-settings-btn';
    settingsButton.title = 'Open SpikePrimeGit Settings';
    settingsButton.textContent = '⚙️';

    // Assemble the card
    card.appendChild(header);
    card.appendChild(commitSection);
    card.appendChild(syncButton);
    card.appendChild(settingsButton);

    container.appendChild(card);
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

    // Create elements safely using DOM methods to prevent XSS
    const iconSpan = document.createElement('span');
    iconSpan.className = 'notification-icon';
    iconSpan.textContent = icon;

    const messageSpan = document.createElement('span');
    messageSpan.className = 'notification-message';
    messageSpan.textContent = message;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'notification-close';
    closeBtn.textContent = '×';

    notification.appendChild(iconSpan);
    notification.appendChild(messageSpan);
    notification.appendChild(closeBtn);

    this.notificationContainer.appendChild(notification);

    // Animate in
    setTimeout(() => notification.classList.add('show'), 10);

    // Close button
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
