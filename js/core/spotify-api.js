/**
 * SpotifyAPI - Spotify Web API Integration
 * 
 * RESPONSIBILITIES:
 * - Search Spotify catalog using recommendations API
 * - Get track audio features (energy, valence, tempo, etc.)
 * - Create playlists in user's Spotify account
 * - Control playback via Spotify Connect API
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
    
    // Hardcoded list of KNOWN VALID Spotify genre seeds
    // NOTE: Spotify removed the /available-genre-seeds endpoint in Dec 2024
    // This list contains commonly used, tested valid genres
    this.validGenres = [
      'acoustic', 'ambient', 'blues', 'classical', 'country', 'dance',
      'electronic', 'folk', 'hip-hop', 'indie', 'jazz', 'metal',
      'pop', 'rock', 'soul', 'world', 
      // Additional useful genres for book music
      'chill', 'piano', 'indie-pop', 'sad', 'happy', 'sleep',
      'new-age', 'opera', 'soundtrack', 'romance', 'rainy-day',
      'edm', 'house', 'techno', 'industrial', 'goth',
      'minimal-techno', 'trip-hop', 'post-dubstep',
      'indie-folk', 'singer-songwriter', 'acoustic'
    ];
  }

  /**
   * Check if API is configured and user is authenticated
   */
  async isConfigured() {
    return await this.auth.isAuthenticated();
  }
  
  /**
   * Validate and filter genre seeds against Spotify's known valid list
   * @param {Array<string>} genres - Genre seeds to validate
   * @returns {Array<string>} Valid genre seeds only
   */
  validateGenres(genres) {
    const validSet = new Set(this.validGenres);
    const validated = genres.filter(genre => validSet.has(genre));
    
    // Log any invalid genres
    const invalid = genres.filter(genre => !validSet.has(genre));
    if (invalid.length > 0) {
      console.warn(`⚠️ Invalid Spotify genres filtered out: [${invalid.join(', ')}]`);
    }
    
    return validated;
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
   * IMPORTANT: Spotify's Search API does NOT support genre: filters
   * Use plain text search only, avoid "genre:" prefixes
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
    limit = Math.max(1, Math.min(50, Math.floor(limit) || 15));

    // Get settings
    const settings = JSON.parse(localStorage.getItem('booksWithMusic-settings') || '{}');
    const instrumentalOnly = settings.instrumentalOnly !== false;

    // Build search query using PLAIN TEXT ONLY (no genre: filters!)
    // Spotify Search API does NOT support genre filters in query string
    let searchQuery = queryTerms.join(' ');
    
    // Add instrumental-related terms if needed (plain text, not genre filters)
    if (instrumentalOnly) {
      searchQuery += ' instrumental';
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
   * Search by mood characteristics using Spotify Recommendations API
   * This is MORE EFFICIENT than text search and respects rate limits better
   * 
   * @param {string} mood - Chapter mood (e.g., 'tense', 'peaceful', 'epic')
   * @param {number} energy - Energy level 1-5
   * @param {Array<string>} keywords - Additional mood keywords
   * @param {number} limit - Max tracks to return (1-100 for Recommendations API)
   * @returns {Promise<Array>} Array of track objects
   */
  async searchByMood(mood, energy, keywords = [], limit = 20) {
    // Default values for safety
    mood = mood || 'peaceful';
    energy = energy || 3;
    
    // Validate limit for Recommendations API (1-100)
    limit = Math.max(1, Math.min(100, Math.floor(limit) || 20));
    
    // Map mood and keywords to Spotify genres (max 5 seeds) and validate them
    const genreSeeds = this._moodToGenres(mood, energy, keywords);
    
    // If no valid genres after validation, fall back to search
    if (genreSeeds.length === 0) {
      console.warn('⚠️ No valid genres available, falling back to search');
      const searchLimit = Math.min(20, limit);
      return await this.searchByQuery([mood, 'instrumental', ...keywords.slice(0, 1)], searchLimit);
    }
    
    // Convert energy (1-5) to Spotify scale (0-1)
    const targetEnergy = energy / 5;
    
    // Build recommendations query with audio features
    const params = new URLSearchParams({
      seed_genres: genreSeeds.slice(0, 5).join(','), // Max 5 genre seeds
      limit: limit.toString(),
      target_energy: targetEnergy.toFixed(2),
      target_instrumentalness: '0.7', // Prefer instrumental
      min_instrumentalness: '0.5', // Filter to instrumental only
      max_speechiness: '0.3' // Avoid tracks with too much speech/vocals
    });
    
    // Add valence (mood positivity) based on mood
    const valence = this._moodToValence(mood);
    if (valence !== null) {
      params.append('target_valence', valence.toFixed(2));
    }
    
    const endpoint = `/recommendations?${params.toString()}`;
    
    console.log(`🎵 Spotify Recommendations: mood="${mood}", energy=${energy}, genres=[${genreSeeds.slice(0, 5).join(', ')}]`);
    
    try {
      const data = await this._makeRequest(endpoint);
      
      if (!data || !data.tracks || data.tracks.length === 0) {
        console.warn('⚠️ No tracks from Recommendations API, falling back to search');
        // Fallback to text search - limit to 20 for Search API (max 50, but 20 is safer)
        const searchLimit = Math.min(20, limit);
        return await this.searchByQuery([mood, 'instrumental', ...keywords.slice(0, 1)], searchLimit);
      }

      const tracks = data.tracks.map(track => this._formatTrack(track));
      console.log(`✅ Found ${tracks.length} Spotify tracks via Recommendations API`);
      
      return tracks;
    } catch (error) {
      console.error('❌ Spotify Recommendations API error:', error);
      // Fallback to search API - limit to 20 for Search API (max 50, but 20 is safer)
      const searchLimit = Math.min(20, limit);
      return await this.searchByQuery([mood, 'instrumental', ...keywords.slice(0, 1)], searchLimit);
    }
  }
  
  /**
   * Score and filter tracks based on match quality
   * Ensures we only return tracks that actually fit the mood
   * @private
   */
  _scoreAndFilterTracks(tracks, criteria) {
    const { mood, targetEnergy, targetValence, instrumentalnessThreshold } = criteria;
    
    const settings = JSON.parse(localStorage.getItem('booksWithMusic-settings') || '{}');
    const showTrackInfo = settings.showTrackInfo || false;
    
    // Score each track
    const scoredTracks = tracks.map(track => {
      let score = 100; // Start with perfect score
      let reasons = [];
      
      // Fetch audio features if available (from Spotify's response)
      // Note: Recommendations API doesn't always return audio features
      // We might need to fetch them separately for accurate scoring
      
      // 1. Check instrumentalness (CRITICAL - must be instrumental)
      if (track.instrumentalness !== undefined) {
        if (track.instrumentalness < instrumentalnessThreshold) {
          score -= 50; // Major penalty for vocal tracks
          reasons.push(`❌ Too vocal (${(track.instrumentalness * 100).toFixed(0)}% instrumental)`);
        } else {
          reasons.push(`✅ Instrumental (${(track.instrumentalness * 100).toFixed(0)}%)`);
        }
      }
      
      // 2. Check energy match (IMPORTANT)
      if (track.energy !== undefined && targetEnergy !== undefined) {
        const energyDiff = Math.abs(track.energy - targetEnergy);
        if (energyDiff > 0.3) {
          score -= 20; // Penalty for energy mismatch
          reasons.push(`⚠️ Energy mismatch (want ${(targetEnergy * 100).toFixed(0)}%, got ${(track.energy * 100).toFixed(0)}%)`);
        } else {
          reasons.push(`✅ Energy match (${(track.energy * 100).toFixed(0)}%)`);
        }
      }
      
      // 3. Check valence (mood positivity) match
      if (track.valence !== undefined && targetValence !== null) {
        const valenceDiff = Math.abs(track.valence - targetValence);
        if (valenceDiff > 0.4) {
          score -= 15; // Penalty for mood mismatch
          reasons.push(`⚠️ Mood mismatch (want ${(targetValence * 100).toFixed(0)}% positive, got ${(track.valence * 100).toFixed(0)}%)`);
        } else {
          reasons.push(`✅ Mood match (${(track.valence * 100).toFixed(0)}% positive)`);
        }
      }
      
      // 4. Check speechiness (should be low for instrumental)
      if (track.speechiness !== undefined) {
        if (track.speechiness > 0.33) {
          score -= 25; // Penalty for too much speech
          reasons.push(`❌ Too much speech (${(track.speechiness * 100).toFixed(0)}%)`);
        } else {
          reasons.push(`✅ Low speech (${(track.speechiness * 100).toFixed(0)}%)`);
        }
      }
      
      // 5. Bonus for perfect matches
      if (track.instrumentalness >= 0.9) {
        score += 10;
        reasons.push(`🌟 Highly instrumental`);
      }
      
      // Store score and reasoning
      track.matchScore = score;
      track.matchReasons = reasons;
      
      if (showTrackInfo) {
        console.log(`📊 ${track.title} - Score: ${score}/100 - ${reasons.join(', ')}`);
      }
      
      return track;
    });
    
    // Filter out tracks that don't meet minimum quality
    const MIN_SCORE = 50; // Tracks must score at least 50/100
    const filteredTracks = scoredTracks.filter(track => {
      if (track.matchScore < MIN_SCORE) {
        console.warn(`🚫 Filtered out "${track.title}" (score: ${track.matchScore}/100)`);
        return false;
      }
      return true;
    });
    
    // Sort by score (best matches first)
    filteredTracks.sort((a, b) => b.matchScore - a.matchScore);
    
    return filteredTracks;
  }

  /**
   * Map mood to Spotify genres and validate them
   * @private
   */
  _moodToGenres(mood, energy, keywords) {
    // Map to Spotify genre seeds
    const moodGenreMap = {
      'epic': ['soundtrack', 'classical', 'metal'],
      'tense': ['ambient', 'electronic', 'industrial'],
      'peaceful': ['ambient', 'chill', 'piano', 'new-age'],
      'mysterious': ['ambient', 'electronic', 'minimal-techno'],
      'joyful': ['indie', 'folk', 'happy', 'indie-pop'],
      'sad': ['piano', 'acoustic', 'indie', 'sad', 'rainy-day'],
      'dramatic': ['soundtrack', 'classical', 'opera'],
      'calm': ['ambient', 'chill', 'acoustic', 'sleep'],
      'energetic': ['electronic', 'indie', 'dance', 'edm'],
      'dark': ['ambient', 'electronic', 'goth', 'industrial'],
      'romantic': ['acoustic', 'piano', 'indie', 'romance'],
      'adventure': ['soundtrack', 'folk', 'classical', 'world'],
      'action': ['electronic', 'soundtrack', 'metal'],
      'fantasy': ['soundtrack', 'classical', 'folk', 'ambient']
    };
    
    // Start with mood-based genres
    let genres = moodGenreMap[mood.toLowerCase()] || ['ambient', 'chill'];
    
    // Add energy-based genre
    if (energy >= 4) {
      genres.push('electronic'); // High energy
    } else if (energy <= 2) {
      genres.push('ambient'); // Low energy
    } else {
      genres.push('soundtrack'); // Medium energy
    }
    
    // Add keyword-based genres if they map
    keywords.forEach(kw => {
      if (moodGenreMap[kw.toLowerCase()]) {
        genres.push(...moodGenreMap[kw.toLowerCase()]);
      }
    });
    
    // Get unique genres first
    const uniqueGenres = [...new Set(genres)];
    
    // Validate genres against known valid list
    const validatedGenres = this.validateGenres(uniqueGenres);
    
    // Limit to 5 (Spotify's max for seed_genres)
    const finalGenres = validatedGenres.slice(0, 5);
    
    // Log for debugging
    console.log(`🎼 Genre seeds: [${finalGenres.join(', ')}] (from mood="${mood}", energy=${energy})`);
    
    return finalGenres;
  }
  
  /**
   * Map mood to valence (happiness/positivity)
   * @private
   */
  _moodToValence(mood) {
    const valenceMap = {
      'joyful': 0.8,
      'happy': 0.8,
      'peaceful': 0.5,
      'calm': 0.5,
      'mysterious': 0.4,
      'tense': 0.3,
      'sad': 0.2,
      'dark': 0.2,
      'epic': 0.6,
      'dramatic': 0.5,
      'romantic': 0.7
    };
    
    return valenceMap[mood.toLowerCase()] || null;
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
