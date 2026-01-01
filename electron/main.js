/**
 * PCB Tracer - Electron Main Process
 * Copyright (c) 2025 Philip L. Giacalone. All Rights Reserved.
 *
 * This software and associated documentation files (the "Software") are the
 * proprietary and confidential property of Philip L. Giacalone.
 *
 * Unauthorized copying, modification, distribution, or use of this Software,
 * via any medium, is strictly prohibited and may be subject to civil and
 * criminal penalties.
 *
 * The Software is protected by copyright laws and international copyright
 * treaties, as well as other intellectual property laws and treaties.
 */

const { app, BrowserWindow, Menu, shell, dialog, ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

// Keep a global reference of the window object to prevent garbage collection
let mainWindow = null;

// Determine if we're in development mode
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Get the correct path to app resources (works in both dev and packaged modes)
function getAppPath() {
  // app.getAppPath() returns the correct path in both dev and packaged modes
  return app.getAppPath();
}

/**
 * Create the main application window
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    title: 'PCB Tracer',
    icon: path.join(__dirname, 'resources', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      // Allow File System Access API to work
      webSecurity: true,
      allowRunningInsecureContent: false,
      // Enable experimental features for File System Access API
      experimentalFeatures: true,
    },
    // Use standard native title bar for proper window dragging
    titleBarStyle: 'default',
  });
  
  // Request file system permissions for macOS
  if (process.platform === 'darwin') {
    app.setAboutPanelOptions({
      applicationName: 'PCB Tracer',
      applicationVersion: app.getVersion(),
      copyright: '© 2025 Philip L. Giacalone',
    });
  }

  // Load the app
  if (isDev) {
    // In development, load from the Vite dev server
    mainWindow.loadURL('http://localhost:5173');
    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built files
    const appPath = getAppPath();
    const indexPath = path.join(appPath, 'app', 'index.html');
    console.log('Loading app from:', indexPath);
    mainWindow.loadFile(indexPath);
  }
  
  // Debug: Log any load errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });

  // Handle external links - open in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Handle window close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Create application menu
  createMenu();
}

/**
 * Create the application menu
 */
function createMenu() {
  const template = [
    // macOS app menu
    ...(process.platform === 'darwin' ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    // Edit menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    // View menu
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    // Window menu
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(process.platform === 'darwin' ? [
          { type: 'separator' },
          { role: 'front' }
        ] : [
          { role: 'close' }
        ])
      ]
    },
    // Help menu
    {
      label: 'Help',
      submenu: [
        {
          label: 'About PCB Tracer',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About PCB Tracer',
              message: 'PCB Tracer v' + app.getVersion(),
              detail: 'A PCB Reverse Engineering Tool\n\nCopyright © 2025 Philip L. Giacalone\n\nTrace and document PCB circuits with ease.',
              buttons: ['OK']
            });
          }
        },
        { type: 'separator' },
        {
          label: 'Support on Ko-fi',
          click: async () => {
            await shell.openExternal('https://ko-fi.com/onesmallstep');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

/**
 * Configure auto-updater
 * Note: Auto-updates are disabled until a public release server is configured
 */
function setupAutoUpdater() {
  // Auto-updater is disabled for now since the GitHub repo is private
  // To enable, set up a public release server or make the repo public
  console.log('Auto-updater: Disabled (private repository)');
  
  /* Uncomment this block when auto-updates are configured:
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Available',
      message: `A new version (${info.version}) is available. Would you like to download it now?`,
      buttons: ['Download', 'Later']
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.downloadUpdate();
      }
    });
  });

  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: 'Update downloaded. The application will restart to install the update.',
      buttons: ['Restart Now', 'Later']
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err);
  });

  // Check for updates after app is ready (not in development)
  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify();
  }
  */
}

// App lifecycle events
app.whenReady().then(() => {
  // Set up session permissions for File System Access API
  const { session } = require('electron');
  
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    // Allow all file system permissions
    const allowedPermissions = [
      'fileSystem',
      'clipboard-read',
      'clipboard-write',
      'media',
      'mediaKeySystem',
      'geolocation',
      'notifications',
      'fullscreen',
      'pointerLock'
    ];
    
    if (allowedPermissions.includes(permission)) {
      callback(true);
    } else {
      console.log('Permission requested:', permission);
      callback(true); // Allow all for now
    }
  });
  
  // Also handle permission check requests
  session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
    return true; // Allow all permission checks
  });

  createWindow();
  setupAutoUpdater();

  // macOS: Re-create window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Security: Prevent navigation to external URLs
app.on('web-contents-created', (event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    // Allow navigation only to local files or localhost in dev
    if (parsedUrl.protocol !== 'file:' && !navigationUrl.startsWith('http://localhost')) {
      event.preventDefault();
      shell.openExternal(navigationUrl);
    }
  });
});

