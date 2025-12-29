## Publishing to GitHub Pages

If you want to deploy this tool to a web server, this document explains how to publish it to Github pages.

### Automatic Deployment (Recommended)

The project is configured for automatic deployment to GitHub Pages using GitHub Actions. Here's how to set it up:

#### Step 1: Enable GitHub Pages
1. Go to your repository on GitHub
2. Click on **Settings** tab
3. Scroll down to **Pages** section
4. Under **Source**, select **GitHub Actions**

#### Step 2: Push Your Code
```bash
# Add all files to git
git add .

# Commit your changes
git commit -m "Initial commit with GitHub Pages setup"

# Push to GitHub
git push origin main
```

#### Step 3: Automatic Deployment
- GitHub Actions will automatically build and deploy your app
- Check the **Actions** tab in your repository to monitor deployment
- Your app will be available at: `https://[your-username].github.io/PCB_Reverse_Engineering_Tool`

### Manual Deployment

If you prefer manual deployment:

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Deploy to GitHub Pages**
   ```bash
   # Install gh-pages package
   npm install --save-dev gh-pages
   
   # Add deploy script to package.json
   # "deploy": "gh-pages -d dist"
   
   # Deploy
   npm run deploy
   ```

### Custom Domain (Optional)

To use a custom domain:

1. Create a `CNAME` file in the `public` folder with your domain name
2. Configure your domain's DNS to point to GitHub Pages
3. Enable custom domain in GitHub Pages settings

### Production Build
To create a production build:
```bash
npm run build
npm run preview
```

## AI Feature Configuration

The AI-powered pin name extraction feature works automatically on GitHub Pages. **No special configuration is required** for deployment.

### How It Works

- Users enter their own Google Gemini API key in the Component Properties dialog
- **API keys** are stored in browser `sessionStorage` (automatically cleared when the tab is closed)
- **Model preference** is stored in browser `localStorage` (persists across sessions)
- No API keys are embedded in the build
- Each user uses their own free API key and quota

### User Setup (After Deployment)

1. Get a free API key from: https://aistudio.google.com/apikey
2. Open any Integrated Circuit component's properties
3. Enter the API key in the "Pin Name" column header
4. Click "Save API Key"
5. Use the "Fetch Pin Names" feature

For detailed instructions, see [GITHUB_PAGES_AI_SETUP.md](./GITHUB_PAGES_AI_SETUP.md)


