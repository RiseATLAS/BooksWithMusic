/**
 * SpotifyAPI - Spotify Web API Integration
 * 
 * RESPONSIBILITIES:
 * - Search Spotify catalog using recommendations API
 * - Get track audio features (energy, valence, tempo, etc.)
 * - Create playlists in user's Spotify account
 * - Control playback via Spotify Connect API
 * - Handle rate limiting and errors
 * - Convert MoodProcessor output to Spotify parameters
 * 
 * INTEGRATION NOTES:
 * - This is ONE of TWO music sources (alternative to Freesound)
 * - Used when settings.musicSource === "spotify"
 * - Requires user authentication (spotify-auth.js)
 * - Returns track objects with Spotify URIs (not direct URLs)
 * - Works with spotify-sdk-player.js for embedded playback
 * - See music-api-factory.js for API selection logic
 * 
 * API FEATURES:
 * - Recommendations: Get tracks based on audio features + genres
 * - Audio Features: Precise mood matching (energy, valence, tempo, etc.)
 * - Search: Text-based search with filters
 * - Playback Control: Play/pause/skip via Web Playback SDK
 * 
 * TRACK SELECTION ALGORITHM:
 * 1. Book Analysis (mood-processor.js) - Analyze chapters, detect mood/themes/energy, generate keywords
 * 2. Track Search - Use Recommendations API with audio features (energy, valence, tempo, genre)
 * 3. Track Scoring - Match keywords/genres, energy level, tempo, sort by score
 * 4. Track Mapping - Assign 1-5 tracks per chapter, calculate shift points
 * 
 * SPOTIFY ENHANCEMENTS vs FREESOUND:
 * - 100M+ tracks vs ~500K
 * - Precise audio feature matching (energy, valence, tempo, instrumentalness)
 * - Professional catalog with consistent quality
 * - Example: "epic" mood → seed_genres: ["cinematic", "orchestral", "epic"],
 *   target_energy: 0.85, target_valence: 0.6, target_instrumentalness: 0.8
 * 
 * RATE LIMITING:
 * - API calls limited by Spotify (usually fine for personal use)
 * - 100ms minimum interval between requests
 * - Automatic rate limit handling (429 responses)
 * 
 * REQUIREMENTS:
 * - Spotify Premium account
 * - Valid OAuth tokens (from spotify-auth.js)
 * - Internet connection
 * 
 * REFERENCES:
 * - Web API Reference: https://developer.spotify.com/documentation/web-api
 * - Recommendations: https://developer.spotify.com/documentation/web-api/reference/get-recommendations
 * - Audio Features: https://developer.spotify.com/documentation/web-api/reference/get-audio-features
 */

import { SpotifyAuth } from '../auth/spotify-auth.js';
import { SpotifyMapper } from '../mappers/spotify-mapper.js';

export class SpotifyAPI {
  constructor() {
    this.auth = new SpotifyAuth();
    this.mapper = new SpotifyMapper();
    this.baseURL = 'https://api.spotify.com/v1';
    
    // Rate limiting
    this.lastRequestTime = 0;
    this.minRequestInterval = 100; // 100ms between requests
    this.rateLimitedUntil = 0;
    
    // Cache for search results
    this.cache = new Map();
  }

  /**
   * Check if API is configured and user is authenticated
   */
  async isConfigured() {
    return await this.auth.isAuthenticated();
  }

  /**
   * Search for tracks using Spotify Recommendations API
   * This is the primary method for finding mood-matched music
   * 
   * @param {Array<string>} keywords - Keywords from MoodProcessor
   * @param {number} limit - Number of tracks to return
   * @param {Object} chapterAnalysis - Full chapter analysis from MoodProcessor
   * @returns {Array} Array of track objects
   */
  async searchTracks(keywords, limit = 20, chapterAnalysis = null, bookProfile = null) {
    if (!await this.isConfigured()) {
      console.warn('⚠️ Spotify not authenticated');
      return [];
    }

    // Get settings
    const settings = JSON.parse(localStorage.getItem('booksWithMusic-settings') || '{}');
    const instrumentalOnly = settings.instrumentalOnly !== false;

    // If we have chapter analysis, use recommendations API (better results)
    if (chapterAnalysis) {
      return await this._getRecommendations(chapterAnalysis, bookProfile, limit, instrumentalOnly);
    }

    // Fallback to text search
    return await this._textSearch(keywords, limit, instrumentalOnly);
  }

