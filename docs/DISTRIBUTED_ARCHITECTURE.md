# PCB Tracer - System Architecture

This document describes the multi-hosted architecture of PCB Tracer, including service hosts, deployment pipelines, and CORS configuration.

## Architecture Overview

PCB Tracer uses a decoupled architecture with the frontend and backend deployed on separate hosting platforms. This separation provides flexibility, scalability, and cost optimization.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              GitHub Repositories                             │
│                                                                              │
│   ┌──────────────────────────┐       ┌──────────────────────────┐          │
│   │   PCBTracer_Backend      │       │ PCB_Reverse_Engineering_ │          │
│   │   (Node.js/Express)      │       │ Tool (React/Vite)        │          │
│   └────────────┬─────────────┘       └────────────┬─────────────┘          │
│                │                                  │                         │
└────────────────┼──────────────────────────────────┼─────────────────────────┘
                 │                                  │
                 │ Auto-deploy (Staging)            │ GitHub Pages Deploy
                 │ Manual (Production)              │
                 ▼                                  ▼
┌────────────────────────────────┐   ┌────────────────────────────────┐
│           HEROKU               │   │        GITHUB PAGES            │
│                                │   │                                │
│  ┌──────────────────────────┐  │   │  ┌──────────────────────────┐  │
│  │   Staging Pipeline       │  │   │  │   Static Site Hosting    │  │
│  │   (Auto-deploy from      │  │   │  │                          │  │
│  │    GitHub main branch)   │  │   │  │   URL:                   │  │
│  │                          │  │   │  │   pgiacalo.github.io/    │  │
│  │   URL: pcbtracer-staging │  │   │  │   PCB_Reverse_           │  │
│  │   -bd8cca44225e          │  │   │  │   Engineering_Tool/      │  │
│  │   .herokuapp.com         │  │   │  │                          │  │
│  └──────────────────────────┘  │   │  └──────────────────────────┘  │
│                                │   │                                │
│  ┌──────────────────────────┐  │   └────────────────────────────────┘
│  │   Production Pipeline    │  │
│  │   (Manual deploy)        │  │
│  │                          │  │
│  │   URL: pcbtracer         │  │
│  │   .herokuapp.com         │  │
│  └──────────────────────────┘  │
│                                │
└────────────────────────────────┘
```

## Service Hosts

### 1. Frontend - GitHub Pages

| Property | Value |
|----------|-------|
| **Platform** | GitHub Pages (Static Site Hosting) |
| **Technology** | React 18 + TypeScript + Vite |
| **URL** | `https://pgiacalo.github.io/PCB_Reverse_Engineering_Tool/` |
| **Cost** | Free |
| **Deployment** | Manual via `deploy-to-github-pages.sh` |
| **SSL** | Automatic (GitHub-managed) |

**What it serves:**
- Static HTML, JavaScript, and CSS files
- All application logic runs in the user's browser
- No server-side processing

### 2. Backend - Heroku

| Property | Value |
|----------|-------|
| **Platform** | Heroku (Platform as a Service) |
| **Technology** | Node.js + Express + TypeScript |
| **Staging URL** | `https://pcbtracer-staging-bd8cca44225e.herokuapp.com` |
| **Production URL** | `https://pcbtracer.herokuapp.com` (TBD) |
| **Cost** | Paid (Dyno hours) |
| **Deployment** | Auto-deploy (Staging), Manual (Production) |

**What it provides:**
- REST API endpoints for authentication
- User management (CRUD operations)
- Customer/subscription management via Stripe
- Email OTP delivery via SendGrid

### 3. Database - MongoDB Atlas

| Property | Value |
|----------|-------|
| **Platform** | MongoDB Atlas (Cloud Database) |
| **Type** | NoSQL Document Database |
| **Connection** | Via `STARTER_MONGO_URL` environment variable |

**Collections:**
- `users` - User accounts and profiles
- `otps` - One-time passwords for authentication
- `refreshtokens` - JWT refresh tokens for session management
- `customers` - Stripe customer data

### 4. External Services

| Service | Purpose |
|---------|---------|
| **SendGrid** | Email delivery for OTP codes |
| **Stripe** | Payment processing and subscriptions |
| **MongoDB Atlas** | Cloud database hosting |

## API Endpoints

### Authentication Routes (`/auth/*`)
- `POST /auth/signUpOrContinueWithOTP` - Request OTP via email
- `POST /auth/login` - Verify OTP and receive tokens

### API Routes (`/api/*`) - Requires Authentication
- `POST /api/token` - Refresh access token
- `GET /api/getUser` - Get current user profile
- `POST /api/deleteUser` - Delete user account
- `GET /api/getCustomer` - Get subscription info

### Health Routes (`/health/*`)
- `GET /health/check` - Backend health check

## CORS Configuration

Cross-Origin Resource Sharing (CORS) controls which domains can make API requests to the backend.

