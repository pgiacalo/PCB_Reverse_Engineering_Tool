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
 * WelcomeDialog component
 * Displays a welcome message when no project images are loaded
 */

import React from 'react';

export interface WelcomeDialogProps {
  /** Whether to show the dialog (typically when no images are loaded) */
  visible: boolean;
}

export const WelcomeDialog: React.FC<WelcomeDialogProps> = ({ visible }) => {
  if (!visible) return null;

  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      textAlign: 'center',
      padding: '24px 32px',
      background: 'rgba(255, 255, 255, 0.95)',
      borderRadius: 8,
      border: '2px solid #4CAF50',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      zIndex: 1,
      maxWidth: '500px'
    }}>
      <div style={{ fontSize: '16px', fontWeight: 600, color: '#000', marginBottom: '12px' }}>
        PCB Reverse Engineering Tool
      </div>
      <div style={{ fontSize: '16px', fontWeight: 600, color: '#000', marginBottom: '16px', lineHeight: '1.5' }}>
        Supports Typical 4-Layer PCBs
      </div>
      <div style={{ fontSize: '13px', color: '#555', marginBottom: '8px', lineHeight: '1.5', textAlign: 'left' }}>
        1) Use the File menu to start a new project.
      </div>
      <div style={{ fontSize: '13px', color: '#555', marginBottom: '8px', lineHeight: '1.5', textAlign: 'left' }}>
        2) Use the Images menu to load PCB photos.
      </div>
      <div style={{ fontSize: '13px', color: '#555', marginBottom: '12px', lineHeight: '1.5', textAlign: 'left' }}>
        3) Use the tools to draw vias, pads, traces, etc.
      </div>
      <div style={{ fontSize: '13px', color: '#555', marginTop: '16px', lineHeight: '1.5', textAlign: 'left', fontWeight: 'bold' }}>
        Best viewed in browser's Full Screen Mode
      </div>
    </div>
  );
};

