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
// Project History Module
// ============================================================================
// History restore functionality

export interface HistoryFile {
  name: string;
  lastModified: Date;
  size: number;
  timestamp: Date;
}

/**
 * Parse timestamp from filename
 * Handles both current format (_YYYY_MM_DD-HH-mm-ss) and old format (_YYYY_MM_DD_HH_mm_ss)
 */
function parseTimestampFromFilename(filename: string): Date | null {
  // Try current format: _YYYY_MM_DD-HH-mm-ss
  const currentFormatMatch = filename.match(/_(\d{4})_(\d{2})_(\d{2})-(\d{2})-(\d{2})-(\d{2})\.json$/);
  if (currentFormatMatch) {
    const [, year, month, day, hour, minute, second] = currentFormatMatch;
    return new Date(
      parseInt(year),
      parseInt(month) - 1, // Month is 0-indexed
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second)
    );
  }

  // Try old format: _YYYY_MM_DD_HH_mm_ss
  const oldFormatMatch = filename.match(/_(\d{4})_(\d{2})_(\d{2})_(\d{2})_(\d{2})_(\d{2})\.json$/);
  if (oldFormatMatch) {
    const [, year, month, day, hour, minute, second] = oldFormatMatch;
    return new Date(
      parseInt(year),
      parseInt(month) - 1, // Month is 0-indexed
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second)
    );
  }

  return null;
}

/**
 * List all history files in the project's history directory
 * Returns files sorted by timestamp (newest first)
 */
export async function listHistoryFiles(
  projectDirHandle: FileSystemDirectoryHandle
): Promise<HistoryFile[]> {
  try {
    // Get history directory
    let historyDirHandle: FileSystemDirectoryHandle;
    try {
      historyDirHandle = await projectDirHandle.getDirectoryHandle('history');
    } catch (e) {
      // History directory doesn't exist yet
      return [];
    }

    // Read all files from history directory
    const files: HistoryFile[] = [];
    for await (const name of (historyDirHandle as any).keys()) {
      // Only process .json files
      if (!name.endsWith('.json')) {
        continue;
      }
      try {
        const fileHandle = await historyDirHandle.getFileHandle(name);
        const file = await fileHandle.getFile();

        // Parse timestamp from filename (more reliable than file.lastModified)
        const timestampFromFilename = parseTimestampFromFilename(name);

        files.push({
          name: name,
          lastModified: new Date(file.lastModified),
          size: file.size,
          timestamp: timestampFromFilename || new Date(file.lastModified), // Fallback to lastModified if no timestamp in filename
        });
      } catch (e) {
        console.warn(`Failed to read file ${name}:`, e);
        // Continue with other files
      }
    }

    // Sort by timestamp (parsed from filename) in reverse chronological order (newest first)
    files.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return files;
  } catch (e) {
    console.error('Failed to load history files:', e);
    throw new Error('Failed to load history files. Please try again.');
  }
}

/**
 * Restore a project file from history
 * Loads the file from history directory and returns the parsed project data
 */
export async function restoreFromHistory(
  projectDirHandle: FileSystemDirectoryHandle,
  fileName: string
): Promise<any> {
  try {
    // Get history directory
    let historyDirHandle: FileSystemDirectoryHandle;
    try {
      historyDirHandle = await projectDirHandle.getDirectoryHandle('history');
    } catch (e) {
      throw new Error('History directory not found.');
    }

    // Get the file from history directory
    const fileHandle = await historyDirHandle.getFileHandle(fileName);
    const file = await fileHandle.getFile();

    // Check if file is empty
    if (file.size === 0) {
      throw new Error(`File ${fileName} is empty.`);
    }

    const text = await file.text();

    // Check if text is empty or whitespace only
    if (!text || text.trim().length === 0) {
      throw new Error(`File ${fileName} contains no data.`);
    }

    let project;
    try {
      project = JSON.parse(text);
    } catch (parseError) {
      console.error(`Failed to parse JSON from file ${fileName}:`, parseError);
      throw new Error(`Failed to parse file ${fileName}. It may be corrupted.`);
    }

    return project;
  } catch (e) {
    console.error('Failed to restore file from history:', e);
    if (e instanceof Error) {
      throw e;
    }
    throw new Error(`Failed to restore file ${fileName}. Please try again.`);
  }
}
