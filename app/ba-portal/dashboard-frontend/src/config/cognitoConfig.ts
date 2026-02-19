// Cognito Configuration
// Update these values with your Cognito User Pool settings

interface CognitoConfig {
  clientId: string;
  domain: string;
  redirectUri: string;
  logoutUri: string;
  region: string;
  scopes: string[];
  apiUrl: string;
}

const cognitoConfig: CognitoConfig = {
  // Cognito App Client ID
  clientId: import.meta.env.VITE_COGNITO_CLIENT_ID || 'YOUR_CLIENT_ID',
  
  // Cognito Domain (without https:// prefix)
  domain: import.meta.env.VITE_COGNITO_DOMAIN || 'advicegenie-auth-baportal-001.auth.ap-southeast-2.amazoncognito.com',
  
  // Redirect URI (must match what's configured in Cognito)
  redirectUri: import.meta.env.VITE_COGNITO_REDIRECT_URI || 'http://localhost:3000/',
  
  // Logout URI
  logoutUri: import.meta.env.VITE_COGNITO_LOGOUT_URI || 'http://localhost:3000/',
  
  // AWS Region
  region: import.meta.env.VITE_AWS_REGION || 'ap-southeast-2',
  
  // OAuth Scopes
  scopes: ['openid', 'email', 'profile'],
  
  // API Gateway URL for user info endpoint
  apiUrl: import.meta.env.VITE_API_URL || 'https://YOUR_API_ID.execute-api.ap-southeast-2.amazonaws.com/prod'
};

// Derived URLs
export const getLoginUrl = (): string => {
  const params = new URLSearchParams({
    client_id: cognitoConfig.clientId,
    response_type: 'code',
    scope: cognitoConfig.scopes.join(' '),
    redirect_uri: cognitoConfig.redirectUri
  });
  
  return `https://${cognitoConfig.domain}/login?${params.toString()}`;
};

export const getLogoutUrl = (): string => {
  const params = new URLSearchParams({
    client_id: cognitoConfig.clientId,
    logout_uri: cognitoConfig.logoutUri
  });
  
  return `https://${cognitoConfig.domain}/logout?${params.toString()}`;
};

export const getTokenUrl = (): string => {
  return `https://${cognitoConfig.domain}/oauth2/token`;
};

export const getJwksUrl = (): string => {
  return `https://cognito-idp.${cognitoConfig.region}.amazonaws.com/.well-known/jwks.json`;
};

export const getUserPoolId = (): string => {
  // Extract user pool ID from the domain if possible
  // Format: https://<domain-prefix>.auth.<region>.amazoncognito.com
  return import.meta.env.VITE_COGNITO_USER_POOL_ID || 'ap-southeast-2_XXXXXXXXX';
};

export default cognitoConfig;
