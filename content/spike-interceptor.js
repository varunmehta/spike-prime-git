/**
 * SPIKE Prime Project Interceptor
 * Captures project downloads from the SPIKE web app using File System Access API
 */

// Initialize logger
const logger = window.createLogger('interceptor');

class SpikeInterceptor {
  constructor() {
    this.capturedProject = null;
    this.projectName = null;
    this.observers = [];
    logger.info('Initializing SpikeInterceptor...');
    this.setupInterceptors();
    logger.success('SpikeInterceptor initialized successfully');
  }

  /**
   * Set up interception methods
   */
  setupInterceptors() {
    logger.info('Setting up interceptors...');
    this.interceptFileSystemAPI();
    this.interceptBlobDownloads();
    this.monitorDownloadButtons();
    logger.info('All interceptors set up');
  }

  /**
   * Intercept File System Access API (ALL methods)
   * This captures BOTH initial downloads AND subsequent edit saves
   */
  interceptFileSystemAPI() {
    const self = this;

    // Helper to wrap file handles
    const wrapFileHandle = (handle) => {
      if (!handle || !handle.createWritable) return handle;

      const originalCreateWritable = handle.createWritable;

      handle.createWritable = async function() {
        logger.info(`createWritable called for: ${handle.name}`);
        const writable = await originalCreateWritable.apply(this, arguments);

        // Wrap the write method
        const originalWrite = writable.write;
        const originalClose = writable.close;
        let capturedData = null;

        writable.write = async function(data) {
          if (handle.name && (handle.name.endsWith('.llsp3') || handle.name.endsWith('.llsp'))) {
            logger.info(`📝 File System API write detected: ${handle.name}`);
            logger.state('Write data type', {
              isBlob: data instanceof Blob,
              isArrayBuffer: data instanceof ArrayBuffer,
              hasBuffer: data?.buffer instanceof ArrayBuffer,
              type: typeof data,
              constructor: data?.constructor?.name
            });

            try {
              let arrayBuffer;
              if (data instanceof Blob) {
                logger.debug('Data is Blob, converting to ArrayBuffer');
                arrayBuffer = await data.arrayBuffer();
              } else if (data instanceof ArrayBuffer) {
                logger.debug('Data is ArrayBuffer');
                arrayBuffer = data;
              } else if (data?.buffer instanceof ArrayBuffer) {
                logger.debug('Data has buffer property');
                arrayBuffer = data.buffer;
              } else if (typeof data === 'object' && data !== null) {
                logger.warn('Unknown data type, attempting to convert:', data);
                // Try to handle other formats
                try {
                  const blob = new Blob([data]);
                  arrayBuffer = await blob.arrayBuffer();
                } catch (e) {
                  logger.error('Failed to convert to ArrayBuffer:', e);
                }
              }

              if (arrayBuffer) {
                logger.success(`✓ Captured data from write, size: ${arrayBuffer.byteLength} bytes`);
                capturedData = arrayBuffer;
                self.captureProject(arrayBuffer, 'FileSystemAPI-Write', handle.name);
              } else {
                logger.warn('Could not extract ArrayBuffer from write data');
              }
            } catch (error) {
              logger.error('Capture error:', error);
            }
          }
          return originalWrite.apply(this, arguments);
        };

        writable.close = async function() {
          logger.info(`📁 File being closed: ${handle.name}`);
          if (capturedData && handle.name.endsWith('.llsp3') || handle.name.endsWith('.llsp')) {
            logger.success(`✓ File closed with captured data: ${handle.name}`);
          }
          return originalClose.apply(this, arguments);
        };

        return writable;
      };

      return handle;
    };

    // Intercept showSaveFilePicker (used for "Download" / "Export")
    const originalShowSaveFilePicker = window.showSaveFilePicker;
    if (originalShowSaveFilePicker) {
      logger.info('Intercepting showSaveFilePicker (Download/Export)');
      window.showSaveFilePicker = async function(options) {
        logger.info('🔽 showSaveFilePicker called (Download/Export)');
        const handle = await originalShowSaveFilePicker.apply(this, arguments);
        return wrapFileHandle(handle);
      };
    } else {
      logger.warn('showSaveFilePicker not available');
    }

    // Intercept showOpenFilePicker (used for "Upload" / "Open")
    const originalShowOpenFilePicker = window.showOpenFilePicker;
    if (originalShowOpenFilePicker) {
      logger.info('Intercepting showOpenFilePicker (Upload/Open)');
      window.showOpenFilePicker = async function(options) {
        logger.info('🔼 showOpenFilePicker called (Upload/Open)');
        const handles = await originalShowOpenFilePicker.apply(this, arguments);

        // showOpenFilePicker returns an array of file handles
        if (Array.isArray(handles)) {
          return handles.map(handle => wrapFileHandle(handle));
        }
        return handles;
      };
    } else {
      logger.warn('showOpenFilePicker not available');
    }

    // Intercept getFileHandle (used by some apps)
    if (window.FileSystemDirectoryHandle && window.FileSystemDirectoryHandle.prototype.getFileHandle) {
      const originalGetFileHandle = window.FileSystemDirectoryHandle.prototype.getFileHandle;
      logger.info('Intercepting FileSystemDirectoryHandle.getFileHandle');
      window.FileSystemDirectoryHandle.prototype.getFileHandle = async function(name, options) {
        logger.info(`🗂️ getFileHandle called for: ${name}`);
        const handle = await originalGetFileHandle.apply(this, arguments);
        return wrapFileHandle(handle);
      };
    }

    logger.success('File System Access API interception complete');
  }

