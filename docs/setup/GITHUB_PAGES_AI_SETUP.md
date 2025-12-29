# GitHub Pages AI Feature Setup Guide

## Overview

The AI-powered pin name extraction feature works on GitHub Pages **without any special configuration**. The feature uses a user-provided API key stored in the browser's sessionStorage, so no API keys are exposed in the build.

## ✅ No Configuration Required

**Good news:** You don't need to configure anything special for GitHub Pages! The AI feature works out of the box because:

- ✅ No API keys are embedded in the build
- ✅ Users enter their own API keys in the UI
- ✅ API keys are stored securely in browser sessionStorage (cleared when tab is closed)
- ✅ Model preferences persist in localStorage across sessions
- ✅ No backend server required
- ✅ No environment variables needed for production

## Deployment Steps

### Option 1: Automatic Deployment (Recommended)

1. **Enable GitHub Pages:**
   - Go to your repository on GitHub
   - Click **Settings** → **Pages**
   - Under **Source**, select **GitHub Actions**

2. **Push your code:**
   ```bash
   git add .
   git commit -m "Add AI pin name extraction feature"
   git push origin main
   ```

3. **Wait for deployment:**
   - GitHub Actions will automatically build and deploy
   - Check the **Actions** tab to monitor progress
   - Your site will be available at: `https://[your-username].github.io/PCB_Reverse_Engineering_Tool`

### Option 2: Manual Deployment

1. **Build the application:**
   ```bash
   npm run build
   ```

2. **Deploy to GitHub Pages:**
   ```bash
   npm run deploy
   ```
   
   Or use the deployment script:
   ```bash
   ./build_and_deploy_to_github_pages.sh
   ```

## User Configuration (After Deployment)

Once your site is deployed, users need to configure their own API key:

### Step 1: Get a Free API Key

1. Visit: https://aistudio.google.com/apikey
2. Sign in with your Google account
3. Click **Create API Key**
4. Copy the API key (starts with `AIza...`)

### Step 2: Enter API Key in the Application

1. Open your deployed GitHub Pages site
2. Open any Integrated Circuit component's properties:
   - Click the **Component** tool (or press `C`)
   - Double-click any Integrated Circuit component
   - Or press `A` to open properties for the selected component

3. In the Component Properties dialog:
   - Look for the **Pin Name** column header
   - You'll see an API key input field (password field)
   - Paste your API key
   - Click **Save API Key**

4. The key is now saved in your browser's sessionStorage for this session (it will be cleared when you close the browser tab)

### Step 3: Use the Feature

1. With a component's properties open, ensure you have:
   - Uploaded a PDF datasheet file, OR
   - Entered a datasheet URL

2. Click the **Fetch Pin Names** button (green button below the API key field)

3. The AI will extract pin names from the datasheet and populate the table

## Security Features

✅ **No API keys in code:** The build contains no API keys  
✅ **User-specific keys:** Each user uses their own API key and quota  
✅ **Session-based storage:** API keys stored in sessionStorage (automatically cleared when tab closes)  
✅ **Persistent preferences:** Model selection stored in localStorage (persists across sessions)  
✅ **Free tier available:** Google provides free API keys with generous limits  

## Troubleshooting

### "Gemini API key is not configured" Error

**Solution:** Enter your API key in the Component Properties dialog as described above.

### API Key Not Persisting

**Note:** API keys are stored in sessionStorage, which means they are intentionally cleared when you close the browser tab. This is a security feature. You will need to re-enter your API key when you start a new session.

**If the key is not saving at all, check:**
- Browser allows sessionStorage (not blocked by settings)
- Browser settings allow site data storage
- Try saving the key again

### "Failed to fetch pin names" Error

**Possible causes:**
1. **Invalid API key:** Make sure you copied the entire key correctly
2. **API quota exceeded:** Check your Google AI Studio dashboard
3. **Network issues:** Check browser console for CORS or network errors
4. **PDF format issues:** Some PDFs may not be parseable

**Solutions:**
- Verify your API key at https://aistudio.google.com/apikey
- Check your API usage/quota
- Try uploading the PDF file instead of using a URL
- Check browser console for detailed error messages

### Feature Not Working After Deployment

**Verify:**
1. The build completed successfully (check Actions tab)
2. You're accessing the deployed site (not localhost)
3. Browser console shows no JavaScript errors
4. The Component Properties dialog shows the API key input field

## Development vs Production

### Development (Local)
- Use the UI to enter API key (same as production)
- API key is stored in sessionStorage (cleared when tab closes)
- Model preference is stored in localStorage (persists)

### Production (GitHub Pages)
- Users must enter API key in the UI
- No `.env` file needed (and shouldn't be committed)
- Works automatically after deployment
- API keys are session-based for security

## Best Practices

1. **Documentation:** Add a note in your README about the AI feature
2. **User instructions:** Consider adding a tooltip or help text in the UI
3. **Error handling:** The app already shows helpful error messages
4. **Privacy:** Remind users that API keys are stored in sessionStorage (cleared on tab close) for security

## Summary

**For Repository Owners:**
- ✅ No special configuration needed
- ✅ Deploy normally (automatic or manual)
- ✅ Feature works immediately after deployment

**For End Users:**
- ✅ Get free API key from Google
- ✅ Enter key in Component Properties dialog
- ✅ Start using the feature

The AI feature is designed to work seamlessly on GitHub Pages without exposing any secrets!

