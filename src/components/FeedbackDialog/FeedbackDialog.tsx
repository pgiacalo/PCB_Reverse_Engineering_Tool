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
  appVersion = '3.2.0',
}) => {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [replyToEmail, setReplyToEmail] = useState('');
  const [feedbackType, setFeedbackType] = useState<'bug' | 'feature' | 'question' | 'other'>('other');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [submitMessage, setSubmitMessage] = useState('');

  if (!visible) return null;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    if (!message.trim()) {
      setSubmitStatus('error');
      setSubmitMessage('Please enter a message before sending feedback.');
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus('idle');
    setSubmitMessage('');

    // Build email subject - always include "PCB Tracer" for easy inbox searching
    const typePrefix = {
      bug: '[BUG]',
      feature: '[FEATURE REQUEST]',
      question: '[QUESTION]',
      other: '[FEEDBACK]',
    }[feedbackType];

    const emailSubject = subject.trim() 
      ? `[PCB Tracer] ${typePrefix} ${subject.trim()}`
      : `[PCB Tracer] ${typePrefix} Feedback`;

    // Build email body with app info
    const emailBody = `${message.trim()}\n\n---\nApp Version: ${appVersion}\nBrowser: ${navigator.userAgent}\nTimestamp: ${new Date().toISOString()}`;

    try {
      // Use Web3Forms API to send email directly
      const formData = new FormData();
      formData.append('access_key', '1bbde7fe-a68d-4e70-97fe-2988d8b9c08d');
      formData.append('subject', emailSubject);
      formData.append('message', emailBody);
      formData.append('from_name', 'PCB Tracer User');
      formData.append('to_email', 'sciencethink@gmail.com');
      // Add reply-to email if provided
      if (replyToEmail.trim()) {
        formData.append('replyto', replyToEmail.trim());
      }

      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        setSubmitStatus('success');
        setSubmitMessage('Thank you! Your feedback has been sent successfully.');
        
        // Reset form and close dialog after 2 seconds
        setTimeout(() => {
          setSubject('');
          setMessage('');
          setFeedbackType('other');
          setIsSubmitting(false);
          setSubmitStatus('idle');
          setSubmitMessage('');
          onClose();
        }, 2000);
      } else {
        throw new Error(data.message || 'Failed to send feedback');
      }
    } catch (error) {
      console.error('Error sending feedback:', error);
      setIsSubmitting(false);
      setSubmitStatus('error');
      setSubmitMessage(
        error instanceof Error 
          ? `Failed to send feedback: ${error.message}. Please try again or email sciencethink@gmail.com directly.`
          : 'Failed to send feedback. Please try again or email sciencethink@gmail.com directly.'
      );
    }
  };

  const handleCancel = () => {
    setSubject('');
    setMessage('');
    setReplyToEmail('');
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

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', color: '#e0e0e0', fontSize: '14px', fontWeight: 500 }}>
            Your Email (optional):
          </label>
          <input
            type="email"
            value={replyToEmail}
            onChange={(e) => setReplyToEmail(e.target.value)}
            placeholder="your.email@example.com"
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
          <div style={{ marginTop: '4px', fontSize: '12px', color: '#aaa' }}>
            If provided, we can reply to your feedback via email.
          </div>
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

        {/* Status message display */}
        {submitStatus !== 'idle' && submitMessage && (
          <div style={{ 
            marginBottom: '16px', 
            padding: '12px', 
            backgroundColor: submitStatus === 'success' ? '#1f3f1f' : '#3f1f1f',
            border: `1px solid ${submitStatus === 'success' ? '#4CAF50' : '#ff4444'}`,
            borderRadius: 6,
            fontSize: '13px',
            color: submitStatus === 'success' ? '#4CAF50' : '#ff4444',
            lineHeight: '1.5',
          }}>
            {submitStatus === 'success' ? '✅ ' : '❌ '}
            {submitMessage}
          </div>
        )}

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
            disabled={isSubmitting}
            style={{
              padding: '10px 20px',
              background: isSubmitting ? '#666' : '#4CAF50',
              color: '#fff',
              border: isSubmitting ? '1px solid #555' : '1px solid #45a049',
              borderRadius: 6,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 600,
              opacity: isSubmitting ? 0.6 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isSubmitting) {
                e.currentTarget.style.background = '#45a049';
              }
            }}
            onMouseLeave={(e) => {
              if (!isSubmitting) {
                e.currentTarget.style.background = '#4CAF50';
              }
            }}
          >
            {isSubmitting ? 'Sending...' : 'Send Feedback'}
          </button>
        </div>
      </div>
    </div>
  );
};