  /**
   * Intercept blob URL creation and anchor downloads
   * This catches the FileSaver.js fallback method used by SPIKE
   */
  interceptBlobDownloads() {
    logger.info('Intercepting Blob downloads');
    const self = this;
    const originalCreateObjectURL = URL.createObjectURL;

    URL.createObjectURL = function(blob) {
      const url = originalCreateObjectURL.apply(this, arguments);

      if (blob instanceof Blob) {
        const isLikelyProject =
          blob.size > 5000 &&
          (blob.type === 'application/zip' ||
           blob.type === 'application/octet-stream' ||
           blob.type === '');

        if (isLikelyProject) {
          logger.info(`Blob URL created for likely project - size: ${blob.size}, type: ${blob.type}`);
          blob.arrayBuffer().then(arrayBuffer => {
            logger.info(`Capturing project via BlobURL, size: ${arrayBuffer.byteLength} bytes`);
            self.captureProject(arrayBuffer, 'BlobURL', null);
          }).catch(error => {
            logger.error('Blob read error:', error);
          });
        } else {
          logger.debug(`Blob URL created but not a project - size: ${blob.size}, type: ${blob.type}`);
        }
      }

      return url;
    };

    const originalAnchorClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function() {
      if (this.hasAttribute('download')) {
        const downloadName = this.getAttribute('download');
        const href = this.href;

        if (downloadName && (downloadName.endsWith('.llsp3') || downloadName.endsWith('.llsp'))) {
          logger.info(`Anchor download clicked: ${downloadName}`);
          if (href.startsWith('blob:')) {
            logger.debug(`Fetching blob from: ${href}`);
            fetch(href)
              .then(response => response.blob())
              .then(blob => blob.arrayBuffer())
              .then(arrayBuffer => {
                logger.info(`Capturing project via Anchor-Download, size: ${arrayBuffer.byteLength} bytes`);
                self.captureProject(arrayBuffer, 'Anchor-Download', downloadName);
              })
              .catch(error => {
                logger.error('Blob fetch error:', error);
              });
          }
        }
      }
      return originalAnchorClick.apply(this, arguments);
    };
  }

  /**
   * Centralized method to capture and verify a project
   * @param {ArrayBuffer} arrayBuffer - The potential project data
   * @param {string} source - Where this was captured from
   * @param {string} filename - Optional filename
   */
  captureProject(arrayBuffer, source, filename = null) {
    logger.group(`Capturing project from ${source}`);
    logger.info(`ArrayBuffer size: ${arrayBuffer.byteLength} bytes`);

    const bytes = new Uint8Array(arrayBuffer);
    const isZip = bytes[0] === 0x50 && bytes[1] === 0x4B;

    if (!isZip) {
      logger.warn(`Not a valid ZIP file. First bytes: ${bytes[0]}, ${bytes[1]}`);
      logger.groupEnd();
      return false;
    }

    logger.success('Valid ZIP file detected');
    this.capturedProject = arrayBuffer;

    if (filename) {
      this.projectName = filename.replace(/\.(llsp3?|zip)$/i, '');
      logger.info(`Project name from filename: ${this.projectName}`);
    } else {
      this.extractProjectName();
      logger.info(`Project name extracted: ${this.projectName}`);
    }

    logger.state('Captured Project', {
      projectName: this.projectName,
      size: arrayBuffer.byteLength,
      source: source,
      timestamp: new Date().toISOString()
    });

    window.dispatchEvent(new CustomEvent('spikeprimegit:project-captured', {
      detail: {
        projectName: this.projectName,
        size: arrayBuffer.byteLength,
        source: source,
        content: arrayBuffer,
        timestamp: Date.now()
      }
    }));

    logger.success(`✓ Project "${this.projectName}" captured and event dispatched`);
    logger.groupEnd();
    return true;
  }

