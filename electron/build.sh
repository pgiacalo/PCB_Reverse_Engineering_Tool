#!/bin/bash

# PCB Tracer - Electron Build Script
# Copyright (c) 2025 Philip L. Giacalone

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🔧 PCB Tracer - Electron Build Script"
echo "======================================"

# Check if we're in the electron directory
cd "$SCRIPT_DIR"

# Step 1: Build the web app
echo ""
echo "📦 Step 1: Building web app..."
cd "$PROJECT_ROOT"
npm run build

# Step 2: Copy built files to electron/app
echo ""
echo "📋 Step 2: Copying built files to electron/app..."
cd "$SCRIPT_DIR"
rm -rf app/*
mkdir -p app
cp -r "$PROJECT_ROOT/dist/"* app/

# Step 3: Install Electron dependencies if needed
if [ ! -d "node_modules" ]; then
  echo ""
  echo "📥 Step 3: Installing Electron dependencies..."
  npm install
else
  echo ""
  echo "✓ Step 3: Electron dependencies already installed"
fi

# Step 4: Build for the specified platform
PLATFORM=${1:-$(uname -s)}

echo ""
echo "🏗️  Step 4: Building Electron app for $PLATFORM..."

case "$PLATFORM" in
  Darwin|mac|macos)
    npm run build:mac
    ;;
  Linux|linux)
    npm run build:linux
    ;;
  MINGW*|MSYS*|win|windows)
    npm run build:win
    ;;
  all)
    echo "Building for all platforms..."
    npm run build:mac
    npm run build:win
    npm run build:linux
    ;;
  *)
    echo "Unknown platform: $PLATFORM"
    echo "Usage: ./build.sh [mac|linux|win|all]"
    exit 1
    ;;
esac

echo ""
echo "✅ Build complete! Check the 'release/' folder for your installer."
echo ""
ls -la release/ 2>/dev/null || echo "(No release files found yet)"
