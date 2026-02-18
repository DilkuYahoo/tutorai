import axios from 'axios';
import cognitoConfig, { getLoginUrl, getLogoutUrl, getTokenUrl } from '../config/cognitoConfig';

/**
 * Authentication Service for AWS Cognito
 * Handles OAuth 2.0 Authorization Code Flow
 */
class AuthService {
  constructor() {
    this.tokenKey = 'cognito_tokens';
    this.userKey = 'cognito_user';
  }

  /**
   * Initiate login by redirecting to Cognito Hosted UI
   */
  login() {
    window.location.href = getLoginUrl();
  }

  /**
   * Logout user by clearing tokens and redirecting to Cognito logout
   */
  logout() {
    this.clearTokens();
    window.location.href = getLogoutUrl();
  }

  /**
   * Handle OAuth callback - exchange authorization code for tokens
   * @param {string} code - Authorization code from Cognito
   * @returns {Promise<object>} - Token response
   */
  async handleCallback(code) {
    try {
      const response = await axios.post(
        getTokenUrl(),
        new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: cognitoConfig.clientId,
          code: code,
          redirect_uri: cognitoConfig.redirectUri
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      const tokens = {
        accessToken: response.data.access_token,
        idToken: response.data.id_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in,
        tokenType: response.data.token_type
      };

      this.saveTokens(tokens);
      return tokens;
    } catch (error) {
      console.error('Error exchanging code for tokens:', error);
      throw new Error('Failed to authenticate: ' + (error.response?.data?.error_description || error.message));
    }
  }

  /**
   * Save tokens to session storage
   * @param {object} tokens - Token object
   */
  saveTokens(tokens) {
    sessionStorage.setItem(this.tokenKey, JSON.stringify(tokens));
  }

  /**
   * Get stored tokens
   * @returns {object|null} - Tokens or null if not found
   */
  getTokens() {
    const tokens = sessionStorage.getItem(this.tokenKey);
    return tokens ? JSON.parse(tokens) : null;
  }

  /**
   * Get ID token
   * @returns {string|null} - ID token or null
   */
  getIdToken() {
    const tokens = this.getTokens();
    return tokens?.idToken || null;
  }

  /**
   * Get access token
   * @returns {string|null} - Access token or null
   */
  getAccessToken() {
    const tokens = this.getTokens();
    return tokens?.accessToken || null;
  }

  /**
   * Clear all stored tokens
   */
  clearTokens() {
    sessionStorage.removeItem(this.tokenKey);
    sessionStorage.removeItem(this.userKey);
  }

  /**
   * Check if user is authenticated
   * @returns {boolean} - True if tokens exist
   */
  isAuthenticated() {
    return !!this.getIdToken();
  }

  /**
   * Decode JWT token (without verification - for display purposes only)
   * @param {string} token - JWT token
   * @returns {object} - Decoded payload
   */
  decodeToken(token) {
    if (!token) return null;
    
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  }

  /**
   * Get user info from ID token
   * @returns {object|null} - User info or null
   */
  getUserFromToken() {
    const idToken = this.getIdToken();
    if (!idToken) return null;

    const decoded = this.decodeToken(idToken);
    if (!decoded) return null;

    return {
      email: decoded.email || '',
      emailVerified: decoded.email_verified || false,
      name: decoded.name || decoded.given_name || '',
      familyName: decoded.family_name || '',
      givenName: decoded.given_name || '',
      preferredUsername: decoded.preferred_username || '',
      sub: decoded.sub || '',
      username: decoded['cognito:username'] || decoded.sub || '',
      groups: decoded['cognito:groups'] || [],
      phoneNumber: decoded.phone_number || '',
      picture: decoded.picture || '',
      locale: decoded.locale || '',
      updatedAt: decoded.updated_at || '',
      iat: decoded.iat,
      exp: decoded.exp,
      aud: decoded.aud,
      iss: decoded.iss
    };
  }

  /**
   * Fetch user info from backend API
   * @returns {Promise<object>} - User info from backend
   */
  async fetchUserInfo() {
    const idToken = this.getIdToken();
    if (!idToken) {
      throw new Error('No authentication token found');
    }

    try {
      const response = await axios.get(`${cognitoConfig.apiUrl}/user-info`, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error fetching user info:', error);
      throw new Error('Failed to fetch user info: ' + (error.response?.data?.message || error.message));
    }
  }

  /**
   * Check if token is expired
   * @returns {boolean} - True if expired
   */
  isTokenExpired() {
    const tokens = this.getTokens();
    if (!tokens) return true;

    const decoded = this.decodeToken(tokens.idToken);
    if (!decoded) return true;

    // Add 5 minute buffer
    const buffer = 5 * 60 * 1000;
    return decoded.exp * 1000 < Date.now() + buffer;
  }
}

// Export singleton instance
const authService = new AuthService();
export default authService;
