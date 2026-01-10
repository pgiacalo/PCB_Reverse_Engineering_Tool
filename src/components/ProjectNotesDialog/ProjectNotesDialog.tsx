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

/**
 * ProjectNotesDialog component
 * Displays and allows editing of project notes as a tabular list (Name, Value)
 */

import React, { useState, useEffect, useRef } from 'react';

export interface ProjectNote {
  name: string;
  value: string;
  checked?: boolean;
}

export interface ProjectMetadata {
  productName: string;
  modelNumber: string;
  manufacturer: string;
  dateManufactured: string;
}

export interface ProjectNotesDialogProps {
  /** Whether the dialog is visible */
  visible: boolean;
  /** Project notes array */
  projectNotes: ProjectNote[];
  /** Callback to update project notes */
  setProjectNotes: (notes: ProjectNote[]) => void;
  /** Project metadata */
  projectMetadata: ProjectMetadata;
  /** Callback to update project metadata */
  setProjectMetadata: (metadata: ProjectMetadata) => void;
  /** Callback to close the dialog */
  onClose: () => void;
  /** Dialog position for dragging */
  position: { x: number; y: number } | null;
  /** Whether the dialog is being dragged */
  isDragging: boolean;
  /** Callback when drag starts */
  onDragStart: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export const ProjectNotesDialog: React.FC<ProjectNotesDialogProps> = ({
  visible,
  projectNotes,
  setProjectNotes,
  projectMetadata,
  setProjectMetadata,
  onClose,
  position,
  isDragging,
  onDragStart,
}) => {
  const [localNotes, setLocalNotes] = useState<ProjectNote[]>([]);
  const [localMetadata, setLocalMetadata] = useState<ProjectMetadata>({
    productName: '',
    modelNumber: '',
    manufacturer: '',
    dateManufactured: new Date().toISOString().split('T')[0], // Auto-fill with current date (YYYY-MM-DD)
  });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<'name' | 'value' | null>(null);
  const inputRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());
  const [dialogSize, setDialogSize] = useState({ width: Math.min(window.innerWidth * 0.85, 1400), height: window.innerHeight * 0.7 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Sync local state with props
  useEffect(() => {
    if (visible) {
      setLocalNotes([...projectNotes]);
      setLocalMetadata({ ...projectMetadata });
      // Auto-fill dateManufactured if empty
      if (!projectMetadata.dateManufactured || projectMetadata.dateManufactured.trim() === '') {
        setLocalMetadata(prev => ({
          ...prev,
          dateManufactured: new Date().toISOString().split('T')[0]
        }));
      }
      setEditingIndex(null);
      setEditingField(null);
      setSearchQuery(''); // Clear search when dialog opens
    }
  }, [visible, projectNotes, projectMetadata]);

  // Filter notes based on search query
  const filteredNotes = searchQuery.trim() === '' 
    ? localNotes 
    : localNotes.filter(note => {
        const query = searchQuery.toLowerCase();
        const nameMatch = note.name.toLowerCase().includes(query);
        const valueMatch = note.value.toLowerCase().includes(query);
        return nameMatch || valueMatch;
      });

  // Handle resize mouse events
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStart.x;
      const deltaY = e.clientY - resizeStart.y;
      const newWidth = Math.max(400, Math.min(window.innerWidth - 20, resizeStart.width + deltaX));
      const newHeight = Math.max(300, Math.min(window.innerHeight - 20, resizeStart.height + deltaY));
      setDialogSize({ width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, resizeStart]);

  const handleResizeStart = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: dialogSize.width,
      height: dialogSize.height,
    });
  };

  if (!visible) return null;

  const handleAddNote = () => {
    const newNote: ProjectNote = { name: '', value: '', checked: false };
    setLocalNotes([...localNotes, newNote]);
    setEditingIndex(localNotes.length);
    setEditingField('name');
  };

  const handleDeleteNote = (index: number) => {
    const updated = localNotes.filter((_, i) => i !== index);
    setLocalNotes(updated);
    if (editingIndex === index) {
      setEditingIndex(null);
      setEditingField(null);
    } else if (editingIndex !== null && editingIndex > index) {
      setEditingIndex(editingIndex - 1);
    }
  };

  const handleSave = () => {
    // Filter out empty notes
    const filtered = localNotes.filter(note => note.name.trim() !== '' || note.value.trim() !== '');
    setProjectNotes(filtered);
    setProjectMetadata(localMetadata);
    onClose(); // Save and close
  };

  const handleCancel = () => {
    setLocalNotes([...projectNotes]);
    setLocalMetadata({ ...projectMetadata });
    setEditingIndex(null);
    setEditingField(null);
    onClose();
  };

  const handleFieldChange = (index: number, field: 'name' | 'value', value: string) => {
    const updated = [...localNotes];
    updated[index] = { ...updated[index], [field]: value };
    setLocalNotes(updated);
  };

  const handleCheckboxChange = (index: number, checked: boolean) => {
    const updated = [...localNotes];
    updated[index] = { ...updated[index], checked };
    setLocalNotes(updated);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, index: number, field: 'name' | 'value') => {
    // CRITICAL: Stop propagation to prevent App.tsx keyboard shortcuts from firing
    // This allows typing in cells without triggering tool shortcuts (S, V, T, etc.)
    e.stopPropagation();
    
    const textarea = e.currentTarget;
    const cursorPos = textarea.selectionStart;
    const textLength = textarea.value.length;
    const hasSelection = textarea.selectionStart !== textarea.selectionEnd;
    
    // Alt+Enter: Insert line break (Excel behavior)
    if (e.key === 'Enter' && e.altKey) {
      // Allow default behavior (line break in textarea)
      return;
    }
    
    // Arrow Right: Only navigate to next cell if cursor is at end of text and no selection
    if (e.key === 'ArrowRight' && !e.ctrlKey && !e.shiftKey && !e.altKey) {
      if (cursorPos === textLength && !hasSelection) {
        if (field === 'name') {
      e.preventDefault();
        // Move to value in same row
        const valueKey = `${index}-value`;
        const valueInput = inputRefs.current.get(valueKey);
        if (valueInput) {
          valueInput.focus();
            valueInput.setSelectionRange(0, 0); // Cursor at start
          }
        }
        // If in value field, don't navigate (stay in cell)
      }
      // Otherwise, allow default cursor movement within cell
      return;
    }
    
    // Arrow Left: Only navigate to previous cell if cursor is at start of text and no selection
    if (e.key === 'ArrowLeft' && !e.ctrlKey && !e.shiftKey && !e.altKey) {
      if (cursorPos === 0 && !hasSelection) {
        if (field === 'value') {
      e.preventDefault();
        // Move to name in same row
        const nameKey = `${index}-name`;
        const nameInput = inputRefs.current.get(nameKey);
        if (nameInput) {
          nameInput.focus();
            nameInput.setSelectionRange(nameInput.value.length, nameInput.value.length); // Cursor at end
          }
        }
        // If in name field, don't navigate (stay in cell)
      }
      // Otherwise, allow default cursor movement within cell
      return;
    }
    
    // Arrow Down: Navigate to same field in next row
    if (e.key === 'ArrowDown' && !e.ctrlKey && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      // Move to same field in next row, or create new row if at end
      if (index < localNotes.length - 1) {
        const nextKey = `${index + 1}-${field}`;
        const nextInput = inputRefs.current.get(nextKey);
        if (nextInput) {
          nextInput.focus();
          // Try to preserve cursor position
          const newPos = Math.min(cursorPos, nextInput.value.length);
          nextInput.setSelectionRange(newPos, newPos);
        }
      } else {
        // At last row, create new row and focus on same field
        const newIndex = localNotes.length;
        handleAddNote();
        setTimeout(() => {
          const newKey = `${newIndex}-${field}`;
          const newInput = inputRefs.current.get(newKey);
          if (newInput) {
            newInput.focus();
            newInput.setSelectionRange(0, 0);
          }
        }, 0);
      }
      return;
    }
    
    // Arrow Up: Navigate to same field in previous row
    if (e.key === 'ArrowUp' && !e.ctrlKey && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      // Move to same field in previous row
      if (index > 0) {
        const prevKey = `${index - 1}-${field}`;
        const prevInput = inputRefs.current.get(prevKey);
        if (prevInput) {
          prevInput.focus();
          // Try to preserve cursor position
          const newPos = Math.min(cursorPos, prevInput.value.length);
          prevInput.setSelectionRange(newPos, newPos);
        }
      }
      return;
    }
    
    // Enter: Move to next cell (Excel behavior)
    if (e.key === 'Enter' && !e.altKey && !e.shiftKey) {
      e.preventDefault();
      if (field === 'name') {
        // Move to value in same row
        const valueKey = `${index}-value`;
        const valueInput = inputRefs.current.get(valueKey);
        if (valueInput) {
          valueInput.focus();
          valueInput.setSelectionRange(0, 0);
        }
      } else if (field === 'value') {
        // Move to name in next row, or create new row if at end
        if (index < localNotes.length - 1) {
          const nextNameKey = `${index + 1}-name`;
          const nextNameInput = inputRefs.current.get(nextNameKey);
          if (nextNameInput) {
            nextNameInput.focus();
            nextNameInput.setSelectionRange(0, 0);
          }
        } else {
          // At last row, create new row and focus on its name
          const newIndex = localNotes.length;
          handleAddNote();
          setTimeout(() => {
            const newNameKey = `${newIndex}-name`;
            const newNameInput = inputRefs.current.get(newNameKey);
            if (newNameInput) {
              newNameInput.focus();
              newNameInput.setSelectionRange(0, 0);
            }
          }, 0);
        }
      }
      return;
    }
    
    // Tab: Move to next field (name -> value -> next row's name)
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      if (field === 'name') {
        // Move to value in same row
        const valueKey = `${index}-value`;
        const valueInput = inputRefs.current.get(valueKey);
        if (valueInput) {
          valueInput.focus();
          valueInput.select(); // Select all text in next cell
        }
      } else if (field === 'value') {
        // Move to name in next row, or create new row if at end
        if (index < localNotes.length - 1) {
          const nextNameKey = `${index + 1}-name`;
          const nextNameInput = inputRefs.current.get(nextNameKey);
          if (nextNameInput) {
            nextNameInput.focus();
            nextNameInput.select(); // Select all text in next cell
          }
        } else {
          // At last row, create new row and focus on its name
          const newIndex = localNotes.length;
          handleAddNote();
          setTimeout(() => {
            const newNameKey = `${newIndex}-name`;
            const newNameInput = inputRefs.current.get(newNameKey);
            if (newNameInput) {
              newNameInput.focus();
            }
          }, 0);
        }
      }
      return;
    }
    
    // Shift+Tab: Move to previous field (value -> name -> previous row's value)
    if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      if (field === 'value') {
        // Move to name in same row
        const nameKey = `${index}-name`;
        const nameInput = inputRefs.current.get(nameKey);
        if (nameInput) {
          nameInput.focus();
          nameInput.select(); // Select all text in previous cell
        }
      } else if (field === 'name') {
        // Move to value in previous row
        if (index > 0) {
          const prevValueKey = `${index - 1}-value`;
          const prevValueInput = inputRefs.current.get(prevValueKey);
          if (prevValueInput) {
            prevValueInput.focus();
            prevValueInput.select(); // Select all text in previous cell
          }
        }
      }
      return;
    }
  };

  // Track which cell has focus for styling purposes
  const handleFieldFocus = (index: number, field: 'name' | 'value') => {
    setEditingIndex(index);
    setEditingField(field);
  };

  const handleFieldBlur = () => {
    // Don't clear editing state on blur - cells are always editable
    // This allows navigation to work properly
  };

  const dialogStyle: React.CSSProperties = {
    position: 'fixed',
    top: position?.y ?? 100,
    left: position?.x ?? (window.innerWidth - dialogSize.width) / 2,
    width: `${dialogSize.width}px`,
    height: `${dialogSize.height}px`,
    backgroundColor: '#fff',
    borderRadius: 8,
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
    border: '1px solid #ddd',
    zIndex: 10000,
    display: 'flex',
    flexDirection: 'column',
    cursor: isDragging ? 'grabbing' : 'default',
    overflow: 'hidden',
  };

  return (
    <div
      style={dialogStyle}
    >
      {/* Header - Only this area is draggable */}
      <div 
        style={{
        padding: '8px 12px',
        borderBottom: '1px solid #e0e0e0',
        background: '#888',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        cursor: 'move',
        userSelect: 'none',
        }}
        onMouseDown={onDragStart}
      >
        <h2 style={{ margin: 0, fontSize: '12px', color: '#fff', fontWeight: 600 }}>Project Notes / TODO List (L)</h2>
        <button
          onClick={handleCancel}
          style={{
            background: 'transparent',
            border: 'none',
            fontSize: '14px',
            cursor: 'pointer',
            color: '#fff',
            padding: '0 4px',
            lineHeight: 1,
          }}
          title="Close"
        >
          ×
        </button>
      </div>

      {/* Product Metadata Fields */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #e0e0e0',
        backgroundColor: '#f9f9f9',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr 1fr',
        gap: '12px',
        alignItems: 'center',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: '#333' }}>
            Product Name:
          </label>
          <input
            type="text"
            value={localMetadata.productName}
            onChange={(e) => setLocalMetadata({ ...localMetadata, productName: e.target.value })}
            placeholder="Enter product name"
            style={{
              padding: '6px 8px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '12px',
              color: '#000',
              background: '#fff',
              outline: 'none',
            }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: '#333' }}>
            Model Number:
          </label>
          <input
            type="text"
            value={localMetadata.modelNumber}
            onChange={(e) => setLocalMetadata({ ...localMetadata, modelNumber: e.target.value })}
            placeholder="Enter model number"
            style={{
              padding: '6px 8px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '12px',
              color: '#000',
              background: '#fff',
              outline: 'none',
            }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: '#333' }}>
            Manufacturer:
          </label>
          <input
            type="text"
            value={localMetadata.manufacturer}
            onChange={(e) => setLocalMetadata({ ...localMetadata, manufacturer: e.target.value })}
            placeholder="Enter manufacturer"
            style={{
              padding: '6px 8px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '12px',
              color: '#000',
              background: '#fff',
              outline: 'none',
            }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: '#333' }}>
            Date Manufactured:
          </label>
          <input
            type="date"
            value={localMetadata.dateManufactured}
            onChange={(e) => setLocalMetadata({ ...localMetadata, dateManufactured: e.target.value })}
            style={{
              padding: '6px 8px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '12px',
              color: '#000',
              background: '#fff',
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Search Bar */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #e0e0e0',
        backgroundColor: '#f5f5f5',
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
        flexShrink: 0,
      }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              // Search is already performed on change, so just prevent form submission
            }
          }}
          placeholder="Search notes..."
          style={{
            flex: 1,
            padding: '6px 12px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '13px',
            color: '#000',
            background: '#fff',
            outline: 'none',
          }}
        />
        <button
          onClick={() => {
            // Search is performed automatically via filteredNotes
            // This button can be used to clear search or provide visual feedback
            if (searchQuery.trim() !== '') {
              setSearchQuery('');
            }
          }}
          style={{
            padding: '6px 16px',
            background: searchQuery.trim() !== '' ? '#4CAF50' : '#888',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 500,
            whiteSpace: 'nowrap',
          }}
        >
          {searchQuery.trim() !== '' ? 'Clear' : 'Search'}
        </button>
      </div>

      {/* Content */}
      <div 
        className="project-notes-content"
        style={{
          padding: 0, // Remove padding to eliminate gap between header and table
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0, // Important for flex scrolling
          scrollbarWidth: 'thin',
          scrollbarColor: '#888 #f0f0f0',
        }}
      >
        {/* Table */}
        <div style={{
          border: 'none',
          borderTop: '1px solid #ccc',
          borderRadius: 0,
          overflow: 'visible', // Allow content to overflow for scrolling
          marginBottom: '16px',
          backgroundColor: '#e0e0e0', // Light grey background like the image
          flexShrink: 0, // Prevent table from shrinking
        }}>
          {/* Table Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '40px 1fr 3fr auto',
            backgroundColor: '#e0e0e0', // Light grey background like the image
            borderBottom: '1px solid #ccc',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}>
            <div style={{ padding: '8px 12px', fontWeight: 600, fontSize: '12px', borderRight: '1px solid #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000' }}>
              <label className="radio-label" style={{ margin: 0, cursor: 'default' }}>
                <input type="checkbox" disabled style={{ opacity: 0.5 }} />
              </label>
            </div>
            <div style={{ padding: '8px 12px', fontWeight: 600, fontSize: '12px', borderRight: '1px solid #ccc', color: '#000' }}>
              Item
            </div>
            <div style={{ padding: '8px 12px', fontWeight: 600, fontSize: '12px', borderRight: '1px solid #ccc', color: '#000' }}>
              Notes
            </div>
            <div style={{ padding: '8px 12px', fontWeight: 600, fontSize: '12px', color: '#000' }}>
              {/* Actions column - intentionally blank */}
            </div>
          </div>

          {/* Table Body */}
          <div>
            {localNotes.length === 0 ? (
              <div style={{
                padding: '24px',
                textAlign: 'center',
                color: '#999',
                fontSize: '13px',
              }}>
                No notes. Click "Add Note" to create one.
              </div>
            ) : filteredNotes.length === 0 ? (
              <div style={{
                padding: '24px',
                textAlign: 'center',
                color: '#999',
                fontSize: '13px',
              }}>
                No matches found for "{searchQuery}".
              </div>
            ) : (
              filteredNotes.map((note) => {
                // Find the original index in localNotes to maintain proper editing/delete functionality
                const originalIndex = localNotes.findIndex(n => n === note);
                return (
                <div
                  key={originalIndex}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '40px 1fr 3fr auto',
                    borderBottom: '1px solid #ccc',
                    backgroundColor: '#fff', // White rows like the image
                  }}
                >
                  {/* Checkbox Column */}
                  <div style={{ padding: '8px 12px', borderRight: '1px solid #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <label className="radio-label" style={{ margin: 0, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={note.checked || false}
                        onChange={(e) => handleCheckboxChange(originalIndex, e.target.checked)}
                      />
                    </label>
                  </div>

                  {/* Name Column - Always editable textarea */}
                  <div style={{ padding: '4px', borderRight: '1px solid #ccc' }}>
                      <textarea
                        ref={(el) => {
                          if (el) inputRefs.current.set(`${originalIndex}-name`, el);
                          else inputRefs.current.delete(`${originalIndex}-name`);
                        }}
                        value={note.name}
                        onChange={(e) => handleFieldChange(originalIndex, 'name', e.target.value)}
                      onFocus={() => handleFieldFocus(originalIndex, 'name')}
                        onBlur={handleFieldBlur}
                        onKeyDown={(e) => handleKeyDown(e, originalIndex, 'name')}
                      placeholder="Item name..."
                        rows={1}
                        style={{
                          width: '100%',
                          padding: '4px 6px',
                        border: editingIndex === originalIndex && editingField === 'name' ? '2px solid #0b5fff' : '1px solid transparent',
                          borderRadius: 3,
                          fontSize: '12px',
                          backgroundColor: '#fff',
                          color: '#000',
                          fontFamily: 'inherit',
                        resize: 'none',
                        minHeight: '24px',
                          lineHeight: '1.4',
                          overflow: 'hidden',
                        outline: 'none',
                        boxSizing: 'border-box',
                        }}
                        onInput={(e) => {
                          // Auto-resize textarea to fit content
                          const target = e.target as HTMLTextAreaElement;
                          target.style.height = 'auto';
                          target.style.height = `${target.scrollHeight}px`;
                        }}
                      />
                  </div>

                  {/* Value Column - Always editable textarea */}
                  <div style={{ padding: '4px', borderRight: '1px solid #ccc' }}>
                      <textarea
                        ref={(el) => {
                          if (el) inputRefs.current.set(`${originalIndex}-value`, el);
                          else inputRefs.current.delete(`${originalIndex}-value`);
                        }}
                        value={note.value}
                        onChange={(e) => handleFieldChange(originalIndex, 'value', e.target.value)}
                      onFocus={() => handleFieldFocus(originalIndex, 'value')}
                        onBlur={handleFieldBlur}
                        onKeyDown={(e) => handleKeyDown(e, originalIndex, 'value')}
                      placeholder="Notes..."
                        rows={1}
                        style={{
                          width: '100%',
                          padding: '4px 6px',
                        border: editingIndex === originalIndex && editingField === 'value' ? '2px solid #0b5fff' : '1px solid transparent',
                          borderRadius: 3,
                          fontSize: '12px',
                          backgroundColor: '#fff',
                          color: '#000',
                          fontFamily: 'inherit',
                        resize: 'none',
                        minHeight: '24px',
                          lineHeight: '1.4',
                          overflow: 'hidden',
                        outline: 'none',
                        boxSizing: 'border-box',
                        }}
                        onInput={(e) => {
                          // Auto-resize textarea to fit content
                          const target = e.target as HTMLTextAreaElement;
                          target.style.height = 'auto';
                          target.style.height = `${target.scrollHeight}px`;
                        }}
                      />
                  </div>

                  {/* Actions Column */}
                  <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <button
                      onClick={() => handleDeleteNote(originalIndex)}
                      style={{
                        background: '#f44336',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 3,
                        padding: '4px 8px',
                        cursor: 'pointer',
                        fontSize: '11px',
                      }}
                      title="Delete note"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
              })
            )}
          </div>
        </div>

        {/* Add Note Button */}
        <div style={{ padding: '16px', flexShrink: 0 }}>
          <button
            onClick={handleAddNote}
            style={{
              background: '#888',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 500,
              alignSelf: 'flex-start',
            }}
          >
            + Add Note
          </button>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid #ddd',
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '8px',
        flexShrink: 0,
      }}>
        <button
          onClick={handleCancel}
          style={{
            background: '#f5f5f5',
            color: '#000',
            border: '1px solid #ddd',
            borderRadius: 4,
            padding: '6px 16px',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          style={{
            background: '#0b5fff', // Blue for important button (matching Component Properties dialog)
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            padding: '6px 16px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 500,
          }}
        >
          Save
        </button>
      </div>

      {/* Resize Handle */}
      <div
        onMouseDown={handleResizeStart}
        style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: '20px',
          height: '20px',
          cursor: 'nwse-resize',
          background: 'linear-gradient(135deg, transparent 0%, transparent 40%, #ccc 40%, #ccc 45%, transparent 45%, transparent 55%, #ccc 55%, #ccc 60%, transparent 60%)',
          zIndex: 10001,
        }}
        title="Drag to resize"
      />
    </div>
  );
};

