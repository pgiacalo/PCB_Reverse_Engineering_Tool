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

