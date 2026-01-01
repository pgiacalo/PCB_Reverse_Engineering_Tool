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
// Project Operations Module
// ============================================================================
// Core project operations: create, open, save, close

import React from 'react';
import { removeTimestampFromFilename } from '../fileOperations';
// ensureProjectIsolation available if needed from './projectIsolation'
import type { ProjectOperationResult, ProjectFileInfo } from './types';
import { isElectron, showDirectoryPicker as electronShowDirectoryPicker } from '../electronFileSystem';

/**
 * Create a new project with the specified name and parent directory
 * Creates project folder, subdirectories, and initial project file
 */
export async function createNewProject(
  projectName: string,
  parentDirHandle: FileSystemDirectoryHandle,
  ensureIsolation: () => Promise<void>,
  setProjectName: (name: string) => void,
  setProjectDirHandle: (handle: FileSystemDirectoryHandle | null) => void,
  setCurrentProjectFilePath: (path: string) => void,
  projectDirHandleRef: React.MutableRefObject<FileSystemDirectoryHandle | null>,
  buildProjectData: () => { project: any; timestamp: string },
  initializeDefaults: () => void,
  resetView: () => void,
  setIsBottomView: (isBottom: boolean) => void,
  setTransparency: (transparency: number) => void,
  configureAutoSave: (interval: number, projectName: string, projectDirHandle: FileSystemDirectoryHandle | null, closePromptDialog: boolean) => Promise<void>
): Promise<ProjectOperationResult> {
  const cleanProjectName = projectName.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  if (!cleanProjectName) {
    return { success: false, error: 'Please enter a valid project name.' };
  }

  // CRITICAL: Ensure complete project isolation before creating new project
  await ensureIsolation();

  // Create project folder with project name (NO timestamp)
  let projectDirHandle: FileSystemDirectoryHandle;
  try {
    projectDirHandle = await parentDirHandle.getDirectoryHandle(cleanProjectName, { create: true });
  } catch (e) {
    console.error('Failed to create project folder:', e);
    return { success: false, error: `Failed to create project folder "${cleanProjectName}". See console for details.` };
  }

  // Request permissions for the project directory
  // Note: queryPermission/requestPermission are part of File System Access API but not in standard TypeScript types
  try {
    const dirHandleAny = projectDirHandle as any;
    if (dirHandleAny.queryPermission) {
      const permission = await dirHandleAny.queryPermission({ mode: 'readwrite' });
      if (permission !== 'granted') {
        const requestResult = await dirHandleAny.requestPermission({ mode: 'readwrite' });
        if (requestResult !== 'granted') {
          return { success: false, error: 'Full access to the project directory is required to create and manage project files.' };
        }
      }
    }
  } catch (permError) {
    console.warn('Permission check failed (may not be supported in this browser):', permError);
    // Continue anyway
  }

  // Create standard subdirectories
  try {
    await projectDirHandle.getDirectoryHandle('history', { create: true });
    await projectDirHandle.getDirectoryHandle('images', { create: true });
    await projectDirHandle.getDirectoryHandle('datasheets', { create: true });
    await projectDirHandle.getDirectoryHandle('BOM', { create: true });
    await projectDirHandle.getDirectoryHandle('netlists', { create: true });
    console.log('Created project subdirectories: history, images, datasheets, BOM, netlists');
  } catch (e) {
    console.error('Failed to create project subdirectories:', e);
    // Continue anyway - subdirectories will be created when needed
  }

  // Store project name and directory handle
  setProjectName(cleanProjectName);
  setProjectDirHandle(projectDirHandle);
  projectDirHandleRef.current = projectDirHandle;

  // Initialize application defaults
  initializeDefaults();

  // Reset view
  resetView();
  setIsBottomView(false);
  setTransparency(0); // Show only top image

  // Save initial project file with project name + timestamp
  try {
    const { project, timestamp } = buildProjectData();
    const filename = `${cleanProjectName}_${timestamp}.json`;
    const json = JSON.stringify(project, null, 2);
    const blob = new Blob([json], { type: 'application/json' });

    const fileHandle = await projectDirHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();

    setCurrentProjectFilePath(filename);
    console.log(`New project created: ${cleanProjectName}/${filename}`);

    // Enable auto-save by default with 5 minute interval
    // Pass project name and directory handle directly to avoid timing issues with state updates
    await configureAutoSave(5, cleanProjectName, projectDirHandle, true);

    return {
      success: true,
      projectDirHandle,
      projectFileName: filename,
      projectName: cleanProjectName
    };
  } catch (e) {
    console.error('Failed to save new project:', e);
    return { success: false, error: 'Failed to save new project file. See console for details.' };
  }
}

