# Authentication Storage Summary

## We Store Authentication Information

SpikePrimeGit **does store** authentication information locally in the browser using `chrome.storage.local`.

---

## What Authentication Data is Stored?

### 1. **GitHub OAuth Tokens** (`github_tokens`)
Stored after successful GitHub authentication:
```javascript
{
  accessToken: "ghu_xxxxx",           // GitHub access token
  refreshToken: "ghr_xxxxx",          // Refresh token for token renewal
  expiresAt: 1699564800000,           // Token expiration timestamp (milliseconds)
  scope: "repo,user"                  // Token permissions scope
}
```

**Purpose:** Authenticate API requests to GitHub without requiring user to log in repeatedly.

**Storage Location:** Chrome's local storage (encrypted by Chrome, isolated from other extensions)

**Code:** `background/github-auth.js:35-44`

---

### 2. **GitHub App Installation** (`github_installation`)
Stored after GitHub App authorization:
```javascript
{
  id: 12345678,                       // Installation ID
  account: {                          // GitHub account info
    login: "username",
    id: 987654,
    type: "User"
  },
  repository_selection: "selected",   // "all" or "selected"
  created_at: "2024-11-09T12:00:00Z" // Installation timestamp
}
```

**Purpose:** Track which GitHub App installation to use for API requests.

**Code:** `background/github-auth.js:168-175`

---

### 3. **Auth State Token** (`auth_state`) - TEMPORARY
Stored during OAuth flow, **automatically deleted** after completion:
```javascript
"random-csrf-token-string"
```

**Purpose:** Prevent CSRF attacks during OAuth authentication.

**Lifecycle:** Created before OAuth → Verified on callback → Immediately deleted

**Code:** `background/github-auth.js:102-104, 179, 183`

---

### 4. **Optional: Client ID & Secret** (`github_client_id`, `github_client_secret`)
Only stored if user configures custom GitHub App (advanced use case):
```javascript
{
  github_client_id: "Iv1.xxxxx",
  github_client_secret: "xxxxx"
}
```

**Purpose:** Allow users to use their own GitHub App instead of official one.

**Note:** Most users will NOT have this stored.

**Code:** `background/github-auth.js:380-383`

---

## Security Measures

### ✅ Local Storage Only
- All data stored in `chrome.storage.local` (browser's secure storage)
- Never transmitted to third-party servers
- Isolated from other extensions and websites
- Encrypted by Chrome's built-in storage security

### ✅ Token Refresh
- Tokens automatically refreshed before expiration
- Old tokens replaced with new ones
- No manual intervention required

**Code:** `background/github-auth.js:388-413`

### ✅ CSRF Protection
- State tokens prevent Cross-Site Request Forgery during OAuth
- State verified on callback, then immediately deleted

**Code:** `background/github-auth.js:142-145`

### ✅ Easy Deletion
Users can clear all auth data by:
- Clicking "Disconnect" in extension popup
- Uninstalling the extension
- Clearing Chrome extension data

**Code:** `background/github-auth.js:58-64`

---

## Chrome Web Store Disclosure

**For Chrome Web Store reviewers:**

YES, this extension stores authentication credentials:
- **What:** GitHub OAuth access tokens, refresh tokens, and GitHub App installation data
- **Where:** Chrome's local storage API (`chrome.storage.local`)
- **Why:** Maintain persistent authentication for GitHub API requests
- **Security:**
  - Tokens stored locally in browser (not transmitted to third parties)
  - Uses Chrome's encrypted storage
  - Follows OAuth 2.0 best practices
  - CSRF protection via state tokens
  - Automatic token refresh
- **User Control:** Users can disconnect and clear all auth data anytime
- **Transparency:** Open source code available for audit

---

## Privacy Compliance

✅ **No Third-Party Sharing:** Tokens never sent to servers other than GitHub's official API

✅ **User Control:** Users authorize GitHub App and can revoke access anytime via GitHub settings

✅ **Minimal Data:** Only stores data necessary for GitHub authentication

✅ **Transparent:** Full source code available for review

✅ **Secure:** Uses industry-standard OAuth 2.0 protocol

---

## Related Files

- **Full Privacy Policy:** `docs/privacy-policy.html`
- **Permission Justifications:** `CHROME_PERMISSIONS_JUSTIFICATION.md`
- **Web Store Form:** `CHROME_WEB_STORE_JUSTIFICATIONS.txt`
- **Auth Implementation:** `background/github-auth.js`
