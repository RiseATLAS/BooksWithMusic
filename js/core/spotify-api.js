/**
 * SpotifyAPI - Spotify Web API Integration
 * 
 * IMPORTANT: Spotify deprecated key endpoints on Nov 27, 2024:
 * - /recommendations (deprecated) - Now use keyword search
 * - /audio-features (deprecated) - No longer available
 * - preview_url field (deprecated) - Removed from track objects
 * 
 * RESPONSIBILITIES:
 * - Search Spotify catalog using keyword-based search API
 * - Control playback via Spotify Connect API
 * - Convert MoodProcessor output to search keywords
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
 * - Search: Text-based keyword search (only available method)
 * - Playback Control: Play/pause/skip via Web Playback SDK
 * 
 * TRACK SELECTION ALGORITHM:
 * 1. Book Analysis (mood-processor.js) - Analyze chapters, detect mood/themes/energy, generate keywords
 * 2. Track Search - Use Search API with mood/genre keywords (no audio features available)
 * 3. Track Mapping - Assign tracks based on keyword match
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
    this.cachedTopArtists = [];
    this.cachedTopArtistsFetchedAt = 0;
    
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
   * Search for tracks using Spotify Search API (keyword-based)
   * NOTE: Recommendations API is deprecated (Nov 2024) and unavailable for new apps
   * 
   * @param {Array<string>} keywords - Keywords from MoodProcessor
   * @param {number} limit - Number of tracks to return (1-20)
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

    // Build search terms from chapter analysis and keywords
    const queryTerms = [];
    
    if (chapterAnalysis) {
      if (chapterAnalysis.mood) queryTerms.push(chapterAnalysis.mood);
      if (chapterAnalysis.genres && chapterAnalysis.genres.length > 0) {
        queryTerms.push(...chapterAnalysis.genres.slice(0, 2));
      }
    }
    
    // Add keywords
    if (keywords && keywords.length > 0) {
      queryTerms.push(...keywords.slice(0, 2));
    }
    
    // Default fallback
    if (queryTerms.length === 0) {
      queryTerms.push('background', 'ambient');
    }
    
    if (instrumentalOnly) {
      queryTerms.push('instrumental');
    }

    return await this.searchByQuery(queryTerms, Math.min(20, limit));
  }

  /**
   * Text-based search (fallback method)
   * @private
   */
  async _textSearch(keywords, limit, instrumentalOnly) {
    const query = keywords.join(' ');
    let searchQuery = `track:${query}`;
    const safeLimit = Math.max(1, Math.min(20, Math.floor(limit) || 10));
    
    if (instrumentalOnly) {
      searchQuery += ' genre:instrumental OR genre:ambient OR genre:classical';
    }

    const endpoint = `/search?q=${encodeURIComponent(searchQuery)}&type=track`;

    try {
      const data = await this._makeRequest(endpoint);
      
      if (!data || !data.tracks || !data.tracks.items) {
        return [];
      }

      return data.tracks.items
        .slice(0, safeLimit)
        .map(track => this._formatTrack(track));
    } catch (error) {
      console.error('❌ Spotify search error:', error);
      return [];
    }
  }

  /**
   * Search for tracks using query terms (compatibility with Freesound API interface)
   * This method provides the same interface as Freesound's searchByQuery
   * 
   * Uses Spotify-supported query fields (genre:, artist:) and optional
   * user top-artist anchoring for stronger personalization.
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

    // Clamp to a conservative per-request window to keep response size predictable.
    // We fan out across multiple focused queries below for diversity.
    limit = Math.max(1, Math.min(20, Math.floor(limit) || 15));

    const safeTerms = (Array.isArray(queryTerms) ? queryTerms : [])
      .map(term => (term || '').trim())
      .filter(Boolean);
    const settings = JSON.parse(localStorage.getItem('booksWithMusic-settings') || '{}');
    const preferTasteAnchored = settings.preferTasteAnchoredSpotifyResults !== false;
    const normalizedTerms = safeTerms.length > 0 ? safeTerms : ['ambient'];
    const termsWithoutInstrumental = normalizedTerms.filter(
      term => term.toLowerCase() !== 'instrumental'
    );
    const termsText = (termsWithoutInstrumental.length > 0 ? termsWithoutInstrumental : ['ambient']).join(' ');
    const collectedTracks = new Map();

    const addTracks = (tracks) => {
      for (const track of tracks) {
        if (track?.id && !collectedTracks.has(track.id)) {
          collectedTracks.set(track.id, track);
        }
      }
    };

    try {
      const baseQueries = [
        `${termsText} instrumental genre:soundtrack`,
        `${termsText} instrumental genre:ambient`,
        `${termsText} instrumental genre:classical`
      ];

      for (let i = 0; i < baseQueries.length; i++) {
        const query = baseQueries[i];
        const tracks = await this._searchTracksByQueryString(
          query,
          i === 0 ? Math.max(limit, 10) : Math.max(6, Math.min(10, limit)),
          `base-${i + 1}`
        );
        addTracks(tracks);

        const provisional = this._filterAndSortTracks(Array.from(collectedTracks.values()), limit);
        if (provisional.length >= limit) {
          break;
        }
      }

      // If base mood+genre queries don't produce enough variety, anchor on user taste.
      if (preferTasteAnchored) {
        const topArtists = await this.getUserTopArtists(3);
        for (const artist of topArtists) {
          const artistQuery = `${termsText} instrumental artist:"${this._escapeSpotifyQueryValue(artist.name)}"`;
          const artistTracks = await this._searchTracksByQueryString(
            artistQuery,
            Math.max(6, Math.min(10, limit)),
            `artist:${artist.name}`
          );
          addTracks(artistTracks);

          const provisional = this._filterAndSortTracks(Array.from(collectedTracks.values()), limit);
          if (provisional.length >= limit) {
            break;
          }
        }
      }

      const allTracks = Array.from(collectedTracks.values());
      const filteredTracks = this._filterAndSortTracks(allTracks, limit);

      console.log(
        `✅ Spotify candidate pool: ${allTracks.length} tracks, returning ${filteredTracks.length} instrumental tracks`
      );

      return filteredTracks;
    } catch (error) {
      console.error('❌ Spotify searchByQuery error:', error);
      return [];
    }
  }

  /**
   * Execute one Spotify query-string search request.
   * @private
   */
  async _searchTracksByQueryString(searchQuery, limit, label = 'query') {
    const safeLimit = Math.max(1, Math.min(20, Math.floor(limit) || 10));
    const params = new URLSearchParams({
      q: searchQuery,
      type: 'track'
    });
    const endpoint = `/search?${params.toString()}`;

    console.log(`🔍 Spotify search (${label}): "${searchQuery}" (api limit=default, client limit=${safeLimit})`);

    const data = await this._makeRequest(endpoint);
    if (!data?.tracks?.items) {
      return [];
    }

    return data.tracks.items
      .slice(0, safeLimit)
      .map(track => this._formatTrack(track));
  }

  /**
   * Get user's top artists (requires user-top-read scope).
   * Used to anchor search results to real listening taste.
   */
  async getUserTopArtists(limit = 5) {
    const now = Date.now();
    const cacheTTL = 6 * 60 * 60 * 1000; // 6 hours
    const clampedLimit = Math.max(1, Math.min(10, Math.floor(limit) || 5));

    if (
      this.cachedTopArtistsFetchedAt &&
      (now - this.cachedTopArtistsFetchedAt) < cacheTTL
    ) {
      return this.cachedTopArtists.slice(0, clampedLimit);
    }

    try {
      const endpoint = `/me/top/artists?time_range=medium_term&limit=${clampedLimit}`;
      const data = await this._makeRequest(endpoint);
      const artists = (data?.items || []).map(artist => ({
        id: artist.id,
        name: artist.name,
        genres: artist.genres || [],
        popularity: artist.popularity || 0
      }));

      this.cachedTopArtists = artists;
      this.cachedTopArtistsFetchedAt = now;
      return artists;
    } catch (error) {
      this.cachedTopArtists = [];
      this.cachedTopArtistsFetchedAt = now;
      const msg = (error?.message || '').toLowerCase();
      if (msg.includes('scope') || msg.includes('insufficient')) {
        console.warn('⚠️ Spotify top artists unavailable (missing user-top-read scope). Reconnect Spotify to enable taste anchoring.');
      } else {
        console.warn('⚠️ Could not fetch Spotify top artists, using generic mood search only.');
      }
      return [];
    }
  }

  /**
   * Escape query values used inside quoted Spotify field filters.
   * @private
   */
  _escapeSpotifyQueryValue(value) {
    return String(value || '').replace(/"/g, '').trim();
  }

  /**
   * Post-filter and rank candidates.
   * @private
   */
  _filterAndSortTracks(tracks, limit) {
    const instrumentalTracks = tracks.filter(track => this._isLikelyInstrumental(track));
    instrumentalTracks.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    return instrumentalTracks.slice(0, limit);
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
    
    // Search API supports max 20 results (reduced from 50 as of Feb 2026)
    limit = Math.max(1, Math.min(20, Math.floor(limit) || 20));
    
    // Build search query from mood and keywords
    const queryTerms = [mood];
    
    // Get settings
    const settings = JSON.parse(localStorage.getItem('booksWithMusic-settings') || '{}');
    const instrumentalOnly = settings.instrumentalOnly !== false;
    
    if (instrumentalOnly) {
      queryTerms.push('instrumental');
    }
    
    // Add keywords for variety
    if (keywords && keywords.length > 0) {
      queryTerms.push(...keywords.slice(0, 2));
    }
    
    console.log(`🔍 Spotify Search: mood="${mood}", energy=${energy}, keywords=[${keywords.slice(0, 2).join(', ')}]`);
    
    return await this.searchByQuery(queryTerms, limit);
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
      // Note: preview_url removed (deprecated by Spotify)
      imageUrl: spotifyTrack.album?.images?.[0]?.url,
      source: 'spotify',
      
      // Audio features (if available, otherwise will be fetched separately)
      energy: spotifyTrack.energy,
      valence: spotifyTrack.valence,
      tempo: spotifyTrack.tempo,
      instrumentalness: spotifyTrack.instrumentalness,
      
      // Store available markets and popularity for filtering
      availableMarkets: spotifyTrack.available_markets || [],
      popularity: spotifyTrack.popularity,
      
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
   * Check if track is likely instrumental (non-vocal)
   * NOTE: Spotify doesn't provide language tags, so we can't filter by language.
   * We rely on instrumental indicators and metadata heuristics.
   * @private
   */
  _isLikelyInstrumental(track) {
    const titleLower = track.title?.toLowerCase() || '';
    const artistLower = track.artist?.toLowerCase() || '';
    const combined = `${titleLower} ${artistLower}`;
    
    // Strong instrumental indicators
    const instrumentalKeywords = [
      'instrumental', 'karaoke', 'no vocals', 'without vocals',
      'piano version', 'guitar version', 'orchestral', 'orchestra', 'symphony',
      'soundtrack', 'ost', 'original score', 'film score', 'movie score',
      'ambient', 'piano solo', 'guitar solo',
      'classical', 'concerto', 'sonata', 'prelude',
      'trailer', 'cinematic', 'epic music', 'dramatic music',
      'video game', 'game music', 'bgm', 'background music',
      'meditation', 'relaxing', 'study music', 'sleep music',
      'lofi', 'lo-fi', 'chillhop', 'beats'
    ];
    
    // Check if explicitly instrumental
    const hasInstrumentalKeyword = instrumentalKeywords.some(keyword => 
      combined.includes(keyword)
    );
    
    if (hasInstrumentalKeyword) {
      return true;
    }
    
    // If we have instrumentalness score from Spotify, use it
    // instrumentalness > 0.5 means likely no vocals
    if (track.instrumentalness !== undefined && track.instrumentalness > 0.5) {
      return true;
    }
    
    // Check for common instrumental genres/artists
    const instrumentalGenres = [
      'classical', 'jazz', 'ambient', 'electronic', 'piano',
      'orchestral', 'soundtrack', 'post-rock', 'downtempo',
      'cinematic', 'trailer', 'epic'
    ];
    
    const tags = track.tags || [];
    const hasInstrumentalGenre = tags.some(tag => 
      instrumentalGenres.some(genre => tag.toLowerCase().includes(genre))
    );
    
    if (hasInstrumentalGenre) {
      return true;
    }
    
    // Check artist names for instrumental music indicators
    const instrumentalArtists = [
      'music', 'audio', 'sound', 'library', 'production',
      'studios', 'orchestra', 'ensemble', 'philharmonic'
    ];
    
    const hasInstrumentalArtist = instrumentalArtists.some(keyword =>
      artistLower.includes(keyword)
    );
    
    if (hasInstrumentalArtist) {
      return true;
    }
    
    // If no strong indicators, reject (prefer false positives over including vocals)
    console.log(`🚫 Filtered likely vocal track: "${track.title}" by ${track.artist}`);
    return false;
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
        console.error('❌ Spotify API Error Response:', {
          status: response.status,
          statusText: response.statusText,
          error: error,
          url: url
        });
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
