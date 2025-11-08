# SpikePrimeGit

> Disclaimer: This repository was made using [claude code](https://www.claude.com/product/claude-code) as a coding partner. 

**Automatically sync your LEGO SPIKE Prime projects to GitHub!**

SpikePrimeGit is a Chrome extension that automatically backs up your LEGO SPIKE Prime robotics projects to GitHub. Every time you save in SPIKE Prime, your project is automatically uploaded to your GitHub repository with full version control.

## ✨ Features

- ⚡ **Auto-Sync**: Automatically uploads every time you save - no manual steps
- 🔒 **Secure OAuth**: Industry-standard GitHub authentication
- 📦 **Version Control**: Every save creates a Git commit with timestamp
- 📊 **Sync History**: Track all your uploads
- 🚀 **Zero Configuration**: Simple setup, works immediately
- 🔐 **Privacy First**: No data collection, everything stays local

## 🎯 Quick Start

### Prerequisites

- Google Chrome (version 88+)
- GitHub account
- GitHub repository (public or private)

### Setup Steps

#### 1. Create GitHub OAuth App

1. Go to https://github.com/settings/developers
2. Click **"OAuth Apps"** → **"New OAuth App"**
3. Fill in:
   - **Application name:** `SpikePrimeGit`
   - **Homepage URL:** Your repository URL
   - **Authorization callback URL:** `https://YOUR_EXTENSION_ID.chromiumapp.org/`
     _(You'll get the Extension ID after installing the extension)_
4. Click **"Register application"**
5. Copy your **Client ID**
6. Click **"Generate a new client secret"** and copy it

#### 2. Install Extension

**Option A: From Source (Developer Mode)**

1. Download this repository as ZIP and extract it
2. Open Chrome and go to `chrome://extensions/`
3. Enable **"Developer mode"** (toggle in top-right)
4. Click **"Load unpacked"**
5. Select the `brickhub/` folder
6. Copy your **Extension ID** (shown under the extension name)
7. **Go back to GitHub OAuth App** and update the callback URL with your Extension ID

#### 3. Configure Extension

1. Click the **SpikePrimeGit icon** in Chrome toolbar
2. Enter your **Client ID** and **Client Secret**
3. Click **"Save & Continue"**
4. Click **"Connect to GitHub"** and authorize the app
5. Select your **repository** and **branch**
6. Set **project path** (default: `projects/`)
7. Enable **"Auto-Sync"** toggle
8. Click **"Save Settings"**

#### 4. Test It!

1. Open https://spike.legoeducation.com
2. Create or open a project
3. Save your project (Ctrl+S or Cmd+S)
4. You'll see: **"✅ Auto-synced 'ProjectName' to GitHub"**
5. Check your GitHub repository - your project is there!

## 📖 How It Works

```
Save in SPIKE Prime (Ctrl+S)
    ↓
File captured automatically
    ↓
Auto-synced to GitHub
    ↓
Commit appears on GitHub with timestamp
```

Every save creates a new commit:
```
Update SPIKE project: MyRobot

Synced from LEGO SPIKE Prime web editor
Timestamp: 2025-01-08T12:34:56.789Z
```

## 🎓 Usage

### Automatic Syncing (Recommended)

Once configured, just work normally:
1. Open any SPIKE Prime project
2. Make your changes
3. Save (Ctrl+S) - **automatically syncs!**
4. Continue working - every save creates a commit

### Manual Syncing

You can also sync manually:
1. Download/Export project from SPIKE Prime
2. Look for the **SpikePrimeGit card** on the SPIKE page
3. Click **"Sync to GitHub"** button

### Viewing Sync History

Your projects are saved as `.llsp3` files in your repository:
1. Go to your GitHub repository
2. Navigate to your projects folder (e.g., `projects/`)
3. Click any file to see version history
4. Use GitHub features to view changes, restore versions, etc.

## 🔐 Privacy & Security

- ✅ **No Data Collection**: Zero telemetry or analytics
- ✅ **Local Storage Only**: Tokens stored securely in browser
- ✅ **Direct Communication**: Extension talks directly to GitHub
- ✅ **Open Source**: All code available for inspection
- ✅ **OAuth Security**: Industry-standard authentication
- ✅ **No Backend**: No third-party servers involved

## 🐛 Troubleshooting

### "Not Connected" Status

**Solution:**
1. Click extension icon
2. Verify Client ID and Secret are correct
3. Click "Connect to GitHub" again
4. Check OAuth callback URL matches Extension ID

### "Authorization page could not be loaded"

**Solution:**
1. Go to `chrome://extensions/` and copy Extension ID
2. Go to GitHub OAuth App settings
3. Make sure callback URL is **exactly**:
   ```
   https://YOUR_EXTENSION_ID.chromiumapp.org/
   ```

### "Auto-sync skipped - download project first"

**Solution:**
1. Download/export your project from SPIKE Prime once first
2. After first download, auto-sync will work on subsequent saves

### Projects not appearing on GitHub

**Solutions:**
1. Check you're looking at the correct branch
2. Verify project path matches your settings
3. Check repository commits to see if files are being created
4. Open browser console (F12) and look for errors with `[SpikePrimeGit]`

## 📚 Documentation

- **CONTRIBUTE.md** - Development setup and contributing guidelines
- **GitHub Issues** - Report bugs or request features

## 🤝 Contributing

Contributions are welcome! See [CONTRIBUTE.md](../CONTRIBUTE.md) for development setup and guidelines.

## 📄 License

This project is provided as-is for educational purposes.

## 🙏 Acknowledgments

- LEGO Education for SPIKE Prime
- GitHub for API access
- Chrome Extensions team for Manifest V3

---

**Made with ❤️ for LEGO Education enthusiasts**

Never lose your SPIKE Prime projects again! 🧱🤖