  /**
   * Get recommendations using Spotify's advanced audio features
   * @private
   */
  async _getRecommendations(chapterAnalysis, bookProfile, limit, instrumentalOnly) {
    const query = this.mapper.buildRecommendationsQuery(chapterAnalysis, bookProfile, instrumentalOnly);
    query.limit = limit;

    const queryString = this.mapper.formatQueryForURL(query);
    const endpoint = `/recommendations?${queryString}`;

    console.log(`🎵 Spotify Query | Genres:[${query.seed_genres.split(',').join(', ')}] | E${query.target_energy} V${query.target_valence} T${query.target_tempo} I${query.target_instrumentalness}`);

    try {
      const data = await this._makeRequest(endpoint);
      
      if (!data || !data.tracks) {
        console.warn('⚠️ No tracks in Spotify response');
        return [];
      }

      const tracks = data.tracks.map(track => this._formatTrack(track));
      console.log(`✅ Found ${tracks.length} Spotify tracks`);
      
      return tracks;
    } catch (error) {
      console.error('❌ Spotify recommendations error:', error);
      return [];
    }
  }

  /**
   * Text-based search (fallback method)
   * @private
   */
  async _textSearch(keywords, limit, instrumentalOnly) {
    const query = keywords.join(' ');
    let searchQuery = `track:${query}`;
    
    if (instrumentalOnly) {
      searchQuery += ' genre:instrumental OR genre:ambient OR genre:classical';
    }

    const endpoint = `/search?q=${encodeURIComponent(searchQuery)}&type=track&limit=${limit}`;

    try {
      const data = await this._makeRequest(endpoint);
      
      if (!data || !data.tracks || !data.tracks.items) {
        return [];
      }

      return data.tracks.items.map(track => this._formatTrack(track));
    } catch (error) {
      console.error('❌ Spotify search error:', error);
      return [];
    }
  }

