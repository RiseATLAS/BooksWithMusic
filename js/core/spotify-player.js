/**
 * SpotifyPlayer - Spotify Playback Control via Spotify Connect API
 * 
 * RESPONSIBILITIES:
 * - Control playback on user's Spotify devices (play/pause/skip)
 * - Get current playback state
 * - Select active device for playback
 * - Handle track changes at shift points
 * - Emit events for UI updates
 * - Sync playback with reading progress
 * 
 * INTEGRATION NOTES:
 * - Used when settings.musicSource === "spotify"
 * - Requires Spotify Premium and active device
 * - Music plays in Spotify app (not embedded)
 * - Implements same interface as audio-player.js for consistency
 * 
 * PLAYBACK CONTROL:
 * - Uses Spotify Connect API (controls any Spotify device)
 * - Requires user to have Spotify app open on a device
 * - Can control desktop, mobile, web player, or smart speakers
 * 
 * LIMITATIONS:
 * - Cannot control volume (user controls in Spotify app)
 * - Cannot cache tracks (streams from Spotify)
 * - Requires internet connection
 * - User can manually skip tracks, breaking sync
 * 
 * REFERENCES:
 * - Playback API: https://developer.spotify.com/documentation/web-api/reference/start-a-users-playback
 * - Web Playback SDK: https://developer.spotify.com/documentation/web-playback-sdk/
 */

import { SpotifyAuth } from '../auth/spotify-auth.js';

export class SpotifyPlayer {
  constructor() {
    this.auth = new SpotifyAuth();
    this.baseURL = 'https://api.spotify.com/v1';
    
    // Playback state
    this.currentTrack = null;
    this.isPlayingState = false;
    this.currentDeviceId = null;
    this.playlist = [];
    this.currentTrackIndex = 0;
    
    // Event emitter
    this.eventHandlers = {};
    
    // Polling for playback state (Spotify doesn't push updates)
    this.pollingInterval = null;
    this.pollingIntervalMs = 3000; // Poll every 3 seconds
  }

  /**
   * Initialize player - select device and start polling
   */
  async initialize() {
    try {
      // Get available devices
      const devices = await this.getDevices();
      
      if (devices.length === 0) {
        throw new Error('No Spotify devices found. Please open Spotify on a device.');
      }

      // Find active device or use first available
      const activeDevice = devices.find(d => d.is_active);
      this.currentDeviceId = activeDevice ? activeDevice.id : devices[0].id;

      console.log(`🎵 Spotify device selected: ${activeDevice?.name || devices[0]?.name}`);

      // Start polling for playback state
      this.startPolling();

      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Spotify player:', error);
      throw error;
    }
  }

