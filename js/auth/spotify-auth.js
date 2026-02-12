/**
 * SpotifyAuth - Spotify OAuth 2.0 PKCE Authentication
 * 
 * RESPONSIBILITIES:
 * - Handle OAuth 2.0 Authorization Code + PKCE Flow (recommended for SPAs)
 * - Redirect user to Spotify authorization page
 * - Handle OAuth callback with authorization code
 * - Exchange authorization code for access/refresh tokens (PKCE)
 * - Store tokens securely in IndexedDB
 * - Auto-refresh expired tokens
 * - Provide logout/disconnect functionality
 * - Check authentication status
 * 
 * OAUTH 2.0 FLOW (PKCE):
 * 1. User clicks "Connect Spotify" in settings
 * 2. Redirect to Spotify authorization page with PKCE challenge
 * 3. User logs in and authorizes
 * 4. Spotify redirects back with auth code
 * 5. Exchange code for access token using PKCE verifier
 * 6. Store access token (expires in 1 hour) and refresh token (never expires)
 * 7. Use access token for API calls
 * 8. When expired, refresh automatically    
 * 
 * SPOTIFY API CONTRACT:
 * - Auth URL: https://accounts.spotify.com/authorize (PKCE/code redirect)
 * - Token endpoint: https://accounts.spotify.com/api/token (exchange/refresh)
 * - Uses PKCE (no client secret exposed in browser)
 * - Header format: Authorization: Bearer <access_token>
 * 
 * OAUTH SCOPES (for Web Playback SDK - embedded streaming):
 * - streaming (REQUIRED: Web Playback SDK streaming)
 * - user-read-email (REQUIRED: SDK initialization)
 * - user-read-private (REQUIRED: SDK initialization)
 * - user-read-playback-state (read state + devices) - REQUIRED
 * - user-modify-playback-state (play/pause/skip/volume) - REQUIRED
 * - user-read-currently-playing (currently playing) - Optional
 * 
 * POLICY CONSTRAINTS:
 * - Player endpoints only work for Spotify Premium users
 * - Streaming applications may not be commercial
 * - Spotify content may not be used to train ML/AI models
 * 
 * PLAYBACK MODEL: Embedded Web Playback SDK
 * - Music streams directly in the browser
 * - Creates a virtual "device" in user's Spotify
 * - Full control over playback (volume, seek, etc.)
 * - No external Spotify app needed (browser only)
 * - Requires Premium subscription
 * 
 * SDK ERROR EVENTS TO HANDLE:
 * - initialization_error
 * - authentication_error
 * - account_error (Premium missing)
 * 
 * RE-AUTHENTICATION NOTE:
 * - Users must re-authenticate to get new SDK scopes after migration
 * - Old tokens only had external control scopes
 * - New tokens include streaming, user-read-email, user-read-private
 * 
 * CREDENTIALS:
 * - Client ID: 8eb244f79da24a448a2633ba8552a5c8
 * - Client Secret: (not needed for PKCE flow)
 * - Dashboard: https://developer.spotify.com/dashboard/applications/8eb244f79da24a448a2633ba8552a5c8
 * 
 * REDIRECT URIs (must be registered in Spotify Dashboard):
 * - Production (GitHub Pages): https://riseatlas.github.io/BooksWithMusic/callback.html
 * - Local development: http://localhost:8080/callback.html
 * - Local development: http://127.0.0.1:8080/callback.html
 * 
 * TROUBLESHOOTING "INVALID_CLIENT: Invalid redirect URI":
 * 1. Check console log for the actual redirect URI being used
 * 2. Go to Spotify Developer Dashboard (link above)
 * 3. Click "Edit Settings"
 * 4. Add the exact redirect URI to "Redirect URIs" field
 * 5. Click "Add" then "Save"
 * 6. Try connecting again
 * 
 * REFERENCES:
 * - PKCE Guide: https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow
 * - Authorization Guide: https://developer.spotify.com/documentation/general/guides/authorization/
 */

export class SpotifyAuth {
  constructor() {
    // Spotify App Credentials (PKCE - no client secret needed)
    this.clientId = '8eb244f79da24a448a2633ba8552a5c8';
    this.redirectUri = this._getRedirectUri();
    
    // OAuth endpoints (Spotify API contract)
    this.authEndpoint = 'https://accounts.spotify.com/authorize';
    this.tokenEndpoint = 'https://accounts.spotify.com/api/token';
    
    // Required scopes for Web Playback SDK (embedded streaming)
    this.scopes = [
      'streaming',                         // REQUIRED: Web Playback SDK streaming
      'user-read-email',                   // REQUIRED: SDK initialization
      'user-read-private',                 // REQUIRED: SDK initialization
      'user-read-playback-state',          // Read state + devices 
      'user-modify-playback-state',        // Play/pause/skip/volume
      'user-read-currently-playing'        // Currently playing track
    ];
    
    // Token storage keys
    this.STORAGE_KEYS = {
      ACCESS_TOKEN: 'spotify_access_token',
      REFRESH_TOKEN: 'spotify_refresh_token',
      TOKEN_EXPIRY: 'spotify_token_expiry',
      CODE_VERIFIER: 'spotify_code_verifier'  // PKCE
    };
  }

