# Contributing to SpikePrimeGit

## Development Setup

### Prerequisites
- Google Chrome
- Git
- GitHub account with OAuth App configured

### Getting Started

1. Clone and load extension:
   ```bash
   git clone https://github.com/varunmehta/spike-prime-git.git
   cd spike-prime-git
   ```

2. In Chrome:
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `spike-prime-git` directory

3. Configure OAuth:
   - Create GitHub OAuth App
   - Get Extension ID from `chrome://extensions/`
   - Set callback URL: `https://YOUR_EXTENSION_ID.chromiumapp.org/`
   - Enter Client ID/Secret in extension popup

4. Test at https://spike.legoeducation.com

### Hot Reload
After code changes: Reload extension at `chrome://extensions/` → Refresh SPIKE Prime page

---

## Architecture

Chrome Extension Manifest V3 with three layers:

1. **MAIN World** (`spike-interceptor.js`): Intercepts File System API, captures `.llsp3` ArrayBuffer
2. **ISOLATED World** (`content-script.js`): Receives data via custom events, manages UI/sync logic
3. **Service Worker** (`service-worker.js`, `github-auth.js`, `github-api.js`): OAuth + GitHub API

**Flow:** User saves → Interceptor captures → Event to content script → Service worker pushes to GitHub

---

## Project Structure

```
spike-prime-git/
├── manifest.json              # Extension config
├── background/                # Service worker
│   ├── service-worker.js     # Message router
│   ├── github-auth.js        # OAuth flow
│   └── github-api.js         # GitHub API calls
├── content/                   # Content scripts
│   ├── spike-interceptor.js  # File capture (MAIN world)
│   ├── content-script.js     # Coordination (ISOLATED world)
│   └── ui-injector.js        # UI injection
├── popup/                     # Settings UI
│   ├── popup.html/js/css
├── lib/pkce.js               # OAuth helper
└── assets/                    # Icons and styles
```

**Key files:**
- `spike-interceptor.js`: Intercepts File System API, captures ArrayBuffer
- `content-script.js`: Receives data, manages sync
- `github-auth.js`: OAuth 2.0 with PKCE
- `github-api.js`: Repository/branch/file operations

---

## Development Workflow

1. Edit code
2. Reload extension at `chrome://extensions/`
3. Refresh SPIKE Prime page
4. Test and check console
5. Commit with clear message

### Common Tasks

**Add GitHub API endpoint:** Edit `github-api.js` → Add handler to `service-worker.js` → Call from content script/popup

**Modify capture:** Edit `spike-interceptor.js` → Test different save scenarios

**Update UI:** Edit `popup/` files for settings, `ui-injector.js` for page UI

---

## Testing

### Testing Checklist
- [ ] Extension loads, connects to GitHub
- [ ] Save project in SPIKE → appears on GitHub
- [ ] Auto-sync creates commits
- [ ] Special characters in project names work
- [ ] Error handling (invalid credentials, no repo selected, offline)

### Debug Tools
- **Service Worker:** `chrome://extensions/` → "service worker"
- **Content Script:** F12 on SPIKE page
- **Popup:** Right-click icon → "Inspect popup"
- **Storage:** DevTools → Application → Extension Storage

**Console prefixes:** `[SpikePrimeGit]`, `[SpikePrimeGit Auth]`, `[SpikePrimeGit API]`

---

## Code Style

- ES6+ (async/await, arrow functions, const/let)
- JSDoc comments for functions
- Descriptive names, small focused functions
- Log with prefixes: `[SpikePrimeGit Component]`
- Remove debug logs before committing

---

## Pull Requests

### Before Submitting
1. Test on SPIKE Prime
2. Check console for errors
3. Update docs if needed
4. Remove debug code

### PR Format
**Title:** Clear description (e.g., "Add custom commit message feature")

**Description:**
- What changed and why
- How to test
- Screenshots for UI changes
- Related issues

**Checklist:**
- [ ] Follows code style
- [ ] Tested on SPIKE Prime
- [ ] Docs updated
- [ ] No console errors

---

## Debugging

**Common Issues:**
- "Extension context invalidated": Refresh SPIKE page
- "Cannot access chrome.runtime": Use ISOLATED world (content-script.js)
- "Project not captured": Check injection timing in manifest.json
- OAuth errors: Verify callback URL, Client ID/Secret, token expiry

**Debug workflow:**
1. Identify layer (MAIN world / ISOLATED world / Service worker / Popup)
2. Check appropriate console (F12 on page / chrome://extensions / Inspect popup)
3. Add logging: `console.log('[SpikePrimeGit Debug]', data);`
4. Test incrementally

**Network debugging:** DevTools (F12) → Network tab → Filter "github.com"

---

## Resources

- [Chrome Extensions Docs](https://developer.chrome.com/docs/extensions/)
- [GitHub API Docs](https://docs.github.com/en/rest)
- [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API)

---