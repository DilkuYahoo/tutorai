import React from 'react';
import authService from '../services/authService';

/**
 * Login Component
 * Displays login button that redirects to Cognito Hosted UI
 */
const Login = () => {
  const handleLogin = () => {
    authService.login();
  };

  return (
    <div className="container">
      <div className="header">
        <div className="welcome-icon">🔐</div>
        <h1>Welcome to Cognito Login Test</h1>
        <p>Click the button below to login with AWS Cognito</p>
      </div>
      
      <button className="login-btn" onClick={handleLogin}>
        Login with Cognito
      </button>
      
      <div style={{ marginTop: '30px', color: '#666', fontSize: '12px' }}>
        <p>This is a test page for AWS Cognito configuration.</p>
        <p>You will be redirected to the Cognito Hosted UI to authenticate.</p>
      </div>
    </div>
  );
};

export default Login;