  /**
   * Monitor download buttons in the SPIKE UI
   * Used to detect when user initiates download and extract project name
   */
  monitorDownloadButtons() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupDownloadMonitoring());
    } else {
      this.setupDownloadMonitoring();
    }
  }

  setupDownloadMonitoring() {
    const observer = new MutationObserver(() => {
      this.findAndMonitorDownloadButtons();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    this.observers.push(observer);
    this.findAndMonitorDownloadButtons();
  }

  findAndMonitorDownloadButtons() {
    const selectors = [
      'button[aria-label*="download" i]',
      'button[aria-label*="export" i]',
      'button[aria-label*="save" i]',
      'button[title*="download" i]',
      'button[title*="export" i]',
      'button[title*="save" i]',
      '[data-testid*="download"]',
      '[data-testid*="export"]',
      '[data-testid*="save"]',
      'button[class*="download" i]',
      'button[class*="export" i]',
      'button[class*="save" i]'
    ];

    selectors.forEach(selector => {
      const buttons = document.querySelectorAll(selector);
      buttons.forEach(button => {
        if (!button.hasAttribute('data-spikeprimegit-monitored')) {
          button.setAttribute('data-spikeprimegit-monitored', 'true');
          button.addEventListener('click', () => {
            this.extractProjectName();
            window.dispatchEvent(new CustomEvent('spikeprimegit:download-initiated', {
              detail: { projectName: this.projectName }
            }));
          }, { capture: true });
        }
      });
    });
  }

  /**
   * Extract project name from the page
   */
  extractProjectName() {
    if (this.projectName) return;

    const selectors = [
      'h1',
      'h2',
      '[data-testid*="project-name"]',
      '[data-testid*="title"]',
      '[class*="project-name" i]',
      '[class*="title" i]',
      'input[type="text"][value]',
      '[contenteditable="true"]'
    ];

    // Words to skip when extracting project name
    const skipWords = [
      'SPIKE',
      'LEGO',
      'Education',
      'Browser not supported',
      'Not supported',
      'Warning',
      'Error',
      'Save',
      'Download',
      'Export'
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const text = element.textContent || element.value || element.getAttribute('value');
        if (text && text.trim().length > 0 && text.trim().length < 100) {
          // Avoid generic/error titles
          const trimmedText = text.trim();
          const shouldSkip = skipWords.some(word =>
            trimmedText.toLowerCase().includes(word.toLowerCase())
          );

          if (!shouldSkip) {
            this.projectName = trimmedText;
            return;
          }
        }
      }
    }

    // Fallback
    const urlMatch = window.location.pathname.match(/\/([^\/]+)$/);
    if (urlMatch && urlMatch[1] !== 'spike.legoeducation.com') {
      this.projectName = urlMatch[1];
    } else {
      this.projectName = `SPIKE_Project_${new Date().toISOString().slice(0, 10)}`;
    }
  }

  /**
   * Get the captured project data
   */
  getCapturedProject() {
    if (!this.capturedProject) {
      return null;
    }

    return {
      name: this.projectName || 'Unknown_Project',
      content: this.capturedProject,
      size: this.capturedProject.byteLength,
      timestamp: Date.now()
    };
  }

  /**
   * Clear captured project
   */
  clearCaptured() {
    this.capturedProject = null;
    this.projectName = null;
  }

  /**
   * Manually trigger project capture
   * Prompts user to download if no project captured yet
   */
  async triggerCapture() {
    if (this.capturedProject) {
      return this.getCapturedProject();
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.capturedProject) {
          resolve(this.getCapturedProject());
        } else {
          reject(new Error('Timeout: Please download/export your project first, then click Sync again.'));
        }
      }, 30000);

      const handler = () => {
        clearTimeout(timeout);
        window.removeEventListener('spikeprimegit:project-captured', handler);
        resolve(this.getCapturedProject());
      };

      window.addEventListener('spikeprimegit:project-captured', handler);

      const downloadButton = document.querySelector([
        'button[aria-label*="download" i]',
        'button[aria-label*="export" i]',
        'button[title*="download" i]',
        'button[title*="export" i]',
        '[data-testid*="download"]',
        '[class*="download" i]',
        '[class*="export" i]'
      ].join(', '));

      if (downloadButton) {
        this.extractProjectName();
        setTimeout(() => {
          try {
            downloadButton.click();
          } catch (error) {
            console.error('[SpikePrimeGit] Download button click error:', error);
          }
        }, 100);
      }
    });
  }

  /**
   * Clean up interceptors
   */
  destroy() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }
}

window.spikeInterceptor = new SpikeInterceptor();
