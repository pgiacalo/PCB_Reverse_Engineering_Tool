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

echo "🏗️  Building production bundle..."
npm run build

echo "🚀 Deploying to gh-pages branch..."
npm run deploy

echo "✅ Deployment complete. Your site should be available at:"
echo "   https://pgiacalo.github.io/PCB_Reverse_Engineering_Tool/"
echo "📌 You are now on branch: $(git rev-parse --abbrev-ref HEAD)"


