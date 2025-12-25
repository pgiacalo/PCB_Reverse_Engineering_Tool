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
 * AuthScreen component
 * Full-screen splash with unified signup/login using email OTP
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { getNetworkManager, type User } from '../../network';

type AuthStep = 'email' | 'otp';

export interface AuthScreenProps {
  /** Callback when authentication is successful */
  onAuthSuccess: (user: User) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess }) => {
  const [step, setStep] = useState<AuthStep>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const emailInputRef = useRef<HTMLInputElement>(null);
  const otpInputRef = useRef<HTMLInputElement>(null);

  // Focus appropriate input on step change
  useEffect(() => {
    if (step === 'email' && emailInputRef.current) {
      emailInputRef.current.focus();
    } else if (step === 'otp' && otpInputRef.current) {
      otpInputRef.current.focus();
    }
  }, [step]);

  const handleEmailSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError('Please enter your email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);

    try {
      const networkManager = getNetworkManager();
      await networkManager.signUpWithOTP(trimmedEmail);
      setSuccessMessage('Check your email for the verification code');
      setStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send verification code');
    } finally {
      setIsLoading(false);
    }
  }, [email]);

  const handleOtpSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const trimmedOtp = otp.trim();
    if (!trimmedOtp) {
      setError('Please enter the verification code');
      return;
    }

    if (!/^\d{6}$/.test(trimmedOtp)) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setIsLoading(true);

    try {
      const networkManager = getNetworkManager();
      const response = await networkManager.loginWithOTP(trimmedOtp);
      onAuthSuccess(response.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid or expired code');
    } finally {
      setIsLoading(false);
    }
  }, [otp, onAuthSuccess]);

  const handleBackToEmail = useCallback(() => {
    setStep('email');
    setOtp('');
    setError(null);
    setSuccessMessage(null);
  }, []);

  const handleResendOtp = useCallback(async () => {
    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      const networkManager = getNetworkManager();
      await networkManager.signUpWithOTP(email.trim().toLowerCase());
      setSuccessMessage('New verification code sent to your email');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend code');
    } finally {
      setIsLoading(false);
    }
  }, [email]);

  return (
    <div style={styles.container}>
      {/* Background gradient matching app theme */}
      <div style={styles.background} />

      {/* Main card */}
      <div style={styles.card}>
        {/* Logo/Title */}
        <div style={styles.header}>
          <h1 style={styles.title}>PCB Tracer</h1>
          <p style={styles.subtitle}>
            Reverse Engineer, Troubleshoot, Repair
          </p>
        </div>

        {/* Success message */}
        {successMessage && (
          <div style={styles.successMessage}>
            {successMessage}
          </div>
        )}

        {/* Error message */}
        {error && (
          <div style={styles.errorMessage}>
            {error}
          </div>
        )}

        {/* Email Step */}
        {step === 'email' && (
          <form onSubmit={handleEmailSubmit} style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Email Address</label>
              <input
                ref={emailInputRef}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={styles.input}
                disabled={isLoading}
                autoComplete="email"
              />
            </div>

            <button
              type="submit"
              style={{
                ...styles.button,
                ...(isLoading ? styles.buttonDisabled : {}),
              }}
              disabled={isLoading}
            >
              {isLoading ? 'Sending...' : 'Continue with Email'}
            </button>

            <p style={styles.helpText}>
              We'll send a verification code to your email
            </p>
          </form>
        )}

        {/* OTP Step */}
        {step === 'otp' && (
          <form onSubmit={handleOtpSubmit} style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Verification Code</label>
              <input
                ref={otpInputRef}
                type="text"
                value={otp}
                onChange={(e) => {
                  // Only allow digits, max 6
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setOtp(value);
                }}
                placeholder="123456"
                style={styles.otpInput}
                disabled={isLoading}
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={6}
              />
            </div>

            <button
              type="submit"
              style={{
                ...styles.button,
                ...(isLoading ? styles.buttonDisabled : {}),
              }}
              disabled={isLoading}
            >
              {isLoading ? 'Verifying...' : 'Verify & Sign In'}
            </button>

            <div style={styles.linkRow}>
              <button
                type="button"
                onClick={handleBackToEmail}
                style={styles.linkButton}
                disabled={isLoading}
              >
                ← Change email
              </button>
              <button
                type="button"
                onClick={handleResendOtp}
                style={styles.linkButton}
                disabled={isLoading}
              >
                Resend code
              </button>
            </div>

            <p style={styles.helpText}>
              Enter the 6-digit code sent to <strong>{email}</strong>
            </p>
          </form>
        )}
      </div>

      {/* Footer */}
      <div style={styles.footer}>
        <p style={styles.footerText}>
          By continuing, you agree to PCB Tracer's Terms of Service
        </p>
      </div>
    </div>
  );
};

// Styles
const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    zIndex: -1,
  },
  card: {
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(10px)',
    borderRadius: '16px',
    padding: '40px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
    border: '2px solid #4CAF50',
    maxWidth: '420px',
    width: '90%',
    textAlign: 'center',
  },
  header: {
    marginBottom: '32px',
  },
  title: {
    fontSize: '28px',
    fontWeight: 700,
    color: '#333',
    margin: '0 0 8px 0',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  subtitle: {
    fontSize: '14px',
    color: '#666',
    margin: 0,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  inputGroup: {
    textAlign: 'left',
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: 600,
    color: '#333',
    marginBottom: '8px',
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    fontSize: '16px',
    border: '2px solid #e0e0e0',
    borderRadius: '8px',
    outline: 'none',
    transition: 'border-color 0.2s ease',
    boxSizing: 'border-box',
    color: '#333',
    backgroundColor: '#fff',
  },
  otpInput: {
    width: '100%',
    padding: '14px 16px',
    fontSize: '24px',
    fontWeight: 600,
    letterSpacing: '8px',
    textAlign: 'center',
    border: '2px solid #e0e0e0',
    borderRadius: '8px',
    outline: 'none',
    transition: 'border-color 0.2s ease',
    boxSizing: 'border-box',
    color: '#333',
    backgroundColor: '#fff',
  },
  button: {
    width: '100%',
    padding: '14px 24px',
    fontSize: '16px',
    fontWeight: 600,
    color: '#fff',
    background: 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 12px rgba(76, 175, 80, 0.3)',
  },
  buttonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
    transform: 'none',
  },
  linkRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '8px',
  },
  linkButton: {
    background: 'none',
    border: 'none',
    color: '#667eea',
    fontSize: '14px',
    cursor: 'pointer',
    padding: '4px 8px',
    textDecoration: 'underline',
    transition: 'color 0.2s ease',
  },
  helpText: {
    fontSize: '13px',
    color: '#888',
    margin: '8px 0 0 0',
    lineHeight: 1.5,
  },
  successMessage: {
    background: 'rgba(76, 175, 80, 0.1)',
    border: '1px solid #4CAF50',
    borderRadius: '8px',
    padding: '12px 16px',
    marginBottom: '16px',
    color: '#2e7d32',
    fontSize: '14px',
  },
  errorMessage: {
    background: 'rgba(244, 67, 54, 0.1)',
    border: '1px solid #f44336',
    borderRadius: '8px',
    padding: '12px 16px',
    marginBottom: '16px',
    color: '#c62828',
    fontSize: '14px',
  },
  footer: {
    marginTop: '24px',
  },
  footerText: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.7)',
    margin: 0,
  },
};

export default AuthScreen;


