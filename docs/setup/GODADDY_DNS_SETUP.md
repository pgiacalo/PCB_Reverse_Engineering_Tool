# GoDaddy DNS Setup for pcbtracer.com → GitHub Pages

This guide provides step-by-step instructions for configuring DNS records in GoDaddy to point `pcbtracer.com` to your GitHub Pages site.

## Prerequisites

- GoDaddy account with `pcbtracer.com` domain
- GitHub repository with GitHub Pages enabled
- Access to GoDaddy DNS Management

## Step-by-Step Instructions

### Step 1: Log in to GoDaddy

1. Go to [godaddy.com](https://www.godaddy.com)
2. Click **Sign In** (top right)
3. Enter your credentials and sign in

### Step 2: Navigate to DNS Management

1. After logging in, click **My Products** (top menu)
2. Find `pcbtracer.com` in your domain list
3. Click the **DNS** button (or **Manage DNS** link) next to your domain
4. You'll see the DNS Management page with existing records

### Step 3: Add A Records for Apex Domain (pcbtracer.com)

You need to add **4 A records** pointing to GitHub's IP addresses.

**For each A record:**

1. Click **Add** button (usually at the top of the records table)
2. Select **A** from the record type dropdown
3. Fill in the following:

#### A Record #1:
- **Name/Host:** `@` (or leave blank - GoDaddy uses `@` for root domain)
- **Value/Points to:** `185.199.108.153`
- **TTL:** `600 seconds` (or 1 hour, or use default)

Click **Save**

#### A Record #2:
- **Name/Host:** `@` (or leave blank)
- **Value/Points to:** `185.199.109.153`
- **TTL:** `600 seconds`

Click **Save**

#### A Record #3:
- **Name/Host:** `@` (or leave blank)
- **Value/Points to:** `185.199.110.153`
- **TTL:** `600 seconds`

Click **Save**

#### A Record #4:
- **Name/Host:** `@` (or leave blank)
- **Value/Points to:** `185.199.111.153`
- **TTL:** `600 seconds`

Click **Save**

**Note:** GoDaddy's interface may show "Name" or "Host" - use `@` for the root domain. Some interfaces may require you to leave it blank or enter just the domain name.

### Step 4: Add CNAME Record for WWW Subdomain (Optional)

This allows `www.pcbtracer.com` to also work.

1. Click **Add** button
2. Select **CNAME** from the record type dropdown
3. Fill in:
   - **Name/Host:** `www`
   - **Value/Points to:** `pgiacalo.github.io`
   - **TTL:** `600 seconds` (or 1 hour, or use default)
4. Click **Save**

### Step 5: Remove or Update Conflicting Records

**Important:** Check for existing A records or CNAME records for the root domain (`@`):

- If you see an existing **A record** for `@` pointing to a different IP (like GoDaddy's parking page), you can either:
  - **Delete it** (recommended if you're not using GoDaddy hosting)
  - **Update it** to one of GitHub's IPs (but you still need all 4 A records)

- If you see an existing **CNAME record** for `@`, you **must delete it** - you cannot have both A records and a CNAME for the root domain.

### Step 6: Verify Your DNS Records

After adding the records, your DNS table should show:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | @ | 185.199.108.153 | 600 |
| A | @ | 185.199.109.153 | 600 |
| A | @ | 185.199.110.153 | 600 |
| A | @ | 185.199.111.153 | 600 |
| CNAME | www | pgiacalo.github.io | 600 |

### Step 7: Wait for DNS Propagation

- DNS changes typically take **1-24 hours** to propagate globally
- Some regions may see changes within minutes, others may take longer
- You can check propagation status at: [dnschecker.org](https://dnschecker.org/#A/pcbtracer.com)

### Step 8: Verify DNS is Working

Once DNS has propagated, verify:

1. **Check DNS records:**
   ```bash
   dig pcbtracer.com +short
   # Should return the 4 GitHub IP addresses
   ```

2. **Or use online tools:**
   - [DNS Checker](https://dnschecker.org/#A/pcbtracer.com)
   - [What's My DNS](https://www.whatsmydns.net/#A/pcbtracer.com)

3. **Test the domain:**
   - Visit `http://pcbtracer.com` (HTTPS may not be available immediately)
   - GitHub will provision SSL certificate automatically (can take up to 24 hours)

## Troubleshooting

### "Name already exists" error
- You may have duplicate A records
- Delete the old ones and add the new GitHub IPs

### Domain not resolving
- Wait longer for DNS propagation (up to 48 hours)
- Clear your browser DNS cache
- Try accessing from a different network/device

### GoDaddy interface looks different
- GoDaddy updates their interface periodically
- Look for "DNS Management", "DNS Records", or "Manage DNS" options
- The record types (A, CNAME) should be the same regardless of interface

### Can't find DNS Management
- Some GoDaddy accounts may have DNS managed elsewhere
- Check if your domain uses GoDaddy nameservers
- If not, you'll need to configure DNS where your nameservers are hosted

## Next Steps

After DNS is configured:

1. **Add custom domain in GitHub:**
   - Go to repository Settings → Pages
   - Enter `pcbtracer.com` in Custom domain field
   - Click Save

2. **Deploy your site:**
   ```bash
   ./deploy-to-github-pages.sh
   ```

3. **Enable HTTPS (after DNS propagates):**
   - Return to GitHub Pages settings
   - Check "Enforce HTTPS" checkbox

## Important Notes

- **All 4 A records are required** - GitHub uses multiple IPs for load balancing and redundancy
- **TTL (Time To Live):** Lower values (600 seconds) mean faster updates but more DNS queries. Higher values (3600+) mean slower updates but fewer queries
- **DNS Propagation:** Can take 1-48 hours globally, but usually completes within 24 hours
- **HTTPS:** GitHub automatically provisions SSL certificates, but this happens after DNS propagates (may take additional time)

## Support

If you encounter issues:
- Check [GitHub Pages documentation](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site)
- Verify DNS records are correct using online DNS checkers
- Contact GoDaddy support if DNS management issues persist
