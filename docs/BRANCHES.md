# PCB Tracer - Branch Strategy

This document describes the branching strategy for PCB Tracer, which allows for parallel development of a free/open-source core product and an optional paid version with authentication and payment features.

## Branch Structure

```
auth-payment ──●─────●───────────────────────────► (auth + Stripe work preserved)
               │     │
             docs  v3.1 auth
               │
main ──────────●─────────────────────────────────► (clean, no auth)
               │
            aab0915
         (pre-auth)
```

## Branch Overview

| Branch | Purpose | Contains Auth? | Deploys To |
|--------|---------|----------------|------------|
| `main` | Core product development (free/open-source ready) | ❌ No | GitHub Pages |
| `auth-payment` | Paid product with login, user management, Stripe | ✅ Yes | Heroku Staging/Production |
| `gh-pages` | Built frontend assets for GitHub Pages hosting | N/A | GitHub Pages (auto) |
| `development` | Feature development and testing | Varies | Local only |

## Branch Details

### `main` Branch
- **Purpose:** Core PCB Tracer functionality without authentication
- **Target Audience:** Open-source users, free tier users
- **Features:**
  - PCB image loading and viewing
  - Drawing tools (vias, traces, pads, components)
  - Project save/load
  - Export capabilities (BOM, PDF, KiCad)
  - All core reverse engineering features

### `auth-payment` Branch
- **Purpose:** Full product with authentication and payment integration
- **Target Audience:** Paid/premium users
- **Additional Features (beyond main):**
  - Email OTP authentication system
  - User account management
  - Stripe payment integration
  - Session management with JWT tokens
  - Logout functionality
  - Network manager with automatic token refresh

### What's in `auth-payment` (not in `main`):
```
src/
├── components/
│   └── AuthScreen/           # Login/signup UI
│       ├── AuthScreen.tsx
│       └── index.ts
├── network/                  # API communication layer
│   ├── routes.ts             # API endpoint definitions
│   ├── network-manager.ts    # Auth & API methods
│   └── index.ts
docs/
└── DISTRIBUTED_ARCHITECTURE.md  # Multi-host deployment docs
Release_Notes/
└── v3.1.md                   # Auth feature release notes
```

## Workflow

### Adding Core Features (most common)

1. Work on `main` branch
2. Commit and push to `main`
3. Periodically merge into `auth-payment`:

```bash
git checkout auth-payment
git merge main
git push origin auth-payment
```

### Adding Auth/Payment Features

1. Switch to `auth-payment` branch
2. Make changes
3. Commit and push to `auth-payment`

```bash
git checkout auth-payment
# ... make changes ...
git commit -m "Add payment feature"
git push origin auth-payment
```

### Deploying to GitHub Pages (Free Version)

```bash
git checkout main
./deploy-to-github-pages.sh
```

### Deploying Auth Version to Heroku

The `auth-payment` branch can be deployed to Heroku by:
1. Setting up a separate Heroku app connected to the `auth-payment` branch
2. Or manually deploying from the Heroku dashboard

## Decision Points

When you're ready to decide the product direction:

### Option A: Go Fully Open Source
- Keep `main` as the primary branch
- Archive or delete `auth-payment`
- Remove any references to paid features

### Option B: Go Paid Product
- Merge `auth-payment` into `main`
- All users will need to authenticate
- Configure Stripe for payments

### Option C: Freemium Model
- Maintain both branches
- `main` → Free tier (GitHub Pages)
- `auth-payment` → Premium tier (Heroku)
- Keep features in sync, with premium features only in `auth-payment`

## Keeping Branches in Sync

To keep `auth-payment` updated with core features from `main`:

```bash
# 1. Make sure main is up to date
git checkout main
git pull origin main

# 2. Switch to auth-payment and merge main
git checkout auth-payment
git merge main

# 3. Resolve any conflicts if needed
# 4. Push the updated auth-payment
git push origin auth-payment
```

## Branch Protection (Recommended)

Consider setting up branch protection rules on GitHub:

- **main:** Require pull request reviews before merging
- **auth-payment:** Require pull request reviews before merging
- **gh-pages:** No direct pushes (only via deploy script)
