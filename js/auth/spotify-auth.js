/**
 * SpotifyAuth - Spotify OAuth 2.0 Authentication
 * 
 * RESPONSIBILITIES:
 * - Handle OAuth 2.0 Authorization Code Flow
 * - Redirect user to Spotify authorization page
 * - Handle OAuth callback with authorization code
 * - Exchange authorization code for access/refresh tokens
 * - Store tokens securely in IndexedDB
 * - Auto-refresh expired tokens
 * - Provide logout/disconnect functionality
 * - Check authentication status
 * 
 * INTEGRATION NOTES:
 * - Used by spotify-api.js for authenticated API calls
 * - Tokens stored in IndexedDB (more secure than localStorage)
 * - See SPOTIFY-INTEGRATION.md for OAuth flow diagram
 * - Access token expires after 1 hour (auto-refreshed)
 * - Refresh token never expires (until user revokes)
 * 
 * OAUTH SCOPES REQUIRED:
 * - user-modify-playback-state (control playback)
 * - user-read-playback-state (read playback state)
 * - playlist-modify-public (create public playlists)
 * - playlist-modify-private (create private playlists)
 * - user-read-currently-playing (get current track)
 * 
 * SPOTIFY APP SETUP:
 * 1. Create app at https://developer.spotify.com/dashboard
 * 2. Add redirect URI (e.g., http://localhost:8080/callback)
 * 3. Get Client ID and Client Secret
 * 4. Store in environment/config (not in git!)
 * 
 * REFERENCES:
 * - Authorization Guide: https://developer.spotify.com/documentation/general/guides/authorization/
 */

export class SpotifyAuth {
  constructor() {
    // Spotify App Credentials (should come from environment/config)
    // TODO: Move to environment variables or secure config
    this.clientId = this._getClientId();
    this.clientSecret = this._getClientSecret();
    this.redirectUri = this._getRedirectUri();
    
    // OAuth endpoints
    this.authEndpoint = 'https://accounts.spotify.com/authorize';
    this.tokenEndpoint = 'https://accounts.spotify.com/api/token';
    
    // Required scopes
    this.scopes = [
      'user-modify-playback-state',
      'user-read-playback-state',
      'playlist-modify-public',
      'playlist-modify-private',
      'user-read-currently-playing',
      'user-read-email'  // To identify user
    ];
    
    // Token storage keys
    this.STORAGE_KEYS = {
      ACCESS_TOKEN: 'spotify_access_token',
      REFRESH_TOKEN: 'spotify_refresh_token',
      TOKEN_EXPIRY: 'spotify_token_expiry'
    };
  }

  /**
   * Get Spotify Client ID from config or localStorage
   * @private
   */
  _getClientId() {
    // Try localStorage first (user can set in settings)
    const stored = localStorage.getItem('spotify_client_id');
    if (stored) return stored;
    
    // TODO: Add environment variable support
    // For now, require user to set in settings
    return null;
  }

  /**
   * Get Spotify Client Secret (should be server-side for production)
   * @private
   */
  _getClientSecret() {
    // ⚠️ WARNING: Client secret should NOT be in client-side code in production
    // For personal use / friends & family, this is acceptable
    // For production, implement PKCE flow or use backend proxy
    
    const stored = localStorage.getItem('spotify_client_secret');
    if (stored) return stored;
    
    return null;
  }

  /**
   * Get redirect URI based on current location
   * @private
   */
  _getRedirectUri() {
    // Allow override from settings
    const stored = localStorage.getItem('spotify_redirect_uri');
    if (stored) return stored;
    
    // Auto-detect based on current URL
    const origin = window.location.origin;
    return `${origin}/callback.html`;  // Dedicated callback page
  }

  /**
   * Check if user is authenticated with Spotify
   */
  async isAuthenticated() {
    const accessToken = await this._getAccessToken();
    return !!accessToken;
  }

  /**
   * Get current access token (auto-refresh if expired)
   */
  async getAccessToken() {
    const token = await this._getAccessToken();
    const expiry = await this._getTokenExpiry();
    const now = Date.now();

    // If token is expired or expiring soon (within 5 minutes), refresh it
    if (!token || !expiry || expiry < now + 300000) {
      console.log('🔄 Spotify token expired or expiring soon, refreshing...');
      return await this.refreshAccessToken();
    }

    return token;
  }