/**
 * Open an existing project by selecting the project root directory
 * Automatically finds the most recent JSON file that starts with the directory name
 */
export async function openProject(
  ensureIsolation: () => Promise<void>,
  setProjectDirHandle: (handle: FileSystemDirectoryHandle | null) => void,
  setCurrentProjectFilePath: (path: string) => void,
  setProjectName: (name: string) => void,
  projectDirHandleRef: React.MutableRefObject<FileSystemDirectoryHandle | null>,
  isOpeningProjectRef: React.MutableRefObject<boolean>,
  loadProject: (project: any, dirHandle?: FileSystemDirectoryHandle | null) => Promise<void>,
  configureAutoSave: (interval: number, projectName: string, projectDirHandle: FileSystemDirectoryHandle | null, closePromptDialog: boolean) => Promise<void>,
  preSelectedDirHandle?: FileSystemDirectoryHandle | null
): Promise<ProjectOperationResult> {
  const w = window as any;
  
  let projectDirHandle: FileSystemDirectoryHandle;
  
  // If a directory handle is provided, use it (preserves user gesture)
  // Otherwise, show directory picker
  if (preSelectedDirHandle) {
    projectDirHandle = preSelectedDirHandle;
  } else {
    // Use Electron's native dialog if running in Electron, otherwise use browser API
    if (isElectron()) {
      try {
        projectDirHandle = await electronShowDirectoryPicker() as any;
      } catch (e) {
        if ((e as any)?.name === 'AbortError') {
          return { success: false, error: 'User cancelled directory selection.' };
        }
        throw e;
      }
    } else {
      if (typeof w.showDirectoryPicker !== 'function') {
        return { success: false, error: 'Directory picker is not supported in this browser.' };
      }

      try {
        // Request directory access with readwrite permissions
        projectDirHandle = await w.showDirectoryPicker({ mode: 'readwrite' });
      } catch (e) {
        if ((e as any)?.name === 'AbortError') {
          return { success: false, error: 'User cancelled directory selection.' };
        }
        throw e;
      }
    }
  }

  try {

    // Verify we have write access
    // Note: queryPermission/requestPermission are part of File System Access API but not in standard TypeScript types
    try {
      const dirHandleAny = projectDirHandle as any;
      if (dirHandleAny.queryPermission) {
        const permission = await dirHandleAny.queryPermission({ mode: 'readwrite' });
        if (permission !== 'granted') {
          const requestResult = await dirHandleAny.requestPermission({ mode: 'readwrite' });
          if (requestResult !== 'granted') {
            return { success: false, error: 'Full access to the project directory is required to open and manage project files.' };
          }
        }
      }
    } catch (permError) {
      console.warn('Permission check failed (may not be supported in this browser):', permError);
      // Continue anyway
    }

    // CRITICAL: Set flag BEFORE ensuring isolation to prevent useEffect from overwriting refs
    isOpeningProjectRef.current = true;

    // CRITICAL: Ensure complete project isolation before opening new project
    await ensureIsolation();

    // Find the most recent project JSON file that starts with the directory name
    const directoryName = projectDirHandle.name;
    let projectFileHandle: FileSystemFileHandle | null = null;
    let project: any = null;
    let projectFileName: string = '';

    try {
      // Collect all JSON files that start with the directory name
      const candidateFiles: ProjectFileInfo[] = [];
      // Note: entries() is part of File System Access API but not in standard TypeScript types
      const dirHandleAny = projectDirHandle as any;

      for await (const [name, handle] of dirHandleAny.entries()) {
        if (handle.kind === 'file' && name.toLowerCase().endsWith('.json')) {
          // Check if filename starts with directory name (case-insensitive)
          const nameWithoutExt = name.replace(/\.json$/i, '');
          if (nameWithoutExt.toLowerCase().startsWith(directoryName.toLowerCase())) {
            try {
              const file = await (handle as FileSystemFileHandle).getFile();
              candidateFiles.push({
                name,
                handle: handle as FileSystemFileHandle,
                lastModified: file.lastModified,
              });
            } catch (fileError) {
              console.warn(`Failed to read file ${name}:`, fileError);
              // Continue to next file
            }
          }
        }
      }

      if (candidateFiles.length === 0) {
        return { success: false, error: `No project file found in the selected directory that starts with "${directoryName}". Please ensure the project file name starts with the directory name.` };
      }

      // Sort by lastModified (most recent first) and select the first one
      candidateFiles.sort((a, b) => b.lastModified - a.lastModified);
      const selectedFile = candidateFiles[0];
      projectFileHandle = selectedFile.handle;
      projectFileName = selectedFile.name;

      const file = await projectFileHandle.getFile();
      const text = await file.text();
      project = JSON.parse(text);
      setCurrentProjectFilePath(projectFileName);

      if (candidateFiles.length > 1) {
        console.log(`Found ${candidateFiles.length} project files starting with "${directoryName}". Selected most recent: ${projectFileName}`);
      } else {
        console.log(`Found project file: ${projectFileName}`);
      }
    } catch (error) {
      console.error('Failed to find or open project file:', error);
      return { success: false, error: `Failed to open project file: ${error instanceof Error ? error.message : String(error)}. See console for details.` };
    }

    // Store directory handle and update refs
    setProjectDirHandle(projectDirHandle);
    projectDirHandleRef.current = projectDirHandle;

    // Create standard subdirectories if they don't exist
    try {
      await projectDirHandle.getDirectoryHandle('history', { create: true });
      await projectDirHandle.getDirectoryHandle('images', { create: true });
      await projectDirHandle.getDirectoryHandle('datasheets', { create: true });
      await projectDirHandle.getDirectoryHandle('BOM', { create: true });
      await projectDirHandle.getDirectoryHandle('netlists', { create: true });
      console.log('Created/verified project subdirectories: history, images, datasheets, BOM, netlists');
    } catch (e) {
      console.error('Failed to create/verify project subdirectories:', e);
      // Continue anyway
    }

    // Clear the flag after a short delay
    setTimeout(() => {
      isOpeningProjectRef.current = false;
    }, 1000);

    // Load the project
    await loadProject(project, projectDirHandle);

    // Determine project name
    let projectNameToUse: string;
    if (project.projectInfo?.name) {
      projectNameToUse = project.projectInfo.name;
    } else {
      // Use directory name as project name (remove timestamp if present)
      const nameWithoutTimestamp = removeTimestampFromFilename(directoryName);
      projectNameToUse = nameWithoutTimestamp.replace(/[^a-zA-Z0-9_-]/g, '_');
      if (!projectNameToUse) {
        // If directory name is invalid, use a sanitized version of the filename
        const fileNameWithoutExt = projectFileName.replace(/\.json$/i, '');
        projectNameToUse = removeTimestampFromFilename(fileNameWithoutExt).replace(/[^a-zA-Z0-9_-]/g, '_');
      }
    }

    if (!projectNameToUse) {
      return { success: false, error: 'Warning: Could not determine project name. Please ensure the project file or directory has a valid name.' };
    }

    setProjectName(projectNameToUse);

    // Configure auto-save if it was enabled in the project file
    // Pass projectNameToUse and projectDirHandle directly to avoid timing issues with state updates
    const wasAutoSaveEnabledInFile = project.autoSave?.enabled === true;
    if (wasAutoSaveEnabledInFile && project.autoSave?.interval) {
      await configureAutoSave(project.autoSave.interval, projectNameToUse, projectDirHandle, false);
    } else {
      // Default: enable auto-save with 5 minute interval
      await configureAutoSave(5, projectNameToUse, projectDirHandle, false);
    }

    return {
      success: true,
      projectDirHandle,
      projectFileName,
      projectName: projectNameToUse
    };
  } catch (error) {
    if ((error as any)?.name === 'AbortError') {
      return { success: false, error: 'User cancelled directory selection.' };
    }
    console.error('Failed to open project:', error);
    return { success: false, error: `Failed to open project: ${error instanceof Error ? error.message : String(error)}. See console for details.` };
  }
}

