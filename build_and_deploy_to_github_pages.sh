#!/usr/bin/env bash

# Build the app and deploy the dist/ folder to the gh-pages branch.
# Guarantees the working copy ends on the main branch when finished.

set -euo pipefail

DEFAULT_BRANCH="main"

# Always return to main on exit (success or failure)
cleanup() {
  set +e
  git checkout "$DEFAULT_BRANCH" >/dev/null 2>&1 || true
}
trap cleanup EXIT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🔧 Building and deploying PCB Reverse Engineering Tool to GitHub Pages..."

# Ensure a clean working tree to avoid accidentally publishing uncommitted code
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "❌ Uncommitted changes detected. Please commit or stash them before deploying."
  exit 1
fi

# Switch to main branch (creates a consistent deployment baseline)
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD || echo '')"
if [[ "$CURRENT_BRANCH" != "$DEFAULT_BRANCH" ]]; then
  echo "➡️  Checking out $DEFAULT_BRANCH..."
  git checkout "$DEFAULT_BRANCH"
fi

echo "⬇️  Pulling latest changes..."
git pull --ff-only origin "$DEFAULT_BRANCH" || true

echo "📦 Installing dependencies..."
if [[ -f "package-lock.json" ]]; then
  npm ci
else
  npm install
fi

echo "🔗 Inspecting git remote to compute dynamic public URL..."
ORIGIN_URL="$(git remote get-url origin 2>/dev/null || echo)"
if [[ "$ORIGIN_URL" == http* ]]; then
  ORIGIN_OWNER="$(echo "$ORIGIN_URL" | sed -E 's#https?://github.com/([^/]+)/.*#\1#')"
  ORIGIN_REPO="$(echo "$ORIGIN_URL" | sed -E 's#https?://github.com/[^/]+/([^/]+)(\.git)?#\1#')"
elif [[ "$ORIGIN_URL" == git@github.com:* ]]; then
  ORIGIN_OWNER="$(echo "$ORIGIN_URL" | sed -E 's#git@github.com:([^/]+)/.*#\1#')"
  ORIGIN_REPO="$(echo "$ORIGIN_URL" | sed -E 's#git@github.com:[^/]+/([^/]+)(\.git)?#\1#')"
fi

BASE_PATH="/${ORIGIN_REPO}/"
PUBLIC_URL="https://${ORIGIN_OWNER}.github.io${BASE_PATH}"

echo "🏗️  Building production bundle with base: ${BASE_PATH}"
npx --yes tsc -b
npx --yes vite build --base "${BASE_PATH}"

echo "🚀 Preparing deployment target..."
# ORIGIN_URL/OWNER/REPO already determined above

TARGET_REPO="${GH_PAGES_REPO:-$ORIGIN_URL}"

echo "🚀 Deploying to gh-pages branch (repo: $TARGET_REPO)..."
# Use gh-pages directly so we can pass the repo target safely
npx --yes gh-pages -d dist -r "$TARGET_REPO"

echo "✅ Deployment complete."

# Public URL derived from remote
HOMEPAGE_URL="${PUBLIC_URL}"

echo "🌐 Your site should be available at:"
echo "   ${HOMEPAGE_URL}"
echo "📌 You are now on branch: $(git rev-parse --abbrev-ref HEAD)"

echo "⏳ Note: GitHub Pages may take 2–10 minutes (sometimes up to ~30) to deploy changes due to CDN caching."
echo "   If you don't see updates immediately, hard refresh (Cmd+Shift+R) or open in an incognito window."


