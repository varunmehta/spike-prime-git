# Support

Need help with SpikePrimeGit? Here's how to get support.

## Before Filing an Issue

1. Check [README.md](README.md) troubleshooting section
2. Search [existing issues](../../issues) for similar problems
3. Try basic troubleshooting:
   - Refresh SPIKE Prime page (F5)
   - Reload extension at `chrome://extensions/`
   - Check browser console (F12) for errors
   - Verify settings (repository, branch, project path)

## Filing a GitHub Issue

### Bug Reports

[Create a bug report](../../issues/new)

**Include:**
- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Browser version (Chrome version number)
- Extension version (from `chrome://extensions/`)
- Console errors (F12 → Console tab)
- Screenshots/videos if relevant

**Example:**
```
Title: "Sync fails with special characters in project name"

Description:
When I save a project named "Robot #1", the sync to GitHub fails.

Steps to reproduce:
1. Create project named "Robot #1"
2. Save the project
3. Click "Sync to GitHub"

Expected: Project syncs successfully
Actual: Error message "Failed to sync"

Console error:
[SpikePrimeGit] Error: Invalid filename: Robot #1.llsp3

Chrome: Version 120.0.6099.129
Extension: v1.0.0
```

### Feature Requests

[Create a feature request](../../issues/new)

**Include:**
- Clear description of the feature
- Use case / why it's needed
- How you envision it working
- Any alternatives you've considered

**Example:**
```
Title: "Add support for auto-sync on every save"

Description:
I'd like the extension to automatically sync to GitHub every time
I save, without having to click the "Sync to GitHub" button.

Use case:
When iterating quickly, I save frequently and would like automatic
backups without manual intervention.

Proposed solution:
Add a toggle in settings: "Auto-sync on save"
When enabled, automatically sync after each save with a default
commit message like "Auto-save: [timestamp]"
```

### Questions

[Create a discussion](../../discussions) for general questions.

**Examples:**
- "How do I change the GitHub repository?"
- "Can I sync to multiple repositories?"
- "How do I restore an old version?"

## Response Time

- Bug reports: Reviewed within 3-5 business days
- Feature requests: Reviewed monthly
- Questions: Community-driven, response varies

## Security Issues

**DO NOT** file public issues for security vulnerabilities.

Instead, email maintainers privately with:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

## Contributing

Want to fix a bug or add a feature yourself? See [CONTRIBUTE.md](CONTRIBUTE.md)

---
