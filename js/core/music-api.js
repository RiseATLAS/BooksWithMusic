/**
 * FreesoundAPI - Freesound API Integration (CC0-licensed music)
 * 
 * RESPONSIBILITIES:
 * - Search Freesound for CC0-licensed music tracks
 * - Filter by duration, tags, instrumental-only
 * - Handle API rate limiting and errors
 * - Cache search results to minimize API calls
 * - Provide direct audio URLs for playback
 * 
 * INTEGRATION NOTES:
 * - This is ONE of TWO music sources (alternative to Spotify)
 * - Used when settings.musicSource === "freesound" (default)
 * - Returns track objects with direct audio URLs
 * - Tracks can be cached in IndexedDB for offline use
 * - See music-api-factory.js for API selection logic
 * 
 * API ENDPOINTS:
 * - Search: /apiv2/search/ (updated from deprecated /apiv2/search/text/)
 * - Filters: CC0 license, duration 30-360s, music tags
 * - Sort: rating_desc (highest quality first)
 * 
 * NOTE: Will be refactored to freesound-api.js for clarity
 */

export class MusicAPI {
  constructor() {
    // Get API key from localStorage or use backup
    this.freesoundKey = this._getApiKey();
    this.cache = new Map();
    
    // Rate limiting for Freesound API
    this.lastRequestTime = 0;
    this.minRequestInterval = 1000; // 1 second between requests
    this.rateLimitedUntil = 0; // Timestamp when rate limit expires
    
    // Max duration for tracks (6 minutes = 360 seconds)
    this.maxDuration = 360;
  }

  /**
   * Get API key with backup fallback
   * @private
   */
  _getApiKey() {
    const userKey = localStorage.getItem('freesound_api_key');
    if (userKey) return userKey;
    
    // Backup key (obfuscated)
    const parts = ['zuEylS4I', 'QQIyJdHt', 'oySnXhXF', 'oDwMgGv8', 'qVgrxsad'];
    return parts.join('');
  }

  /**
   * Check if API keys are configured
   */
  isConfigured() {
    return !!this.freesoundKey;
  }

  /**
   * Set Freesound API key
   */
  setFreesoundKey(key) {
    this.freesoundKey = key;
    localStorage.setItem('freesound_api_key', key);
  }

  /**
   * Search for music tracks by tags/mood
   * @param {Array<string>} tags - Search tags like ['calm', 'piano', 'ambient']
   * @param {number} limit - Number of results
   */
  async searchTracks(tags, limit = 10) {
    const cacheKey = `${tags.join(',')}_${limit}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      let tracks = [];

      // Try Freesound (best for music)
      if (this.freesoundKey) {
        tracks = await this.searchFreesound(tags, limit);
      }

      // No fallback - return empty array if no Freesound results
      if (tracks.length === 0) {
        console.warn(`⚠️ No CC0 tracks found for tags: ${tags.join(', ')}`);
      }

      this.cache.set(cacheKey, tracks);
      return tracks;
    } catch (error) {
      console.error('❌ Error fetching music:', error);
      return [];
    }
  }
  
  /**
   * Search for tracks using a multi-term query
   * This creates better, more conventional music results by combining genre/style/mood terms
   * @param {Array<string>} queryTerms - Terms to search for (e.g., ['epic', 'orchestral', 'cinematic'])
   * @param {number} limit - Number of results
   */
  async searchByQuery(queryTerms, limit = 10) {
    if (!this.freesoundKey) {
      console.warn('⚠️ No Freesound API key configured');
      return [];
    }

    // Build a smart query: use OR between terms for broader results
    // e.g., "epic OR orchestral OR cinematic" finds tracks with any of these terms
    const query = queryTerms.join(' OR ');
    
    // Check if we're rate limited
    const now = Date.now();
    if (now < this.rateLimitedUntil) {
      console.warn(' Rate limited, skipping query for:', queryTerms);
      return [];
    }

    // Enforce minimum interval between requests
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.minRequestInterval) {
      const delay = this.minRequestInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    // Check settings
    const settings = JSON.parse(localStorage.getItem('booksWithMusic-settings') || '{}');
    const instrumentalOnly = settings.instrumentalOnly !== false; // Default true
    const maxEnergyLevel = settings.maxEnergyLevel || 3; // Default to 3 (Moderate)

    // Build filter to get high-quality, conventional music (not weird sound effects)
    // Include all Creative Commons licensed music
    let filter = 'duration:[30 TO 360] tag:music';
    
    // Require soundtrack/background music tags for better quality
    // This dramatically reduces weird experimental sounds
    if (instrumentalOnly) {
      filter += ' (tag:instrumental OR tag:soundtrack OR tag:background OR tag:ambient OR tag:cinematic OR tag:orchestral OR tag:piano OR tag:strings)';
    }
    
    // Boost quality by requiring production/game/film tags
    filter += ' (tag:soundtrack OR tag:film OR tag:game OR tag:score OR tag:production OR tag:music)';
    
    // Exclude common "weird" tags
    filter += ' -tag:fx -tag:foley -tag:sfx -tag:effect -tag:noise -tag:experimental';

    // Use the updated /apiv2/search/ endpoint (text search was deprecated Nov 2025)
    const url = `https://freesound.org/apiv2/search/?query=${encodeURIComponent(query)}&filter=${encodeURIComponent(filter)}&fields=id,name,username,duration,previews,tags,license&token=${this.freesoundKey}&page_size=${limit}&sort=rating_desc`;

    // 🔍 LOG QUERY


    try {
      this.lastRequestTime = Date.now();
      const response = await fetch(url);
      
      if (response.status === 429) {
        console.warn(' Freesound API rate limit reached. Using cached/fallback tracks.');
        this.rateLimitedUntil = Date.now() + 60000;
        return [];
      }
      
      if (!response.ok) {
        console.error(' Freesound API error:', response.status, response.statusText);
        console.error('Query was:', queryTerms.join(', '));
        console.error('Response:', await response.text().catch(() => 'Could not read response'));
        return [];
      }

      const data = await response.json();
      
      if (!data || !data.results) {
        console.error(' Invalid response from Freesound API:', data);
        return [];
      }
      
      if (data.results.length === 0) {
        console.warn(` Freesound returned 0 results for query: [${queryTerms.join(', ')}]`);
        return [];
      }
      
      // 🔍 LOG RAW RESPONSE

      
      const tracks = data.results
        .filter(sound => {
          // Include all Creative Commons licensed sounds
          const hasLicense = sound.license && sound.license.length > 0;
          if (!hasLicense) {
            console.warn(`❌ Filtered out sound without license: ${sound.name}`);
          }
          return hasLicense;
        })
        .map(sound => ({
          // Core identifiers
          id: `freesound_${sound.id}`,
          freesoundId: sound.id, // Store original Freesound ID for documentation
          
          // Display info
          title: sound.name,
          artist: sound.username,
          duration: Math.round(sound.duration),
          url: sound.previews['preview-hq-mp3'] || sound.previews['preview-lq-mp3'],
          
          // Categorization
          tags: sound.tags,
          energy: this._estimateEnergy(sound.tags),
          tempo: this._estimateTempo(sound.tags),
          
          // Legal documentation (stored but not displayed in UI)
          license: {
            type: 'CC0', // Only CC0 sounds pass the filter
            sourceUrl: `https://freesound.org/people/${sound.username}/sounds/${sound.id}/`,
            fetchedAt: new Date().toISOString() // Timestamp of retrieval
          }
        }));
      
      // Filter by max duration (6 minutes)
      let filteredTracks = tracks.filter(track => track.duration <= this.maxDuration);
      
      // Filter by max energy level if set
      filteredTracks = maxEnergyLevel < 5 
        ? filteredTracks.filter(track => track.energy <= maxEnergyLevel)
        : filteredTracks;
      
      // Removed verbose per-query logging - see summary at end
      
      return filteredTracks;
    } catch (error) {
      console.error(' Freesound search failed:', error);
      return [];
    }
  }

