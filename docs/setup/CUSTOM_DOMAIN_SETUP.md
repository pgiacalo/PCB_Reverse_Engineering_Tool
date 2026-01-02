# Custom Domain Setup for GitHub Pages

This guide explains how to configure `pcbtracer.com` as a custom domain for your GitHub Pages site.

## Step 1: Configure GitHub Pages Settings

1. **Go to your repository on GitHub:**
   - Navigate to: https://github.com/pgiacalo/PCB_Reverse_Engineering_Tool

2. **Open Settings:**
   - Click on the **Settings** tab (top menu bar)

3. **Navigate to Pages:**
   - In the left sidebar, click **Pages** (under "Code and automation")

4. **Add Custom Domain:**
   - Under "Custom domain", enter: `pcbtracer.com`
   - Click **Save**
   - GitHub will automatically create a `CNAME` file in your repository

5. **Enable HTTPS (after DNS propagates):**
   - Wait for DNS to propagate (can take up to 24 hours)
   - Return to Pages settings
   - Check the **"Enforce HTTPS"** checkbox
   - This ensures your site uses secure connections

## Step 2: Configure DNS Records

Configure DNS records with your domain registrar (where you purchased `pcbtracer.com`):

### For Apex Domain (pcbtracer.com)

Create **four A records** pointing to GitHub's IP addresses:

| Type | Host/Name | Value | TTL |
|------|-----------|-------|-----|
| A | @ (or blank) | 185.199.108.153 | 3600 |
| A | @ (or blank) | 185.199.109.153 | 3600 |
| A | @ (or blank) | 185.199.110.153 | 3600 |
| A | @ (or blank) | 185.199.111.153 | 3600 |

**Note:** Some registrars use `@` for the root domain, others use a blank field or `pcbtracer.com`

### For WWW Subdomain (www.pcbtracer.com) - Optional

Create a **CNAME record**:

| Type | Host/Name | Value | TTL |
|------|-----------|-------|-----|
| CNAME | www | pgiacalo.github.io | 3600 |

This allows both `pcbtracer.com` and `www.pcbtracer.com` to work.

## Step 3: Update Application Configuration

The deployment script automatically detects the custom domain! You just need to:

1. **Ensure `public/CNAME` exists:**
   - The file should contain: `pcbtracer.com`
   - This file is already created in the repository
   - GitHub will also create it automatically when you add the domain in settings

2. **Update `package.json` (already done):**
   - Homepage is set to `https://pcbtracer.com`

3. **Redeploy:**
   - Run `./deploy-to-github-pages.sh`
   - The script will automatically detect the custom domain from `public/CNAME` and use base path `/`
   - No manual configuration changes needed!

## Step 4: Verify DNS Configuration

After DNS changes propagate (usually 1-24 hours), verify:

1. **Check DNS records:**
   - Use tools like [DNS Checker](https://dnschecker.org/) or `dig pcbtracer.com`
   - Verify A records point to GitHub IPs

2. **Test the site:**
   - Visit `https://pcbtracer.com` (wait for HTTPS to be available)
   - Visit `https://www.pcbtracer.com` (if you set up the CNAME)

3. **Check GitHub Pages settings:**
   - Return to repository Settings → Pages
   - Should show "Custom domain: pcbtracer.com" with a green checkmark
   - "Enforce HTTPS" should be available and enabled

## Troubleshooting

### Site not loading:
- Wait 24-48 hours for DNS propagation
- Verify DNS records are correct using DNS checker tools
- Check that GitHub Pages shows the custom domain as verified

### HTTPS not available:
- DNS must fully propagate first
- Wait up to 24 hours after DNS changes
- GitHub will automatically provision SSL certificate

### Mixed content warnings:
- Ensure all resources use HTTPS
- Check that `base` path in `vite.config.ts` is set to `/`

### CNAME file issues:
- GitHub creates this automatically when you add the custom domain
- Don't manually edit it unless necessary
- It should contain: `pcbtracer.com`

## Important Notes

- **DNS Propagation:** Can take 1-24 hours (sometimes up to 48 hours)
- **HTTPS Certificate:** GitHub automatically provisions SSL certificates (may take time after DNS propagates)
- **Base Path:** With custom domain, use `/` instead of `/PCB_Reverse_Engineering_Tool/`
- **Both Domains Work:** After setup, both `pgiacalo.github.io/PCB_Reverse_Engineering_Tool/` and `pcbtracer.com` will work

## After Setup

Once everything is configured:
- Your site will be available at: `https://pcbtracer.com`
- The old GitHub Pages URL will still work (redirects to custom domain)
- All future deployments will use the custom domain automatically
