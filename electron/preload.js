/**
 * PCB Tracer - Electron Preload Script
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

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // App information
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // Platform detection
  platform: process.platform,
  isElectron: true,
  
  // Dialog APIs - Native Electron dialogs
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  
  // Directory picker for project folders
  showDirectoryPicker: () => ipcRenderer.invoke('show-directory-picker'),
  
  // File operations
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  readFileBinary: (filePath) => ipcRenderer.invoke('read-file-binary', filePath),
  writeFile: (filePath, data) => ipcRenderer.invoke('write-file', filePath, data),
  writeFileBinary: (filePath, base64Data) => ipcRenderer.invoke('write-file-binary', filePath, base64Data),
  readDir: (dirPath) => ipcRenderer.invoke('read-dir', dirPath),
  mkdir: (dirPath) => ipcRenderer.invoke('mkdir', dirPath),
  exists: (path) => ipcRenderer.invoke('exists', path),
  removeEntry: (path) => ipcRenderer.invoke('remove-entry', path),
  copyFile: (src, dest) => ipcRenderer.invoke('copy-file', src, dest),
  moveFile: (src, dest) => ipcRenderer.invoke('move-file', src, dest),
  
  // Get/set last used directory
  getLastDirectory: () => ipcRenderer.invoke('get-last-directory'),
  setLastDirectory: (dir) => ipcRenderer.invoke('set-last-directory', dir),
});

// Log that preload script has loaded
console.log('PCB Tracer: Electron preload script loaded (with native file dialogs)');
