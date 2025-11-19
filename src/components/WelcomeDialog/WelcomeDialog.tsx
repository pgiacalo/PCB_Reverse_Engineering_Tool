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
      <div style={{ fontSize: '13px', color: '#555', marginBottom: '8px', lineHeight: '1.5' }}>
        Use the <strong>File</strong> menu to start a new project.
      </div>
      <div style={{ fontSize: '13px', color: '#555', marginBottom: '12px', lineHeight: '1.5' }}>
        Use the <strong>Images</strong> menu to load PCB photos.
      </div>
    </div>
  );
};

