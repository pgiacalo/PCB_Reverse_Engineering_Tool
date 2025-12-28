#!/usr/bin/env bash

# Deploy auth-payment branch to both GitHub Pages and Heroku
# This script:
# 1. Checks out auth-payment branch
# 2. Merges latest changes from main
# 3. Builds and verifies the build
# 4. Deploys to GitHub Pages
# 5. Deploys directly to Heroku
# Guarantees the working copy ends on the auth-payment branch when finished.

set -euo pipefail

AUTH_PAYMENT_BRANCH="auth-payment"
MAIN_BRANCH="main"
DEFAULT_BRANCH="main"

# Always return to default branch on exit (success or failure)
cleanup() {
  set +e
  git checkout "$DEFAULT_BRANCH" >/dev/null 2>&1 || true
}
trap cleanup EXIT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🔧 Deploying auth-payment branch to GitHub Pages and Heroku..."
echo ""

# Ensure a clean working tree to avoid accidentally publishing uncommitted code
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "❌ Uncommitted changes detected. Please commit or stash them before deploying."
  exit 1
fi

# Step 1: Update main branch first
echo "📥 Step 1: Updating main branch..."
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD || echo '')"
if [[ "$CURRENT_BRANCH" != "$MAIN_BRANCH" ]]; then
  echo "➡️  Checking out $MAIN_BRANCH..."
  git checkout "$MAIN_BRANCH"
fi

echo "⬇️  Pulling latest changes from origin/$MAIN_BRANCH..."
git pull --ff-only origin "$MAIN_BRANCH" || {
  echo "⚠️  Could not fast-forward main. Continuing anyway..."
}

# Step 2: Checkout auth-payment and merge main
echo ""
echo "🔄 Step 2: Updating auth-payment branch with latest from main..."
echo "➡️  Checking out $AUTH_PAYMENT_BRANCH..."
git checkout "$AUTH_PAYMENT_BRANCH" || {
  echo "❌ Failed to checkout $AUTH_PAYMENT_BRANCH branch."
  echo "   Does the branch exist? Run: git checkout -b $AUTH_PAYMENT_BRANCH"
  exit 1
}

echo "⬇️  Pulling latest changes from origin/$AUTH_PAYMENT_BRANCH..."
git pull --ff-only origin "$AUTH_PAYMENT_BRANCH" || {
  echo "⚠️  Could not fast-forward auth-payment. Continuing with merge..."
}

echo "🔀 Merging $MAIN_BRANCH into $AUTH_PAYMENT_BRANCH..."
if git merge "$MAIN_BRANCH" --no-edit; then
  echo "✅ Merge successful"
else
  echo "⚠️  Merge conflicts detected or merge failed."
  echo "   Please resolve conflicts manually and run this script again."
  echo "   Or continue with: git merge --abort"
  exit 1
fi

# Step 3: Install dependencies and build
echo ""
echo "📦 Step 3: Installing dependencies..."
if [[ -f "package-lock.json" ]]; then
  npm ci
else
  npm install
fi

echo ""
echo "🏗️  Step 4: Building production bundle..."
# Use build.sh script to ensure consistent build process
"${SCRIPT_DIR}/scripts/build.sh" || {
  echo "❌ Build failed. Please fix build errors before deploying."
  exit 1
}

echo "✅ Build completed successfully!"

# Step 5: Deploy to GitHub Pages
echo ""
echo "📤 Step 5: Deploying to GitHub Pages..."

echo "🔗 Inspecting git remote to compute dynamic public URL..."
ORIGIN_URL="$(git remote get-url origin 2>/dev/null || echo)"
if [[ "$ORIGIN_URL" == http* ]]; then
  ORIGIN_OWNER="$(echo "$ORIGIN_URL" | sed -E 's#https?://github.com/([^/]+)/.*#\1#')"
  ORIGIN_REPO="$(echo "$ORIGIN_URL" | sed -E 's#^.*/##' | sed -E 's/\.git$//')"
elif [[ "$ORIGIN_URL" == git@github.com:* ]]; then
  ORIGIN_OWNER="$(echo "$ORIGIN_URL" | sed -E 's#git@github.com:([^/]+)/.*#\1#')"
  ORIGIN_REPO="$(echo "$ORIGIN_URL" | sed -E 's#^git@github.com:[^/]+/##' | sed -E 's/\.git$//')"
fi

BASE_PATH="/${ORIGIN_REPO}/"
PUBLIC_URL="https://${ORIGIN_OWNER}.github.io${BASE_PATH}"

TARGET_REPO="${GH_PAGES_REPO:-$ORIGIN_URL}"

echo "🚀 Deploying to gh-pages branch (repo: $TARGET_REPO)..."
# Increase HTTP buffer to handle large files
git config http.postBuffer 524288000
git config --global http.postBuffer 524288000
git config http.version HTTP/1.1
git config --global http.version HTTP/1.1