### Allowed Origins

```javascript
// Production (always allowed)
const corsAllowlist = [
  'https://www.pcbpro.com',        // Production domain
  'https://pgiacalo.github.io'     // GitHub Pages
];

// Development only (when STARTER_ENV === 'DEV')
if (isDevelopment) {
  corsAllowlist.push('http://localhost:3000');
  corsAllowlist.push('https://*.netlify.app');
}
```

### CORS Flow Diagram

```
┌─────────────────────┐          ┌─────────────────────┐
│   GitHub Pages      │          │   Heroku Backend    │
│   (Frontend)        │          │                     │
│                     │          │                     │
│  pgiacalo.github.io │ ──────►  │  1. Check Origin    │
│                     │  HTTP    │     header          │
│                     │ Request  │                     │
│                     │          │  2. Is origin in    │
│                     │          │     allowlist?      │
│                     │          │     ✓ Yes           │
│                     │          │                     │
│                     │ ◄──────  │  3. Add CORS        │
│                     │ Response │     headers:        │
│                     │          │     Access-Control- │
│                     │          │     Allow-Origin    │
└─────────────────────┘          └─────────────────────┘
```

### Why CORS Matters

Browsers enforce the Same-Origin Policy for security. When the frontend (`pgiacalo.github.io`) makes API calls to the backend (`herokuapp.com`), the browser blocks these "cross-origin" requests unless the backend explicitly allows them via CORS headers.

**Without proper CORS configuration:** `Failed to fetch` errors

**With proper CORS configuration:** API calls work seamlessly

## Local Development

During local development, a Vite proxy is used to avoid CORS issues entirely:

```
┌─────────────────────────────────────────────────────────────┐
│                    localhost:5173                            │
│                                                              │
│   ┌─────────────────┐      ┌─────────────────────────────┐  │
│   │  Vite Dev       │      │  Vite Proxy                 │  │
│   │  Server         │ ───► │                             │  │
│   │                 │      │  /auth/* ──► Heroku Staging │  │
│   │  Serves React   │      │  /api/*  ──► Heroku Staging │  │
│   │  App            │      │  /health ──► Heroku Staging │  │
│   └─────────────────┘      └─────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Vite Proxy Configuration** (`vite.config.ts`):
```typescript
server: {
  proxy: {
    '/auth': {
      target: 'https://pcbtracer-staging-bd8cca44225e.herokuapp.com',
      changeOrigin: true,
    },
    '/api': { /* same */ },
    '/health': { /* same */ },
  },
}
```

This allows the frontend to make requests to `/auth/login` which Vite proxies to the real backend, avoiding CORS entirely during development.

## Authentication Flow

```
┌──────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────┐
│  User    │     │  Frontend    │     │  Backend    │     │ SendGrid │
│ Browser  │     │ GitHub Pages │     │  Heroku     │     │  Email   │
└────┬─────┘     └──────┬───────┘     └──────┬──────┘     └────┬─────┘
     │                  │                    │                  │
     │ 1. Enter email   │                    │                  │
     │─────────────────►│                    │                  │
     │                  │                    │                  │
     │                  │ 2. POST /auth/     │                  │
     │                  │    signUpOrContinue│                  │
     │                  │    WithOTP         │                  │
     │                  │───────────────────►│                  │
     │                  │                    │                  │
     │                  │                    │ 3. Send OTP      │
     │                  │                    │    email         │
     │                  │                    │─────────────────►│
     │                  │                    │                  │
     │                  │   4. 200 OK        │                  │
     │                  │◄───────────────────│                  │
     │                  │                    │                  │
     │◄─────────────────│                    │    5. Email      │
     │ Show OTP input   │                    │    delivered     │
     │                  │                    │◄─────────────────│
     │                  │                    │                  │
     │ 6. Enter OTP     │                    │                  │
     │─────────────────►│                    │                  │
     │                  │                    │                  │
     │                  │ 7. POST /auth/login│                  │
     │                  │───────────────────►│                  │
     │                  │                    │                  │
     │                  │ 8. {accessToken,   │                  │
     │                  │    refreshToken,   │                  │
     │                  │    user}           │                  │
     │                  │◄───────────────────│                  │
     │                  │                    │                  │
     │ 9. Store tokens  │                    │                  │
     │    in localStorage                    │                  │
     │    Show main app │                    │                  │
     │◄─────────────────│                    │                  │
     │                  │                    │                  │
