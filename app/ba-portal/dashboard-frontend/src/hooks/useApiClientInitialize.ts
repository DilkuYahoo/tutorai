/**
 * Hook to integrate API client with auth context
 * Sets up token expiration callback for redirecting to login
 */

import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { setApiClientConfig } from '../services/apiClient';

/**
 * Initialize API client with auth context callbacks
 * Should be called once in a top-level component (e.g., App or Dashboard)
 */
export function useApiClientInitialize(): void {
  const { logout } = useAuth();

  useEffect(() => {
    // Configure API client to call logout when token expires
    setApiClientConfig({
      onTokenExpired: () => {
        logout();
      }
    });
  }, [logout]);
}
