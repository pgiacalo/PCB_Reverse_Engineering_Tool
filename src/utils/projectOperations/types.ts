/**
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

// ============================================================================
// Project Operations Types
// ============================================================================

export interface ProjectOperationResult {
  success: boolean;
  error?: string;
  projectDirHandle?: FileSystemDirectoryHandle;
  projectFileName?: string;
  projectName?: string;
}

export interface ProjectFileInfo {
  name: string;
  handle: FileSystemFileHandle;
  lastModified: number;
}

export interface AutoSaveConfig {
  enabled: boolean;
  interval: number; // in minutes
  baseName: string;
  dirHandle: FileSystemDirectoryHandle | null;
}

export interface ProjectState {
  projectName: string;
  projectDirHandle: FileSystemDirectoryHandle | null;
  currentProjectFilePath: string;
  autoSaveEnabled: boolean;
  autoSaveInterval: number | null;
  autoSaveBaseName: string;
}