```

## Deployment Pipelines

### CI/CD Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CONTINUOUS DEPLOYMENT                              │
│                                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   Developer │    │   GitHub    │    │   GitHub    │    │   Heroku    │  │
│  │   Pushes    │───►│   Repo      │───►│   Actions   │───►│   Staging   │  │
│  │   to main   │    │   (main)    │    │   (CI)      │    │   (Auto)    │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
│                                              │                    │         │
│                                              │ ✓ Checks Pass      │         │
│                                              ▼                    ▼         │
│                                        ┌─────────────┐    ┌─────────────┐  │
│                                        │   Heroku    │    │   Heroku    │  │
│                                        │   Waits for │───►│   Deploys   │  │
│                                        │   CI Pass   │    │   Staging   │  │
│                                        └─────────────┘    └─────────────┘  │
│                                                                  │         │
│                                                                  │ Manual  │
│                                                                  ▼         │
│                                                           ┌─────────────┐  │
│                                                           │   Heroku    │  │
│                                                           │  Production │  │
│                                                           │  (Manual)   │  │
│                                                           └─────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Automatic Deployment (Staging)

The staging environment uses **automatic deployment** triggered by GitHub pushes:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Push to main   │ ──► │  GitHub Action  │ ──► │  Heroku Auto    │
│  branch         │     │  runs CI        │     │  Deploy         │
│                 │     │  (build/test)   │     │                 │
│                 │     │  ✅ Pass        │     │  ✅ Deployed    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

**Workflow:**
1. Developer pushes code to `main` branch on GitHub
2. GitHub Actions CI workflow triggers automatically (`.github/workflows/ci.yml`)
3. CI runs: checkout → install dependencies → build TypeScript → run tests
4. Heroku detects CI checks passed (configured: "Wait for GitHub checks to pass")
5. Heroku automatically deploys to staging environment
6. New code is live on `https://pcbtracer-staging-bd8cca44225e.herokuapp.com`

**Timeline:** ~3-5 minutes from push to live

**Configuration Requirements:**
- GitHub Actions workflow must exist in `.github/workflows/`
- Heroku "Automatic deploys" enabled for `main` branch
- Heroku "Wait for GitHub checks to pass" enabled

### Manual Deployment (Production)

The production environment uses **manual deployment** for controlled releases:

**Method 1: Promote from Staging (Recommended)**
1. Go to Heroku Dashboard → Pipeline view
2. Click "Promote to Production" on the staging app
3. This copies the exact staging build to production (no rebuild)

**Method 2: Direct Deploy from Dashboard**
1. Go to Heroku Dashboard → Production app → Deploy tab
2. Select branch and click "Deploy Branch"

**Method 3: Git Push (if Heroku remote configured)**
```bash
git push heroku main:master
```

### Frontend Deployment (GitHub Pages)

The frontend uses **manual deployment** via a shell script:

```bash
# Build and deploy script
./deploy-to-github-pages.sh
```

**What the script does:**
1. `npm run build` - Creates optimized production build in `dist/` folder
2. Copies `dist/` contents to `gh-pages` branch
3. Pushes `gh-pages` branch to GitHub
4. GitHub Pages automatically serves the new static files

**Timeline:** ~1-2 minutes from script execution to live

**To deploy frontend:**
```bash
cd /Users/phil/dev/Electronics/pcb_reverse_engineer
./deploy-to-github-pages.sh
```

### Deployment Comparison

| Aspect | Backend Staging | Backend Production | Frontend |
|--------|-----------------|-------------------|----------|
| **Trigger** | Automatic (push to main) | Manual | Manual (script) |
| **CI Required** | Yes (GitHub Actions) | No | No |
| **Approval** | None | Human decision | Human decision |
| **Rollback** | Re-push previous commit | Promote older staging | Re-deploy previous build |
| **Hosting** | Heroku | Heroku | GitHub Pages |
| **URL** | pcbtracer-staging-*.herokuapp.com | pcbtracer.herokuapp.com | pgiacalo.github.io |

## Environment Variables

### Backend (Heroku)

| Variable | Purpose |
|----------|---------|
| `STARTER_MONGO_URL` | MongoDB Atlas connection string |
| `STARTER_JWT_SECRET` | Secret for signing JWT tokens |
| `STARTER_ENV` | Environment type (DEV/PROD) |
| `STARTER_STRIPE_SECRET` | Stripe API secret key |
| `STARTER_STRIPE_WEBHOOK_SECRET` | Stripe webhook verification |
| `SENDGRID_API_KEY` | SendGrid email API key |

### Frontend (Build-time)

| Variable | Purpose |
|----------|---------|
| `import.meta.env.DEV` | Vite's development mode flag |
| `import.meta.env.BASE_URL` | Base path for assets |

## Security Considerations

1. **JWT Tokens**: Access tokens expire in 5 minutes, refresh tokens in 100 years
2. **HTTPS Only**: All production traffic encrypted via SSL/TLS
3. **CORS Restricted**: Only allowed origins can make API calls
4. **Rate Limiting**: API endpoints have request limits to prevent abuse
5. **Helmet.js**: Security headers applied to all responses
6. **API Key**: Additional authentication layer via `X-Starter-Tools-Secret` header


