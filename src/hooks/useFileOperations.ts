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

