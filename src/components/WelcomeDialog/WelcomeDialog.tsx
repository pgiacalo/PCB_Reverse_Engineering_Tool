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

/**
 * WelcomeDialog component
 * Displays a welcome message when no project images are loaded
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';

export interface WelcomeDialogProps {
  /** Whether to show the dialog (typically when no images are loaded) */
  visible: boolean;
  /** Canvas size and position to match video background */
  canvasSize?: { width: number; height: number };
  canvasPosition?: { left: number; top: number };
  /** Callback when user interacts (clicks) - should stop and remove video */
  onDismiss?: () => void;
}

export const WelcomeDialog: React.FC<WelcomeDialogProps> = ({ 
  visible, 
  canvasSize = { width: 960, height: 600 },
  canvasPosition = { left: 244, top: 6 },
  onDismiss
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showVideo, setShowVideo] = useState(true);

  // Stop and remove video when dismissed
  const stopAndRemoveVideo = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.src = '';
      videoRef.current.load(); // Reset video element to free memory
    }
    setShowVideo(false); // Remove video from DOM
    if (onDismiss) {
      onDismiss();
    }
  }, [onDismiss]);

  // Reset showVideo when dialog becomes visible again
  useEffect(() => {
    if (visible) {
      setShowVideo(true);
    }
  }, [visible]);

  // Handle clicks anywhere to dismiss
  useEffect(() => {
    if (!visible) return;

    const handleClick = () => {
      // Stop video and dismiss on any click
      stopAndRemoveVideo();
    };

    // Add click listener to document
    document.addEventListener('click', handleClick, { once: true });
    document.addEventListener('mousedown', handleClick, { once: true });

    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [visible, stopAndRemoveVideo]);

  useEffect(() => {
    if (visible && showVideo && videoRef.current) {
      // Ensure video plays when dialog becomes visible
      videoRef.current.play().catch((error) => {
        console.warn('Video autoplay failed:', error);
      });
    } else if ((!visible || !showVideo) && videoRef.current) {
      // Stop video when dialog becomes invisible or video is dismissed
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = '';
        videoRef.current.load();
      }
    }
  }, [visible, showVideo]);

  if (!visible) return null;

  return (
    <div 
      ref={containerRef}
      onClick={stopAndRemoveVideo}
      style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: '#ffffff', pointerEvents: 'auto', zIndex: 10 }}
    >
      {/* Video background - matches canvas area exactly */}
      {showVideo && (
        <video
          ref={videoRef}
          src={`${import.meta.env.BASE_URL}SplashLoop.mp4`}
          autoPlay
          loop
          muted
          playsInline
          style={{
            position: 'absolute',
            left: `${canvasPosition.left}px`,
            top: `${canvasPosition.top}px`,
            width: `${canvasSize.width}px`,
            height: `${canvasSize.height}px`,
            objectFit: 'cover',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        />
      )}
      {/* Dialog content - centered on top of video */}
    <div 
      onClick={stopAndRemoveVideo}
      style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      textAlign: 'center',
      padding: '24px 32px',
      background: '#ffffff',
      borderRadius: 8,
      border: '2px solid #4CAF50',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        maxWidth: '500px',
        pointerEvents: 'auto',
        zIndex: 2,
        cursor: 'pointer',
    }}>
      <div style={{ fontSize: '16px', fontWeight: 600, color: '#000', marginBottom: '12px' }}>
        PCB Tracer: An Electronics Tool
      </div>
      <div style={{ fontSize: '16px', fontWeight: 600, color: '#000', marginBottom: '16px', lineHeight: '1.5' }}>
        Reverse Engineer, Troubleshoot, Trace Signals,<br />
        Document Tests, Aid Repairs
      </div>
      <div style={{ fontSize: '13px', color: '#555', marginBottom: '8px', lineHeight: '1.5', textAlign: 'left' }}>
        1) Use the File menu to start a new project.
      </div>
      <div style={{ fontSize: '13px', color: '#555', marginBottom: '8px', lineHeight: '1.5', textAlign: 'left' }}>
        2) Use the Images menu to load images.
      </div>
      <div style={{ fontSize: '13px', color: '#555', marginBottom: '12px', lineHeight: '1.5', textAlign: 'left' }}>
        3) Use the tools to draw vias, traces, components, etc.
      </div>
      <div style={{ fontSize: '12px', color: '#666', marginTop: '16px', textAlign: 'center', fontStyle: 'italic', fontWeight: 'bold' }}>
        Best viewed in browser's full screen mode.
      </div>
      </div>
    </div>
  );
};