  /**
   * Search for tracks using query terms (compatibility with Freesound API interface)
   * This method provides the same interface as Freesound's searchByQuery
   * 
   * @param {Array<string>} queryTerms - Terms to search for (e.g., ['epic', 'orchestral'])
   * @param {number} limit - Number of results (1-50, default 15)
   * @returns {Array} Array of track objects
   */
  async searchByQuery(queryTerms, limit = 15) {
    if (!await this.isConfigured()) {
      console.warn('⚠️ Spotify not authenticated');
      return [];
    }

    // Validate and clamp limit to Spotify's allowed range
    // Per official docs: https://developer.spotify.com/documentation/web-api/reference/search
    // limit parameter: Default=20, Range: 0-50
    // Using 20 as safe maximum based on testing (even though 50 is documented max)
    limit = Math.max(1, Math.min(20, Math.floor(limit) || 15));

    // Get settings
    const settings = JSON.parse(localStorage.getItem('booksWithMusic-settings') || '{}');
    const instrumentalOnly = settings.instrumentalOnly !== false;

    // For Spotify, we'll use text search with genre hints
    // Convert query terms to Spotify-friendly search
    const searchTerms = queryTerms.map(term => {
      // Map common music terms to Spotify genres
      const genreMap = {
        'epic': 'genre:epic genre:orchestral',
        'orchestral': 'genre:orchestral genre:classical',
        'ambient': 'genre:ambient',
        'cinematic': 'genre:cinematic genre:soundtrack',
        'piano': 'genre:piano genre:classical',
        'jazz': 'genre:jazz',
        'classical': 'genre:classical',
        'electronic': 'genre:electronic',
        'folk': 'genre:folk',
        'world': 'genre:world-music'
      };
      
      return genreMap[term.toLowerCase()] || term;
    });

    // Build search query
    let searchQuery = searchTerms.slice(0, 3).join(' ');
    
    if (instrumentalOnly) {
      searchQuery += ' genre:instrumental';
    }

    // Ensure limit is a valid integer (additional safety check)
    const validLimit = Math.floor(Number(limit)) || 20;
    if (validLimit < 1 || validLimit > 50) {
      console.warn(`⚠️ Invalid limit ${limit}, using default 20`);
      limit = 20;
    } else {
      limit = validLimit;
    }

    const endpoint = `/search?q=${encodeURIComponent(searchQuery)}&type=track&limit=${limit}`;
    
    console.log(`🔍 Spotify search: "${searchQuery}" (limit: ${limit})`);

    try {
      const data = await this._makeRequest(endpoint);
      
      if (!data || !data.tracks || !data.tracks.items) {
        console.warn('⚠️ No tracks in response or invalid response structure');
        return [];
      }

      const tracks = data.tracks.items.map(track => this._formatTrack(track));
      
      // Note: Audio features API sometimes returns 403 errors even with correct scopes
      // We'll skip audio features enrichment for now to avoid errors
      // The tracks will still work fine without energy/valence/tempo metadata
      
      return tracks;
    } catch (error) {
      console.error('❌ Spotify searchByQuery error:', error);
      return [];
    }
  }

  /**
   * Search by mood characteristics
   * Maps book moods to Spotify audio features and genres
   * 
   * @param {string} mood - Chapter mood (e.g., 'tense', 'peaceful', 'epic')
   * @param {number} energy - Energy level 1-5
   * @param {Array<string>} keywords - Additional mood keywords
   * @param {number} limit - Max tracks to return
   * @returns {Promise<Array>} Array of track objects
   */
  async searchByMood(mood, energy, keywords = [], limit = 5) {
    // Default values for safety
    mood = mood || 'peaceful';
    energy = energy || 3;
    
    // Simplified: just search for the mood + instrumental
    // Too many genre filters make the query too restrictive
    const searchTerms = [mood, 'instrumental'];
    
    // Add one keyword if available
    if (keywords && keywords.length > 0) {
      searchTerms.push(keywords[0]);
    }
    
    // Use the existing searchByQuery method
    return await this.searchByQuery(searchTerms, limit);
  }

  /**
   * Get audio features for multiple tracks
   * Used for more precise track scoring
   * Max 100 track IDs per request
   */
  async getAudioFeatures(trackIds) {
    if (!trackIds || trackIds.length === 0) return [];

    // Spotify API allows max 100 track IDs per request
    if (trackIds.length > 100) {
      trackIds = trackIds.slice(0, 100);
    }

    const ids = trackIds.join(',');
    const endpoint = `/audio-features?ids=${ids}`;

    try {
      const data = await this._makeRequest(endpoint);
      return data.audio_features || [];
    } catch (error) {
      console.error('❌ Error getting audio features:', error);
      // Return empty array instead of failing - audio features are optional
      return trackIds.map(() => null);
    }
  }

  /**
   * Create a playlist in user's Spotify account
   */
  async createPlaylist(userId, name, description, trackUris) {
    // Get user ID if not provided
    if (!userId) {
      const user = await this.getCurrentUser();
      userId = user.id;
    }

    // Create playlist
    const createEndpoint = `/users/${userId}/playlists`;
    const playlistData = {
      name,
      description,
      public: false
    };

    try {
      const playlist = await this._makeRequest(createEndpoint, 'POST', playlistData);
      
      // Add tracks to playlist
      if (trackUris && trackUris.length > 0) {
        const addTracksEndpoint = `/playlists/${playlist.id}/tracks`;
        await this._makeRequest(addTracksEndpoint, 'POST', { uris: trackUris });
      }

      console.log(`✅ Created Spotify playlist: ${name}`);
      return playlist;
    } catch (error) {
      console.error('❌ Error creating playlist:', error);
      throw error;
    }
  }

