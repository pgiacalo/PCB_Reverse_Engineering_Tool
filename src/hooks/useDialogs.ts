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

