#!/usr/bin/env bash

# Remove the GitHub Pages deployment by deleting the gh-pages branch
# (both remote and local). Leaves the working copy on the main branch.

set -euo pipefail

DEFAULT_BRANCH="main"

# Always return to main on exit
cleanup() {
  set +e
  git checkout "$DEFAULT_BRANCH" >/dev/null 2>&1 || true
}
trap cleanup EXIT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🛑 Undeploying GitHub Pages (removing gh-pages branch)..."

# Ensure we are not on gh-pages when attempting deletion
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD || echo '')"
if [[ "$CURRENT_BRANCH" == "gh-pages" ]]; then
  echo "➡️  Currently on gh-pages; switching to $DEFAULT_BRANCH first..."
  git checkout "$DEFAULT_BRANCH"
fi

echo "⬇️  Fetching remotes..."
git fetch origin --prune || true

# Parse origin for info messages
ORIGIN_URL="$(git remote get-url origin 2>/dev/null || echo)"
if [[ "$ORIGIN_URL" == http* ]]; then
  OWNER="$(echo "$ORIGIN_URL" | sed -E 's#https?://github.com/([^/]+)/.*#\1#')"
  REPO="$(echo "$ORIGIN_URL" | sed -E 's#https?://github.com/[^/]+/([^/]+)(\.git)?#\1#')"
elif [[ "$ORIGIN_URL" == git@github.com:* ]]; then
  OWNER="$(echo "$ORIGIN_URL" | sed -E 's#git@github.com:([^/]+)/.*#\1#')"
  REPO="$(echo "$ORIGIN_URL" | sed -E 's#git@github.com:[^/]+/([^/]+)(\.git)?#\1#')"
else
  OWNER=""
  REPO=""
fi

# Delete remote gh-pages branch if it exists
if git ls-remote --exit-code --heads origin gh-pages >/dev/null 2>&1; then
  echo "🗑️  Deleting remote branch: origin/gh-pages"
  git push origin --delete gh-pages || true
else
  echo "ℹ️  No remote gh-pages branch found."
fi

# Delete local gh-pages branch if it exists
if git show-ref --verify --quiet refs/heads/gh-pages; then
  echo "🗑️  Deleting local branch: gh-pages"
  git branch -D gh-pages || true
else
  echo "ℹ️  No local gh-pages branch found."
fi

echo "✅ Undeploy complete."
if [[ -n "$OWNER" && -n "$REPO" ]]; then
  echo "   Previous public URL (now unpublished once cache clears): https://${OWNER}.github.io/${REPO}/"
fi
echo "📌 You are on branch: $(git rev-parse --abbrev-ref HEAD)"

echo "⏳ Note: GitHub Pages may take 2–10 minutes (sometimes up to ~30) to fully unpublish due to CDN caching."
echo "   Try a hard refresh (Cmd+Shift+R) or an incognito window if the page still appears."