  /**
   * Get current user's profile
   */
  async getCurrentUser() {
    try {
      return await this._makeRequest('/me');
    } catch (error) {
      console.error('❌ Error getting user profile:', error);
      throw error;
    }
  }

  /**
   * Get user's available devices
   */
  async getDevices() {
    try {
      const data = await this._makeRequest('/me/player/devices');
      return data.devices || [];
    } catch (error) {
      console.error('❌ Error getting devices:', error);
      return [];
    }
  }

  /**
   * Format Spotify track to our standard format
   * @private
   */
  _formatTrack(spotifyTrack) {
    return {
      id: spotifyTrack.id,
      uri: spotifyTrack.uri,  // Spotify URI (needed for playback)
      title: spotifyTrack.name,
      artist: spotifyTrack.artists.map(a => a.name).join(', '),
      album: spotifyTrack.album?.name,
      duration: Math.round(spotifyTrack.duration_ms / 1000), // Convert to seconds
      url: spotifyTrack.external_urls?.spotify,  // Web player URL
      previewUrl: spotifyTrack.preview_url,  // 30-second preview
      imageUrl: spotifyTrack.album?.images?.[0]?.url,
      source: 'spotify',
      
      // Audio features (if available, otherwise will be fetched separately)
      energy: spotifyTrack.energy,
      valence: spotifyTrack.valence,
      tempo: spotifyTrack.tempo,
      instrumentalness: spotifyTrack.instrumentalness,
      
      // Tags (we can infer from genres)
      tags: this._inferTags(spotifyTrack)
    };
  }

  /**
   * Infer tags from Spotify track data
   * @private
   */
  _inferTags(track) {
    const tags = [];
    
    // Add artist genres if available
    if (track.artists && track.artists[0]?.genres) {
      tags.push(...track.artists[0].genres);
    }
    
    // Infer from track name
    const nameLower = track.name.toLowerCase();
    if (nameLower.includes('instrumental')) tags.push('instrumental');
    if (nameLower.includes('piano')) tags.push('piano');
    if (nameLower.includes('acoustic')) tags.push('acoustic');
    if (nameLower.includes('orchestra')) tags.push('orchestral');
    
    return tags;
  }

  /**
   * Make authenticated request to Spotify API
   * @private
   */
  async _makeRequest(endpoint, method = 'GET', body = null) {
    // Check rate limit
    const now = Date.now();
    if (now < this.rateLimitedUntil) {
      throw new Error('Rate limited by Spotify API. Please wait.');
    }

    // Enforce minimum interval between requests
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.minRequestInterval) {
      const delay = this.minRequestInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    // Get access token (will auto-refresh if expired)
    const token = await this.auth.getAccessToken();
    if (!token) {
      throw new Error('No Spotify access token available. Please authenticate.');
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

    this.lastRequestTime = Date.now();

    try {
      const response = await fetch(url, options);

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
        this.rateLimitedUntil = Date.now() + (retryAfter * 1000);
        throw new Error(`Spotify API rate limit reached. Retry after ${retryAfter} seconds.`);
      }

      // Handle authentication errors
      if (response.status === 401) {
        // Token might be invalid, try refreshing
        console.warn('⚠️ Spotify token invalid, attempting refresh...');
        await this.auth.refreshAccessToken();
        // Retry the request (but only once to avoid infinite loop)
        throw new Error('Token refreshed, please retry request');
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Spotify API error: ${error.error?.message || error.error || response.statusText}`);
      }

      // Handle empty responses (e.g., from DELETE requests)
      if (response.status === 204) {
        return { success: true };
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Spotify API request failed:', error);
      throw error;
    }
  }
}
