# Google Analytics 4 (GA4) Setup Guide

This guide explains how to set up Google Analytics 4 to track visitors to pcbtracer.com.

## Overview

Google Analytics 4 (GA4) tracks:
- **Visitor count** - Total number of unique visitors
- **Page views** - Number of pages viewed
- **Sessions** - User sessions on your site
- **Date-based reports** - View metrics by day, week, month
- **Demographics** - Geographic location, device type, browser
- **User behavior** - Time on site, bounce rate, etc.

## Step 1: Create a Google Analytics Account

1. Go to [Google Analytics](https://analytics.google.com)
2. Sign in with your Google account
3. Click **Start measuring** or **Admin** → **Create Account**

## Step 2: Create a GA4 Property

1. In Google Analytics, go to **Admin** (gear icon)
2. Click **Create Property**
3. Enter property details:
   - **Property name**: `PCBTracer` (or your preferred name)
   - **Reporting time zone**: Your timezone
   - **Currency**: Your currency
4. Click **Next**
5. Fill in business information (optional)
6. Click **Create**

## Step 3: Get Your Measurement ID

1. After creating the property, you'll see a **Data Streams** section
2. Click **Add stream** → **Web**
3. Enter stream details:
   - **Website URL**: `https://pcbtracer.com`
   - **Stream name**: `PCBTracer Website`
4. Click **Create stream**
5. Copy your **Measurement ID** (format: `G-XXXXXXXXXX`)

## Step 4: Configure the Application

### Option A: Environment Variable (Recommended for Production)

1. Create a `.env` file in the project root (if it doesn't exist)
2. Add your Measurement ID:

```env
VITE_GA4_ID=G-XXXXXXXXXX
```

Replace `G-XXXXXXXXXX` with your actual Measurement ID.

3. **Important**: The `.env` file is in `.gitignore` and won't be committed
4. For deployment, you'll need to set this as an environment variable in your CI/CD or build process

### Option B: Set During Build (For GitHub Pages)

Since GitHub Pages doesn't support environment variables directly, you have two options:

#### Option B1: Set in Deployment Script

Modify `deploy-to-github-pages.sh` to set the environment variable:

```bash
export VITE_GA4_ID=G-XXXXXXXXXX
./deploy-to-github-pages.sh
```

#### Option B2: Use GitHub Secrets (If using GitHub Actions)

1. Go to repository Settings → Secrets and variables → Actions
2. Add a new secret: `VITE_GA4_ID` with value `G-XXXXXXXXXX`
3. Update your GitHub Actions workflow to use the secret

## Step 5: Deploy

1. Build and deploy the application:
   ```bash
   ./deploy-to-github-pages.sh
   ```

2. The GA4 script will automatically load in production builds when `VITE_GA4_ID` is set

## Step 6: Verify Analytics is Working

1. Visit `https://pcbtracer.com` in your browser
2. Open browser DevTools → Network tab
3. Look for requests to `googletagmanager.com` or `google-analytics.com`
4. In Google Analytics, go to **Reports** → **Realtime**
5. You should see your visit appear within a few seconds

## Viewing Analytics Data

### Real-time Data
- Go to **Reports** → **Realtime** in Google Analytics
- See active users and page views as they happen

### Historical Data
- Go to **Reports** → **Life cycle** → **Acquisition** → **Overview**
- View visitors by date, location, device, etc.
- Use date range picker to view specific periods

### Key Metrics
- **Users**: Total unique visitors
- **New users**: First-time visitors
- **Sessions**: User sessions
- **Page views**: Total pages viewed
- **Average session duration**: Time spent on site

## Privacy Considerations

### GDPR Compliance
- GA4 collects user data (IP addresses, device info, etc.)
- Consider adding a cookie consent banner for EU visitors
- Google Analytics has built-in IP anonymization (enabled by default)

### Privacy Policy
- Update your privacy policy to mention Google Analytics
- Inform users that analytics data is collected

## Troubleshooting

### Analytics Not Working

1. **Check Measurement ID**:
   - Verify `VITE_GA4_ID` is set correctly
   - Format should be `G-XXXXXXXXXX` (starts with G-)

2. **Check Build**:
   - Analytics only loads in production builds (`npm run build`)
   - Development mode (`npm run dev`) won't load GA4

3. **Check Browser Console**:
   - Open DevTools → Console
   - Look for "GA4: Initialized" message
   - If you see "GA4: Not configured", the ID isn't set

4. **Check Network Tab**:
   - Look for requests to `googletagmanager.com`
   - If missing, GA4 isn't loading

5. **Ad Blockers**:
   - Some ad blockers prevent GA4 from loading
   - Test in incognito mode or disable ad blockers

### Data Not Appearing in Google Analytics

- **Wait 24-48 hours**: Some reports take time to populate
- **Check Real-time report**: This updates immediately
- **Verify Measurement ID**: Must match exactly
- **Check filters**: Make sure no filters are excluding your data

## Advanced Configuration

### Custom Events

You can track custom events in your application:

```typescript
import { trackEvent } from './utils/analytics';

// Track a button click
trackEvent('button_click', {
  button_name: 'feedback',
  page: 'home'
});
```

### Page View Tracking

For SPA navigation (if you add routing):

```typescript
import { trackPageView } from './utils/analytics';

trackPageView('/new-page', 'New Page Title');
```

## Security Notes

- **Never commit `.env` file** - It's already in `.gitignore`
- **Measurement ID is public** - It's visible in the built JavaScript
- **No sensitive data** - GA4 only tracks public website usage
- **API keys not used** - GA4 uses Measurement ID, not API keys

## Support

- [Google Analytics Help](https://support.google.com/analytics)
- [GA4 Documentation](https://developers.google.com/analytics/devguides/collection/ga4)
