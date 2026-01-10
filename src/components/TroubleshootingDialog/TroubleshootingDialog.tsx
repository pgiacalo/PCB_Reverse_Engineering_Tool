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
 * TroubleshootingDialog component
 * Displays troubleshooting analysis interface with symptom selection, measurement data selection,
 * and AI-powered root cause analysis results.
 */

import React, { useState, useEffect } from 'react';
import type { ProjectMetadata, ProjectNote } from '../ProjectNotesDialog/ProjectNotesDialog';
import type { DrawingStroke } from '../../types';

export interface TroubleshootingDialogProps {
  /** Whether the dialog is visible */
  visible: boolean;
  /** Project metadata (read-only display) */
  projectMetadata: ProjectMetadata;
  /** Project notes array (for symptom and measurement selection) */
  projectNotes: ProjectNote[];
  /** Drawing strokes (for test point data) */
  drawingStrokes: DrawingStroke[];
  /** Existing troubleshooting results to display */
  troubleshootingResults: string | null;
  /** Whether to include PCB data in analysis */
  includePcbData: boolean;
  /** Callback when PCB data inclusion changes */
  onIncludePcbDataChange: (include: boolean) => void;
  /** Callback to run analysis */
  onRunAnalysis: (selectedSymptomIndices: number[], selectedMeasurementIndices: number[], includePcbData: boolean) => Promise<void>;
  /** Callback to get the prompt that will be sent (for preview/edit) */
  onGetPrompt: (selectedSymptomIndices: number[], selectedMeasurementIndices: number[], includePcbData: boolean) => Promise<string>;
  /** Callback to close the dialog */
  onClose: () => void;
  /** Dialog position for dragging */
  position: { x: number; y: number } | null;
  /** Whether the dialog is being dragged */
  isDragging: boolean;
  /** Callback when drag starts */
  onDragStart: (e: React.MouseEvent<HTMLDivElement>) => void;
  /** Whether analysis is in progress */
  isAnalyzing: boolean;
}

