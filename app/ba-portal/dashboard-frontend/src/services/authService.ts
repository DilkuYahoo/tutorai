import axios from 'axios';
import cognitoConfig, { getLoginUrl, getLogoutUrl, getTokenUrl } from '../config/cognitoConfig';

/**
 * Token interface for stored authentication tokens
 */
export interface Tokens {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

/**
 * User information interface
 */
export interface UserInfo {
  email: string;
  emailVerified: boolean;
  name: string;
  familyName: string;
  givenName: string;
  preferredUsername: string;
  sub: string;
  username: string;
  groups: string[];
  phoneNumber: string;
  picture: string;
  locale: string;
  updatedAt: string;
  iat?: number;
  exp?: number;
  aud?: string;
  iss?: string;
}

/**
 * Authentication Service for AWS Cognito
 * Handles OAuth 2.0 Authorization Code Flow
 */
class AuthService {
  private tokenKey = 'cognito_tokens';
  private userKey = 'cognito_user';

  /**
   * Initiate login by redirecting to Cognito Hosted UI
   */
  login(): void {
    window.location.href = getLoginUrl();
  }

  /**
   * Logout user by clearing tokens and redirecting to Cognito logout
   */
  logout(): void {
    this.clearTokens();
    window.location.href = getLogoutUrl();
  }

  /**
   * Handle OAuth callback - exchange authorization code for tokens
   * @param code - Authorization code from Cognito
   * @returns Promise with token response
   */
  async handleCallback(code: string): Promise<Tokens> {
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

      const tokens: Tokens = {
        accessToken: response.data.access_token,
        idToken: response.data.id_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in,
        tokenType: response.data.token_type
      };

      this.saveTokens(tokens);
      return tokens;
    } catch (error: unknown) {
      console.error('Error exchanging code for tokens:', error);
      const axiosError = error as { response?: { data?: { error_description?: string } }; message?: string };
      throw new Error('Failed to authenticate: ' + (axiosError.response?.data?.error_description || axiosError.message));
    }
  }

  /**
   * Save tokens to session storage
   * @param tokens - Token object
   */
  saveTokens(tokens: Tokens): void {
    sessionStorage.setItem(this.tokenKey, JSON.stringify(tokens));
  }

  /**
   * Get stored tokens
   * @returns Tokens or null if not found
   */
  getTokens(): Tokens | null {
    const tokens = sessionStorage.getItem(this.tokenKey);
    return tokens ? JSON.parse(tokens) : null;
  }

  /**
   * Get ID token
   * @returns ID token or null
   */
  getIdToken(): string | null {
    const tokens = this.getTokens();
    return tokens?.idToken || null;
  }

  /**
   * Get access token
   * @returns Access token or null
   */
  getAccessToken(): string | null {
    const tokens = this.getTokens();
    return tokens?.accessToken || null;
  }

  /**
   * Clear all stored tokens
   */
  clearTokens(): void {
    sessionStorage.removeItem(this.tokenKey);
    sessionStorage.removeItem(this.userKey);
  }

  /**
   * Check if user is authenticated
   * @returns True if tokens exist
   */
  isAuthenticated(): boolean {
    return !!this.getIdToken();
  }

  /**
   * Decode JWT token (without verification - for display purposes only)
   * @param token - JWT token
   * @returns Decoded payload
   */
  decodeToken(token: string): Record<string, unknown> | null {
    if (!token) return null;
    
    try {
      const base64Url = token.split('.')[1];
      if (!base64Url) return null;
      
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
   * @returns User info or null
   */
  getUserFromToken(): UserInfo | null {
    const idToken = this.getIdToken();
    if (!idToken) return null;

    const decoded = this.decodeToken(idToken);
    if (!decoded) return null;

    return {
      email: (decoded.email as string) || '',
      emailVerified: (decoded.email_verified as boolean) || false,
      name: (decoded.name as string) || (decoded.given_name as string) || '',
      familyName: (decoded.family_name as string) || '',
      givenName: (decoded.given_name as string) || '',
      preferredUsername: (decoded.preferred_username as string) || '',
      sub: (decoded.sub as string) || '',
      username: (decoded['cognito:username'] as string) || (decoded.sub as string) || '',
      groups: (decoded['cognito:groups'] as string[]) || [],
      phoneNumber: (decoded.phone_number as string) || '',
      picture: (decoded.picture as string) || '',
      locale: (decoded.locale as string) || '',
      updatedAt: (decoded.updated_at as string) || '',
      iat: decoded.iat as number | undefined,
      exp: decoded.exp as number | undefined,
      aud: decoded.aud as string | undefined,
      iss: decoded.iss as string | undefined
    };
  }

  /**
   * Fetch user info from backend API
   * @returns User info from backend
   */
  async fetchUserInfo(): Promise<Record<string, unknown>> {
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
    } catch (error: unknown) {
      console.error('Error fetching user info:', error);
      const axiosError = error as { response?: { data?: { message?: string } }; message?: string };
      throw new Error('Failed to fetch user info: ' + (axiosError.response?.data?.message || axiosError.message));
    }
  }

  /**
   * Check if token is expired
   * @returns True if expired
   */
  isTokenExpired(): boolean {
    const tokens = this.getTokens();
    if (!tokens) return true;

    const decoded = this.decodeToken(tokens.idToken);
    if (!decoded) return true;

    // Add 5 minute buffer
    const buffer = 5 * 60 * 1000;
    return (decoded.exp as number) * 1000 < Date.now() + buffer;
  }
}

// Export singleton instance
const authService = new AuthService();
export default authService;