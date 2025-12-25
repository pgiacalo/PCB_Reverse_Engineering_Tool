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
 * Network Manager
 * Singleton class handling all API communication with automatic token refresh
 */

import {
  API_KEY,
  AUTH_ROUTES,
  API_ROUTES,
  HEALTH_ROUTES,
  HEADERS,
  STORAGE_KEYS,
  buildUrl,
} from './routes';

// Types for API responses
export interface User {
  _id: string;
  id: string;
  email: string;
  loginOrSignupIPAddress?: string;
  hasTrackedTrialStart: boolean;
  hasTrackedInitialSubscription: boolean;
  createdAt: string;
  updatedAt: string;
  isNewUser?: boolean;
  isTestUser?: boolean;
  customerId?: string;
  referralCode?: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface TokenResponse {
  accessToken: string;
}

export interface GetUserResponse {
  user: User;
}

export interface DeleteUserResponse {
  user: User;
}

export interface GetCustomerResponse {
  customer: unknown;
  subscriptionType: string;
  subscriptionStatus: string;
  subscriptionIsYearly: boolean;
}

export interface ApiError {
  errorMessage: string;
}

/**
 * NetworkManager - Singleton class for handling API requests
 * Automatically handles token storage, refresh, and retry logic
 */
class NetworkManager {
  private static instance: NetworkManager | null = null;
  private isRefreshing = false;
  private refreshPromise: Promise<boolean> | null = null;

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get the singleton instance of NetworkManager
   */
  public static getInstance(): NetworkManager {
    if (!NetworkManager.instance) {
      NetworkManager.instance = new NetworkManager();
    }
    return NetworkManager.instance;
  }

  // ============================================
  // Token Management
  // ============================================

  /**
   * Get the stored access token
   */
  public getAccessToken(): string | null {
    return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  }

  /**
   * Get the stored refresh token
   */
  public getRefreshToken(): string | null {
    return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  }

