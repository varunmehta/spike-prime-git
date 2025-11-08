/**
 * UI Injector for SPIKE Prime Page
 * Injects sync button and status indicators
 */

class UIInjector {
  constructor(onSyncClick) {
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
    // Create container
    const container = document.createElement('div');
    container.id = 'spikeprimegit-container';
    container.innerHTML = `
      <div class="spikeprimegit-card">
        <div class="spikeprimegit-header">
          <div class="spikeprimegit-logo">
            <span class="spikeprimegit-icon">🧱</span>
            <span class="spikeprimegit-title">SpikePrimeGit</span>
          </div>
          <div class="spikeprimegit-status" id="spikeprimegit-status">
            <span class="status-dot"></span>
            <span class="status-text">Checking...</span>
          </div>
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
    const settingsButton = document.getElementById('spikeprimegit-settings-btn');

    // Attach event listeners
    this.syncButton.addEventListener('click', () => this.handleSyncClick());
    settingsButton.addEventListener('click', () => this.openSettings());

    this.isInjected = true;
    this.updateConnectionStatus();
  }

  /**
   * Handle sync button click
   */
  async handleSyncClick() {
    if (this.syncButton.disabled) return;
    this.setButtonState('syncing');

    try {
      if (this.onSyncClick) {
        await this.onSyncClick();
      }
    } catch (error) {
      this.setButtonState('error');
      this.showNotification('Sync failed: ' + error.message, 'error');
    }
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
    if (!this.statusIndicator) return;

    try {
      const response = await chrome.runtime.sendMessage({ type: 'CHECK_CONNECTION' });

      const dot = this.statusIndicator.querySelector('.status-dot');
      const text = this.statusIndicator.querySelector('.status-text');

      if (response.connected) {
        dot.className = 'status-dot connected';
        text.textContent = 'Connected';
        this.syncButton.disabled = false;
      } else {
        dot.className = 'status-dot disconnected';
        text.textContent = 'Not Connected';
        this.syncButton.disabled = true;
      }
    } catch (error) {
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
