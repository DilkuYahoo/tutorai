import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import authService from '../services/authService';
import type { UserInfo, Tokens } from '../services/authService';

/**
 * Authentication context interface
 */
interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserInfo | null;
  tokens: Tokens | null;
  login: () => void;
  logout: () => void;
  handleAuthCallback: (code: string) => Promise<void>;
}

/**
 * Default context value
 */
const defaultAuthContext: AuthContextType = {
  isAuthenticated: false,
  isLoading: true,
  user: null,
  tokens: null,
  login: () => {},
  logout: () => {},
  handleAuthCallback: async () => {}
};

/**
 * Auth Context
 */
const AuthContext = createContext<AuthContextType>(defaultAuthContext);

/**
 * Auth Provider Props
 */
interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Auth Provider Component
 * Manages authentication state and provides auth methods to children
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [tokens, setTokens] = useState<Tokens | null>(null);

  /**
   * Initialize auth state on mount
   */
  useEffect(() => {
    const initAuth = () => {
      try {
        const authenticated = authService.isAuthenticated();
        setIsAuthenticated(authenticated);
        
        if (authenticated) {
          const storedTokens = authService.getTokens();
          const storedUser = authService.getUserFromToken();
          setTokens(storedTokens);
          setUser(storedUser);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        setIsAuthenticated(false);
        setUser(null);
        setTokens(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  /**
   * Login - redirect to Cognito hosted UI
   */
  const login = useCallback(() => {
    authService.login();
  }, []);

  /**
   * Logout - clear tokens and redirect to Cognito logout
   */
  const logout = useCallback(() => {
    setIsAuthenticated(false);
    setUser(null);
    setTokens(null);
    authService.logout();
  }, []);

  /**
   * Handle OAuth callback - exchange code for tokens
   */
  const handleAuthCallback = useCallback(async (code: string) => {
    setIsLoading(true);
    try {
      const newTokens = await authService.handleCallback(code);
      const newUser = authService.getUserFromToken();
      
      setTokens(newTokens);
      setUser(newUser);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Error handling auth callback:', error);
      setIsAuthenticated(false);
      setUser(null);
      setTokens(null);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value: AuthContextType = {
    isAuthenticated,
    isLoading,
    user,
    tokens,
    login,
    logout,
    handleAuthCallback
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Custom hook to use auth context
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;