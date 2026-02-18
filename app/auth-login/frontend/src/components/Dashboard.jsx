import React, { useState, useEffect } from 'react';
import UserInfo from './UserInfo';
import authService from '../services/authService';

/**
 * Dashboard Component
 * Displays user information after successful login
 */
const Dashboard = ({ user }) => {
  const [apiUserInfo, setApiUserInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showTokenInfo, setShowTokenInfo] = useState(false);

  useEffect(() => {
    // Fetch additional user info from backend API
    fetchUserInfo();
  }, []);

  const fetchUserInfo = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const info = await authService.fetchUserInfo();
      setApiUserInfo(info);
    } catch (err) {
      console.error('Failed to fetch user info from API:', err);
      // Don't show error - we can still display token info
      // setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    authService.logout();
  };

  const handleRefresh = () => {
    fetchUserInfo();
  };

  return (
    <div className="container">
      <div className="header">
        <div className="welcome-icon">👋</div>
        <h1>Welcome, {user.name || user.email || 'User'}!</h1>
        <p>You have successfully logged in with AWS Cognito</p>
      </div>
      
      <div className="success">
        ✅ Authentication successful! Your Cognito configuration is working correctly.
      </div>
      
      {loading && (
        <div className="loading">
          <div className="spinner"></div>
          <span>Loading user information...</span>
        </div>
      )}
      
      {error && (
        <div className="error">
          ⚠️ Could not fetch additional user info from API: {error}
          <br />
          <small>Showing information from ID token instead.</small>
        </div>
      )}
      
      <UserInfo user={user} apiUserInfo={apiUserInfo} />
      
      <div style={{ marginTop: '20px' }}>
        <button className="login-btn" onClick={handleRefresh} style={{ marginRight: '10px' }}>
          🔄 Refresh Info
        </button>
        <button className="logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </div>
      
      <div style={{ marginTop: '30px' }}>
        <button 
          onClick={() => setShowTokenInfo(!showTokenInfo)}
          style={{ 
            background: 'none', 
            border: '1px solid #ccc', 
            padding: '8px 16px', 
            borderRadius: '4px',
            cursor: 'pointer',
            color: '#666',
            fontSize: '12px'
          }}
        >
          {showTokenInfo ? 'Hide' : 'Show'} Token Details
        </button>
        
        {showTokenInfo && (
          <div style={{ 
            marginTop: '15px', 
            padding: '15px', 
            background: '#f5f5f5', 
            borderRadius: '8px',
            textAlign: 'left',
            fontSize: '12px',
            wordBreak: 'break-all'
          }}>
            <h4 style={{ marginBottom: '10px' }}>ID Token (decoded):</h4>
            <pre style={{ overflow: 'auto', maxHeight: '200px' }}>
              {JSON.stringify(user, null, 2)}
            </pre>
            
            {apiUserInfo && (
              <>
                <h4 style={{ marginTop: '15px', marginBottom: '10px' }}>API Response:</h4>
                <pre style={{ overflow: 'auto', maxHeight: '200px' }}>
                  {JSON.stringify(apiUserInfo, null, 2)}
                </pre>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
