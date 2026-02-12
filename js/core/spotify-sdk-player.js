/**
 * SpotifySDKPlayer - Spotify Web Playback SDK Integration
 * 
 * RESPONSIBILITIES:
 * - Initialize Spotify Web Playback SDK
 * - Stream music directly in the browser (embedded playback)
 * - Create virtual "BooksWithMusic" device in user's Spotify
 * - Control playback (play/pause/skip/volume/seek)
 * - Handle SDK events and errors
 * - Emit events for UI updates
 * - Full playback control without external app
 * 
 * MIGRATION FROM EXTERNAL CONTROL:
 * - BEFORE: Required Spotify app open on external device, controlled via API
 * - AFTER: Music streams directly in browser, no external app needed
 * - Benefits: Full volume control (0-100%), perfect sync, unified UI, "BooksWithMusic Reader" virtual device
 * 
 * SPOTIFY WEB PLAYBACK SDK:
 * - Streams Spotify content directly in browser
 * - Requires Premium subscription
 * - Creates virtual device visible in Spotify's device list
 * - Full control over playback state
 * - No external Spotify app needed
 * - SDK script: https://sdk.scdn.co/spotify-player.js
 * 
 * SDK ERROR EVENTS (must handle):
 * - initialization_error: SDK failed to initialize
 * - authentication_error: Token invalid/expired (auto-refreshes)
 * - account_error: User doesn't have Premium (shows error)
 * - playback_error: Playback issues (logs and emits event)
 * 
 * REQUIREMENTS:
 * - Spotify Premium (required for SDK)
 * - Modern browser with Web Audio API
 * - User must re-authenticate to get SDK scopes
 * 
 * POLICY CONSTRAINTS:
 * - Requires Spotify Premium
 * - Non-commercial use only
 * - Cannot train AI/ML models on content
 * 
 * INTEGRATION:
 * - Used when settings.musicSource === "spotify"
 * - Replaces spotify-player.js (external control)
 * - Implements same interface as audio-player.js
 * - Loaded by music-api-factory.js
 * 
 * USER EXPERIENCE:
 * - User authenticates once
 * - Music automatically streams in browser
 * - "BooksWithMusic Reader" appears in Spotify device list
 * - Everything in one place, seamless experience
 * 
 * REFERENCES:
 * - Web Playback SDK: https://developer.spotify.com/documentation/web-playback-sdk/
 * - Quick Start: https://developer.spotify.com/documentation/web-playback-sdk/quick-start/
 */

import { SpotifyAuth } from '../auth/spotify-auth.js';

export class SpotifySDKPlayer {
  constructor() {
    this.auth = new SpotifyAuth();
    this.baseURL = 'https://api.spotify.com/v1';
    
    // SDK Player instance
    this.player = null;
    this.deviceId = null;
    
    // Playback state
    this.currentTrack = null;
    this.isPlayingState = false;
    this.playlist = [];
    this.currentTrackIndex = 0;
    this.isPremium = false;
    
    // Event emitter
    this.eventHandlers = {};
    
    // SDK ready flag
    this.sdkReady = false;
    this.initPromise = null;
  }

