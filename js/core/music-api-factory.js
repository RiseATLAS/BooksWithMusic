/**
 * MusicAPIFactory - Factory pattern for music source selection
 * 
 * RESPONSIBILITIES:
 * - Return appropriate music API based on user settings
 * - Provide unified interface for both Freesound and Spotify
 * - Validate source availability (authentication, configuration)
 * - Handle fallback to default source if selected source unavailable
 * 
 * INTEGRATION NOTES:
 * - Used by music-manager.js to get correct API instance
 * - See SPOTIFY-INTEGRATION.md for architecture diagram
 * - Both APIs implement the same core interface
 * - Settings key: 'musicSource' = 'freesound' | 'spotify'
 * 
 * INTERFACE (both APIs must implement):
 * - async searchTracks(keywords, limit, chapterAnalysis, bookProfile)
 * - async isConfigured()
 * - async getAllTracksForBook(bookAnalysis) [optional]
 * 
 * USAGE:
 * ```javascript
 * const factory = new MusicAPIFactory();
 * const api = await factory.getMusicAPI();
 * const tracks = await api.searchTracks(keywords, 20, analysis);
 * ```
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
    // Get source from settings or parameter
    const settings = JSON.parse(localStorage.getItem('booksWithMusic-settings') || '{}');
    const source = preferredSource || settings.musicSource || 'freesound';


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
    const settings = JSON.parse(localStorage.getItem('booksWithMusic-settings') || '{}');
    const activeSource = source || settings.musicSource || 'freesound';

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

    // Update settings
    const settings = JSON.parse(localStorage.getItem('booksWithMusic-settings') || '{}');
    settings.musicSource = newSource;
    localStorage.setItem('booksWithMusic-settings', JSON.stringify(settings));


    // Return new API
    return await this.getMusicAPI(newSource);
  }

  /**
   * Get current music source from settings
   * @returns {string} 'freesound' or 'spotify'
   */
  getCurrentSource() {
    const settings = JSON.parse(localStorage.getItem('booksWithMusic-settings') || '{}');
    return settings.musicSource || 'freesound';
  }
}