  /**
   * Get the stored user
   */
  public getStoredUser(): User | null {
    const userJson = localStorage.getItem(STORAGE_KEYS.USER);
    if (userJson) {
      try {
        return JSON.parse(userJson);
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Store access token
   */
  private setAccessToken(token: string): void {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
  }

  /**
   * Store refresh token
   */
  private setRefreshToken(token: string): void {
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, token);
  }

  /**
   * Store user data
   */
  private setUser(user: User): void {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  }

  /**
   * Clear all stored auth data
   */
  private clearAuth(): void {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
  }

  /**
   * Check if user is logged in (has a refresh token)
   */
  public isLoggedIn(): boolean {
    return this.getRefreshToken() !== null;
  }

  // ============================================
  // Request Helpers
  // ============================================

  /**
   * Build headers for API requests
   */
  private buildHeaders(includeAuth: boolean = false, useRefreshToken: boolean = false): HeadersInit {
    const headers: HeadersInit = {
      [HEADERS.CONTENT_TYPE]: 'application/json',
      [HEADERS.API_KEY]: API_KEY,
    };

    if (includeAuth) {
      const token = useRefreshToken ? this.getRefreshToken() : this.getAccessToken();
      if (token) {
        headers[HEADERS.AUTHORIZATION] = token;
      }
    }

    return headers;
  }

  /**
   * Make an authenticated request with automatic token refresh on 403
   */
  private async authenticatedRequest<T>(
    url: string,
    options: RequestInit,
    retry: boolean = true
  ): Promise<T> {
    const headers = this.buildHeaders(true);
    const response = await fetch(url, {
      ...options,
      headers: { ...headers, ...options.headers },
    });

    // If we get a 403 and haven't retried yet, try refreshing the token
    if (response.status === 403 && retry) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        // Retry the request with the new token
        return this.authenticatedRequest<T>(url, options, false);
      }
      // If refresh failed, throw an auth error
      throw new Error('Session expired. Please log in again.');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ errorMessage: 'Request failed' }));
      throw new Error(errorData.errorMessage || `Request failed with status ${response.status}`);
    }

    // Handle empty responses
    const text = await response.text();
    if (!text) {
      return {} as T;
    }
    return JSON.parse(text);
  }

  /**
   * Refresh the access token using the refresh token
   */
  private async refreshAccessToken(): Promise<boolean> {
    // If already refreshing, wait for that to complete
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      return false;
    }

    this.isRefreshing = true;
    this.refreshPromise = this.doRefreshToken(refreshToken);

    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  /**
   * Actually perform the token refresh
   */
  private async doRefreshToken(refreshToken: string): Promise<boolean> {
    try {
      const response = await fetch(buildUrl(API_ROUTES.TOKEN), {
        method: 'POST',
        headers: {
          [HEADERS.CONTENT_TYPE]: 'application/json',
          [HEADERS.API_KEY]: API_KEY,
          [HEADERS.AUTHORIZATION]: refreshToken,
        },
      });

      if (!response.ok) {
        // Refresh token is invalid, clear auth
        this.clearAuth();
        return false;
      }

      const data: TokenResponse = await response.json();
      this.setAccessToken(data.accessToken);
      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
      this.clearAuth();
      return false;
    }
  }

  // ============================================
  // Auth Methods
  // ============================================

  /**
   * Request OTP for signup/login
   * @param email User's email address
   */
  public async signUpWithOTP(email: string): Promise<void> {
    const response = await fetch(buildUrl(AUTH_ROUTES.SIGNUP_OTP), {
      method: 'POST',
      headers: this.buildHeaders(false),
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      // Try to get error message from response
      let errorMessage = 'Failed to send verification code';
      try {
        const text = await response.text();
        if (text) {
          try {
            const errorData = JSON.parse(text);
            errorMessage = errorData.errorMessage || errorMessage;
          } catch {
            // Response is plain text
            if (text.includes('Internal Server Error')) {
              errorMessage = 'Server error. Please try with a valid email address.';
            } else {
              errorMessage = text;
            }
          }
        }
      } catch {
        // Ignore parsing errors
      }
      throw new Error(errorMessage);
    }
  }

  /**
   * Login with OTP code
   * @param otp The 6-digit OTP code
   * @returns Login response with tokens and user
   */
  public async loginWithOTP(otp: string): Promise<LoginResponse> {
    const response = await fetch(buildUrl(AUTH_ROUTES.LOGIN), {
      method: 'POST',
      headers: this.buildHeaders(false),
      body: JSON.stringify({ otp }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ errorMessage: 'Invalid or expired OTP' }));
      throw new Error(errorData.errorMessage || 'Invalid or expired OTP');
    }

    const data: LoginResponse = await response.json();

    // Store tokens and user
    this.setAccessToken(data.accessToken);
    this.setRefreshToken(data.refreshToken);
    this.setUser(data.user);

    return data;
  }

  /**
   * Logout - clear all stored auth data
   */
  public logout(): void {
    this.clearAuth();
  }

  // ============================================
  // API Methods
  // ============================================

  /**
   * Get current user info
   */
  public async getUser(): Promise<GetUserResponse> {
    return this.authenticatedRequest<GetUserResponse>(
      buildUrl(API_ROUTES.GET_USER),
      { method: 'GET' }
    );
  }

  /**
   * Delete current user account
   */
  public async deleteUser(): Promise<DeleteUserResponse> {
    const response = await this.authenticatedRequest<DeleteUserResponse>(
      buildUrl(API_ROUTES.DELETE_USER),
      { method: 'POST' }
    );

    // Clear local auth after deletion
    this.clearAuth();

    return response;
  }

  /**
   * Get customer/subscription info
   */
  public async getCustomer(): Promise<GetCustomerResponse> {
    return this.authenticatedRequest<GetCustomerResponse>(
      buildUrl(API_ROUTES.GET_CUSTOMER),
      { method: 'GET' }
    );
  }

  // ============================================
  // Health Check
  // ============================================

  /**
   * Check if the backend is healthy
   */
  public async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(buildUrl(HEALTH_ROUTES.CHECK), {
        method: 'GET',
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Export singleton instance getter
export const getNetworkManager = (): NetworkManager => NetworkManager.getInstance();

// Export the class for type usage
export default NetworkManager;


