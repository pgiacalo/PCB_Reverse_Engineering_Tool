# Security Incident Response - Exposed API Key

## Issue
Google Gemini API key was exposed in the repository.

## Where it was found
- Built file: `dist/assets/index-C-vS_iCM.js` (line 238)
- The key was embedded during the build process when Vite read the `.env` file
- The `dist` folder was committed to git with the key embedded

## Immediate Actions Required

### 1. REVOKE THE API KEY IMMEDIATELY
   - Go to: https://aistudio.google.com/apikey
   - Find and delete/revoke the exposed API key
   - Create a new API key if needed

### 2. Remove from Git History
   The key needs to be removed from git history. This requires rewriting history:
   
   ```bash
   # Option 1: Use git-filter-repo (recommended)
   pip install git-filter-repo
   git filter-repo --invert-paths --path dist/
   # Replace the actual key with REDACTED in history
   git filter-repo --replace-text <(echo 'YOUR_EXPOSED_KEY==>REDACTED')
   
   # Option 2: Use BFG Repo-Cleaner
   # Download from: https://rtyley.github.io/bfg-repo-cleaner/
   java -jar bfg.jar --replace-text passwords.txt
   
   # After cleaning, force push (WARNING: This rewrites history)
   git push origin --force --all
   ```

   **WARNING**: Rewriting git history will require all collaborators to re-clone the repository.

### 3. Verify .gitignore
   The `.gitignore` file already has:
   - `.env` (ignored)
   - `dist/` (ignored)
   
   These are correct and should prevent future commits.

### 4. Clean Local Build
   ```bash
   # Remove the dist folder
   rm -rf dist/
   
   # Rebuild without the key
   npm run build
   ```

## Prevention

1. **Never commit `.env` files** - Already in `.gitignore` ✓
2. **Never commit `dist` folder** - Already in `.gitignore` ✓
3. **Use environment variables** - Source code correctly uses `import.meta.env.VITE_GEMINI_API_KEY` ✓
4. **For GitHub Pages**: Users should enter their own API key in the UI (localStorage), not use build-time env vars

## Status
- ✅ Source code is secure (no hardcoded keys)
- ✅ `.gitignore` is properly configured
- ⚠️ Key needs to be revoked
- ⚠️ Git history needs to be cleaned
- ✅ `.env.example` updated to avoid false positives

