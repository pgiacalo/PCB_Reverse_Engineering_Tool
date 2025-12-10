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

import { useState, useRef } from 'react';

/**
 * Custom hook for managing file operations state (auto-save, project management)
 */
export function useFileOperations() {
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const [autoSaveInterval, setAutoSaveInterval] = useState<number | null>(1); // Interval in minutes
  const [autoSaveDirHandle, setAutoSaveDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [autoSaveBaseName, setAutoSaveBaseName] = useState<string>('');
  const [currentProjectFilePath, setCurrentProjectFilePath] = useState<string>('');
  const [projectDirHandle, setProjectDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [projectName, setProjectName] = useState<string>('pcb_project');
  const [autoSaveFileHistory, setAutoSaveFileHistory] = useState<string[]>([]);
  const [currentFileIndex, setCurrentFileIndex] = useState<number>(-1);
  
  const autoSaveIntervalRef = useRef<number | null>(null);
  const hasChangesSinceLastAutoSaveRef = useRef<boolean>(false);
  const prevAutoSaveEnabledRef = useRef<boolean>(false);

  return {
    // State
    autoSaveEnabled,
    setAutoSaveEnabled,
    autoSaveInterval,
    setAutoSaveInterval,
    autoSaveDirHandle,
    setAutoSaveDirHandle,
    autoSaveBaseName,
    setAutoSaveBaseName,
    currentProjectFilePath,
    setCurrentProjectFilePath,
    projectDirHandle,
    setProjectDirHandle,
    projectName,
    setProjectName,
    autoSaveFileHistory,
    setAutoSaveFileHistory,
    currentFileIndex,
    setCurrentFileIndex,
    
    // Refs
    autoSaveIntervalRef,
    hasChangesSinceLastAutoSaveRef,
    prevAutoSaveEnabledRef,
  };
}