export const TroubleshootingDialog: React.FC<TroubleshootingDialogProps> = ({
  visible,
  projectMetadata,
  projectNotes,
  drawingStrokes: _drawingStrokes,
  troubleshootingResults,
  includePcbData,
  onIncludePcbDataChange,
  onRunAnalysis,
  onGetPrompt,
  onClose,
  position,
  isDragging,
  onDragStart,
  isAnalyzing,
}) => {
  const [selectedSymptomIndices, setSelectedSymptomIndices] = useState<Set<number>>(new Set());
  const [selectedMeasurementIndices, setSelectedMeasurementIndices] = useState<Set<number>>(new Set());
  const [dialogSize, setDialogSize] = useState({ width: Math.min(window.innerWidth * 0.85, 1200), height: window.innerHeight * 0.75 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [showPromptDialog, setShowPromptDialog] = useState(false);
  const [promptText, setPromptText] = useState<string>('');

  // Reset selections when dialog opens
  useEffect(() => {
    if (visible) {
      setSelectedSymptomIndices(new Set());
      setSelectedMeasurementIndices(new Set());
    }
  }, [visible]);

  // Handle resize mouse events
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStart.x;
      const deltaY = e.clientY - resizeStart.y;
      const newWidth = Math.max(600, Math.min(window.innerWidth - 20, resizeStart.width + deltaX));
      const newHeight = Math.max(400, Math.min(window.innerHeight - 20, resizeStart.height + deltaY));
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

  const handleSymptomToggle = (index: number) => {
    setSelectedSymptomIndices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const handleMeasurementToggle = (index: number) => {
    setSelectedMeasurementIndices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const handleRunAnalysis = async () => {
    if (selectedSymptomIndices.size === 0) {
      alert('Please select at least one symptom to analyze.');
      return;
    }
    
    await onRunAnalysis(
      Array.from(selectedSymptomIndices),
      Array.from(selectedMeasurementIndices),
      includePcbData
    );
  };

  const handleCopyResults = () => {
    if (troubleshootingResults) {
      navigator.clipboard.writeText(troubleshootingResults).then(() => {
        alert('Results copied to clipboard');
      }).catch(err => {
        console.error('Failed to copy:', err);
        alert('Failed to copy results to clipboard');
      });
    }
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

  if (!visible) return null;

  return (
    <div style={dialogStyle}>
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
        <h2 style={{ margin: 0, fontSize: '12px', color: '#fff', fontWeight: 600 }}>Troubleshooting Analysis</h2>
        <button
          onClick={onClose}
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
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Product Information */}
        <div style={{ padding: '12px', backgroundColor: '#f9f9f9', borderRadius: '4px', border: '1px solid #e0e0e0' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600, color: '#333' }}>Product Information</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', color: '#000' }}>
            <div><strong>Product Name:</strong> {projectMetadata.productName || 'Not specified'}</div>
            <div><strong>Model Number:</strong> {projectMetadata.modelNumber || 'Not specified'}</div>
            <div><strong>Manufacturer:</strong> {projectMetadata.manufacturer || 'Not specified'}</div>
            <div><strong>Date Manufactured:</strong> {projectMetadata.dateManufactured || 'Not specified'}</div>
          </div>
        </div>

        {/* Symptom Selection */}
        <div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600, color: '#333' }}>Select Symptoms</h3>
          <div style={{ border: '1px solid #ddd', borderRadius: '4px', maxHeight: '150px', overflowY: 'auto' }}>
            {projectNotes.length === 0 ? (
              <div style={{ padding: '12px', color: '#666', fontSize: '12px' }}>No project notes available. Add symptoms in Project Notes first.</div>
            ) : (
              projectNotes.map((note, index) => (
                <div
                  key={index}
                  style={{
                    padding: '8px 12px',
                    borderBottom: index < projectNotes.length - 1 ? '1px solid #eee' : 'none',
                    backgroundColor: selectedSymptomIndices.has(index) ? '#e3f2fd' : 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                  }}
                  onClick={() => handleSymptomToggle(index)}
                >
                  <label className="radio-label" style={{ margin: 0, marginTop: '2px' }}>
                    <input
                      type="checkbox"
                      checked={selectedSymptomIndices.has(index)}
                      onChange={() => handleSymptomToggle(index)}
                    />
                  </label>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '12px', color: '#000', marginBottom: '2px' }}>{note.name}</div>
                    <div style={{ fontSize: '11px', color: '#666' }}>{note.value}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Measurement Data Selection */}
        <div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600, color: '#333' }}>Select Measurement Data (Optional)</h3>
          <div style={{ border: '1px solid #ddd', borderRadius: '4px', maxHeight: '150px', overflowY: 'auto' }}>
            {projectNotes.length === 0 ? (
              <div style={{ padding: '12px', color: '#666', fontSize: '12px' }}>No project notes available.</div>
            ) : (
              projectNotes.map((note, index) => (
                <div
                  key={index}
                  style={{
                    padding: '8px 12px',
                    borderBottom: index < projectNotes.length - 1 ? '1px solid #eee' : 'none',
                    backgroundColor: selectedMeasurementIndices.has(index) ? '#fff3e0' : 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                  }}
                  onClick={() => handleMeasurementToggle(index)}
                >
                  <label className="radio-label" style={{ margin: 0, marginTop: '2px' }}>
                    <input
                      type="checkbox"
                      checked={selectedMeasurementIndices.has(index)}
                      onChange={() => handleMeasurementToggle(index)}
                    />
                  </label>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '12px', color: '#000', marginBottom: '2px' }}>{note.name}</div>
                    <div style={{ fontSize: '11px', color: '#666' }}>{note.value}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Options */}
        <div style={{ padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '4px', border: '1px solid #e0e0e0' }}>
          <label className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', color: '#000' }}>
            <input
              type="checkbox"
              checked={includePcbData}
              onChange={(e) => onIncludePcbDataChange(e.target.checked)}
            />
            <span>Include PCB component and netlist data in analysis</span>
          </label>
          <div style={{ marginTop: '4px', fontSize: '11px', color: '#666' }}>
            If checked, system will automatically detect identical signal paths and compare measurements. Test point data will also be included.
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={async () => {
              if (selectedSymptomIndices.size === 0) {
                alert('Please select at least one symptom to analyze.');
                return;
              }
              try {
                const prompt = await onGetPrompt(
                  Array.from(selectedSymptomIndices),
                  Array.from(selectedMeasurementIndices),
                  includePcbData
                );
                setPromptText(prompt);
                setShowPromptDialog(true);
              } catch (error) {
                alert(`Error generating prompt: ${error instanceof Error ? error.message : 'Unknown error'}`);
              }
            }}
            disabled={selectedSymptomIndices.size === 0 || isAnalyzing}
            style={{
              padding: '10px 20px',
              backgroundColor: selectedSymptomIndices.size === 0 || isAnalyzing ? '#ccc' : '#2196F3',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: selectedSymptomIndices.size === 0 || isAnalyzing ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 600,
              flex: 1,
            }}
          >
            View/Edit Prompt
          </button>
          <button
            onClick={handleRunAnalysis}
            disabled={selectedSymptomIndices.size === 0 || isAnalyzing}
            style={{
              padding: '10px 20px',
              backgroundColor: selectedSymptomIndices.size === 0 || isAnalyzing ? '#ccc' : '#4CAF50',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: selectedSymptomIndices.size === 0 || isAnalyzing ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 600,
              flex: 1,
            }}
          >
            {isAnalyzing ? 'Analyzing...' : 'Run Troubleshooting Analysis'}
          </button>
        </div>

        {/* Results Display */}
        {troubleshootingResults && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#333' }}>Analysis Results</h3>
              <button
                onClick={handleCopyResults}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#2196F3',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                Copy to Clipboard
              </button>
            </div>
            <div
              style={{
                border: '1px solid #ddd',
                borderRadius: '4px',
                padding: '12px',
                backgroundColor: '#fafafa',
                maxHeight: '300px',
                overflowY: 'auto',
                fontSize: '12px',
                color: '#000',
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace',
              }}
            >
              {troubleshootingResults}
            </div>
          </div>
        )}
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={handleResizeStart}
        style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: '20px',
          height: '20px',
          cursor: 'nwse-resize',
          background: 'linear-gradient(-45deg, transparent 40%, #999 40%, #999 45%, transparent 45%, transparent 55%, #999 55%, #999 60%, transparent 60%)',
        }}
      />

      {/* Prompt View/Edit Dialog */}
      {showPromptDialog && (
        <div
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '80%',
            maxWidth: '900px',
            maxHeight: '80vh',
            backgroundColor: '#fff',
            borderRadius: 8,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            border: '1px solid #ddd',
            zIndex: 10001,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid #e0e0e0',
              background: '#888',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '14px', color: '#fff', fontWeight: 600 }}>AI Prompt Preview/Edit</h3>
            <button
              onClick={() => setShowPromptDialog(false)}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '18px',
                cursor: 'pointer',
                color: '#fff',
                padding: '0 4px',
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              style={{
                width: '100%',
                minHeight: '400px',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '12px',
                fontFamily: 'monospace',
                color: '#000',
                backgroundColor: '#fafafa',
                resize: 'vertical',
              }}
              spellCheck={false}
            />
          </div>
          <div style={{ padding: '12px 16px', borderTop: '1px solid #e0e0e0', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button
              onClick={() => {
                navigator.clipboard.writeText(promptText).then(() => {
                  alert('Prompt copied to clipboard');
                }).catch(err => {
                  console.error('Failed to copy:', err);
                  alert('Failed to copy prompt to clipboard');
                });
              }}
              style={{
                padding: '8px 16px',
                backgroundColor: '#2196F3',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              Copy to Clipboard
            </button>
            <button
              onClick={() => setShowPromptDialog(false)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#666',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
