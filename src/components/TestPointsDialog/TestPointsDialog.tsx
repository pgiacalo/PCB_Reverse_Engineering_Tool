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
 * TestPointsDialog component
 * Displays a list of all test points with their notes and Find buttons
 */

import React, { useState, useEffect } from 'react';

// DrawingStroke type matches App.tsx's local interface
interface DrawingStroke {
  id: string;
  points: Array<{ x: number; y: number; id?: number }>;
  color: string;
  size: number;
  layer: 'top' | 'bottom';
  type?: 'trace' | 'via' | 'pad' | 'testPoint';
  notes?: string | null;
  testPointType?: 'power' | 'ground' | 'signal' | 'unknown';
}

export interface TestPointsDialogProps {
  /** Whether the dialog is visible */
  visible: boolean;
  /** Drawing strokes (to filter test points) */
  drawingStrokes: DrawingStroke[];
  /** Callback to close the dialog */
  onClose: () => void;
  /** Callback to find and center on a test point */
  onFindTestPoint?: (strokeId: string, x: number, y: number) => void;
  /** Dialog position for dragging */
  position: { x: number; y: number } | null;
  /** Whether the dialog is being dragged */
  isDragging: boolean;
  /** Callback when drag starts */
  onDragStart: (e: React.MouseEvent<HTMLDivElement>) => void;
  /** Function to determine test point type based on Node ID */
  determineTestPointType: (nodeId: number, powerBuses: any[]) => string;
  /** Power buses for type determination */
  powerBuses: any[];
}

export const TestPointsDialog: React.FC<TestPointsDialogProps> = ({
  visible,
  drawingStrokes,
  onClose,
  onFindTestPoint,
  position,
  isDragging,
  onDragStart,
  determineTestPointType,
  powerBuses,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Clear search when dialog opens
  useEffect(() => {
    if (visible) {
      setSearchQuery('');
    }
  }, [visible]);

  if (!visible) return null;

  // Filter test points from drawing strokes
  const allTestPoints = drawingStrokes.filter(s => s.type === 'testPoint' && s.points.length > 0);
  
  // Filter test points based on search query (search in notes)
  const testPoints = searchQuery.trim() === ''
    ? allTestPoints
    : allTestPoints.filter(stroke => {
        const notes = stroke.notes || '';
        return notes.toLowerCase().includes(searchQuery.toLowerCase());
      });

  // Use provided position or default to right side
  const dialogStyle: React.CSSProperties = position
    ? {
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        backgroundColor: '#fff',
        borderRadius: 8,
        minWidth: '150px',
        maxWidth: '500px',
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
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      };

  const contentStyle: React.CSSProperties = {
    padding: '20px',
    overflow: 'auto',
    flex: 1,
  };

  return (
    <div style={dialogStyle}>
      {/* Fixed header - does not scroll */}
      <div 
        onMouseDown={(e) => {
          // Only start dragging if clicking on the header (not buttons)
          const target = e.target as HTMLElement;
          if (target.tagName === 'BUTTON' || target.closest('button')) {
            return;
          }
          if (position) {
            onDragStart(e);
          }
        }}
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          padding: '6px',
          borderBottom: '1px solid #e0e0e0',
          background: '#888', // Medium gray background for grabbable window border
          cursor: isDragging ? 'grabbing' : (position ? 'grab' : 'default'),
          userSelect: 'none',
          flexShrink: 0,
        }}
      >
        <h2 style={{ margin: 0, fontSize: '12px', color: '#fff', fontWeight: 600 }}>Test Points</h2>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            fontSize: '14px',
            cursor: 'pointer',
            color: '#fff',
            padding: 0,
            width: '16px',
            height: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ×
        </button>
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
          placeholder="Search test point notes..."
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
            // Search is performed automatically via filtered testPoints
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
      
      <div style={contentStyle}>
        {allTestPoints.length === 0 ? (
          <div style={{
            padding: '24px',
            textAlign: 'center',
            color: '#999',
            fontSize: '13px',
          }}>
            No test points found.
          </div>
        ) : testPoints.length === 0 ? (
          <div style={{
            padding: '24px',
            textAlign: 'center',
            color: '#999',
            fontSize: '13px',
          }}>
            No matches found for "{searchQuery}".
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {testPoints.map((stroke) => {
              const point = stroke.points[0];
              // Determine test point type using the same logic as DetailedInfoDialog
              const testPointTypeString = point.id !== undefined 
                ? determineTestPointType(point.id, powerBuses) 
                : 'Test Point';
              
              // Extract the type label (e.g., "Test Point", "Test Point (+5VDC Power Node)", "Test Point (Ground)")
              const typeLabel = testPointTypeString.includes('(') 
                ? testPointTypeString.substring(0, testPointTypeString.indexOf('(')).trim()
                : testPointTypeString;
              
              return (
                <div 
                  key={stroke.id} 
                  style={{ 
                    padding: '12px',
                    backgroundColor: '#fff',
                    borderRadius: 4,
                    border: '1px solid #ddd',
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    marginBottom: '8px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {/* Yellow Test Point diamond icon (matches Toolbar icon) */}
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                        <path
                          d="M 12 5 L 19 12 L 12 19 L 5 12 Z"
                          fill="#FFD700"
                          stroke="#000"
                          strokeWidth="1.5"
                        />
                      </svg>
                      <div style={{ fontSize: '12px', fontWeight: 500, color: '#000' }}>
                        {typeLabel}
                      </div>
                    </div>
                    {onFindTestPoint && (
                      <button
                        onClick={() => {
                          onFindTestPoint(stroke.id, point.x, point.y);
                        }}
                        style={{
                          padding: '4px 12px',
                          fontSize: '11px',
                          backgroundColor: '#4CAF50',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontWeight: 500,
                          whiteSpace: 'nowrap',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#45a049';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#4CAF50';
                        }}
                      >
                        Find
                      </button>
                    )}
                  </div>
                  {stroke.notes && stroke.notes.trim() !== '' ? (
                    <div style={{ 
                      fontSize: '11px', 
                      color: '#666', 
                      marginTop: '8px',
                      padding: '8px',
                      backgroundColor: '#f5f5f5',
                      borderRadius: '3px',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}>
                      {stroke.notes}
                    </div>
                  ) : (
                    <div style={{ 
                      fontSize: '11px', 
                      color: '#999', 
                      fontStyle: 'italic',
                      marginTop: '8px',
                    }}>
                      No notes
                    </div>
                  )}
                  <div style={{ 
                    fontSize: '10px', 
                    color: '#999', 
                    marginTop: '8px',
                  }}>
                    Layer: {stroke.layer} | Position: ({point.x.toFixed(2)}, {point.y.toFixed(2)})
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

