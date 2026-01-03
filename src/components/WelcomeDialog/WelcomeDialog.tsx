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

  // Stop and remove video when dismissed - comprehensive cleanup to free memory
  const stopAndRemoveVideo = useCallback(() => {
    if (videoRef.current) {
      const video = videoRef.current;
      
      // Stop playback immediately
      video.pause();
      
      // Clear video source and attributes to free memory
      // Setting srcObject to null clears any MediaStream or Blob sources
      video.srcObject = null;
      video.removeAttribute('src');
      video.src = '';
      
      // Clear any poster image
      video.removeAttribute('poster');
      
      // Reset video element to free buffered data and clear internal state
      video.load();
      
      // Remove the element from DOM (this happens via conditional rendering below)
      // but we also explicitly remove it here to ensure immediate cleanup
    }
    setShowVideo(false); // Remove video from DOM (conditional rendering)
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

  // Note: Click-to-dismiss removed - splash screen only dismisses on File->New Project or File->Open Project

  useEffect(() => {
    if (visible && showVideo && videoRef.current) {
      // Ensure video plays when dialog becomes visible
      videoRef.current.play().catch((error) => {
        console.warn('Video autoplay failed:', error);
      });
    } else if ((!visible || !showVideo) && videoRef.current) {
      // Comprehensive cleanup when dialog becomes invisible or video is dismissed
      const video = videoRef.current;
      video.pause();
      video.removeAttribute('src');
      video.src = '';
      video.srcObject = null; // Clear any MediaStream or Blob sources
      video.load(); // Reset video element to free buffered data
      video.removeAttribute('poster');
    }
  }, [visible, showVideo]);
  
  // Additional cleanup when component unmounts
  useEffect(() => {
    return () => {
      // Cleanup on unmount - ensure video is fully released
      if (videoRef.current) {
        const video = videoRef.current;
        video.pause();
        video.removeAttribute('src');
        video.src = '';
        video.srcObject = null;
        video.load();
        video.removeAttribute('poster');
        if (video.parentNode) {
          video.parentNode.removeChild(video);
        }
      }
    };
  }, []);

  if (!visible) return null;

  return (
    <div 
      ref={containerRef}
      style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: '#ffffff', pointerEvents: 'none', zIndex: 10 }}
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

