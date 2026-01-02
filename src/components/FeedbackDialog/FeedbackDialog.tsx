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

import React, { useState } from 'react';

export interface FeedbackDialogProps {
  /** Whether the dialog is visible */
  visible: boolean;
  /** Callback to close the dialog */
  onClose: () => void;
  /** App version for inclusion in feedback */
  appVersion?: string;
}

export const FeedbackDialog: React.FC<FeedbackDialogProps> = ({
  visible,
  onClose,
  appVersion = '3.1.0',
}) => {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [feedbackType, setFeedbackType] = useState<'bug' | 'feature' | 'question' | 'other'>('other');

  if (!visible) return null;

  const handleSubmit = () => {
    if (!message.trim()) {
      alert('Please enter a message before sending feedback.');
      return;
    }

    // Build email subject with type prefix
    const typePrefix = {
      bug: '[BUG]',
      feature: '[FEATURE REQUEST]',
      question: '[QUESTION]',
      other: '[FEEDBACK]',
    }[feedbackType];

    const emailSubject = subject.trim() 
      ? `${typePrefix} ${subject.trim()}`
      : `${typePrefix} PCB Tracer Feedback`;

    // Build email body with app info
    const emailBody = `${message.trim()}\n\n---\nApp Version: ${appVersion}\nBrowser: ${navigator.userAgent}\nTimestamp: ${new Date().toISOString()}`;

    // Create mailto link
    const mailtoLink = `mailto:sciencethink@gmail.com?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

    // Open email client
    window.location.href = mailtoLink;

    // Reset form and close dialog
    setSubject('');
    setMessage('');
    setFeedbackType('other');
    onClose();
  };

  const handleCancel = () => {
    setSubject('');
    setMessage('');
    setFeedbackType('other');
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10005,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleCancel();
        }
      }}
    >
      <div
        style={{
          backgroundColor: '#2b2b31',
          borderRadius: 8,
          padding: '24px',
          minWidth: '500px',
          maxWidth: '600px',
          maxHeight: '80vh',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          border: '1px solid #1f1f24',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: 600, color: '#f2f2f2' }}>
          Send Feedback
        </h2>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', color: '#e0e0e0', fontSize: '14px', fontWeight: 500 }}>
            Type of Feedback:
          </label>
          <select
            value={feedbackType}
            onChange={(e) => setFeedbackType(e.target.value as typeof feedbackType)}
            style={{
              width: '100%',
              padding: '8px 12px',
              backgroundColor: '#1f1f24',
              border: '1px solid #444',
              borderRadius: 6,
              color: '#f2f2f2',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            <option value="bug">Bug Report</option>
            <option value="feature">Feature Request</option>
            <option value="question">Question</option>
            <option value="other">General Feedback</option>
          </select>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', color: '#e0e0e0', fontSize: '14px', fontWeight: 500 }}>
            Subject (optional):
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Brief description of your feedback"
            style={{
              width: '100%',
              padding: '8px 12px',
              backgroundColor: '#1f1f24',
              border: '1px solid #444',
              borderRadius: 6,
              color: '#f2f2f2',
              fontSize: '14px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <label style={{ display: 'block', marginBottom: '8px', color: '#e0e0e0', fontSize: '14px', fontWeight: 500 }}>
            Message: <span style={{ color: '#ff4444' }}>*</span>
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Please describe your feedback, bug report, feature request, or question..."
            rows={8}
            style={{
              width: '100%',
              padding: '8px 12px',
              backgroundColor: '#1f1f24',
              border: '1px solid #444',
              borderRadius: 6,
              color: '#f2f2f2',
              fontSize: '14px',
              fontFamily: 'inherit',
              resize: 'vertical',
              boxSizing: 'border-box',
              minHeight: '120px',
            }}
            required
          />
        </div>

        <div style={{ 
          marginBottom: '16px', 
          padding: '12px', 
          backgroundColor: '#1f1f24', 
          borderRadius: 6,
          fontSize: '12px',
          color: '#aaa',
          lineHeight: '1.5',
        }}>
          <strong style={{ color: '#e0e0e0' }}>Note:</strong> Clicking "Send Feedback" will open your default email client with this information pre-filled. You can review and edit the message before sending.
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            onClick={handleCancel}
            style={{
              padding: '10px 20px',
              background: 'transparent',
              color: '#f2f2f2',
              border: '1px solid #555',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#3b3b42';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            style={{
              padding: '10px 20px',
              background: '#4CAF50',
              color: '#fff',
              border: '1px solid #45a049',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#45a049';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#4CAF50';
            }}
          >
            Send Feedback
          </button>
        </div>
      </div>
    </div>
  );
};