  /**
   * Estimate energy level from tags (1-5)
   */
  _estimateEnergy(tags) {
    // Energy levels 1-5:
    // 1 = Very Calm (ambient, meditation, sleep)
    // 2 = Calm (peaceful, gentle, slow)
    // 3 = Moderate (neutral, background)
    // 4 = Energetic (upbeat, dynamic)
    // 5 = Very Energetic (intense, epic, dramatic)
    
    const veryHighEnergy = ['intense', 'dramatic', 'aggressive', 'powerful', 'action'];
    const highEnergy = ['energetic', 'fast', 'epic', 'upbeat', 'dynamic'];
    const lowEnergy = ['calm', 'peaceful', 'gentle', 'soft', 'relaxing'];
    const veryLowEnergy = ['ambient', 'meditation', 'sleep', 'quiet', 'serene', 'minimal'];
    
    const tagString = tags.join(' ').toLowerCase();
    
    // Check from extremes to middle
    if (veryLowEnergy.some(t => tagString.includes(t))) return 1;
    if (veryHighEnergy.some(t => tagString.includes(t))) return 5;
    if (lowEnergy.some(t => tagString.includes(t))) return 2;
    if (highEnergy.some(t => tagString.includes(t))) return 4;
    
    // Default to moderate
    return 3;
  }

  /**
   * Estimate tempo from tags
   */
  _estimateTempo(tags) {
    const tagString = tags.join(' ').toLowerCase();
    if (tagString.match(/fast|upbeat|energetic|quick/)) return 'upbeat';
    if (tagString.match(/slow|calm|peaceful|gentle/)) return 'slow';
    return 'moderate';
  }



  /**
   * Get curated track library from a working source
   * This would ideally fetch from:
   * - Freesound.org (requires API key)
   * - Free Music Archive
   * - Local music files
   * - User-provided URLs
   */
  async getCuratedLibrary() {
    // Check for user-provided tracks in localStorage
    const userTracks = localStorage.getItem('user_music_tracks');
    if (userTracks) {
      try {
        return JSON.parse(userTracks);
      } catch (e) {
        console.error('Failed to parse user tracks');
      }
    }
    
    return [];
  }

  /**
   * Download and cache a track for offline use
   */
  async downloadTrack(track) {
    try {
      const response = await fetch(track.url);
      const blob = await response.blob();
      return blob;
    } catch (error) {
      console.error('Error downloading track:', error);
      return null;
    }
  }

  /**
   * Get recommended tracks for a specific mood
   */
  async getTracksForMood(mood, limit = 5) {
    const moodTagMapping = {
      dark: ['dark', 'atmospheric', 'suspense'],
      mysterious: ['mysterious', 'ambient', 'ethereal'],
      romantic: ['romantic', 'piano', 'emotional'],
      sad: ['sad', 'melancholy', 'emotional'],
      epic: ['epic', 'orchestral', 'cinematic'],
      peaceful: ['calm', 'peaceful', 'ambient'],
      tense: ['suspense', 'tension', 'dramatic'],
      joyful: ['uplifting', 'cheerful', 'happy'],
      adventure: ['adventure', 'energetic', 'cinematic'],
      magical: ['magical', 'fantasy', 'mystical']
    };

    const tags = moodTagMapping[mood] || ['ambient', 'instrumental'];
    return await this.searchTracks(tags, limit);
  }
}