  /**
   * Load Spotify Web Playback SDK script
   * @private
   */
  async _loadSDK() {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      if (window.Spotify && window.Spotify.Player) {
        resolve();
        return;
      }

      // Check if script is already loading
      if (document.querySelector('script[src="https://sdk.scdn.co/spotify-player.js"]')) {
        // Wait for it to load
        window.onSpotifyWebPlaybackSDKReady = resolve;
        return;
      }

      // Load SDK script
      const script = document.createElement('script');
      script.src = 'https://sdk.scdn.co/spotify-player.js';
      script.async = true;
      
      script.onerror = () => reject(new Error('Failed to load Spotify SDK'));
      
      window.onSpotifyWebPlaybackSDKReady = () => {
        console.log('✅ Spotify Web Playback SDK loaded');
        resolve();
      };
      
      document.head.appendChild(script);
    });
  }

  /**
   * Initialize the Web Playback SDK player
   */
  async initialize() {
    // Prevent multiple initializations
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        console.log('🎵 Initializing Spotify Web Playback SDK...');

        // Check authentication
        if (!await this.auth.isAuthenticated()) {
          throw new Error('Not authenticated with Spotify');
        }

        // Load SDK
        await this._loadSDK();

        // Get access token
        const token = await this.auth.getAccessToken();

        // Create player instance
        this.player = new window.Spotify.Player({
          name: 'BooksWithMusic Reader',
          getOAuthToken: (cb) => {
            // SDK expects synchronous callback invocation
            // Use .then() instead of async/await per Spotify docs
            this.auth.getAccessToken().then(token => cb(token));
          },
          volume: 0.7
        });

        // Setup event listeners BEFORE connecting
        this._setupSDKEventListeners();

        // Connect to Spotify and wait for ready event
        const connected = await this.player.connect();
        
        if (!connected) {
          throw new Error('Failed to connect to Spotify');
        }

        // Wait for the device to be ready before resolving
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Spotify device ready timeout'));
          }, 10000); // 10 second timeout

          // Listen for ready event
          const readyHandler = () => {
            clearTimeout(timeout);
            resolve();
          };

          // If already ready (race condition), resolve immediately
          if (this.deviceId) {
            clearTimeout(timeout);
            resolve();
          } else {
            // Wait for ready event
            this.once('ready', readyHandler);
          }
        });

        console.log('✅ Spotify Web Playback SDK initialized');
        this.sdkReady = true;
        
        return true;
      } catch (error) {
        console.error('❌ Failed to initialize Spotify SDK:', error);
        this.initPromise = null; // Allow retry
        throw error;
      }
    })();

    return this.initPromise;
  }

  /**
   * Setup SDK event listeners
   * @private
   */
  _setupSDKEventListeners() {
    // Ready event - get device ID
    this.player.addListener('ready', ({ device_id }) => {
      console.log('✅ Spotify device ready:', device_id);
      this.deviceId = device_id;
      this.emit('ready', { deviceId: device_id });
    });

    // Not Ready event
    this.player.addListener('not_ready', ({ device_id }) => {
      console.warn('⚠️ Spotify device disconnected:', device_id);
      this.deviceId = null;
    });

    // Initialization Error
    this.player.addListener('initialization_error', ({ message }) => {
      console.error('❌ SDK Initialization Error:', message);
      this.emit('error', { type: 'initialization_error', message });
    });

    // Authentication Error
    this.player.addListener('authentication_error', ({ message }) => {
      console.error('❌ SDK Authentication Error:', message);
      this.emit('error', { type: 'authentication_error', message });
      // Try to refresh token
      this.auth.refreshAccessToken().catch(console.error);
    });

    // Account Error (Premium required)
    this.player.addListener('account_error', ({ message }) => {
      console.error('❌ SDK Account Error (Premium required):', message);
      this.emit('error', { 
        type: 'account_error', 
        message: 'Spotify Premium is required for embedded playback'
      });
      this.isPremium = false;
    });

    // Playback Error
    this.player.addListener('playback_error', ({ message }) => {
      console.error('❌ SDK Playback Error:', message);
      this.emit('error', { type: 'playback_error', message });
    });

    // Player State Changed
    this.player.addListener('player_state_changed', (state) => {
      if (!state) return;

      this.isPlayingState = !state.paused;
      
      if (state.track_window.current_track) {
        const track = state.track_window.current_track;
        this.currentTrack = {
          title: track.name,
          artist: track.artists[0]?.name,
          uri: track.uri,
          duration: track.duration_ms / 1000,
          albumArt: track.album.images[0]?.url
        };
        
        this.emit('trackChanged', this.currentTrack);
      }
      
      this.emit('playStateChanged', this.isPlayingState);
    });

    // Autoplay Failed (mobile support)
    this.player.addListener('autoplay_failed', () => {
      console.warn('⚠️ Autoplay blocked by browser. User interaction required.');
      this.emit('error', { 
        type: 'autoplay_failed', 
        message: 'Please click play to start music. Your browser blocked autoplay.' 
      });
    });
  }

  /**
   * Play a track or list of tracks
   */
  async play(trackOrPlaylist) {
    await this.initialize();

    if (!this.deviceId) {
      throw new Error('Spotify device not ready');
    }

    // Handle single track or playlist
    const uris = Array.isArray(trackOrPlaylist) 
      ? trackOrPlaylist.map(t => t.uri || t)
      : [trackOrPlaylist.uri || trackOrPlaylist];

    // Store playlist for navigation
    if (Array.isArray(trackOrPlaylist)) {
      this.playlist = trackOrPlaylist;
      this.currentTrackIndex = 0;
    }

    try {
      const token = await this.auth.getAccessToken();
      const response = await fetch(`${this.baseURL}/me/player/play?device_id=${this.deviceId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ uris })
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Spotify Premium is required for playback');
        }
        throw new Error(`Failed to play: ${response.statusText}`);
      }

      console.log(`▶️ Playing on Spotify SDK: ${this.currentTrack?.title || uris[0]}`);
      return true;
    } catch (error) {
      console.error('❌ Spotify play error:', error);
      throw error;
    }
  }

  /**
   * Pause playback
   */
  async pause() {
    if (!this.player) {
      throw new Error('Player not initialized');
    }

    try {
      await this.player.pause();
      console.log('⏸ Paused Spotify playback');
      return true;
    } catch (error) {
      console.error('❌ Spotify pause error:', error);
      throw error;
    }
  }

  /**
   * Resume playback
   */
  async resume() {
    if (!this.player) {
      throw new Error('Player not initialized');
    }

    try {
      await this.player.resume();
      console.log('▶️ Resumed Spotify playback');
      return true;
    } catch (error) {
      console.error('❌ Spotify resume error:', error);
      throw error;
    }
  }

  /**
   * Skip to next track
   */
  async next() {
    if (!this.player) {
      throw new Error('Player not initialized');
    }

    try {
      await this.player.nextTrack();
      this.currentTrackIndex = Math.min(this.currentTrackIndex + 1, this.playlist.length - 1);
      console.log('⏭ Skipped to next track');
      return true;
    } catch (error) {
      console.error('❌ Spotify next error:', error);
      throw error;
    }
  }

  /**
   * Skip to previous track
   */
  async previous() {
    if (!this.player) {
      throw new Error('Player not initialized');
    }

    try {
      await this.player.previousTrack();
      this.currentTrackIndex = Math.max(this.currentTrackIndex - 1, 0);
      console.log('⏮ Skipped to previous track');
      return true;
    } catch (error) {
      console.error('❌ Spotify previous error:', error);
      throw error;
    }
  }

  /**
   * Set volume (0-1)
   */
  async setVolume(volume) {
    if (!this.player) {
      throw new Error('Player not initialized');
    }

    // Clamp volume to 0-1
    const vol = Math.max(0, Math.min(1, volume));

    try {
      await this.player.setVolume(vol);
      console.log(`🔊 Set Spotify volume to ${Math.round(vol * 100)}%`);
      return true;
    } catch (error) {
      console.error('❌ Error setting volume:', error);
      throw error;
    }
  }

  /**
   * Get current playback state from SDK
   */
  async getState() {
    if (!this.player) {
      return null;
    }

    try {
      const state = await this.player.getCurrentState();
      return state;
    } catch (error) {
      console.error('❌ Error getting state:', error);
      return null;
    }
  }

  /**
   * Check if player is playing
   */
  isPlaying() {
    return this.isPlayingState;
  }

  /**
   * Get current track
   */
  getCurrentTrack() {
    return this.currentTrack;
  }

  /**
   * Disconnect and cleanup
   */
  async destroy() {
    if (this.player) {
      this.player.disconnect();
      this.player = null;
    }
    this.deviceId = null;
    this.sdkReady = false;
    this.initPromise = null;
    this.playlist = [];
    this.currentTrack = null;
    this.currentTrackIndex = 0;
    this.isPlayingState = false;
    console.log('🔌 Spotify SDK player disconnected');
  }

  /**
   * Activate element for mobile autoplay support
   * Call this from a user interaction event (click/tap) to enable autoplay
   * Required for iOS and some mobile browsers
   * @see https://developer.spotify.com/documentation/web-playback-sdk/reference#spotifyplayeractivateelement
   */
  async activateElement() {
    if (!this.player) {
      console.warn('⚠️ Cannot activate element: player not initialized');
      return;
    }

    try {
      await this.player.activateElement();
      console.log('✅ Player element activated for mobile autoplay');
    } catch (error) {
      console.error('❌ Error activating element:', error);
    }
  }

  /**
   * Event emitter: Register event handler
   */
  on(event, handler) {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event].push(handler);
  }

  /**
   * Event emitter: Register one-time event handler
   */
  once(event, handler) {
    const onceHandler = (data) => {
      handler(data);
      // Remove handler after first call
      const index = this.eventHandlers[event]?.indexOf(onceHandler);
      if (index !== -1) {
        this.eventHandlers[event].splice(index, 1);
      }
    };
    this.on(event, onceHandler);
  }

  /**
   * Event emitter: Emit event
   * @private
   */
  emit(event, data) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach(handler => handler(data));
    }
  }
}
