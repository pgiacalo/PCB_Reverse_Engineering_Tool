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

# Step 4: Clean up previous builds
echo ""
echo "🧹 Step 4: Cleaning up previous builds..."
rm -rf release/macos release/windows release/linux
mkdir -p release/macos release/windows release/linux

# Step 5: Build for the specified platform(s)
PLATFORM=${1:-all}

echo ""
echo "🏗️  Step 5: Building Electron app for $PLATFORM..."

build_mac() {
  echo ""
  echo "🍎 Building for macOS..."
  npm run build:mac
  # Organize macOS outputs
  if [ -d "release" ]; then
    mkdir -p release/macos
    (
      cd release
      # Move macOS installer files (dmg, zip) - handle files with spaces
      shopt -s nullglob
      for file in *.dmg *.zip; do
        [ -f "$file" ] && mv "$file" macos/ 2>/dev/null || true
      done
      # Move macOS unpacked directories (mac, mac-x64, mac-arm64, etc.)
      for dir in mac mac-* *mac*; do
        [ -d "$dir" ] && [ "$dir" != "macos" ] && mv "$dir" macos/ 2>/dev/null || true
      done
      shopt -u nullglob
    )
  fi
}

build_windows() {
  echo ""
  echo "🪟 Building for Windows..."
  npm run build:win
  # Organize Windows outputs
  if [ -d "release" ]; then
    mkdir -p release/windows
    (
      cd release
      # Move Windows installer files (exe, portable exe) - handle files with spaces
      shopt -s nullglob
      for file in *.exe *.7z; do
        [ -f "$file" ] && mv "$file" windows/ 2>/dev/null || true
      done
      # Move Windows unpacked directories (win-unpacked, win-ia32-unpacked, win-x64-unpacked, etc.)
      for dir in win* *win*; do
        [ -d "$dir" ] && [ "$dir" != "windows" ] && mv "$dir" windows/ 2>/dev/null || true
      done
      shopt -u nullglob
    )
  fi
}

build_linux() {
  echo ""
  echo "🐧 Building for Linux..."
  npm run build:linux
  # Organize Linux outputs
  if [ -d "release" ]; then
    mkdir -p release/linux
    (
      cd release
      # Move Linux installer files (AppImage, deb) - handle files with spaces
      shopt -s nullglob
      for file in *.AppImage *.deb; do
        [ -f "$file" ] && mv "$file" linux/ 2>/dev/null || true
      done
      # Move Linux unpacked directories (linux-unpacked, linux-x64-unpacked, etc.)
      for dir in linux* *linux*; do
        [ -d "$dir" ] && [ "$dir" != "linux" ] && mv "$dir" linux/ 2>/dev/null || true
      done
      shopt -u nullglob
    )
  fi
}

case "$PLATFORM" in
  Darwin|mac|macos)
    build_mac
    ;;
  Linux|linux)
    build_linux
    ;;
  MINGW*|MSYS*|win|windows)
    build_windows
    ;;
  all)
    echo "Building for all platforms..."
    build_mac
    build_windows
    build_linux
    ;;
  *)
    echo "Unknown platform: $PLATFORM"
    echo "Usage: ./build.sh [mac|linux|win|all]"
    echo "Default: all (builds for all platforms)"
    exit 1
    ;;
esac

echo ""
echo "✅ Build complete! Check the platform-specific folders:"
echo ""
echo "📁 macOS:   release/macos/"
echo "📁 Windows: release/windows/"
echo "📁 Linux:   release/linux/"
echo ""
for dir in release/macos release/windows release/linux; do
  if [ -d "$dir" ] && [ "$(ls -A $dir 2>/dev/null)" ]; then
    echo "Files in $dir:"
    ls -lh "$dir" | tail -n +2 | awk '{print "  " $9 " (" $5 ")"}'
    echo ""
  fi
done
