# GitHub Issues Setup for Private Repository

This guide explains how to enable GitHub Issues for your private repository to allow bidirectional communication for bug reports and feature requests.

## Enable GitHub Issues

1. **Navigate to your repository on GitHub:**
   - Go to: https://github.com/pgiacalo/PCB_Reverse_Engineering_Tool

2. **Open Settings:**
   - Click on the **Settings** tab (top menu bar)

3. **Enable Issues:**
   - Scroll down to the **Features** section
   - Check the **Issues** checkbox
   - Click **Save** (if needed)

## Using GitHub Issues from the App

The feedback dialog now supports two submission methods:

### 1. Email (One-way)
- Sends feedback directly to your email
- Quick and simple
- No tracking or follow-up

### 2. GitHub Issues (Bidirectional) ⭐ Recommended
- Opens GitHub Issues in a new tab
- Allows you to:
  - Track bug reports and feature requests
  - Respond to users directly on GitHub
  - Assign labels (bug, enhancement, question)
  - Close issues when resolved
  - Have threaded discussions
  - Get notifications for updates

## Benefits of GitHub Issues

- **Bidirectional Communication**: Users can see your responses and updates
- **Issue Tracking**: All feedback is organized in one place
- **Labels & Milestones**: Organize and prioritize feedback
- **Notifications**: Get notified when users comment
- **Search**: Easy to search past issues
- **Integration**: Works with GitHub Actions, pull requests, etc.

## For Pull Requests

To allow pull requests from contributors:

1. **In Repository Settings:**
   - Go to Settings → General
   - Under "Pull Requests", ensure "Allow merge commits" is enabled (or your preferred merge strategy)

2. **For External Contributors:**
   - If you want to accept PRs from people outside your organization:
     - They can fork your private repo (if they have access)
     - Or you can make the repo public
     - Or use GitHub's "Private Vulnerability Reporting" for security issues

## Private Repository Considerations

- **Issues are visible** to anyone with repository access
- For a truly private feedback system, use email
- For public collaboration, consider making the repository public
- GitHub Issues work great for private repos when you want to collaborate with a team

## Testing

1. Open the app
2. Go to Help → Send Feedback...
3. Select "GitHub Issues (Bidirectional)" from the dropdown
4. Fill in your feedback
5. Click "Send Feedback"
6. A new tab should open with GitHub Issues pre-filled
7. Complete the submission on GitHub

---

**Note**: Make sure Issues are enabled in your repository settings before using this feature!
