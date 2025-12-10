/**
 * Copyright (c) 2025 Philip L. Giacalone
 * Author: Philip L. Giacalone
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

/**
 * PastMachineDialog component
 * Displays a list of history files in reverse chronological order, similar to macOS Time Machine
 */

import React, { useState, useEffect, useRef } from 'react';

export interface HistoryFile {
  name: string;
  lastModified: Date;
  size: number;
  timestamp: Date; // Parsed from filename for accurate sorting
}

export interface PastMachineDialogProps {
  visible: boolean;
  projectDirHandle: FileSystemDirectoryHandle | null;
  onClose: () => void;
  onRestore: (fileName: string) => Promise<void>;
  position?: { x: number; y: number };
  isDragging?: boolean;
  onDragStart?: (e: React.MouseEvent) => void;
}

export const PastMachineDialog: React.FC<PastMachineDialogProps> = ({
  visible,
  projectDirHandle,
  onClose,
  onRestore,
  position,
  isDragging = false,
  onDragStart,
}) => {
  const [historyFiles, setHistoryFiles] = useState<HistoryFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Load history files when dialog becomes visible
  useEffect(() => {
    if (!visible || !projectDirHandle) {
      setHistoryFiles([]);
      setSelectedFile(null);
      setError(null);
      return;
    }

    const loadHistoryFiles = async () => {
      setLoading(true);
      setError(null);
      try {
        // Get history directory
        let historyDirHandle: FileSystemDirectoryHandle;
        try {
          historyDirHandle = await projectDirHandle.getDirectoryHandle('history');
        } catch (e) {
          // History directory doesn't exist yet
          setHistoryFiles([]);
          setLoading(false);
          return;
        }

        // Helper function to parse timestamp from filename
        const parseTimestampFromFilename = (filename: string): Date | null => {
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
        };

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
        setHistoryFiles(files);
      } catch (e) {
        console.error('Failed to load history files:', e);
        setError('Failed to load history files. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadHistoryFiles();
  }, [visible, projectDirHandle]);

  const handleRestore = async () => {
    if (!selectedFile) return;
    try {
      await onRestore(selectedFile);
      onClose();
    } catch (e) {
      console.error('Failed to restore file:', e);
      setError('Failed to restore file. Please try again.');
    }
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!visible) return null;

  // Use provided position or default to center
  const dialogStyle: React.CSSProperties = position
    ? {
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        backgroundColor: '#fff',
        borderRadius: 8,
        minWidth: '500px',
        maxWidth: '700px',
        width: 'fit-content',
        maxHeight: '80%',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        border: '1px solid #ddd',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        cursor: isDragging ? 'grabbing' : 'default',
      }
    : {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: '#fff',
        borderRadius: 8,
        minWidth: '500px',
        maxWidth: '700px',
        width: 'fit-content',
        maxHeight: '80%',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        border: '1px solid #ddd',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
      };

  return (
    <div style={dialogStyle}>
      {/* Header - draggable */}
      <div
        onMouseDown={onDragStart}
        style={{
          backgroundColor: '#f5f5f5',
          padding: '12px 16px',
          borderBottom: '1px solid #ddd',
          borderRadius: '8px 8px 0 0',
          cursor: isDragging ? 'grabbing' : 'move',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#000' }}>
          PastTime
        </h2>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            color: '#666',
            padding: '0 4px',
            lineHeight: 1,
          }}
          title="Close"
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {error && (
          <div style={{ padding: '12px', backgroundColor: '#fee', color: '#c00', borderRadius: 4, marginBottom: '12px' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
            Loading history files...
          </div>
        ) : historyFiles.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
            No history files found.
          </div>
        ) : (
          <>
            <div style={{ marginBottom: '12px', color: '#333', fontSize: '14px' }}>
              Select a file to restore:
            </div>
            {/* Scrollable file list */}
            <div
              ref={listRef}
              style={{
                border: '1px solid #ddd',
                borderRadius: 4,
                overflowY: 'auto',
                maxHeight: '400px',
                backgroundColor: '#fafafa',
              }}
            >
              {historyFiles.map((file, index) => (
                <div
                  key={file.name}
                  onClick={() => setSelectedFile(file.name)}
                  style={{
                    padding: '12px 16px',
                    borderBottom: index < historyFiles.length - 1 ? '1px solid #eee' : 'none',
                    backgroundColor: selectedFile === file.name ? '#e6f0ff' : 'transparent',
                    cursor: 'pointer',
                    transition: 'background-color 0.1s',
                  }}
                  onMouseEnter={(e) => {
                    if (selectedFile !== file.name) {
                      e.currentTarget.style.backgroundColor = '#f5f5f5';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedFile !== file.name) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                    <div style={{ fontWeight: 600, color: '#000', fontSize: '13px', wordBreak: 'break-word', flex: 1 }}>
                      {file.name}
                    </div>
                    <div style={{ color: '#666', fontSize: '12px', marginLeft: '12px', whiteSpace: 'nowrap' }}>
                      {formatFileSize(file.size)}
                    </div>
                  </div>
                  <div style={{ color: '#666', fontSize: '12px' }}>
                    {formatDate(file.lastModified)}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid #ddd', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
        <button
          onClick={onClose}
          style={{
            padding: '6px 16px',
            background: '#f5f5f5',
            border: '1px solid #ddd',
            borderRadius: 4,
            cursor: 'pointer',
            color: '#333',
            fontSize: '13px',
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleRestore}
          disabled={!selectedFile || loading}
          style={{
            padding: '6px 16px',
            background: selectedFile && !loading ? '#0066cc' : '#ccc',
            border: 'none',
            borderRadius: 4,
            cursor: selectedFile && !loading ? 'pointer' : 'not-allowed',
            color: '#fff',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          Restore
        </button>
      </div>
    </div>
  );
};