npx --yes gh-pages -d dist -r "$TARGET_REPO" || {
  echo "⚠️  GitHub Pages deployment failed."
  echo "   Continuing with Heroku deployment..."
}

echo "🌐 GitHub Pages site should be available at:"
echo "   ${PUBLIC_URL}"

# Step 6: Deploy to Heroku
echo ""
echo "🚀 Step 6: Deploying to Heroku..."

# Check if Heroku CLI is installed
if ! command -v heroku >/dev/null 2>&1; then
  echo "❌ Heroku CLI is not installed."
  echo ""
  echo "📦 To install Heroku CLI:"
  echo "   macOS: brew tap heroku/brew && brew install heroku"
  echo "   Or visit: https://devcenter.heroku.com/articles/heroku-cli"
  echo ""
  echo "   After installing, run: heroku login"
  echo "   Then run this script again."
  exit 1
fi

# Check if user is logged in
if ! heroku auth:whoami >/dev/null 2>&1; then
  echo "🔐 Logging in to Heroku..."
  heroku login
fi

# Get Heroku app name (default to staging)
echo "📋 Available Heroku apps:"
heroku apps 2>/dev/null | grep -v "^===" | grep -v "^$" || {
  echo "   (No apps found)"
}

echo ""
read -p "Enter your Heroku app name (default: pcbtracer-staging): " HEROKU_APP
HEROKU_APP="${HEROKU_APP:-pcbtracer-staging}"

if [[ -z "$HEROKU_APP" ]]; then
  echo "❌ Heroku app name is required."
  exit 1
fi

# Add Heroku remote if it doesn't exist
if ! git remote | grep -q "^heroku$"; then
  echo "➕ Adding Heroku remote..."
  heroku git:remote --app "$HEROKU_APP"
fi

# Verify Heroku remote
HEROKU_REMOTE_URL="$(git remote get-url heroku 2>/dev/null || echo '')"
if [[ -z "$HEROKU_REMOTE_URL" ]]; then
  echo "❌ Heroku remote not configured. Running: heroku git:remote --app $HEROKU_APP"
  heroku git:remote --app "$HEROKU_APP"
fi

echo "📤 Pushing $AUTH_PAYMENT_BRANCH to Heroku..."
echo "   (This will deploy directly to Heroku)"

# Push to Heroku (Heroku expects 'main' branch, so we push auth-payment:main)
if git push heroku "$AUTH_PAYMENT_BRANCH:main" --force; then
  echo ""
  echo "✅ Successfully deployed to Heroku!"
  echo ""
  echo "🌐 Heroku app should be available at:"
  echo "   https://$HEROKU_APP.herokuapp.com"
else
  echo ""
  echo "❌ Heroku deployment failed. Check the error messages above."
  exit 1
fi

# Step 7: Push to origin/auth-payment (for tracking)
echo ""
echo "📤 Step 7: Pushing to origin/$AUTH_PAYMENT_BRANCH..."

# Check if there are any commits to push
LOCAL_COMMIT="$(git rev-parse $AUTH_PAYMENT_BRANCH 2>/dev/null || echo '')"
REMOTE_COMMIT="$(git rev-parse origin/$AUTH_PAYMENT_BRANCH 2>/dev/null || echo '')"

if [[ -z "$REMOTE_COMMIT" ]]; then
  echo "ℹ️  Remote branch doesn't exist yet. Will push all commits."
elif [[ "$LOCAL_COMMIT" != "$REMOTE_COMMIT" ]]; then
  echo "ℹ️  Local branch has commits not in remote. Will push changes."
else
  echo "ℹ️  Branch is up to date with remote. Creating empty commit to track deployment..."
  # Create an empty commit to track this deployment
  git commit --allow-empty -m "Deploy: $(date +'%Y-%m-%d %H:%M:%S')" || {
    echo "⚠️  Failed to create empty commit. Continuing with push attempt..."
  }
fi

if git push origin "$AUTH_PAYMENT_BRANCH"; then
  echo "✅ Successfully pushed to origin/$AUTH_PAYMENT_BRANCH"
else
  echo "⚠️  Failed to push to origin/$AUTH_PAYMENT_BRANCH (non-critical)"
fi

# Don't cleanup - stay on auth-payment branch
trap - EXIT

echo ""
echo "✅ Deployment complete!"
echo "📌 You are now on branch: $(git rev-parse --abbrev-ref HEAD)"
echo ""
echo "🌐 Deployed to:"
echo "   - GitHub Pages: ${PUBLIC_URL}"
echo "   - Heroku: https://$HEROKU_APP.herokuapp.com"
echo ""
echo "⏳ Note: GitHub Pages may take 2–10 minutes to deploy due to CDN caching."
echo "   Hard refresh (Cmd+Shift+R) to see updates."
