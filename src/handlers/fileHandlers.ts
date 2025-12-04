/**
 * Copyright 2025 Philip L. Giacalone
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * File operation handlers
 * These functions handle file operations like save, load, export, etc.
 */

import { useCallback } from 'react';
import { generateSimpleSchematic } from '../utils/schematic';
import type { DrawingStroke, PCBComponent, DrawingStroke as ImportedDrawingStroke } from '../types';
import type { PowerSymbol, GroundSymbol, PowerBus } from '../hooks/usePowerGround';

export interface FileHandlersProps {
  // Canvas ref
  canvasRef: React.RefObject<HTMLCanvasElement>;
  
  // Project data builder
  buildProjectData: () => { project: any; timestamp: string };
  
  // State values
  projectName: string;
  projectDirHandle: FileSystemDirectoryHandle | null;
  autoSaveDirHandle: FileSystemDirectoryHandle | null;
  componentsTop: PCBComponent[];
  componentsBottom: PCBComponent[];
  drawingStrokes: DrawingStroke[];
  powers: PowerSymbol[];
  grounds: GroundSymbol[];
  powerBuses: PowerBus[];
  
  // State setters
  setCurrentProjectFilePath: React.Dispatch<React.SetStateAction<string>>;
  setProjectDirHandle: React.Dispatch<React.SetStateAction<FileSystemDirectoryHandle | null>>;
  setProjectName: React.Dispatch<React.SetStateAction<string>>;
  setAutoSaveBaseName: React.Dispatch<React.SetStateAction<string>>;
  setNewProjectSetupDialog: React.Dispatch<React.SetStateAction<{
    visible: boolean;
    projectName: string;
    locationPath: string;
    locationHandle: FileSystemDirectoryHandle | null;
  }>>;
  setSaveAsDialog: React.Dispatch<React.SetStateAction<{
    visible: boolean;
    filename: string;
    locationPath: string;
    locationHandle: FileSystemDirectoryHandle | null;
  }>>;
  setAutoSavePromptDialog: React.Dispatch<React.SetStateAction<{
    visible: boolean;
    source: 'new' | 'open' | null;
  }>>;
  
  // Refs
  openProjectRef: React.RefObject<HTMLInputElement | null>;
  saveAsFilenameInputRef: React.RefObject<HTMLInputElement | null>;
  
  // Utility functions
  alert: (message: string) => void;
  loadProject: (project: any) => Promise<void>;
}

export interface FileHandlers {
  handlePrint: () => void;
  saveProject: () => Promise<void>;
  exportSimpleSchematic: () => Promise<void>;
  newProject: () => void;
  openSaveAsDialog: () => void;
  handleOpenProject: () => Promise<void>;
}

/**
 * Creates file operation handlers with all necessary dependencies
 */
