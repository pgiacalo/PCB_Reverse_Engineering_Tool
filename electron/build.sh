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
      # Find and move all dmg and zip files (macOS installers)
      for file in *"PCB Tracer"*.dmg *"pcb-tracer"*.dmg *.dmg; do
        if [ -f "$file" ] && [ "$file" != "*.dmg" ]; then
          mv "$file" macos/ 2>/dev/null || true
        fi
      done
      for file in *"PCB Tracer"*"mac"*.zip *"pcb-tracer"*"mac"*.zip *"mac"*.zip; do
        if [ -f "$file" ] && [ "$file" != "*.zip" ]; then
          mv "$file" macos/ 2>/dev/null || true
        fi
      done
      # Move macOS blockmap files
      for file in *"PCB Tracer"*.blockmap *"pcb-tracer"*.blockmap; do
        if [ -f "$file" ] && [ "$file" != "*.blockmap" ]; then
          # Check if it's a macOS file (dmg or mac.zip)
          if [[ "$file" == *"dmg"* ]] || [[ "$file" == *"mac"* ]]; then
            mv "$file" macos/ 2>/dev/null || true
          fi
        fi
      done
      # Move macOS metadata files
      for file in latest-mac.yml; do
        if [ -f "$file" ]; then
          mv "$file" macos/ 2>/dev/null || true
        fi
      done
      # Move macOS unpacked directories (mac, mac-x64, mac-arm64, etc.)
      for dir in mac mac-x64 mac-arm64 mac-universal; do
        if [ -d "$dir" ]; then
          mv "$dir" macos/ 2>/dev/null || true
        fi
      done
      # Also catch any other mac-* directories
      for dir in mac-*; do
        if [ -d "$dir" ] && [ "$dir" != "macos" ] && [[ "$dir" == mac-* ]]; then
          mv "$dir" macos/ 2>/dev/null || true
        fi
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
      # Find and move all .exe files (installers and portable)
      for file in *"PCB Tracer"*.exe *"pcb-tracer"*.exe *.exe; do
        if [ -f "$file" ] && [ "$file" != "*.exe" ]; then
          mv "$file" windows/ 2>/dev/null || true
        fi
      done
      # Move Windows blockmap files
      for file in *"PCB Tracer"*.blockmap *"pcb-tracer"*.blockmap; do
        if [ -f "$file" ] && [ "$file" != "*.blockmap" ]; then
          # Check if it's a Windows file (not macOS)
          if [[ "$file" != *"mac"* ]] && [[ "$file" != *"dmg"* ]]; then
            mv "$file" windows/ 2>/dev/null || true
          fi
        fi
      done
      # Move Windows unpacked directories (win-unpacked, win-ia32-unpacked, win-x64-unpacked, etc.)
      for dir in win-unpacked win-ia32-unpacked win-x64-unpacked win-arm64-unpacked; do
        if [ -d "$dir" ]; then
          mv "$dir" windows/ 2>/dev/null || true
        fi
      done
      # Also catch any other win-* directories
      for dir in win-*; do
        if [ -d "$dir" ] && [ "$dir" != "windows" ] && [[ "$dir" == win-* ]]; then
          mv "$dir" windows/ 2>/dev/null || true
        fi
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
      # Find and move all AppImage and deb files
      for file in *"PCB Tracer"*.AppImage *"pcb-tracer"*.AppImage *.AppImage; do
        if [ -f "$file" ] && [ "$file" != "*.AppImage" ]; then
          mv "$file" linux/ 2>/dev/null || true
        fi
      done
      for file in *"PCB Tracer"*.deb *"pcb-tracer"*.deb *.deb; do
        if [ -f "$file" ] && [ "$file" != "*.deb" ]; then
          mv "$file" linux/ 2>/dev/null || true
        fi
      done
      # Move Linux blockmap files
      for file in *"PCB Tracer"*.blockmap *"pcb-tracer"*.blockmap; do
        if [ -f "$file" ] && [ "$file" != "*.blockmap" ]; then
          # Check if it's a Linux file (AppImage or deb related)
          if [[ "$file" == *"AppImage"* ]] || [[ "$file" == *"deb"* ]]; then
            mv "$file" linux/ 2>/dev/null || true
          fi
        fi
      done
      # Move Linux unpacked directories (linux-unpacked, linux-x64-unpacked, etc.)
      for dir in linux-unpacked linux-ia32-unpacked linux-x64-unpacked linux-arm64-unpacked; do
        if [ -d "$dir" ]; then
          mv "$dir" linux/ 2>/dev/null || true
        fi
      done
      # Also catch any other linux-* directories
      for dir in linux-*; do
        if [ -d "$dir" ] && [ "$dir" != "linux" ] && [[ "$dir" == linux-* ]]; then
          mv "$dir" linux/ 2>/dev/null || true
        fi
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

# Step 6: Clean up builder config files
echo ""
echo "🧹 Step 6: Cleaning up build artifacts..."
(
  cd release
  # Remove builder config files (not needed for distribution)
  rm -f builder-debug.yml builder-effective-config.yaml 2>/dev/null || true
)

echo ""
echo "✅ Build complete! Check the platform-specific folders:"
echo ""
echo "📁 macOS:   release/macos/"
echo "📁 Windows: release/windows/"
echo "📁 Linux:   release/linux/"
echo ""
echo "Note: .blockmap files are used by electron-updater for delta updates."
echo "      They should be kept with their corresponding installer files."
echo ""
for dir in release/macos release/windows release/linux; do
  if [ -d "$dir" ] && [ "$(ls -A $dir 2>/dev/null)" ]; then
    echo "Files in $dir:"
    ls -lh "$dir" 2>/dev/null | tail -n +2 | awk '{if (NF >= 9) print "  " $9 " (" $5 ")"; else if (NF >= 5) print "  " $NF " (" $5 ")"}'
    echo ""
  else
    echo "$dir: (empty - no files were built for this platform)"
    echo ""
  fi
done