  /**
   * Play a track or list of tracks
   */
  async play(trackOrPlaylist) {
    if (!await this.auth.isAuthenticated()) {
      throw new Error('Not authenticated with Spotify');
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

    const endpoint = `/me/player/play${this.currentDeviceId ? `?device_id=${this.currentDeviceId}` : ''}`;
    const body = { uris };

    try {
      await this._makeRequest(endpoint, 'PUT', body);
      this.isPlayingState = true;
      this.currentTrack = Array.isArray(trackOrPlaylist) ? trackOrPlaylist[0] : trackOrPlaylist;
      
      console.log(`▶️ Playing on Spotify: ${this.currentTrack?.title || uris[0]}`);
      this.emit('trackChanged', this.currentTrack);
      this.emit('playStateChanged', true);
      
      return true;
    } catch (error) {
      console.error('❌ Spotify play error:', error);
      
      // If device not found, try to reinitialize
      if (error.message.includes('Device not found') || error.message.includes('No active device')) {
        console.warn('⚠️ Device not active, attempting to reinitialize...');
        await this.initialize();
        // Retry play
        return await this.play(trackOrPlaylist);
      }
      
      throw error;
    }
  }

  /**
   * Pause playback
   */
  async pause() {
    if (!await this.auth.isAuthenticated()) {
      throw new Error('Not authenticated with Spotify');
    }

    const endpoint = `/me/player/pause${this.currentDeviceId ? `?device_id=${this.currentDeviceId}` : ''}`;

    try {
      await this._makeRequest(endpoint, 'PUT');
      this.isPlayingState = false;
      
      console.log('⏸ Paused Spotify playback');
      this.emit('playStateChanged', false);
      
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
    return await this.play(this.currentTrack || this.playlist);
  }

  /**
   * Stop playback (pause and reset)
   */
  async stop() {
    await this.pause();
    this.currentTrack = null;
    this.currentTrackIndex = 0;
  }

  /**
   * Skip to next track in playlist
   */
  async skipToNext() {
    if (!await this.auth.isAuthenticated()) {
      throw new Error('Not authenticated with Spotify');
    }

    const endpoint = `/me/player/next${this.currentDeviceId ? `?device_id=${this.currentDeviceId}` : ''}`;

    try {
      await this._makeRequest(endpoint, 'POST');
      
      // Update local state
      if (this.playlist && this.currentTrackIndex < this.playlist.length - 1) {
        this.currentTrackIndex++;
        this.currentTrack = this.playlist[this.currentTrackIndex];
        this.emit('trackChanged', this.currentTrack);
      }
      
      console.log('⏭ Skipped to next track');
      return true;
    } catch (error) {
      console.error('❌ Spotify skip error:', error);
      throw error;
    }
  }

  /**
   * Skip to previous track in playlist
   */
  async skipToPrevious() {
    if (!await this.auth.isAuthenticated()) {
      throw new Error('Not authenticated with Spotify');
    }

    const endpoint = `/me/player/previous${this.currentDeviceId ? `?device_id=${this.currentDeviceId}` : ''}`;

    try {
      await this._makeRequest(endpoint, 'POST');
      
      // Update local state
      if (this.playlist && this.currentTrackIndex > 0) {
        this.currentTrackIndex--;
        this.currentTrack = this.playlist[this.currentTrackIndex];
        this.emit('trackChanged', this.currentTrack);
      }
      
      console.log('⏮ Skipped to previous track');
      return true;
    } catch (error) {
      console.error('❌ Spotify previous error:', error);
      throw error;
    }
  }

  /**
   * Play specific track from playlist by index
   */
  async playTrackAtIndex(index) {
    if (!this.playlist || index < 0 || index >= this.playlist.length) {
      throw new Error('Invalid track index');
    }

    this.currentTrackIndex = index;
    return await this.play(this.playlist[index]);
  }

  /**
   * Check if currently playing
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
   * Set volume (0-100) - Premium only, uses Spotify Connect API
   */
  async setVolume(volume) {
    if (!await this.auth.isAuthenticated()) {
      throw new Error('Not authenticated with Spotify');
    }

    // Clamp volume to 0-100
    const volumePercent = Math.max(0, Math.min(100, Math.round(volume)));
    
    const endpoint = `/me/player/volume?volume_percent=${volumePercent}${this.currentDeviceId ? `&device_id=${this.currentDeviceId}` : ''}`;

    try {
      await this._makeRequest(endpoint, 'PUT');
      console.log(`🔊 Set Spotify volume to ${volumePercent}%`);
      return true;
    } catch (error) {
      // Handle Premium requirement (403)
      if (error.message.includes('Premium') || error.message.includes('403')) {
        console.warn('⚠️ Volume control requires Spotify Premium');
        throw new Error('Spotify Premium required for volume control');
      }
      console.error('❌ Error setting volume:', error);
      throw error;
    }
  }

  /**
   * Get current playback state from Spotify
   */
  async getPlaybackState() {
    if (!await this.auth.isAuthenticated()) {
      return null;
    }

    try {
      const data = await this._makeRequest('/me/player');
      
      if (!data || !data.item) {
        return null;
      }

      // Update local state
      this.isPlayingState = data.is_playing;
      this.currentDeviceId = data.device?.id;

      return {
        isPlaying: data.is_playing,
        track: {
          id: data.item.id,
          uri: data.item.uri,
          title: data.item.name,
          artist: data.item.artists.map(a => a.name).join(', '),
          duration: Math.round(data.item.duration_ms / 1000),
          progress: Math.round(data.progress_ms / 1000)
        },
        device: {
          id: data.device.id,
          name: data.device.name,
          type: data.device.type,
          volume: data.device.volume_percent
        }
      };
    } catch (error) {
      console.error('❌ Error getting playback state:', error);
      return null;
    }
  }

  /**
   * Get available Spotify devices
   */
  async getDevices() {
    try {
      const token = await this.auth.getAccessToken();
      const response = await fetch(`${this.baseURL}/me/player/devices`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Failed to get devices');
      }

      const data = await response.json();
      return data.devices || [];
    } catch (error) {
      console.error('❌ Error getting devices:', error);
      return [];
    }
  }

  /**
   * Select active device for playback
   */
  async setActiveDevice(deviceId) {
    this.currentDeviceId = deviceId;
    
    // Transfer playback to this device
    const endpoint = '/me/player';
    const body = {
      device_ids: [deviceId],
      play: this.isPlayingState
    };

    try {
      await this._makeRequest(endpoint, 'PUT', body);
      console.log(`📱 Switched to device: ${deviceId}`);
      return true;
    } catch (error) {
      console.error('❌ Error setting device:', error);
      throw error;
    }
  }

  /**
   * Start polling for playback state updates
   * @private
   */
  startPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    this.pollingInterval = setInterval(async () => {
      const state = await this.getPlaybackState();
      
      if (state) {
        // Check if track changed (user manually skipped)
        if (state.track.id !== this.currentTrack?.id) {
          this.currentTrack = state.track;
          this.emit('trackChanged', state.track);
          
          // Try to find new track in our playlist
          const index = this.playlist.findIndex(t => t.id === state.track.id);
          if (index >= 0) {
            this.currentTrackIndex = index;
          }
        }

        // Check if play state changed
        if (state.isPlaying !== this.isPlayingState) {
          this.isPlayingState = state.isPlaying;
          this.emit('playStateChanged', state.isPlaying);
        }
      }
    }, this.pollingIntervalMs);
  }

  /**
   * Stop polling
   * @private
   */
  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.stopPolling();
    this.playlist = [];
    this.currentTrack = null;
    this.currentTrackIndex = 0;
    this.isPlayingState = false;
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
   * Event emitter: Emit event
   * @private
   */
  emit(event, data) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach(handler => handler(data));
    }
  }

  /**
   * Make authenticated request to Spotify API with error handling
   * Implements Spotify API error handling decision table
   * @private
   */
  async _makeRequest(endpoint, method = 'GET', body = null, retryCount = 0) {
    const token = await this.auth.getAccessToken();
    if (!token) {
      throw new Error('No Spotify access token available');
    }

    const url = `${this.baseURL}${endpoint}`;
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);

      // Handle 204 No Content (success with no response body)
      if (response.status === 204) {
        return { success: true };
      }

      // Handle 401 Unauthorized - refresh token and retry once
      if (response.status === 401 && retryCount === 0) {
        console.warn('🔄 Token expired, refreshing and retrying...');
        await this.auth.refreshAccessToken();
        return await this._makeRequest(endpoint, method, body, retryCount + 1);
      }

      // Handle 403 Forbidden - Premium required or account error
      if (response.status === 403) {
        const error = await response.json().catch(() => ({}));
        console.error('❌ Spotify Premium required or account error:', error);
        throw new Error('Spotify Premium required. Player endpoints only work for Premium users.');
      }

      // Handle 404 Not Found - fallback strategy
      if (response.status === 404) {
        const error = await response.json().catch(() => ({}));
        console.warn('⚠️ Spotify endpoint not found (404):', endpoint);
        throw new Error(`Spotify API endpoint not found: ${error.error?.message || 'Unknown error'}`);
      }

      // Handle 429 Rate Limited - backoff and retry
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
        console.warn(`⏱️ Rate limited, waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return await this._makeRequest(endpoint, method, body, retryCount + 1);
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Spotify API error: ${error.error?.message || error.error || response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      // Re-throw our custom errors
      if (error.message.includes('Premium') || error.message.includes('404') || error.message.includes('Rate limited')) {
        throw error;
      }
      // Wrap other errors
      console.error('❌ Spotify API request failed:', error);
      throw new Error(`Spotify API request failed: ${error.message}`);
    }
  }
}
