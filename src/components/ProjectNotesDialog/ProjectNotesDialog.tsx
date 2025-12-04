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
 * ProjectNotesDialog component
 * Displays and allows editing of project notes as a tabular list (Name, Value)
 */

import React, { useState, useEffect, useRef } from 'react';

export interface ProjectNote {
  name: string;
  value: string;
  checked?: boolean;
}

export interface ProjectNotesDialogProps {
  /** Whether the dialog is visible */
  visible: boolean;
  /** Project notes array */
  projectNotes: ProjectNote[];
  /** Callback to update project notes */
  setProjectNotes: (notes: ProjectNote[]) => void;
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
  onClose,
  position,
  isDragging,
  onDragStart,
}) => {
  const [localNotes, setLocalNotes] = useState<ProjectNote[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<'name' | 'value' | null>(null);
  const inputRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());
  const [dialogSize, setDialogSize] = useState({ width: Math.min(window.innerWidth * 0.85, 1400), height: window.innerHeight * 0.7 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });

  // Sync local state with props
  useEffect(() => {
    if (visible) {
      setLocalNotes([...projectNotes]);
      setEditingIndex(null);
      setEditingField(null);
    }
  }, [visible, projectNotes]);

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
    onClose(); // Save and close
  };

  const handleCancel = () => {
    setLocalNotes([...projectNotes]);
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
    // Alt+Enter: Insert line break (Excel behavior)
    if (e.key === 'Enter' && e.altKey) {
      // Allow default behavior (line break in textarea)
      return;
    }
    
    // Arrow Keys: Navigate between cells
    if (e.key === 'ArrowRight' && !e.ctrlKey && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      if (field === 'name') {
        // Move to value in same row
        const valueKey = `${index}-value`;
        const valueInput = inputRefs.current.get(valueKey);
        if (valueInput) {
          valueInput.focus();
          setEditingIndex(index);
          setEditingField('value');
        }
      }
      return;
    }
    
    if (e.key === 'ArrowLeft' && !e.ctrlKey && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      if (field === 'value') {
        // Move to name in same row
        const nameKey = `${index}-name`;
        const nameInput = inputRefs.current.get(nameKey);
        if (nameInput) {
          nameInput.focus();
          setEditingIndex(index);
          setEditingField('name');
        }
      }
      return;
    }
    
    if (e.key === 'ArrowDown' && !e.ctrlKey && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      // Move to same field in next row, or create new row if at end
      if (index < localNotes.length - 1) {
        const nextKey = `${index + 1}-${field}`;
        const nextInput = inputRefs.current.get(nextKey);
        if (nextInput) {
          nextInput.focus();
          setEditingIndex(index + 1);
          setEditingField(field);
        }
      } else {
        // At last row, create new row and focus on same field
        handleAddNote();
        setTimeout(() => {
          const newKey = `${localNotes.length}-${field}`;
          const newInput = inputRefs.current.get(newKey);
          if (newInput) {
            newInput.focus();
          }
        }, 0);
      }
      return;
    }
    
    if (e.key === 'ArrowUp' && !e.ctrlKey && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      // Move to same field in previous row
      if (index > 0) {
        const prevKey = `${index - 1}-${field}`;
        const prevInput = inputRefs.current.get(prevKey);
        if (prevInput) {
          prevInput.focus();
          setEditingIndex(index - 1);
          setEditingField(field);
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
          setEditingIndex(index);
          setEditingField('value');
        }
      } else if (field === 'value') {
        // Move to name in next row, or create new row if at end
        if (index < localNotes.length - 1) {
          const nextNameKey = `${index + 1}-name`;
          const nextNameInput = inputRefs.current.get(nextNameKey);
          if (nextNameInput) {
            nextNameInput.focus();
            setEditingIndex(index + 1);
            setEditingField('name');
          }
        } else {
          // At last row, create new row and focus on its name
          handleAddNote();
          setTimeout(() => {
            const newNameKey = `${localNotes.length}-name`;
            const newNameInput = inputRefs.current.get(newNameKey);
            if (newNameInput) {
              newNameInput.focus();
            }
          }, 0);
        }
      }
      return;
    }
    
    // Tab: Move to next field (name -> value -> next row's name -> next row's value, etc.)
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      if (field === 'name') {
        // Move to value in same row
        const valueKey = `${index}-value`;
        const valueInput = inputRefs.current.get(valueKey);
        if (valueInput) {
          valueInput.focus();
          setEditingIndex(index);
          setEditingField('value');
        }
      } else if (field === 'value') {
        // Move to name in next row, or create new row if at end
        if (index < localNotes.length - 1) {
          const nextNameKey = `${index + 1}-name`;
          const nextNameInput = inputRefs.current.get(nextNameKey);
          if (nextNameInput) {
            nextNameInput.focus();
            setEditingIndex(index + 1);
            setEditingField('name');
          }
        } else {
          // At last row, create new row and focus on its name
          handleAddNote();
          setTimeout(() => {
            const newNameKey = `${localNotes.length}-name`;
            const newNameInput = inputRefs.current.get(newNameKey);
            if (newNameInput) {
              newNameInput.focus();
            }
          }, 0);
        }
      }
    }
  };

  const handleFieldBlur = () => {
    setEditingIndex(null);
    setEditingField(null);
  };

  const handleFieldClick = (index: number, field: 'name' | 'value') => {
    setEditingIndex(index);
    setEditingField(field);
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
      onMouseDown={(e) => {
        // Only start dragging if clicking on the header area, not the resize handle
        const target = e.target as HTMLElement;
        if (target.closest('[title="Drag to resize"]')) {
          return; // Don't drag when clicking resize handle
        }
        onDragStart(e);
      }}
    >
      {/* Header */}
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid #e0e0e0',
        background: '#888',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        cursor: 'move',
        userSelect: 'none',
      }}>
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
            ) : (
              localNotes.map((note, index) => (
                <div
                  key={index}
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
                        onChange={(e) => handleCheckboxChange(index, e.target.checked)}
                      />
                    </label>
                  </div>

                  {/* Name Column */}
                  <div style={{ padding: '8px 12px', borderRight: '1px solid #ccc' }}>
                    {editingIndex === index && editingField === 'name' ? (
                      <textarea
                        ref={(el) => {
                          if (el) inputRefs.current.set(`${index}-name`, el);
                          else inputRefs.current.delete(`${index}-name`);
                        }}
                        value={note.name}
                        onChange={(e) => handleFieldChange(index, 'name', e.target.value)}
                        onBlur={handleFieldBlur}
                        onKeyDown={(e) => handleKeyDown(e, index, 'name')}
                        autoFocus
                        rows={1}
                        style={{
                          width: '100%',
                          padding: '4px 6px',
                          border: '1px solid #ccc',
                          borderRadius: 3,
                          fontSize: '12px',
                          backgroundColor: '#fff',
                          color: '#000',
                          fontFamily: 'inherit',
                          resize: 'vertical',
                          minHeight: '20px',
                          lineHeight: '1.4',
                          overflow: 'hidden',
                        }}
                        onInput={(e) => {
                          // Auto-resize textarea to fit content
                          const target = e.target as HTMLTextAreaElement;
                          target.style.height = 'auto';
                          target.style.height = `${target.scrollHeight}px`;
                        }}
                      />
                    ) : (
                      <div
                        onClick={() => handleFieldClick(index, 'name')}
                        style={{
                          padding: '4px 6px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          minHeight: '20px',
                          color: note.name.trim() ? '#000' : '#999',
                          whiteSpace: 'pre-wrap',
                          wordWrap: 'break-word',
                        }}
                        title="Click to edit"
                      >
                        {note.name.trim() || '(empty)'}
                      </div>
                    )}
                  </div>

                  {/* Value Column */}
                  <div style={{ padding: '8px 12px', borderRight: '1px solid #ccc' }}>
                    {editingIndex === index && editingField === 'value' ? (
                      <textarea
                        ref={(el) => {
                          if (el) inputRefs.current.set(`${index}-value`, el);
                          else inputRefs.current.delete(`${index}-value`);
                        }}
                        value={note.value}
                        onChange={(e) => handleFieldChange(index, 'value', e.target.value)}
                        onBlur={handleFieldBlur}
                        onKeyDown={(e) => handleKeyDown(e, index, 'value')}
                        autoFocus
                        rows={1}
                        style={{
                          width: '100%',
                          padding: '4px 6px',
                          border: '1px solid #ccc',
                          borderRadius: 3,
                          fontSize: '12px',
                          backgroundColor: '#fff',
                          color: '#000',
                          fontFamily: 'inherit',
                          resize: 'vertical',
                          minHeight: '20px',
                          lineHeight: '1.4',
                          overflow: 'hidden',
                        }}
                        onInput={(e) => {
                          // Auto-resize textarea to fit content
                          const target = e.target as HTMLTextAreaElement;
                          target.style.height = 'auto';
                          target.style.height = `${target.scrollHeight}px`;
                        }}
                      />
                    ) : (
                      <div
                        onClick={() => handleFieldClick(index, 'value')}
                        style={{
                          padding: '4px 6px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          minHeight: '20px',
                          color: note.value.trim() ? '#000' : '#999',
                          whiteSpace: 'pre-wrap',
                          wordWrap: 'break-word',
                        }}
                        title="Click to edit"
                      >
                        {note.value.trim() || '(empty)'}
                      </div>
                    )}
                  </div>

                  {/* Actions Column */}
                  <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <button
                      onClick={() => handleDeleteNote(index)}
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
              ))
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

