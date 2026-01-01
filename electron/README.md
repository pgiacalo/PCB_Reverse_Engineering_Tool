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

## Project Structure

```
electron/
├── main.js          # Electron main process
├── preload.js       # Secure bridge between main and renderer
├── package.json     # Electron app configuration
├── app/             # Built web app files (copied from ../dist)
├── resources/       # App icons and assets
│   ├── icon.icns    # macOS icon
│   ├── icon.ico     # Windows icon
│   └── icon.png     # Linux icon
└── release/         # Built installers (generated)
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

4. Find your installer in `electron/release/`

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