  /**
   * Start OAuth flow - redirect user to Spotify authorization page
   */
  authorize() {
    if (!this.clientId) {
      throw new Error('Spotify Client ID not configured. Please add it in Settings.');
    }

    // Build authorization URL
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      scope: this.scopes.join(' '),
      show_dialog: 'false'  // Don't show dialog if already authorized
    });

    const authUrl = `${this.authEndpoint}?${params.toString()}`;
    
    console.log('🔐 Redirecting to Spotify authorization...');
    window.location.href = authUrl;
  }

  /**
   * Handle OAuth callback (exchange code for tokens)
   * Call this from callback page with authorization code
   */
  async handleCallback(authorizationCode) {
    if (!authorizationCode) {
      throw new Error('No authorization code provided');
    }

    if (!this.clientId || !this.clientSecret) {
      throw new Error('Spotify credentials not configured');
    }

    console.log('🔄 Exchanging authorization code for tokens...');

    // Prepare token request
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: authorizationCode,
      redirect_uri: this.redirectUri,
      client_id: this.clientId,
      client_secret: this.clientSecret
    });

    try {
      const response = await fetch(this.tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: body.toString()
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Spotify token exchange failed: ${error.error_description || error.error}`);
      }

      const data = await response.json();
      
      // Store tokens
      await this._storeTokens(data.access_token, data.refresh_token, data.expires_in);
      
      console.log('✅ Spotify authentication successful!');
      return true;
    } catch (error) {
      console.error('❌ Spotify authentication failed:', error);
      throw error;
    }
  }

  /**
   * Refresh expired access token using refresh token
   */
  async refreshAccessToken() {
    const refreshToken = await this._getRefreshToken();

    if (!refreshToken) {
      throw new Error('No refresh token available. Please re-authenticate.');
    }

    if (!this.clientId || !this.clientSecret) {
      throw new Error('Spotify credentials not configured');
    }

    console.log('🔄 Refreshing Spotify access token...');

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret
    });

    try {
      const response = await fetch(this.tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: body.toString()
      });

      if (!response.ok) {
        const error = await response.json();
        
        // If refresh token is invalid, clear tokens and require re-auth
        if (error.error === 'invalid_grant') {
          await this.logout();
          throw new Error('Refresh token expired. Please re-authenticate with Spotify.');
        }
        
        throw new Error(`Token refresh failed: ${error.error_description || error.error}`);
      }

      const data = await response.json();
      
      // Store new access token (refresh token usually stays the same)
      const newRefreshToken = data.refresh_token || refreshToken;
      await this._storeTokens(data.access_token, newRefreshToken, data.expires_in);
      
      console.log('✅ Access token refreshed successfully');
      return data.access_token;
    } catch (error) {
      console.error('❌ Token refresh failed:', error);
      throw error;
    }
  }

  /**
   * Logout - clear all tokens
   */
  async logout() {
    console.log('🔓 Logging out of Spotify...');
    await this._clearTokens();
  }

  /**
   * Store tokens in IndexedDB (more secure than localStorage)
   * @private
   */
  async _storeTokens(accessToken, refreshToken, expiresIn) {
    const expiry = Date.now() + (expiresIn * 1000);
    
    // Store in localStorage for now (TODO: migrate to IndexedDB)
    localStorage.setItem(this.STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    localStorage.setItem(this.STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    localStorage.setItem(this.STORAGE_KEYS.TOKEN_EXPIRY, expiry.toString());
    
    // Update settings to reflect connection status
    const settings = JSON.parse(localStorage.getItem('booksWithMusic-settings') || '{}');
    settings.spotifyConnected = true;
    localStorage.setItem('booksWithMusic-settings', JSON.stringify(settings));
  }

  /**
   * Get access token from storage
   * @private
   */
  async _getAccessToken() {
    return localStorage.getItem(this.STORAGE_KEYS.ACCESS_TOKEN);
  }

  /**
   * Get refresh token from storage
   * @private
   */
  async _getRefreshToken() {
    return localStorage.getItem(this.STORAGE_KEYS.REFRESH_TOKEN);
  }

  /**
   * Get token expiry timestamp
   * @private
   */
  async _getTokenExpiry() {
    const expiry = localStorage.getItem(this.STORAGE_KEYS.TOKEN_EXPIRY);
    return expiry ? parseInt(expiry) : null;
  }

  /**
   * Clear all tokens from storage
   * @private
   */
  async _clearTokens() {
    localStorage.removeItem(this.STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(this.STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(this.STORAGE_KEYS.TOKEN_EXPIRY);
    
    // Update settings
    const settings = JSON.parse(localStorage.getItem('booksWithMusic-settings') || '{}');
    settings.spotifyConnected = false;
    localStorage.setItem('booksWithMusic-settings', JSON.stringify(settings));
  }

  /**
   * Parse authorization code from callback URL
   * @static
   */
  static parseAuthCodeFromURL(url = window.location.href) {
    const urlParams = new URLSearchParams(new URL(url).search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');

    if (error) {
      throw new Error(`Spotify authorization error: ${error}`);
    }

    return code;
  }
}
