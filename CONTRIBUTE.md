# Contributing to SpikePrimeGit

Thank you for your interest in contributing to SpikePrimeGit! This guide will help you get started with development.

## Table of Contents

- [Development Setup](#development-setup)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Code Style](#code-style)
- [Pull Request Process](#pull-request-process)
- [Debugging](#debugging)

---

## Development Setup

### Prerequisites

- **Google Chrome** (latest version recommended)
- **Git**
- **GitHub account** with OAuth App configured

### Getting Started

1. **Clone the repository:**
   ```bash
   git clone https://github.com/varunmehta/spike-prime-git.git
   cd spike-prime-git
   ```

2. **Load extension in Chrome:**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable **"Developer mode"** (toggle in top-right corner)
   - Click **"Load unpacked"**
   - Select the `/spike-prime-git` directory

3. **Configure OAuth:**
   - Create a GitHub OAuth App (see README.md for details)
   - Get your Extension ID from `chrome://extensions/`
   - Update OAuth callback URL: `https://YOUR_EXTENSION_ID.chromiumapp.org/`
   - Enter Client ID and Secret in extension popup

4. **Test on SPIKE Prime:**
   - Go to https://spike.legoeducation.com
   - Open or create a project
   - Try saving and syncing

### Hot Reloading

After making code changes:
1. Go to `chrome://extensions/`
2. Click the **reload icon** on SpikePrimeGit
3. Refresh the SPIKE Prime page
4. Test your changes

---

## Architecture

### Overview

SpikePrimeGit uses a Chrome Extension Manifest V3 architecture with three main components:

```
┌─────────────────────────────────────┐
│  SPIKE Prime Web Editor             │
│  (spike.legoeducation.com)          │
└──────────────┬──────────────────────┘
               │
       ┌───────▼────────┐
       │ MAIN World     │  spike-interceptor.js
       │ • Intercepts File System API
       │ • Intercepts Blob URLs
       │ • Captures ArrayBuffer
       │ • Dispatches custom events
       └───────┬────────┘
               │ custom events
       ┌───────▼────────┐
       │ ISOLATED World │  content-script.js
       │ • Receives project data
       │ • Chrome Extension APIs
       │ • Auto-sync logic
       │ • UI management
       └───────┬────────┘
               │ chrome.runtime.sendMessage
       ┌───────▼────────┐
       │ Service Worker │  service-worker.js
       │ • OAuth flow   │  github-auth.js
       │ • GitHub API   │  github-api.js
       │ • Settings     │
       └───────┬────────┘
               │ HTTPS
       ┌───────▼────────┐
       │  GitHub API    │
       └────────────────┘
```

### Key Concepts

**MAIN vs ISOLATED Worlds:**
- **MAIN World**: Runs in page context, can access page variables, intercepts SPIKE's functions
- **ISOLATED World**: Separate context, has Chrome Extension API access, cannot access page variables
- **Communication**: Custom events bridge the two worlds

**File Capture Strategy:**
- Intercepts `showSaveFilePicker()` (File System Access API)
- Wraps writable stream's `write()` method
- Captures ArrayBuffer on every save (not just first download)
- Verifies ZIP magic number (`PK`)

**Auto-Sync Flow:**
1. User saves in SPIKE (Ctrl+S)
2. Interceptor captures ArrayBuffer
3. Event dispatched to ISOLATED world
4. Checks if auto-sync enabled
5. Converts to base64 for message passing
6. Service worker pushes to GitHub
7. Success notification displayed

---

## Project Structure

```
brickhub/
├── manifest.json              # Extension manifest (Manifest V3)
├── background/                # Service worker (background processes)
│   ├── service-worker.js     # Message router, coordinates all operations
│   ├── github-auth.js        # OAuth 2.0 flow, token management
│   └── github-api.js         # GitHub REST API wrapper
├── content/                   # Content scripts (injected into SPIKE page)
│   ├── spike-interceptor.js  # MAIN world - captures project downloads
│   ├── content-script.js     # ISOLATED world - Chrome APIs, coordination
│   └── ui-injector.js        # Injects sync UI into SPIKE page
├── popup/                     # Extension popup UI
│   ├── popup.html            # Settings interface
│   ├── popup.js              # Popup logic
│   └── popup.css             # Popup styling
├── lib/                       # Utility libraries
│   └── pkce.js               # OAuth PKCE helper
├── assets/                    # Static resources
│   ├── icons/                # Extension icons (16, 48, 128px)
│   └── styles/
│       └── inject.css        # Injected UI styles
└── backend/                   # Optional backend (NOT USED)
    └── cloudflare-worker/    # Can be deleted
```

### Key Files

**manifest.json** - Extension configuration
- Defines permissions, content scripts, background scripts
- Specifies which pages to inject into
- Declares OAuth redirect URI pattern

**spike-interceptor.js** - Core capture logic
- Runs in MAIN world to access page functions
- Intercepts File System Access API
- Intercepts Blob URL creation
- Monitors download buttons
- Extracts project name from DOM

**content-script.js** - Coordination layer
- Receives captured projects from MAIN world
- Manages auto-sync logic
- Converts ArrayBuffer to base64
- Communicates with service worker

**github-auth.js** - OAuth implementation
- Direct GitHub OAuth (no backend needed)
- Token storage and refresh
- PKCE for security
- Token expiry handling (8 hours)

**github-api.js** - GitHub operations
- List repositories
- Get branches
- Push files (create/update)
- Sync history tracking

---

## Development Workflow

### Making Changes

1. **Edit code** in your preferred editor
2. **Reload extension** in `chrome://extensions/`
3. **Refresh SPIKE page** if needed
4. **Test thoroughly**
5. **Check console** for errors
6. **Commit changes** with clear message

### Adding Features

1. Create feature branch: `git checkout -b feature/my-feature`
2. Implement feature
3. Test on SPIKE Prime
4. Update documentation if needed
5. Create pull request

### Common Tasks

**Add new GitHub API endpoint:**
1. Add function to `background/github-api.js`
2. Add message handler to `background/service-worker.js`
3. Call from content script or popup

**Modify capture logic:**
1. Edit `content/spike-interceptor.js`
2. Test with different save scenarios
3. Check console logs for capture events

**Update UI:**
1. Edit `popup/popup.html` and `popup/popup.js` for settings
2. Edit `content/ui-injector.js` for injected UI
3. Update CSS as needed

---

## Testing

### Manual Testing Checklist

**Basic Functionality:**
- [ ] Extension loads without errors
- [ ] Can connect to GitHub
- [ ] Can select repository and branch
- [ ] Can save project in SPIKE
- [ ] Project appears on GitHub
- [ ] Commit message is correct

**Auto-Sync:**
- [ ] Enable auto-sync toggle
- [ ] Save project multiple times
- [ ] Each save creates new commit
- [ ] Notifications appear correctly

**Edge Cases:**
- [ ] Test with special characters in project name
- [ ] Test with empty project path
- [ ] Test with private repository
- [ ] Test disconnecting and reconnecting
- [ ] Test with expired OAuth token

**Error Handling:**
- [ ] Test with invalid credentials
- [ ] Test with no repository selected
- [ ] Test with network offline
- [ ] Check console for errors

### Testing Tools

**Service Worker Console:**
```
chrome://extensions/ → SpikePrimeGit → "service worker"
```

**Content Script Console:**
```
F12 on SPIKE page → Console
```

**Popup Console:**
```
Right-click extension icon → "Inspect popup"
```

**Storage Inspection:**
```
DevTools → Application → Storage → Extension Storage
```

### Console Log Prefixes

Filter console by these prefixes:
- `[SpikePrimeGit]` - General logs
- `[SpikePrimeGit Auth]` - OAuth logs
- `[SpikePrimeGit API]` - GitHub API logs
- `[SpikePrimeGit Content]` - Content script logs

---

## Code Style

### JavaScript

- Use **ES6+** features (async/await, arrow functions, etc.)
- Use **JSDoc** comments for functions
- Use **const/let**, never `var`
- Descriptive variable names
- Keep functions small and focused

**Example:**
```javascript
/**
 * Push SPIKE project to GitHub
 * @param {string} projectName - Project name
 * @param {ArrayBuffer} content - Project file content
 * @returns {Promise<Object>} Result with commit SHA
 */
async function pushProject(projectName, content) {
  // Implementation
}
```

### Logging

- Use consistent prefixes: `[SpikePrimeGit Component]`
- Log important events, not every operation
- Use `console.error()` for errors
- Remove debug logs before committing

### File Organization

- One class per file when possible
- Group related functions together
- Export public functions explicitly
- Keep imports at top of file

---

## Pull Request Process

### Before Submitting

1. **Test thoroughly** on SPIKE Prime
2. **Check console** for errors and warnings
3. **Update documentation** if API changed
4. **Run code review** on your own code
5. **Ensure no debug code** remains

### PR Requirements

**Title:** Clear, concise description
```
Add custom commit message feature
Fix OAuth token refresh bug
Update README with new setup steps
```

**Description:** Should include:
- What changed and why
- How to test the changes
- Screenshots/videos for UI changes
- Link to related issues

**Checklist:**
- [ ] Code follows style guide
- [ ] No console errors
- [ ] Tested on SPIKE Prime
- [ ] Documentation updated
- [ ] Commit messages are clear

### Review Process

1. Maintainer reviews code
2. Automated checks run (if configured)
3. Feedback provided
4. Make requested changes
5. Final approval and merge

---

## Debugging

### Common Issues

**"Extension context invalidated"**
- Happens after reloading extension
- Solution: Refresh SPIKE page

**"Cannot access chrome.runtime"**
- Trying to use Chrome API in MAIN world
- Solution: Use ISOLATED world (content-script.js)

**"Project not captured"**
- Interceptor may not be installed in time
- Solution: Check injection timing in manifest.json

**OAuth errors**
- Check callback URL matches Extension ID
- Verify Client ID and Secret are correct
- Check token hasn't expired

### Debug Workflow

1. **Identify the layer** where issue occurs:
   - MAIN world capture?
   - ISOLATED world coordination?
   - Service worker OAuth/API?
   - Popup UI?

2. **Check appropriate console:**
   - Content scripts: F12 on SPIKE page
   - Service worker: chrome://extensions
   - Popup: Inspect popup

3. **Add logging:**
   ```javascript
   console.log('[SpikePrimeGit Debug]', data);
   ```

4. **Test incrementally:**
   - Isolate the problem
   - Test one change at a time
   - Verify fix works

### Network Debugging

View GitHub API requests:
1. Open DevTools (F12)
2. Go to Network tab
3. Filter by "github.com"
4. Look for failed requests (red)
5. Check request/response details

---

## Resources

### Documentation

- **Chrome Extensions:** https://developer.chrome.com/docs/extensions/
- **Manifest V3:** https://developer.chrome.com/docs/extensions/mv3/intro/
- **GitHub API:** https://docs.github.com/en/rest
- **File System Access API:** https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API

### Tools

- **Chrome Extension Debugger:** Built into Chrome DevTools
- **GitHub REST API Explorer:** https://docs.github.com/en/rest
- **OAuth Playground:** https://www.oauth.com/playground/

---

## Getting Help

- **Questions:** Open a GitHub Discussion
- **Bugs:** Open a GitHub Issue
- **Security:** Email maintainers privately
- **General:** Comment on related issues

---

## License

This project is provided as-is for educational purposes.

---

**Thank you for contributing to SpikePrimeGit!** 🎉

> The project was built using [`claude code`](https://www.claude.com/product/claude-code) as a coding partner
