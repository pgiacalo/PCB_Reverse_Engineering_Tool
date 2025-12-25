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
 * API Routes Configuration
 * Defines all backend API endpoint paths for the PCB Tracer application
 */

// Base URL for the backend API
// In development, use empty string so requests go through Vite's proxy (avoids CORS)
// In production, use the full backend URL
export const API_BASE_URL = import.meta.env.DEV 
  ? '' 
  : 'https://pcbtracer-staging-bd8cca44225e.herokuapp.com';

// API Key for authenticating requests
export const API_KEY = '09dfbac34888e5197e1ef8a0f77d4fcd7401de3caf09bcc263ff0de709983f867d946c7424aafa7fda5ea8c2b59d56db80519c407e7e6c2ffb8e4b88e7ed76f4';

// Auth routes (no user authentication required, only API key)
export const AUTH_ROUTES = {
  /** POST - Send OTP to email for signup/login. Body: { email: string } */
  SIGNUP_OTP: '/auth/signUpOrContinueWithOTP',
  /** POST - Login with OTP code. Body: { otp: string }. Returns: { accessToken, refreshToken, user } */
  LOGIN: '/auth/login',
} as const;

// API routes (require user authentication via access token)
export const API_ROUTES = {
  /** POST - Refresh access token using refresh token. Returns: { accessToken } */
  TOKEN: '/api/token',
  /** GET - Get current user info. Returns: { user } */
  GET_USER: '/api/getUser',
  /** POST - Delete current user account. Returns: { user } */
  DELETE_USER: '/api/deleteUser',
  /** GET - Get customer/subscription info. Returns: { customer, subscriptionType, subscriptionStatus, subscriptionIsYearly } */
  GET_CUSTOMER: '/api/getCustomer',
} as const;

// Health check routes (no authentication required)
export const HEALTH_ROUTES = {
  /** GET - Health check endpoint */
  CHECK: '/health/check',
} as const;

// HTTP Headers
export const HEADERS = {
  API_KEY: 'X-Starter-Tools-Secret',
  AUTHORIZATION: 'Authorization',
  CONTENT_TYPE: 'Content-Type',
} as const;

// Local storage keys for token persistence
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'pcbtracer_access_token',
  REFRESH_TOKEN: 'pcbtracer_refresh_token',
  USER: 'pcbtracer_user',
} as const;

// Helper to build full URL
export const buildUrl = (path: string): string => `${API_BASE_URL}${path}`;


