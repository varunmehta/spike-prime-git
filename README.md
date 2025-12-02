# SpikePrimeGit

> Sync your LEGO SPIKE Prime projects to GitHub automatically

Chrome extension that backs up SPIKE Prime `.llsp3` files to GitHub with version control.

[![Available in the Chrome Web Store](https://developer.chrome.com/static/docs/webstore/branding/image/iNEddTyWiMfLSwFD6qGq.png)](https://chromewebstore.google.com/detail/spikeprimegit/ldiklhfinipoikhmfbnamjklkigcppoe)

[![Get it on GitHub Marketplace](https://img.shields.io/badge/GitHub%20Marketplace-Get%20it%20on-black?style=for-the-badge&logo=github)](https://github.com/marketplace/spikeprimegit)

[![Chrome Web Store Version](https://img.shields.io/chrome-web-store/v/ldiklhfinipoikhmfbnamjklkigcppoe)](https://chromewebstore.google.com/detail/spikeprimegit/ldiklhfinipoikhmfbnamjklkigcppoe)
[![Chrome Web Store Users](https://img.shields.io/chrome-web-store/users/ldiklhfinipoikhmfbnamjklkigcppoe)](https://chromewebstore.google.com/detail/spikeprimegit/ldiklhfinipoikhmfbnamjklkigcppoe)
[![Chrome Web Store Rating](https://img.shields.io/chrome-web-store/rating/ldiklhfinipoikhmfbnamjklkigcppoe)](https://chromewebstore.google.com/detail/spikeprimegit/ldiklhfinipoikhmfbnamjklkigcppoe)

## Features

- Auto-capture projects when you save in SPIKE Prime
- One-click GitHub authentication
- Version control with custom commit messages
- Privacy-focused: direct GitHub API communication, no third-party servers
- Integrated UI on SPIKE Prime website

## Screenshots

![Pre-Login Screen](docs/images/pre-login-screenshot.png)
![Post Login Screen](docs/images/pop-up-screenshot.png)
![Sync Button](docs/images/ui-injector-screenshot.png)

## Quick Start

### Install
**Chrome Web Store:** [Install here](https://chromewebstore.google.com/detail/spikeprimegit/ldiklhfinipoikhmfbnamjklkigcppoe)

**From Source:**
1. Download and extract this repository
2. Go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the folder

### Setup
1. Click the extension icon
2. Connect to GitHub
3. Select repository and branch
4. Set project path (e.g., `projects/`)
5. Save settings

### Usage
1. Open https://spike.legoeducation.com
2. Create/edit a project
3. Save it (Ctrl+S or Cmd+S)
4. Enter commit message in SpikePrimeGit card
5. Click "Sync to GitHub"

## Troubleshooting

**"No project captured yet"**
- Save your project first in SPIKE Prime

**"Extension context invalidated"**
- Refresh the SPIKE Prime page (F5)

**"Not Connected"**
- Click extension icon and reconnect to GitHub

**Projects not appearing on GitHub**
- Verify correct branch and project path in settings
- Check repository commits for file creation

**More help:** See [SUPPORT.md](SUPPORT.md) or [open an issue](../../issues)

## Contributing

See [CONTRIBUTE.md](CONTRIBUTE.md) for development setup and guidelines.

## License

Provided as-is for educational purposes.

---