/**
 * Save the current project
 * Moves ALL old project JSON files from root to history/ before saving
 * After save, exactly 1 project JSON file remains in root directory
 */
export async function saveProject(
  projectDirHandle: FileSystemDirectoryHandle | null,
  projectName: string,
  buildProjectData: () => { project: any; timestamp: string },
  setCurrentProjectFilePath: (path: string) => void,
  setHasUnsavedChangesState: (hasChanges: boolean) => void,
  hasChangesSinceLastAutoSaveRef: React.MutableRefObject<boolean>
): Promise<ProjectOperationResult> {
  if (!projectDirHandle || !projectName) {
    return { success: false, error: 'No project directory or project name available. Please create a new project or open an existing project first.' };
  }

  try {
    const { project, timestamp } = buildProjectData();
    const json = JSON.stringify(project, null, 2);
    const blob = new Blob([json], { type: 'application/json' });

    // Get or create history directory
    let historyDirHandle: FileSystemDirectoryHandle | null = null;
    try {
      historyDirHandle = await projectDirHandle.getDirectoryHandle('history', { create: true });
    } catch (e) {
      console.error('Failed to get/create history directory:', e);
      // Continue with save even if history directory creation fails
    }

    // Remove any existing timestamp from project name and add new timestamp
    const projectNameWithoutExt = projectName.replace(/\.json$/i, '');
    const projectNameWithoutTimestamp = removeTimestampFromFilename(projectNameWithoutExt);
    const filename = `${projectNameWithoutTimestamp}_${timestamp}.json`;

    // Move ALL existing project JSON files from root to history before saving
    if (historyDirHandle) {
      try {
        const rootFiles: string[] = [];
        for await (const name of (projectDirHandle as any).keys()) {
          try {
            // Skip directories and the file we're about to create
            if (name === 'history' || name === 'images' || name === 'datasheets' || name === 'BOM' || name === 'netlists' || name === filename) {
              continue;
            }

            const fileHandle = await projectDirHandle.getFileHandle(name);
            const file = await fileHandle.getFile();

            // Only check .json files
            if (!name.endsWith('.json')) {
              continue;
            }

            // Read file content to check if it's a PCB project file
            const fileContent = await file.text();
            try {
              const parsed = JSON.parse(fileContent);
              // Check if this is a PCB project file (has version field)
              if (parsed.version) {
                rootFiles.push(name);
                console.log(`Save: Found PCB project file in root: ${name}`);
              }
            } catch (parseError) {
              // Not valid JSON, skip
              continue;
            }
          } catch (e) {
            // Skip if not a file or doesn't exist
            continue;
          }
        }

        // Move ALL existing project files to history
        for (const oldFilename of rootFiles) {
          try {
            const oldFileHandle = await projectDirHandle.getFileHandle(oldFilename);
            const oldFile = await oldFileHandle.getFile();
            const oldFileContent = await oldFile.text();

            // Write to history directory
            const historyFileHandle = await historyDirHandle.getFileHandle(oldFilename, { create: true });
            const historyWritable = await historyFileHandle.createWritable();
            await historyWritable.write(new Blob([oldFileContent], { type: 'application/json' }));
            await historyWritable.close();

            // Remove from root directory
            await projectDirHandle.removeEntry(oldFilename);
            console.log(`Save: Moved ${oldFilename} from root to history/`);
          } catch (e) {
            console.warn(`Save: Failed to move ${oldFilename} to history:`, e);
            // Continue with other files even if one fails
          }
        }
      } catch (e) {
        console.warn('Save: Error checking for old files in root:', e);
        // Continue with save even if moving old files fails
      }
    }

    // Save new file to root directory (exactly 1 file remains in root after save)
    const fileHandle = await projectDirHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    setCurrentProjectFilePath(filename);
    setHasUnsavedChangesState(false);
    hasChangesSinceLastAutoSaveRef.current = false;
    console.log(`Project saved successfully: ${projectName}/${filename}`);

    return {
      success: true,
      projectDirHandle,
      projectFileName: filename,
      projectName
    };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.error('Failed to save project:', e);
    return { success: false, error: `Failed to save project: ${errorMessage}. See console for details.` };
  }
}

/**
 * Close the current project
 * Saves if there are unsaved changes, then clears all state
 */
export async function closeProject(
  hasUnsavedChanges: () => boolean,
  saveProject: () => Promise<ProjectOperationResult>,
  ensureIsolation: () => Promise<void>
): Promise<ProjectOperationResult> {
  // Save if there are unsaved changes (no dialog)
  if (hasUnsavedChanges()) {
    console.log('Close Project: Unsaved changes detected, saving before close...');
    const saveResult = await saveProject();
    if (!saveResult.success) {
      return { success: false, error: `Failed to save before closing: ${saveResult.error}` };
    }
  }

  // Ensure complete isolation (clears all state)
  await ensureIsolation();

  return { success: true };
}
