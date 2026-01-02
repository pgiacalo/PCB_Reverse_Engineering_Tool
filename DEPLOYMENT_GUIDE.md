# Deployment Guide

This guide explains how to deploy the PCB Reverse Engineering Tool to GitHub Pages.

## Primary Deployment Method: GitHub Pages

The application is hosted on **GitHub Pages**, which provides:
- ✅ Free hosting
- ✅ Automatic HTTPS
- ✅ Easy updates (just run the deployment script)
- ✅ No server maintenance
- ✅ Works on any device with a modern browser

## Deployment Script

### `deploy-to-github-pages.sh`
**Deploys the application to GitHub Pages**

This is the primary and recommended deployment method.

**Usage:**
```bash
./deploy-to-github-pages.sh
```

**What it does:**
- Checks for uncommitted changes (prevents deploying incomplete work)
- Switches to `main` branch
- Pulls latest changes from remote
- Installs dependencies
- Builds the production bundle with correct base path
- Deploys to `gh-pages` branch
- Shows the deployment URL

**Deployed to:**
- **GitHub Pages**: `https://pgiacalo.github.io/PCB_Reverse_Engineering_Tool/`

**Prerequisites:**
- Git repository with remote configured
- Node.js and npm installed
- GitHub repository access
- `gh-pages` package (installed automatically if needed)

---

## Quick Reference

### Deploy to GitHub Pages:
```bash
./deploy-to-github-pages.sh
```

That's it! The script handles everything automatically.

---

## Alternative: Manual Deployment

If you prefer to deploy manually:

```bash
# Build the production bundle
npm run build

# Deploy using gh-pages
npm run deploy
```

---

## Troubleshooting

### GitHub Pages not updating:
- Wait 2-10 minutes for CDN cache to refresh
- Hard refresh your browser: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
- Try opening in an incognito/private window

### Build fails:
- Check TypeScript errors: `npm run build`
- Verify dependencies are installed: `npm install`
- Check for uncommitted changes (script will warn you)

### Deployment fails:
- Verify you have push access to the repository
- Check that the `gh-pages` branch exists (it will be created automatically)
- Ensure you're on the `main` branch before deploying

---

## Heroku App Names

- **Staging:** `pcbtracer-staging`
  - URL: `https://pcbtracer-staging-bd8cca44225e.herokuapp.com/`
- **Production:** `pcbtracer`
  - URL: `https://pcbtracer.herokuapp.com/` (TBD)

---

## Troubleshooting

### GitHub Pages not updating:
- Wait 2-10 minutes for CDN cache
- Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)

### Heroku deployment fails:
- Check you're logged in: `heroku auth:whoami`
- Verify app name: `heroku apps`
- Check Heroku remote: `git remote -v`

### Build fails:
- Check TypeScript errors: `npm run build`
- Verify dependencies: `npm install`