export const createFileHandlers = (props: FileHandlersProps): FileHandlers => {
  const {
    canvasRef,
    buildProjectData,
    projectName,
    projectDirHandle,
    autoSaveDirHandle,
    componentsTop,
    componentsBottom,
    drawingStrokes,
    powers,
    grounds,
    powerBuses,
    setCurrentProjectFilePath,
    setProjectDirHandle,
    setProjectName,
    setAutoSaveBaseName,
    setNewProjectSetupDialog,
    setSaveAsDialog,
    setAutoSavePromptDialog,
    openProjectRef,
    saveAsFilenameInputRef,
    alert,
    loadProject,
  } = props;

  const handlePrint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const dataUrl = canvas.toDataURL('image/png');
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print the canvas.');
      return;
    }
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>PCB Drawing</title>
          <style>
            @media print {
              @page {
                margin: 0;
                size: auto;
              }
              body {
                margin: 0;
                padding: 0;
              }
            }
            body {
              margin: 0;
              padding: 20px;
              display: flex;
              justify-content: center;
              align-items: center;
              background: white;
            }
            img {
              max-width: 100%;
              height: auto;
              display: block;
            }
          </style>
        </head>
        <body>
          <img src="${dataUrl}" alt="PCB Drawing" onload="window.setTimeout(function() { window.print(); }, 250);" />
        </body>
      </html>
    `);
    printWindow.document.close();
  }, [canvasRef, alert]);

  const saveProject = useCallback(async () => {
    const { project } = buildProjectData();
    const json = JSON.stringify(project, null, 2);
    const blob = new Blob([json], { type: 'application/json' });

    if (projectDirHandle && projectName) {
      try {
        // Use project name for filename instead of hardcoded 'project.json'
        const cleanProjectName = projectName.replace(/\.json$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_');
        const filename = `${cleanProjectName}.json`;
        const fileHandle = await projectDirHandle.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        setCurrentProjectFilePath(filename);
        console.log(`Project saved: ${projectName}/${filename}`);
        return;
      } catch (e) {
        console.error('Failed to save to project directory:', e);
        setProjectDirHandle(null);
      }
    }
    
    if (projectName && !projectDirHandle) {
      const w = window as any;
      if (typeof w.showDirectoryPicker === 'function') {
        try {
          const dirHandle = await w.showDirectoryPicker();
          setProjectDirHandle(dirHandle);
          const filename = `${projectName}.json`;
          const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();
          setCurrentProjectFilePath(filename);
          console.log(`Project saved: ${filename} in selected directory`);
          return;
        } catch (e) {
          if ((e as any)?.name !== 'AbortError') {
            console.error('Failed to get directory:', e);
          }
        }
      }
    }

    const pad2 = (n: number) => String(n).padStart(2, '0');
    const now = new Date();
    const ts = `${now.getFullYear()}_${pad2(now.getMonth() + 1)}_${pad2(now.getDate())}_${pad2(now.getHours())}_${pad2(now.getMinutes())}_${pad2(now.getSeconds())}`;
    const filename = `pcb_project_${ts}.json`;

    const w = window as any;
    if (typeof w.showSaveFilePicker === 'function') {
      try {
        const handle: FileSystemFileHandle = await w.showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: 'PCB Project', accept: { 'application/json': ['.json'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        const savedFilename: string = handle.name;
        try {
          const file = await handle.getFile();
          setCurrentProjectFilePath(file.name);
        } catch (e) {
          setCurrentProjectFilePath(savedFilename);
        }
        
        const filenameFromHandle = savedFilename;
        const projectNameFromFile = filenameFromHandle.replace(/\.json$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_');
        if (projectNameFromFile) {
          setProjectName(projectNameFromFile);
          // Note: Project name is saved in project file, not localStorage
        }
        
        const baseName = handle.name.replace(/\.json$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_');
        setAutoSaveBaseName(baseName);
        
        if (!autoSaveDirHandle) {
          console.log('Auto save: Directory handle not set. Will prompt on first auto save.');
        }
        
        alert('Project saved successfully!');
        return;
      } catch (e) {
        if ((e as any)?.name === 'AbortError') return;
        console.warn('showSaveFilePicker failed, falling back to download', e);
      }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      document.body.removeChild(a);
    }, 0);
    alert('Project downloaded successfully!');
  }, [
    buildProjectData,
    projectDirHandle,
    projectName,
    setCurrentProjectFilePath,
    setProjectDirHandle,
    setProjectName,
    setAutoSaveBaseName,
    autoSaveDirHandle,
    alert,
  ]);

  const exportSimpleSchematic = useCallback(async () => {
    const allComponents = [...componentsTop, ...componentsBottom];
    const { schematic: schematicContent, nodesCsv } = generateSimpleSchematic(
      allComponents,
      drawingStrokes as ImportedDrawingStroke[],
      powers,
      grounds,
      powerBuses
    );

    // Generate timestamp for CSV filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5); // Format: 2024-01-15T12-30-45
    const baseName = projectName || 'pcb_project';
    const csvFilename = `${timestamp}_nodes.csv`;
    const csvBlob = new Blob([nodesCsv], { type: 'text/csv' });

    // Save nodes CSV first
    const w = window as any;
    if (typeof w.showSaveFilePicker === 'function') {
      try {
        const csvHandle = await w.showSaveFilePicker({
          suggestedName: csvFilename,
          types: [{ description: 'CSV Files', accept: { 'text/csv': ['.csv'] } }],
        });
        const csvWritable = await csvHandle.createWritable();
        await csvWritable.write(csvBlob);
        await csvWritable.close();
        console.log(`Nodes CSV exported: ${csvHandle.name}`);
      } catch (e) {
        if ((e as any)?.name === 'AbortError') return;
        console.warn('showSaveFilePicker failed for CSV, falling back to download', e);
        // Fallback: download CSV
        const csvLink = document.createElement('a');
        csvLink.href = URL.createObjectURL(csvBlob);
        csvLink.download = csvFilename;
        document.body.appendChild(csvLink);
        csvLink.click();
        setTimeout(() => {
          URL.revokeObjectURL(csvLink.href);
          document.body.removeChild(csvLink);
        }, 0);
      }
    } else {
      // Fallback: download CSV
      const csvLink = document.createElement('a');
      csvLink.href = URL.createObjectURL(csvBlob);
      csvLink.download = csvFilename;
      document.body.appendChild(csvLink);
      csvLink.click();
      setTimeout(() => {
        URL.revokeObjectURL(csvLink.href);
        document.body.removeChild(csvLink);
      }, 0);
    }

    const blob = new Blob([schematicContent], { type: 'text/plain' });
    const filename = `${baseName}.kicad_sch`;

    if (typeof w.showSaveFilePicker === 'function') {
      try {
        const handle = await w.showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: 'KiCad Schematic', accept: { 'text/plain': ['.kicad_sch'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        alert('Schematic exported successfully!');
        return;
      } catch (e) {
        if ((e as any)?.name === 'AbortError') return;
        console.warn('showSaveFilePicker failed for schematic, falling back to download', e);
      }
    }

    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      document.body.removeChild(a);
    }, 0);
    alert('Schematic downloaded successfully!');
  }, [componentsTop, componentsBottom, drawingStrokes, powers, grounds, powerBuses, projectName, alert]);

  const newProject = useCallback(() => {
    setNewProjectSetupDialog({ 
      visible: true, 
      projectName: '',
      locationPath: '',
      locationHandle: null,
    });
  }, [setNewProjectSetupDialog]);

  const openSaveAsDialog = useCallback(() => {
    const defaultFilename = projectName ? `${projectName}.json` : '';
    setSaveAsDialog({ 
      visible: true, 
      filename: defaultFilename,
      locationPath: '',
      locationHandle: null,
    });
    setTimeout(() => {
      saveAsFilenameInputRef.current?.focus();
      if (saveAsFilenameInputRef.current && defaultFilename) {
        const nameWithoutExt = defaultFilename.replace(/\.json$/i, '');
        saveAsFilenameInputRef.current.setSelectionRange(0, nameWithoutExt.length);
      }
    }, 100);
  }, [projectName, setSaveAsDialog, saveAsFilenameInputRef]);

  const handleOpenProject = useCallback(async () => {
    const w = window as any;
    if (typeof w.showOpenFilePicker === 'function') {
      try {
        const [handle] = await w.showOpenFilePicker({
          multiple: false,
        });
        const file = await handle.getFile();
        if (!file.name.toLowerCase().endsWith('.json')) {
          alert('Please select a .json project file.');
          return;
        }
        setCurrentProjectFilePath(file.name);
        
        // Get the directory handle from the opened file (this is the project directory)
        // This ensures Auto Save always uses the same directory as the opened file
        // Store and persist this directory path so it's always used for this project
        let projectDirHandle: FileSystemDirectoryHandle | null = null;
        try {
          projectDirHandle = await handle.getParent();
          setProjectDirHandle(projectDirHandle);
          if (projectDirHandle) {
            console.log(`Project opened from directory: ${projectDirHandle.name || 'unknown'}`);
          }
        } catch (e) {
          console.error('Failed to get directory handle from opened file:', e);
          // Continue without directory handle - user may need to set it manually
        }
        
        const text = await file.text();
        const project = JSON.parse(text);
        
        await loadProject(project);
        
        let projectNameToUse: string;
        if (project.projectInfo?.name) {
          projectNameToUse = project.projectInfo.name;
        } else {
          const projectNameFromFile = file.name.replace(/\.json$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_');
          projectNameToUse = projectNameFromFile || 'pcb_project';
          setProjectName(projectNameToUse);
          // Note: Project name is saved in project file, not localStorage
        }
        
        if (!projectName) {
          setProjectName(projectNameToUse);
          // Note: Project name is saved in project file, not localStorage
        }
        
        setTimeout(() => {
          const wasAutoSaveEnabledInFile = project.autoSave?.enabled === true;
          if (!wasAutoSaveEnabledInFile) {
            setAutoSavePromptDialog({ visible: true, source: 'open' });
          }
        }, 100);
      } catch (e) {
        if ((e as any)?.name === 'AbortError') return;
        console.warn('showOpenFilePicker failed, falling back to input', e);
        openProjectRef.current?.click();
      }
    } else {
      openProjectRef.current?.click();
    }
  }, [
    loadProject,
    projectName,
    setCurrentProjectFilePath,
    setProjectName,
    setAutoSavePromptDialog,
    alert,
    openProjectRef,
  ]);

  return {
    handlePrint,
    saveProject,
    exportSimpleSchematic,
    newProject,
    openSaveAsDialog,
    handleOpenProject,
  };
};
