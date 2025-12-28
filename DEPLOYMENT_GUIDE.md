# Deployment Guide

Simple deployment scripts for the PCB Reverse Engineering Tool.

## Scripts

### 1. `deploy_main.sh`
**Deploys `main` branch to GitHub Pages**

Deploys the free version (no authentication) to GitHub Pages.

**Usage:**
```bash
./deploy_main.sh
```

**What it does:**
- Builds the production bundle from `main` branch
- Deploys to `gh-pages` branch
- Makes the free version available at: `https://pgiacalo.github.io/PCB_Reverse_Engineering_Tool/`

---

### 2. `deploy_auth_payment.sh`
**Deploys `auth-payment` branch to GitHub Pages AND Heroku**

Deploys the paid version (with authentication) to both platforms.

**Usage:**
```bash
./deploy_auth_payment.sh
# When prompted, enter Heroku app name: pcbtracer-staging
```

**What it does:**
- Checks out `auth-payment` branch
- Merges latest changes from `main`
- Builds and verifies the build
- Deploys to GitHub Pages
- Deploys directly to Heroku
- Pushes to `origin/auth-payment` for tracking

**Deployed to:**
- GitHub Pages: `https://pgiacalo.github.io/PCB_Reverse_Engineering_Tool/`
- Heroku: `https://pcbtracer-staging-bd8cca44225e.herokuapp.com/`

---

## Quick Reference

### Deploy free version (main):
```bash
./deploy_main.sh
```

### Deploy paid version (auth-payment):
```bash
./deploy_auth_payment.sh
```

---

## Prerequisites

### For `deploy_main.sh`:
- Git repository
- Node.js and npm installed
- GitHub repository access

### For `deploy_auth_payment.sh`:
- Everything from `deploy_main.sh`, plus:
- Heroku CLI installed: `brew tap heroku/brew && brew install heroku`
- Logged in to Heroku: `heroku login`
- Heroku app created (e.g., `pcbtracer-staging`)

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
