# PCB Tracer - Electron Desktop App

This folder contains the Electron wrapper for PCB Tracer, allowing it to run as a native desktop application on macOS, Windows, and Linux.

## Prerequisites

- Node.js 18+ 
- npm or yarn
- The main web app must be built first (`npm run build` in parent directory)

## Quick Start

```bash
# Install dependencies
npm install

# Run in development mode (requires web app dev server running)
npm start

# Build for current platform
npm run build
```

## Build Commands

| Command | Description |
|---------|-------------|
| `npm start` | Run app in development mode |
| `npm run build` | Build for current platform |
| `npm run build:mac` | Build for macOS (dmg + zip) |
| `npm run build:win` | Build for Windows (installer + portable) |
| `npm run build:linux` | Build for Linux (AppImage + deb) |
| `npm run pack` | Create unpacked build (for testing) |
| `./build.sh` | Build for all platforms (default) |
| `./build.sh mac` | Build for macOS only |
| `./build.sh win` | Build for Windows only |
| `./build.sh linux` | Build for Linux only |
| `./build.sh all` | Build for all platforms |

## Project Structure

```
electron/
├── main.js          # Electron main process
├── preload.js       # Secure bridge between main and renderer
├── package.json     # Electron app configuration
├── build.sh         # Build script for all platforms
├── app/             # Built web app files (copied from ../dist)
├── resources/       # App icons and assets
│   ├── icon.icns    # macOS icon
│   ├── icon.ico     # Windows icon
│   └── icon.png     # Linux icon
└── release/         # Built installers (generated)
    ├── macos/       # macOS installers (dmg, zip)
    ├── windows/     # Windows installers (exe, portable)
    └── linux/       # Linux installers (AppImage, deb)
```

## Adding App Icons

Before building, add your app icons to the `resources/` folder:

1. **macOS**: `icon.icns` (512x512 or larger, .icns format)
2. **Windows**: `icon.ico` (256x256, .ico format)
3. **Linux**: `icon.png` (512x512, .png format)

You can use tools like [IconGenerator](https://appicon.co/) to create icons from a single PNG.

## Development Workflow

1. Start the web app dev server in the parent directory:
   ```bash
   cd ..
   npm run dev
   ```

2. In another terminal, start Electron:
   ```bash
   cd electron
   npm start
   ```

## Building for Distribution

### Using the Build Script (Recommended)

The `build.sh` script automates the entire build process:

```bash
cd electron
./build.sh          # Auto-detects current platform and builds for it
./build.sh mac       # Builds for macOS only
./build.sh win       # Builds for Windows only
./build.sh linux     # Builds for Linux only
./build.sh all       # Attempts to build for all platforms (may only create unpacked dirs)
```

The script will:
1. Build the web app
2. Copy files to `electron/app/`
3. Build Electron apps for the specified platform (defaults to current platform)
4. Organize outputs into platform-specific directories:
   - `release/macos/` - macOS installers (dmg, zip)
   - `release/windows/` - Windows installers (exe, portable)
   - `release/linux/` - Linux installers (AppImage, deb)

**Note**: By default, the script detects your current platform and builds only for that platform. This is because proper installers can only be built on their target platform. If you use `./build.sh all`, it will attempt to build for all platforms, but may only create unpacked directories (not installers) for platforms other than the one you're running on.

### Manual Build Process

1. Build the web app first:
   ```bash
   cd ..
   npm run build
   ```

2. Copy built files to Electron app folder:
   ```bash
   cp -r dist/* electron/app/
   ```

3. Build the Electron app:
   ```bash
   cd electron
   npm run build:mac  # or build:win or build:linux
   ```

4. Find your installers in `electron/release/` (organized by platform)

## Distribution Files

### What Users Need

**Windows:**
- **Installer (.exe)**: NSIS installer - users run this to install the app
- **Portable (.exe)**: Standalone executable - no installation required
- **Unpacked directory**: Contains all files including `PCB Tracer.exe` - for advanced users

**Linux:**
- **AppImage**: Standalone executable - works on most Linux distributions, no installation required
- **.deb package**: For Debian/Ubuntu-based systems - installs via package manager
- **Unpacked directory**: Contains all files - for advanced users

**macOS:**
- **.dmg file**: Disk image - users mount and drag the app to Applications
- **.zip file**: Compressed archive - alternative distribution method

### Blockmap Files

`.blockmap` files are metadata files used by `electron-updater` for efficient delta updates. They describe the contents of installer files, allowing the updater to download only changed portions of the app instead of the entire installer.

- **Keep them**: If you're using auto-updates, keep `.blockmap` files with their corresponding installer files
- **Not required**: Users don't need `.blockmap` files to install or run the app
- **Location**: They're automatically organized into platform-specific directories by the build script

### Cross-Platform Building

**Note**: Building Windows and Linux installers on macOS may only create unpacked directories, not installers. To create proper installers:

- **Windows**: Build on Windows or use a Windows CI/CD environment
- **Linux**: Build on Linux or use a Linux CI/CD environment
- **macOS**: Builds work natively on macOS

The unpacked directories contain all necessary files and can be distributed, but installers provide a better user experience.

## Auto-Updates

The app includes auto-update functionality via `electron-updater`. Updates are fetched from GitHub Releases. To enable:

1. Create a GitHub release with your built app
2. Tag releases with semantic versioning (e.g., `v3.1.0`)
3. The app will automatically check for and offer updates

## Code Signing (Production)

For production distribution, you should code sign your app:

### macOS
- Requires Apple Developer account
- Set `CSC_LINK` and `CSC_KEY_PASSWORD` environment variables

### Windows
- Requires code signing certificate
- Set `CSC_LINK` and `CSC_KEY_PASSWORD` environment variables

## Troubleshooting

**App won't start**: Make sure the `app/` folder contains the built web files.

**White screen**: Check the DevTools console (View → Toggle Developer Tools).

**File access issues**: Electron uses the same File System Access API as the web version.

## License

Copyright (c) 2025 Philip L. Giacalone. All Rights Reserved.

This software is proprietary and confidential. Unauthorized copying, modification, 
distribution, or use is strictly prohibited.
