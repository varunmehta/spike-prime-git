/**
 * SpikePrimeGit Debug Logger
 * Centralized logging with debug flag control
 */

// Debug configuration - set to true to enable detailed logging
const DEBUG_CONFIG = {
  enabled: false,  // Master switch - set to false to disable all debug logging
  modules: {
    interceptor: true,    // Spike project interception
    contentScript: true,  // Content script operations
    uiInjector: true,     // UI injection and updates
    background: true,     // Background service worker
    githubApi: true,      // GitHub API calls
    githubAuth: true,     // Authentication flow
    popup: true           // Popup operations
  }
};

class Logger {
  constructor(module) {
    this.module = module;
    this.prefix = `[SpikePrimeGit:${module}]`;
  }

  /**
   * Check if logging is enabled for this module
   */
  isEnabled() {
    if (!DEBUG_CONFIG.enabled) return false;
    return DEBUG_CONFIG.modules[this.module] !== false;
  }

  /**
   * Log informational message
   */
  info(...args) {
    if (this.isEnabled()) {
      console.log(this.prefix, ...args);
    }
  }

  /**
   * Log warning message
   */
  warn(...args) {
    if (this.isEnabled()) {
      console.warn(this.prefix, ...args);
    }
  }

  /**
   * Log error message (always logged even if debug is disabled)
   */
  error(...args) {
    console.error(this.prefix, ...args);
  }

  /**
   * Log debug message with extra detail
   */
  debug(...args) {
    if (this.isEnabled()) {
      console.debug(this.prefix, ...args);
    }
  }

  /**
   * Log success message in green
   */
  success(...args) {
    if (this.isEnabled()) {
      console.log(`%c${this.prefix}`, 'color: green; font-weight: bold;', ...args);
    }
  }

  /**
   * Log state of an object (useful for debugging data flow)
   */
  state(label, obj) {
    if (this.isEnabled()) {
      console.log(`%c${this.prefix} [STATE: ${label}]`, 'color: blue; font-weight: bold;');
      console.log(obj);
    }
  }

  /**
   * Log a separator for readability
   */
  separator() {
    if (this.isEnabled()) {
      console.log(`%c${this.prefix} ${'='.repeat(60)}`, 'color: gray;');
    }
  }

  /**
   * Time a function execution
   */
  time(label) {
    if (this.isEnabled()) {
      console.time(`${this.prefix} ${label}`);
    }
  }

  /**
   * End timing
   */
  timeEnd(label) {
    if (this.isEnabled()) {
      console.timeEnd(`${this.prefix} ${label}`);
    }
  }

  /**
   * Group related logs
   */
  group(label) {
    if (this.isEnabled()) {
      console.group(`${this.prefix} ${label}`);
    }
  }

  /**
   * Group collapsed
   */
  groupCollapsed(label) {
    if (this.isEnabled()) {
      console.groupCollapsed(`${this.prefix} ${label}`);
    }
  }

  /**
   * End group
   */
  groupEnd() {
    if (this.isEnabled()) {
      console.groupEnd();
    }
  }
}

// Export logger factory
if (typeof window !== 'undefined') {
  window.createLogger = (module) => new Logger(module);
}

// For ES6 modules (not used in browser extension context)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Logger, DEBUG_CONFIG };
}
