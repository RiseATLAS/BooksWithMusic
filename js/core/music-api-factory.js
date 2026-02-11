/**
 * MusicAPIFactory - Factory pattern for music source selection
 * 
 * RESPONSIBILITIES:
 * - Return appropriate music API based on user settings
 * - Provide unified interface for both Freesound and Spotify
 * - Validate source availability (authentication, configuration)
 * - Handle fallback to default source if selected source unavailable
 * 
 * DUAL-SOURCE ARCHITECTURE:
 * 1. Freesound API (Default) - Free, CC0-licensed music, embedded HTML5 playback
 * 2. Spotify API (Premium) - Professional catalog, embedded SDK playback
 * 
 * COMMON INTERFACE (both APIs must implement):
 * - async searchTracks(keywords, limit, chapterAnalysis, bookProfile)
 * - async isConfigured()
 * - async getAllTracksForBook(bookAnalysis) [optional]
 * 
 * PLAYER INTERFACE (both players must implement):
 * - async play(track) / pause() / stop() / skipToNext() / skipToPrevious()
 * - isPlaying() / getCurrentTrack()
 * - setVolume(level) [Freesound: 0-1, Spotify: 0-100]
 * 
 * MOOD → SPOTIFY MAPPING:
 * - Energy: 1-5 → 0.2-1.0 (e.g., 1=calm 0.2, 5=energetic 1.0)
 * - Tempo: slow=60-90 BPM, medium=90-120 BPM, fast=120-180 BPM
 * - Valence: dark=0.1-0.3, sad=0.2-0.4, peaceful=0.5-0.7, joyful=0.7-0.9
 * - Genres: viking→"nordic folk,epic", celtic→"celtic,irish folk", jazz→"jazz,swing,blues"
 * 
 * INTEGRATION NOTES:
 * - Used by music-manager.js to get correct API instance
 * - Settings key: 'musicSource' = 'freesound' | 'spotify'
 * - Spotify requires Premium, Freesound works for all users
 * - Both sources use same mood analysis system (mood-processor.js)
 * 
 * SPOTIFY LIMITATIONS:
 * - Requires Spotify Premium (free users cannot use)
 * - Requires internet connection (no offline mode)
 * - Non-commercial use only
 * - Cannot train AI/ML models on Spotify content
 * 
 * FREESOUND LIMITATIONS:
 * - Limited catalog (~500K tracks vs Spotify's 100M+)
 * - Variable quality (community-uploaded)
 * - Inconsistent tagging
 * 
 * USAGE:
 * ```javascript
 * const factory = new MusicAPIFactory();
 * const api = await factory.getMusicAPI();
 * const tracks = await api.searchTracks(keywords, 20, analysis);
 * ```
 * 
 * REFERENCES:
 * - Architecture diagram in code comments
 * - Spotify Web API: https://developer.spotify.com/documentation/web-api
 * - Freesound API: https://freesound.org/docs/api/
 */

import { MusicAPI as FreesoundAPI } from './music-api.js';
import { SpotifyAPI } from './spotify-api.js';

export class MusicAPIFactory {
  constructor() {
    this.apis = {
      freesound: null,
      spotify: null
    };
  }

  /**
   * Get music API based on user settings
   * Returns configured API or falls back to Freesound
   * 
   * @param {string} preferredSource - Override settings ('freesound' or 'spotify')
   * @returns {Promise<FreesoundAPI|SpotifyAPI>}
   */
  async getMusicAPI(preferredSource = null) {
    // Get source from localStorage (use 'music_source' key for consistency)
    const source = preferredSource || localStorage.getItem('music_source') || 'freesound';


    // Try to return requested source
    if (source === 'spotify') {
      const spotifyAPI = await this._getSpotifyAPI();
      
      // Check if Spotify is configured and authenticated
      if (await spotifyAPI.isConfigured()) {

        return spotifyAPI;
      } else {
        console.warn('⚠️ Spotify not configured or not authenticated. Falling back to Freesound.');
        // Fall through to Freesound
      }
    }

    // Default to Freesound
    const freesoundAPI = this._getFreesoundAPI();

    return freesoundAPI;
  }

  /**
   * Get Freesound API instance (singleton)
   * @private
   */
  _getFreesoundAPI() {
    if (!this.apis.freesound) {
      this.apis.freesound = new FreesoundAPI();
    }
    return this.apis.freesound;
  }

  /**
   * Get Spotify API instance (singleton)
   * @private
   */
  async _getSpotifyAPI() {
    if (!this.apis.spotify) {
      this.apis.spotify = new SpotifyAPI();
    }
    return this.apis.spotify;
  }

  /**
   * Check which music sources are available/configured
   * @returns {Promise<Object>} { freesound: boolean, spotify: boolean }
   */
  async getAvailableSources() {
    const freesound = this._getFreesoundAPI().isConfigured();
    const spotify = await this._getSpotifyAPI();
    const spotifyConfigured = await spotify.isConfigured();

    return {
      freesound,
      spotify: spotifyConfigured
    };
  }

  /**
   * Get player for current music source
   * Returns audio-player.js for Freesound, spotify-sdk-player.js for Spotify
   * 
   * @param {string} source - 'freesound' or 'spotify'
   * @returns {Object} Player instance
   */
  async getPlayer(source = null) {
    const activeSource = source || localStorage.getItem('music_source') || 'freesound';

    if (activeSource === 'spotify') {
      // Import Web Playback SDK player (embedded streaming)
      const { SpotifySDKPlayer } = await import('./spotify-sdk-player.js');
      return new SpotifySDKPlayer();
    } else {
      // Return Freesound player (audio-player.js)
      // Note: This will be handled by music-manager.js
      // which already has the AudioPlayer instance
      return null; // Signal to use existing audio player
    }
  }

  /**
   * Switch music source
   * Updates settings and returns new API instance
   * 
   * @param {string} newSource - 'freesound' or 'spotify'
   * @returns {Promise<FreesoundAPI|SpotifyAPI>}
   */
  async switchSource(newSource) {
    if (newSource !== 'freesound' && newSource !== 'spotify') {
      throw new Error(`Invalid music source: ${newSource}`);
    }

    // Check if new source is available
    const available = await this.getAvailableSources();
    
    if (newSource === 'spotify' && !available.spotify) {
      throw new Error('Spotify is not configured. Please authenticate first.');
    }

    // Update localStorage with new source
    localStorage.setItem('music_source', newSource);

    // Return new API
    return await this.getMusicAPI(newSource);
  }

  /**
   * Get current music source from settings
   * @returns {string} 'freesound' or 'spotify'
   */
  getCurrentSource() {
    return localStorage.getItem('music_source') || 'freesound';
  }
}
