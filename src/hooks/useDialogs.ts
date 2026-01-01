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

import { useState } from 'react';

/**
 * Custom hook for managing dialog visibility states
 */
export function useDialogs() {
  const [openMenu, setOpenMenu] = useState<'file' | 'transform' | 'tools' | 'about' | 'help' | null>(null);
  const [setSizeDialog, setSetSizeDialog] = useState<{ visible: boolean; size: number }>({ visible: false, size: 6 });
  const [autoSaveDialog, setAutoSaveDialog] = useState<{ visible: boolean; interval: number | null }>({ visible: false, interval: 5 });
  const [autoSavePromptDialog, setAutoSavePromptDialog] = useState<{ visible: boolean; source: 'new' | 'open' | null; interval: number | null }>({ visible: false, source: null, interval: 5 });
  const [debugDialog, setDebugDialog] = useState<{ visible: boolean; text: string }>({ visible: false, text: '' });
  const [errorDialog, setErrorDialog] = useState<{ visible: boolean; title: string; message: string }>({ visible: false, title: '', message: '' });
  const [newProjectDialog, setNewProjectDialog] = useState<{ visible: boolean }>({ visible: false });
  const [openProjectDialog, setOpenProjectDialog] = useState<{ visible: boolean }>({ visible: false });
  const [newProjectSetupDialog, setNewProjectSetupDialog] = useState<{ 
    visible: boolean; 
    projectName: string; 
    locationPath: string; 
    locationHandle: FileSystemDirectoryHandle | null;
  }>({ 
    visible: false, 
    projectName: '', 
    locationPath: '',
    locationHandle: null,
  });
  const [saveAsDialog, setSaveAsDialog] = useState<{ 
    visible: boolean; 
    filename: string; 
    locationPath: string; 
    locationHandle: FileSystemDirectoryHandle | null;
  }>({ 
    visible: false, 
    filename: '', 
    locationPath: '',
    locationHandle: null,
  });
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showWelcomeDialog, setShowWelcomeDialog] = useState(true);
  const [transformImagesDialogVisible, setTransformImagesDialogVisible] = useState(false);

  return {
    // Menu state
    openMenu,
    setOpenMenu,
    
    // Dialog states
    setSizeDialog,
    setSetSizeDialog,
    autoSaveDialog,
    setAutoSaveDialog,
    autoSavePromptDialog,
    setAutoSavePromptDialog,
    debugDialog,
    setDebugDialog,
    errorDialog,
    setErrorDialog,
    newProjectDialog,
    setNewProjectDialog,
    openProjectDialog,
    setOpenProjectDialog,
    newProjectSetupDialog,
    setNewProjectSetupDialog,
    saveAsDialog,
    setSaveAsDialog,
    showColorPicker,
    setShowColorPicker,
    showWelcomeDialog,
    setShowWelcomeDialog,
    transformImagesDialogVisible,
    setTransformImagesDialogVisible,
  };
}

