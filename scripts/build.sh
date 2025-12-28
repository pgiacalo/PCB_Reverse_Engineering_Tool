#!/usr/bin/env bash

# PCB Reverse Engineering Tool - Build Script
# This script builds the production bundle for the PCB Reverse Engineering Tool
# Usage: ./build.sh [base-path]
#   base-path: Optional base path for the build (e.g., "/PCB_Reverse_Engineering_Tool/")
#              If not provided, uses the base from vite.config.ts

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

BASE_PATH="${1:-}"

echo "🔧 Building PCB Reverse Engineering Tool..."
echo "📁 Project directory: $SCRIPT_DIR"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    if [[ -f "package-lock.json" ]]; then
        npm ci
    else
        npm install
    fi
    echo ""
fi

# Run TypeScript type checking
echo "🔍 Running TypeScript type check..."
npx --yes tsc -b
echo "✅ TypeScript check passed"
echo ""

# Build the production bundle
echo "🏗️  Building production bundle..."
if [[ -n "$BASE_PATH" ]]; then
    echo "   Using base path: ${BASE_PATH}"
    npx --yes vite build --base "${BASE_PATH}"
else
    echo "   Using base path from vite.config.ts"
    npx --yes vite build
fi
echo ""

# Check if build was successful
if [ -d "dist" ]; then
    echo "✅ Build completed successfully!"
    echo "📦 Output directory: dist/"
    echo ""
    
    # Show build output size
    if command -v du >/dev/null 2>&1; then
        DIST_SIZE=$(du -sh dist 2>/dev/null | cut -f1)
        echo "📊 Build size: $DIST_SIZE"
    fi
    
    echo ""
    echo "🚀 To preview the build locally, run:"
    echo "   npm run preview"
    echo ""
    echo "📝 To deploy to GitHub Pages, run:"
    echo "   ./build_and_deploy_to_github_pages.sh"
else
    echo "❌ Build failed - dist/ directory not found"
    exit 1
fi

