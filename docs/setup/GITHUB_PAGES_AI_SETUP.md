# GitHub Pages AI Feature Setup Guide

## Overview

The AI-powered datasheet extraction feature works on GitHub Pages **without any special configuration**. The feature supports multiple AI services and uses user-provided API keys stored in the browser, so no API keys are exposed in the build.

## Supported AI Services

All three services support native PDF processing for datasheet extraction:

| Service | API Key URL | Features |
|---------|-------------|----------|
| **Google Gemini** | https://aistudio.google.com/apikey | Free tier available, fast |
| **Anthropic Claude** | https://console.anthropic.com/settings/keys | High quality responses |
| **OpenAI ChatGPT** | https://platform.openai.com/api-keys | GPT-4o with PDF support |

## ✅ No Configuration Required

**Good news:** You don't need to configure anything special for GitHub Pages! The AI feature works out of the box because:

- ✅ No API keys are embedded in the build
- ✅ Users enter their own API keys in the UI
- ✅ Users choose storage method: sessionStorage (secure) or localStorage (persistent)
- ✅ Each AI service has independent API key and model settings
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
   git commit -m "Add AI datasheet extraction feature"
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

Once your site is deployed, users need to configure their AI service:

### Step 1: Open AI Settings

1. Open your deployed GitHub Pages site
2. Go to **File → AI Settings** in the menu

### Step 2: Configure AI Service

In the AI Settings dialog:

1. **Choose AI Provider:** Select from Google Gemini, Anthropic Claude, or OpenAI ChatGPT
2. **Enter API Key:** Paste your API key for the selected provider
3. **Select Model:** Choose the model that fits your needs (faster vs more capable)
4. **Choose Storage Method:**
   - **Session Storage:** More secure - cleared when you close the browser tab
   - **Local Storage:** More convenient - persists across sessions
5. Click **Save Settings**

### Step 3: Get Your API Key

- **Google Gemini:** https://aistudio.google.com/apikey (free tier available)
- **Anthropic Claude:** https://console.anthropic.com/settings/keys
- **OpenAI ChatGPT:** https://platform.openai.com/api-keys

### Step 4: Use the Feature

1. With a component's properties open, ensure you have:
   - Uploaded a PDF datasheet file, OR
   - Linked a datasheet in the project directory

2. Click the **Extract Datasheet Information** button

3. The AI will extract pin names and component properties from the datasheet

## Security Features

✅ **No API keys in code:** The build contains no API keys  
✅ **User-specific keys:** Each user uses their own API key and quota  
✅ **Flexible storage:** Users choose between sessionStorage (secure) or localStorage (convenient)  
✅ **Isolated keys:** Each AI service has its own key stored separately  
✅ **No backend required:** All processing happens client-side via API calls  

## Troubleshooting

### "API key not configured" Error

**Solution:** Open **File → AI Settings** and enter your API key for the selected provider.

### API Key Not Persisting (Session Storage)

**Note:** If you chose Session Storage, API keys are intentionally cleared when you close the browser tab. This is a security feature. Switch to Local Storage if you want persistence.

### "Failed to extract" Error

**Possible causes:**
1. **Invalid API key:** Make sure you copied the entire key correctly
2. **API quota exceeded:** Check your provider's dashboard
3. **Network issues:** Check browser console for CORS or network errors
4. **PDF format issues:** Some PDFs may not be parseable

**Solutions:**
- Verify your API key at your provider's website
- Check your API usage/quota
- Try a different AI provider
- Check browser console for detailed error messages

### CORS Errors with Claude

**Note:** Claude's API requires a special header for browser access. The application includes the `anthropic-dangerous-direct-browser-access` header, but this may require Anthropic to enable browser access for your API key.

## Development vs Production

### Development (Local)
- Use the UI to configure AI service (same as production)
- Test with any supported provider

### Production (GitHub Pages)
- Users configure their own AI service in the UI
- No `.env` file needed (and shouldn't be committed)
- Works automatically after deployment

## Best Practices

1. **Use Session Storage on shared computers** for better security
2. **Use Local Storage on personal devices** for convenience
3. **Consider API costs** when choosing providers and models
4. **Rotate API keys periodically** for security
5. **Use API key restrictions** when available from your provider

## Summary

**For Repository Owners:**
- ✅ No special configuration needed
- ✅ Deploy normally (automatic or manual)
- ✅ Feature works immediately after deployment

**For End Users:**
- ✅ Choose your preferred AI service
- ✅ Get API key from provider
- ✅ Configure in File → AI Settings
- ✅ Choose your security preference (session vs local storage)

The AI feature is designed to work seamlessly on GitHub Pages without exposing any secrets!
