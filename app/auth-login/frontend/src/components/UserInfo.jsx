import React from 'react';

/**
 * UserInfo Component
 * Displays user information after successful login
 */
const UserInfo = ({ user, apiUserInfo }) => {
  // Combine token user info with API user info
  const displayUser = apiUserInfo || user;
  
  if (!displayUser) {
    return <div className="error">No user information available</div>;
  }

  return (
    <div className="user-info">
      <h2>User Information</h2>
      
      <div className="info-item">
        <span className="info-label">Email:</span>
        <span className="info-value">{displayUser.email || 'N/A'}</span>
      </div>
      
      <div className="info-item">
        <span className="info-label">Name:</span>
        <span className="info-value">{displayUser.name || 'N/A'}</span>
      </div>
      
      {displayUser.givenName && (
        <div className="info-item">
          <span className="info-label">Given Name:</span>
          <span className="info-value">{displayUser.givenName}</span>
        </div>
      )}
      
      {displayUser.familyName && (
        <div className="info-item">
          <span className="info-label">Family Name:</span>
          <span className="info-value">{displayUser.familyName}</span>
        </div>
      )}
      
      <div className="info-item">
        <span className="info-label">Username:</span>
        <span className="info-value">{displayUser.username || displayUser.sub || 'N/A'}</span>
      </div>
      
      <div className="info-item">
        <span className="info-label">User ID (sub):</span>
        <span className="info-value" style={{ fontSize: '12px', maxWidth: '200px', wordBreak: 'break-all' }}>
          {displayUser.sub || 'N/A'}
        </span>
      </div>
      
      <div className="info-item">
        <span className="info-label">Email Verified:</span>
        <span className="info-value">
          {displayUser.emailVerified ? '✅ Yes' : '❌ No'}
        </span>
      </div>
      
      <div className="info-item">
        <span className="info-label">Groups:</span>
        <div className="groups-list">
          {displayUser.groups && displayUser.groups.length > 0 ? (
            displayUser.groups.map((group, index) => (
              <span key={index} className="group-tag">{group}</span>
            ))
          ) : (
            <span className="info-value">No groups</span>
          )}
        </div>
      </div>
      
      {displayUser.phoneNumber && (
        <div className="info-item">
          <span className="info-label">Phone:</span>
          <span className="info-value">{displayUser.phoneNumber}</span>
        </div>
      )}
      
      {displayUser.locale && (
        <div className="info-item">
          <span className="info-label">Locale:</span>
          <span className="info-value">{displayUser.locale}</span>
        </div>
      )}
      
      {displayUser.exp && (
        <div className="info-item">
          <span className="info-label">Token Expires:</span>
          <span className="info-value">
            {new Date(displayUser.exp * 1000).toLocaleString()}
          </span>
        </div>
      )}
      
      {displayUser.iss && (
        <div className="info-item">
          <span className="info-label">Issuer:</span>
          <span className="info-value" style={{ fontSize: '11px', maxWidth: '250px', wordBreak: 'break-all' }}>
            {displayUser.iss}
          </span>
        </div>
      )}
    </div>
  );
};

export default UserInfo;
