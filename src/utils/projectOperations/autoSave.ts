/**
 * Copyright (c) 2025 Philip L. Giacalone
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

// ============================================================================
// Auto-Save Module
// ============================================================================
// Auto-save functionality with default 5 minute interval
// Moves ALL old project JSON files to history/ before saving
// After auto-save, exactly 1 project JSON file remains in root directory

import React from 'react';
import { removeTimestampFromFilename } from '../fileOperations';
import type { DrawingStroke } from '../../hooks/useDrawing';

/**
 * Perform auto-save operation
 * Moves ALL old project JSON files from root to history/ before saving
 */
export async function performAutoSave(
  dirHandle: FileSystemDirectoryHandle | null,
  baseName: string,
  hasChangesSinceLastAutoSaveRef: React.MutableRefObject<boolean>,
  drawingStrokesRef: React.MutableRefObject<DrawingStroke[]>,
  setDrawingStrokes: (strokes: DrawingStroke[]) => void,
  buildProjectData: () => { project: any; timestamp: string },
  setCurrentProjectFilePath: (path: string) => void,
  currentProjectFilePathRef: React.MutableRefObject<string>,
  setAutoSaveFileHistory: (history: string[]) => void,
  autoSaveFileHistoryRef: React.MutableRefObject<string[]>,
  setCurrentFileIndex: (index: number) => void,
  currentFileIndexRef: React.MutableRefObject<number>,
  setHasUnsavedChangesState: (hasChanges: boolean) => void,
  setAutoSaveEnabled: (enabled: boolean) => void,
  autoSaveIntervalRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>
): Promise<void> {
  console.log('Auto save: performAutoSave called');

  if (!dirHandle || !baseName) {
    console.warn(`Auto save: Missing project directory handle (${!dirHandle}) or base name (${!baseName}). Please create a new project or open an existing project first.`);
    // Disable auto save if configuration is incomplete
    setAutoSaveEnabled(false);
    if (autoSaveIntervalRef.current) {
      clearInterval(autoSaveIntervalRef.current);
      autoSaveIntervalRef.current = null;
    }
    return;
  }

  // Only save if there have been changes since the last save
  if (!hasChangesSinceLastAutoSaveRef.current) {
    console.log('Auto save: Skipping - no changes since last save');
    return;
  }

  // Clean up single-point traces before saving
  const currentDrawingStrokes = drawingStrokesRef.current;
  const singlePointTraces = currentDrawingStrokes.filter(s => s.type === 'trace' && s.points.length < 2);
  if (singlePointTraces.length > 0) {
    console.log(`Auto save: Cleaning up ${singlePointTraces.length} single-point trace(s) before save`);
    singlePointTraces.forEach(s => console.log(`  - Removing single-point trace ${s.id}`));
    const cleanedDrawingStrokes = currentDrawingStrokes.filter(s => {
      if (s.type === 'trace' && s.points.length < 2) {
        return false; // Remove single-point traces
      }
      return true; // Keep vias and valid traces
    });
    // Update state to remove single-point traces
    setDrawingStrokes(cleanedDrawingStrokes);
    // Update ref immediately so buildProjectData uses cleaned version
    drawingStrokesRef.current = cleanedDrawingStrokes;
  }

  console.log('Auto save: Starting save...');
  const { project, timestamp } = buildProjectData();
  // Remove any existing timestamp from baseName before appending new timestamp
  const cleanBaseName = removeTimestampFromFilename(baseName);
  const filename = `${cleanBaseName}_${timestamp}.json`;
  const json = JSON.stringify(project, null, 2);
  const blob = new Blob([json], { type: 'application/json' });

  try {
    // Get or create history directory
    let historyDirHandle: FileSystemDirectoryHandle;
    try {
      historyDirHandle = await dirHandle.getDirectoryHandle('history', { create: true });
    } catch (e) {
      console.error('Failed to get/create history directory:', e);
      return;
    }

    // Before saving new file, move ALL existing project JSON files from root to history/
    try {
      const rootFiles: string[] = [];
      const currentFilePath = currentProjectFilePathRef.current;

      for await (const name of (dirHandle as any).keys()) {
        try {
          // Skip directories and the file we're about to create
          if (name === 'history' || name === 'images' || name === 'datasheets' || name === 'BOM' || name === 'netlists' || name === filename) {
            continue;
          }

          const fileHandle = await dirHandle.getFileHandle(name);
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
            // Move ALL project files to history (both auto-saved and manually saved)
            if (parsed.version) {
              rootFiles.push(name);
              const fileType = parsed.fileType ? 'auto-saved' : 'manually saved/opened';
              const isOpenedFile = name === currentFilePath;
              console.log(`Auto save: Found PCB project file in root: ${name} (${fileType}${isOpenedFile ? ' - this is the opened file' : ''})`);
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

      // Move ALL existing project files from root to history
      for (const oldFilename of rootFiles) {
        try {
          const oldFileHandle = await dirHandle.getFileHandle(oldFilename);
          const oldFile = await oldFileHandle.getFile();
          const oldFileContent = await oldFile.text();

          // Write to history directory
          const historyFileHandle = await historyDirHandle.getFileHandle(oldFilename, { create: true });
          const historyWritable = await historyFileHandle.createWritable();
          await historyWritable.write(new Blob([oldFileContent], { type: 'application/json' }));
          await historyWritable.close();

          // Remove from root directory
          await dirHandle.removeEntry(oldFilename);
          console.log(`Auto save: Moved ${oldFilename} from root to history/`);
        } catch (e) {
          console.warn(`Auto save: Failed to move ${oldFilename} to history:`, e);
          // Continue with other files even if one fails
        }
      }
    } catch (e) {
      console.warn('Auto save: Error checking for old files in root:', e);
      // Continue with save even if moving old files fails
    }

    // Save new file to root directory (exactly 1 file remains in root after save)
    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    console.log(`Auto save: Successfully saved ${filename} to root directory`);

    // Update the displayed file path to reflect the current auto-saved file
    setCurrentProjectFilePath(filename);  // Update state to trigger UI re-render
    currentProjectFilePathRef.current = filename;
    // Refresh file history and update index
    const history = autoSaveFileHistoryRef.current;
    const newHistory = [filename, ...history.filter(f => f !== filename)].sort((a, b) => b.localeCompare(a));
    setAutoSaveFileHistory(newHistory);
    autoSaveFileHistoryRef.current = newHistory;
    setCurrentFileIndex(0); // Newest file is at index 0
    currentFileIndexRef.current = 0;
    // Reset the changes flag after successful save
    hasChangesSinceLastAutoSaveRef.current = false;
    // Clear the save status indicator (project is saved - green)
    // This is the ONLY user feedback for auto-save - no alerts should be shown
    setHasUnsavedChangesState(false);
  } catch (e) {
    console.error('Auto save failed:', e);
    // Don't clear indicator on failure - keep showing that changes exist
  }
}

/**
 * Configure auto-save with specified interval
 * Default: ON with 5 minute interval
 */
export async function configureAutoSave(
  interval: number | null,
  projectName: string,
  projectDirHandle: FileSystemDirectoryHandle | null,
  setAutoSaveEnabled: (enabled: boolean) => void,
  setAutoSaveInterval: (interval: number | null) => void,
  setAutoSaveDirHandle: (handle: FileSystemDirectoryHandle | null) => void,
  setAutoSaveBaseName: (name: string) => void,
  autoSaveDirHandleRef: React.MutableRefObject<FileSystemDirectoryHandle | null>,
  autoSaveBaseNameRef: React.MutableRefObject<string>,
  autoSaveIntervalRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>,
  hasChangesSinceLastAutoSaveRef: React.MutableRefObject<boolean>,
  setAutoSaveDialog: (dialog: { visible: boolean; interval: number | null }) => void,
  setAutoSavePromptDialog: (dialog: { visible: boolean; source: 'new' | 'open' | null; interval: number }) => void,
  setProjectDirHandle: (handle: FileSystemDirectoryHandle | null) => void,
  performAutoSaveRef: React.MutableRefObject<(() => Promise<void>) | null>,
  closePromptDialog: boolean = false
): Promise<void> {
  // If interval is null, disable auto-save
  if (interval === null) {
    setAutoSaveEnabled(false);
    setAutoSaveInterval(null);
    if (autoSaveIntervalRef.current) {
      clearInterval(autoSaveIntervalRef.current);
      autoSaveIntervalRef.current = null;
    }
    setAutoSaveDialog({ visible: false, interval: 5 });
    if (closePromptDialog) {
      setAutoSavePromptDialog({ visible: false, source: null, interval: 5 });
    }
    console.log('Auto save: Disabled');
    return;
  }

  // Use project name (should be set from New Project or Open Project)
  if (!projectName) {
    console.warn('Auto save: No project name available. Please create a new project or open an existing project first.');
    return;
  }

  // Use project directory for auto-save (same directory as project.json)
  let dirHandleToUse = projectDirHandle;
  if (!dirHandleToUse) {
    // This should only happen in fallback scenarios
    const w = window as any;
    if (typeof w.showDirectoryPicker === 'function') {
      try {
        dirHandleToUse = await w.showDirectoryPicker();
        setProjectDirHandle(dirHandleToUse);
      } catch (e) {
        if ((e as any)?.name !== 'AbortError') {
          console.error('Failed to get directory:', e);
        }
        return; // User cancelled
      }
    } else {
      console.warn('Directory picker is not supported in this browser. Auto-save requires a directory handle.');
      return;
    }
  }

  // Use project directory for auto-save (same directory as project.json)
  setAutoSaveDirHandle(dirHandleToUse);
  // Use project name as base name for auto-save files, removing any existing timestamp
  const projectNameWithoutExt = projectName.replace(/\.json$/i, '');
  const projectNameWithoutTimestamp = removeTimestampFromFilename(projectNameWithoutExt);
  const cleanBaseName = projectNameWithoutTimestamp.replace(/[^a-zA-Z0-9_-]/g, '_');
  setAutoSaveBaseName(cleanBaseName);

  // Update refs immediately so performAutoSave can use them
  autoSaveDirHandleRef.current = dirHandleToUse;
  autoSaveBaseNameRef.current = cleanBaseName;

  // Clear any existing interval
  if (autoSaveIntervalRef.current) {
    clearInterval(autoSaveIntervalRef.current);
    autoSaveIntervalRef.current = null;
  }

  // Set interval and enable auto-save
  setAutoSaveInterval(interval);
  setAutoSaveEnabled(true);

  // Mark that we have changes so initial save will happen
  hasChangesSinceLastAutoSaveRef.current = true;

  // Close dialogs
  setAutoSaveDialog({ visible: false, interval: 5 });
  if (closePromptDialog) {
    setAutoSavePromptDialog({ visible: false, source: null, interval: 5 });
  }

  // Set up interval timer (convert minutes to milliseconds)
  const intervalMs = interval * 60 * 1000;
  autoSaveIntervalRef.current = setInterval(() => {
    if (performAutoSaveRef.current) {
      performAutoSaveRef.current();
    }
  }, intervalMs);

  // Perform initial save immediately after state updates
  setTimeout(() => {
    console.log(`Auto save: Enabled with interval ${interval} minutes`);
    if (performAutoSaveRef.current) {
      performAutoSaveRef.current();
    }
  }, 200);
}