// IPC handlers for renderer process communication
const fs = require('fs');
const fsPromises = require('fs').promises;

// Store last used directory
let lastUsedDirectory = app.getPath('documents');

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('show-open-dialog', async (event, options) => {
  return dialog.showOpenDialog(mainWindow, options);
});

ipcMain.handle('show-save-dialog', async (event, options) => {
  return dialog.showSaveDialog(mainWindow, options);
});

// Directory picker for project folders
ipcMain.handle('show-directory-picker', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select Project Folder',
    defaultPath: lastUsedDirectory,
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    lastUsedDirectory = result.filePaths[0];
    return { path: result.filePaths[0], canceled: false };
  }
  return { path: null, canceled: true };
});

// File operations
ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const data = await fsPromises.readFile(filePath, 'utf-8');
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Read binary file (for images)
ipcMain.handle('read-file-binary', async (event, filePath) => {
  try {
    const buffer = await fsPromises.readFile(filePath);
    // Convert to base64 for transfer to renderer
    const base64 = buffer.toString('base64');
    // Determine MIME type from extension
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
      '.svg': 'image/svg+xml',
    };
    const mimeType = mimeTypes[ext] || 'application/octet-stream';
    return { success: true, data: base64, mimeType };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('write-file', async (event, filePath, data) => {
  try {
    await fsPromises.writeFile(filePath, data, 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Write binary file (for images) - data should be base64 encoded
ipcMain.handle('write-file-binary', async (event, filePath, base64Data) => {
  try {
    const buffer = Buffer.from(base64Data, 'base64');
    await fsPromises.writeFile(filePath, buffer);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('read-dir', async (event, dirPath) => {
  try {
    const entries = await fsPromises.readdir(dirPath, { withFileTypes: true });
    return { 
      success: true, 
      entries: entries.map(e => ({ 
        name: e.name, 
        isDirectory: e.isDirectory(),
        isFile: e.isFile()
      }))
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('mkdir', async (event, dirPath) => {
  try {
    await fsPromises.mkdir(dirPath, { recursive: true });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('exists', async (event, filePath) => {
  try {
    await fsPromises.access(filePath);
    return true;
  } catch {
    return false;
  }
});

// Delete a file or directory
ipcMain.handle('remove-entry', async (event, entryPath) => {
  try {
    const stats = await fsPromises.stat(entryPath);
    if (stats.isDirectory()) {
      await fsPromises.rmdir(entryPath, { recursive: true });
    } else {
      await fsPromises.unlink(entryPath);
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Copy a file
ipcMain.handle('copy-file', async (event, sourcePath, destPath) => {
  try {
    await fsPromises.copyFile(sourcePath, destPath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Move/rename a file
ipcMain.handle('move-file', async (event, sourcePath, destPath) => {
  try {
    await fsPromises.rename(sourcePath, destPath);
    return { success: true };
  } catch (error) {
    // If rename fails (cross-device), try copy + delete
    try {
      await fsPromises.copyFile(sourcePath, destPath);
      await fsPromises.unlink(sourcePath);
      return { success: true };
    } catch (copyError) {
      return { success: false, error: copyError.message };
    }
  }
});

ipcMain.handle('get-last-directory', () => {
  return lastUsedDirectory;
});

ipcMain.handle('set-last-directory', (event, dir) => {
  lastUsedDirectory = dir;
  return true;
});
