/**
 * SPIKE Prime Project Interceptor
 * Captures project downloads from the SPIKE web app using File System Access API
 */
class SpikeInterceptor {
  constructor() {
    this.capturedProject = null;
    this.projectName = null;
    this.observers = [];
    this.setupInterceptors();
  }

  /**
   * Set up interception methods
   */
  setupInterceptors() {
    this.interceptWriteFile();
    this.interceptBlobDownloads();
    this.monitorDownloadButtons();
  }

  /**
   * Intercept File System Access API (showSaveFilePicker)
   * This captures BOTH initial downloads AND subsequent edit saves
   */
  interceptWriteFile() {
    const self = this;
    const originalShowSaveFilePicker = window.showSaveFilePicker;

    if (!originalShowSaveFilePicker) return;

    window.showSaveFilePicker = async function(options) {
      const handle = await originalShowSaveFilePicker.apply(this, arguments);
      const originalCreateWritable = handle.createWritable;

      handle.createWritable = async function() {
        const writable = await originalCreateWritable.apply(this, arguments);

        // Wrap the write method
        const originalWrite = writable.write;
        const originalClose = writable.close;

        writable.write = async function(data) {
          if (handle.name && (handle.name.endsWith('.llsp3') || handle.name.endsWith('.llsp'))) {
            try {
              let arrayBuffer;
              if (data instanceof Blob) {
                arrayBuffer = await data.arrayBuffer();
              } else if (data instanceof ArrayBuffer) {
                arrayBuffer = data;
              } else if (data?.buffer instanceof ArrayBuffer) {
                arrayBuffer = data.buffer;
              }

              if (arrayBuffer) {
                self.captureProject(arrayBuffer, 'FileSystemAPI-Write', handle.name);
              }
            } catch (error) {
              console.error('[SpikePrimeGit] Capture error:', error);
            }
          }
          return originalWrite.apply(this, arguments);
        };

        writable.close = async function() {
          return originalClose.apply(this, arguments);
        };

        return writable;
      };

      return handle;
    };
  }

  /**
   * Intercept blob URL creation and anchor downloads
   * This catches the FileSaver.js fallback method used by SPIKE
   */
  interceptBlobDownloads() {
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
          blob.arrayBuffer().then(arrayBuffer => {
            self.captureProject(arrayBuffer, 'BlobURL', null);
          }).catch(error => {
            console.error('[SpikePrimeGit] Blob read error:', error);
          });
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
          if (href.startsWith('blob:')) {
            fetch(href)
              .then(response => response.blob())
              .then(blob => blob.arrayBuffer())
              .then(arrayBuffer => {
                self.captureProject(arrayBuffer, 'Anchor-Download', downloadName);
              })
              .catch(error => {
                console.error('[SpikePrimeGit] Blob fetch error:', error);
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
    const bytes = new Uint8Array(arrayBuffer);
    const isZip = bytes[0] === 0x50 && bytes[1] === 0x4B;

    if (!isZip) return false;

    this.capturedProject = arrayBuffer;

    if (filename) {
      this.projectName = filename.replace(/\.(llsp3?|zip)$/i, '');
    } else {
      this.extractProjectName();
    }

    window.dispatchEvent(new CustomEvent('spikeprimegit:project-captured', {
      detail: {
        projectName: this.projectName,
        size: arrayBuffer.byteLength,
        source: source,
        content: arrayBuffer,
        timestamp: Date.now()
      }
    }));

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
