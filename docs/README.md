# SpikePrimeGit Documentation

This folder contains the GitHub Pages documentation for SpikePrimeGit.

## Viewing the Documentation

Once published to GitHub Pages, the documentation will be available at:
`https://[your-username].github.io/spike-prime-git/`

## Local Development

To view the documentation locally:
1. Open `index.html` in your web browser
2. Or use a local server: `python -m http.server 8000` then visit `http://localhost:8000`

## Adding Screenshots

The documentation has placeholder sections for screenshots. To add screenshots:

1. Take screenshots of the following:
   - Chrome Extensions page with Developer mode enabled
   - GitHub new repository creation page
   - GitHub OAuth app creation page
   - Extension setup screen (showing Client ID/Secret inputs)
   - Extension connected screen with settings
   - SPIKE Prime with sync notification
   - Manual upload interface in the extension
   - GitHub repository view showing synced projects

2. Save screenshots in the `images/` folder with descriptive names:
   - `chrome-extensions.png`
   - `github-new-repo.png`
   - `github-oauth-app.png`
   - `extension-setup.png`
   - `extension-connected.png`
   - `spike-sync-notification.png`
   - `manual-upload.png`
   - `github-repo-view.png`

3. Replace the placeholder sections in `index.html` with actual images:
   ```html
   <div class="screenshot">
     <img src="images/screenshot-name.png" alt="Description">
     <p class="caption">Description of what this screenshot shows</p>
   </div>
   ```

## Customization

- Edit `index.html` to update content
- Edit `style.css` to change colors and styling
- The main brand color is `#f5c402` (LEGO yellow)

## Publishing to GitHub Pages

1. Push the `docs` folder to your GitHub repository
2. Go to repository Settings → Pages
3. Set Source to "Deploy from a branch"
4. Select branch: `main` and folder: `/docs`
5. Click Save
6. Your site will be published in a few minutes

## File Structure

```
docs/
├── index.html          # Main documentation page
├── style.css           # Styling
├── images/             # Screenshots and images
│   └── (add images here)
└── README.md           # This file
```