  /**
   * Get redirect URI based on current location
   * Must match exactly what's registered in Spotify Developer Dashboard
   * @private
   */
  _getRedirectUri() {
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    
    // GitHub Pages: Dynamically extract repo name from current pathname
    if (origin.includes('github.io')) {
      // Extract repo name from pathname (e.g., /BooksWithMusic/index.html -> /BooksWithMusic)
      const repoMatch = pathname.match(/^\/([^\/]+)/);
      const repoName = repoMatch ? repoMatch[1] : '';
      return `${origin}/${repoName}/callback.html`;
    }
    
    // Local development with port
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return `${origin}/callback.html`;
    }
    
    // Custom domain or other hosting
    // Extract base path (everything before the current page)
    const basePath = pathname.substring(0, pathname.lastIndexOf('/'));
    return `${origin}${basePath}/callback.html`;
  }

  /**
   * Generate PKCE code verifier (random string)
   * Follows Spotify's official implementation
   * @private
   */
  _generateCodeVerifier() {
    const length = 64;
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(values)
      .map(x => possible[x % possible.length])
      .join('');
  }

  /**
   * Generate PKCE code challenge from verifier
   * @private
   */
  async _generateCodeChallenge(verifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return this._base64URLEncode(new Uint8Array(hash));
  }

  /**
   * Base64 URL encode (for PKCE)
   * @private
   */
  _base64URLEncode(buffer) {
    return btoa(String.fromCharCode(...buffer))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
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
      return await this.refreshAccessToken();
    }

    return token;
  }

  /**
   * Start OAuth flow with PKCE - redirect user to Spotify authorization page
   */
  async authorize() {
    try {
      // Log redirect URI for debugging
      console.log('🎵 Spotify OAuth: Using redirect URI:', this.redirectUri);
      console.log('📝 Make sure this exact URI is registered in your Spotify Developer Dashboard:');
      console.log('   https://developer.spotify.com/dashboard/applications/' + this.clientId);
      
      // Generate PKCE code verifier and challenge
      const codeVerifier = this._generateCodeVerifier();
      console.log('✅ Generated code verifier');
      
      const codeChallenge = await this._generateCodeChallenge(codeVerifier);
      console.log('✅ Generated code challenge');
      
      // Store code verifier for token exchange
      localStorage.setItem(this.STORAGE_KEYS.CODE_VERIFIER, codeVerifier);
      console.log('✅ Stored code verifier in localStorage');

      // Build authorization URL with PKCE
      const params = new URLSearchParams({
        client_id: this.clientId,
        response_type: 'code',
        redirect_uri: this.redirectUri,
        scope: this.scopes.join(' '),
        code_challenge_method: 'S256',
        code_challenge: codeChallenge,
        show_dialog: 'false'  // Don't show dialog if already authorized
      });

      const authUrl = `${this.authEndpoint}?${params.toString()}`;
      console.log('🚀 Redirecting to Spotify authorization page:', authUrl);
      
      window.location.href = authUrl;
    } catch (error) {
      console.error('❌ Error in authorize():', error);
      throw error;
    }
  }

  /**
   * Handle OAuth callback with PKCE (exchange code for tokens)
   * Call this from callback page with authorization code
   */
  async handleCallback(authorizationCode) {
    if (!authorizationCode) {
      throw new Error('No authorization code provided');
    }

    // Get stored code verifier from PKCE flow
    const codeVerifier = localStorage.getItem(this.STORAGE_KEYS.CODE_VERIFIER);
    if (!codeVerifier) {
      throw new Error('PKCE code verifier not found');
    }

    console.log('🔐 Exchanging authorization code for tokens (PKCE)...');

    // Prepare token request with PKCE (no client secret needed)
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: authorizationCode,
      redirect_uri: this.redirectUri,
      client_id: this.clientId,
      code_verifier: codeVerifier
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
        console.error('❌ Token exchange error:', error);
        throw new Error(`Spotify token exchange failed: ${error.error_description || error.error}`);
      }

      const data = await response.json();
      
      // Store tokens
      await this._storeTokens(data.access_token, data.refresh_token, data.expires_in);
      
      // Clean up code verifier
      localStorage.removeItem(this.STORAGE_KEYS.CODE_VERIFIER);

      console.log('✅ Spotify authentication successful');
      return true;
    } catch (error) {
      console.error('❌ Spotify authentication failed:', error);
      throw error;
    }
  }

  /**
   * Refresh expired access token using refresh token (PKCE)
   */
  async refreshAccessToken() {
    const refreshToken = await this._getRefreshToken();

    if (!refreshToken) {
      throw new Error('No refresh token available. Please re-authenticate.');
    }

    console.log('🔄 Refreshing access token...');

    // PKCE refresh only needs client_id (no client secret)
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.clientId
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
   * Backward-compatible alias for older call sites.
   */
  async clearTokens() {
    await this.logout();
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
