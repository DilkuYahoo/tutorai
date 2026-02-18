import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import authService from './services/authService';

/**
 * Main App Component
 * Handles authentication state and OAuth callback
 */
function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      // Check if we're receiving an OAuth callback
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const errorParam = urlParams.get('error');
      const errorDescription = urlParams.get('error_description');

      // Handle OAuth error from Cognito
      if (errorParam) {
        setError(errorDescription || errorParam);
        setLoading(false);
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }

      // Handle OAuth callback with authorization code
      if (code) {
        console.log('Received authorization code, exchanging for tokens...');
        await authService.handleCallback(code);
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      // Check if user is authenticated
      if (authService.isAuthenticated()) {
        // Check if token is expired
        if (authService.isTokenExpired()) {
          console.log('Token expired, logging out...');
          authService.clearTokens();
          setIsAuthenticated(false);
          setUser(null);
        } else {
          const userInfo = authService.getUserFromToken();
          setUser(userInfo);
          setIsAuthenticated(true);
        }
      }
    } catch (err) {
      console.error('Auth initialization error:', err);
      setError(err.message);
      authService.clearTokens();
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">
          <div className="spinner"></div>
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="error">
          <h3>Authentication Error</h3>
          <p>{error}</p>
          <button 
            className="login-btn" 
            onClick={() => {
              setError(null);
              authService.login();
            }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {isAuthenticated && user ? (
        <Dashboard user={user} />
      ) : (
        <Login />
      )}
    </>
  );
}

export default App;
