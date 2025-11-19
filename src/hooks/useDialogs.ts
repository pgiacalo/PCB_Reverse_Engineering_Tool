import { useState } from 'react';

/**
 * Custom hook for managing dialog visibility states
 */
export function useDialogs() {
  const [openMenu, setOpenMenu] = useState<'file' | 'transform' | 'tools' | 'about' | null>(null);
  const [setSizeDialog, setSetSizeDialog] = useState<{ visible: boolean; size: number }>({ visible: false, size: 6 });
  const [autoSaveDialog, setAutoSaveDialog] = useState<{ visible: boolean; interval: number | null }>({ visible: false, interval: 5 });
  const [autoSavePromptDialog, setAutoSavePromptDialog] = useState<{ visible: boolean; source: 'new' | 'open' | null }>({ visible: false, source: null });
  const [debugDialog, setDebugDialog] = useState<{ visible: boolean; text: string }>({ visible: false, text: '' });
  const [errorDialog, setErrorDialog] = useState<{ visible: boolean; title: string; message: string }>({ visible: false, title: '', message: '' });
  const [newProjectDialog, setNewProjectDialog] = useState<{ visible: boolean }>({ visible: false });
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
    newProjectSetupDialog,
    setNewProjectSetupDialog,
    saveAsDialog,
    setSaveAsDialog,
    showColorPicker,
    setShowColorPicker,
    showWelcomeDialog,
    setShowWelcomeDialog,
  };
}

