/**
 * Centralized API Client with Token Expiration Handling
 * Wraps fetch() calls and automatically redirects to login on token expiration
 */

import authService from './authService';

interface ApiClientConfig {
  onTokenExpired?: () => void;
}

const defaultConfig: ApiClientConfig = {};

let clientConfig = defaultConfig;

/**
 * Sets the callback to trigger when token expires
 * @param onTokenExpired - Callback function to handle token expiration
 */
export function setApiClientConfig(config: ApiClientConfig): void {
  clientConfig = { ...defaultConfig, ...config };
}

/**
 * Makes an API call with automatic token injection and error handling
 * @param url - The API endpoint URL
 * @param options - Fetch options
 * @returns Promise with response JSON
 */
export async function apiCall<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const idToken = authService.getIdToken();
  
  // Handle case where token is literally the string "null"
  const validToken = (idToken && idToken !== "null" && idToken !== "undefined") ? idToken : null;

  // Merge headers with authorization
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": validToken ? `Bearer ${validToken}` : ""
  };

  // Merge with any additional headers from options
  if (options.headers) {
    const additionalHeaders = options.headers as Record<string, string>;
    Object.assign(headers, additionalHeaders);
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Try to parse response as JSON regardless of status
    let result;
    try {
      result = await response.json();
    } catch {
      // If response is not JSON, get text
      result = { message: await response.text() };
    }

    // Check if response indicates token expiration FIRST (before checking status)
    if (result.message && result.message.includes("The incoming token has expired")) {
      console.warn('Token expired, redirecting to login');
      handleTokenExpiration();
      throw new Error(result.message);
    }

    // Now check if response was not ok
    if (!response.ok) {
      console.error(`API Error ${response.status}:`, result);
      throw new Error(`API error: ${response.status} ${response.statusText}\n${JSON.stringify(result)}`);
    }

    // Check if API returned error status
    if (result.status !== "success") {
      throw new Error(result.message || "API returned error status");
    }

    return result;
  } catch (error) {
    // Re-throw the error for component-level handling
    throw error;
  }
}

/**
 * Helper for POST requests
 */
export async function apiPost<T = any>(
  url: string,
  body?: any,
  options: RequestInit = {}
): Promise<T> {
  return apiCall<T>(url, {
    ...options,
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Helper for GET requests
 */
export async function apiGet<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  return apiCall<T>(url, {
    ...options,
    method: "GET",
  });
}

/**
 * Handles token expiration by clearing tokens and redirecting to login
 */
function handleTokenExpiration(): void {
  // Clear tokens from storage
  authService.clearTokens();

  // Call custom callback if provided
  if (clientConfig.onTokenExpired) {
    clientConfig.onTokenExpired();
  } else {
    // Default: redirect to login using Cognito logout URL
    // This redirects to Cognito which then sends user back to login page
    authService.logout();
  }
}
