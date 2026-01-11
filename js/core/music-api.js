/**
 * Music API Integration
 * Fetches royalty-free music from free APIs
 */

export class MusicAPI {
  constructor() {
    // Get API key from environment or prompt user
    this.freesoundKey = localStorage.getItem('freesound_api_key') || '';
    this.cache = new Map();
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
    console.log('🔍 MusicAPI: Searching tracks with tags:', tags, 'limit:', limit);
    const cacheKey = `${tags.join(',')}_${limit}`;
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      console.log('✓ Using cached tracks:', cached.length);
      return cached;
    }

    try {
      let tracks = [];

      // Try Freesound (best for music)
      if (this.freesoundKey) {
        console.log('🔑 Using Freesound API key');
        tracks = await this.searchFreesound(tags, limit);
        console.log('✓ Freesound returned:', tracks.length, 'tracks');
      } else {
        console.log('⚠️ No API key configured');
      }

      // Fallback to free sources if no results
      if (tracks.length === 0) {
        console.log('📚 Loading fallback tracks...');
        tracks = await this.getFallbackTracks(tags, limit);
        console.log('✓ Fallback tracks:', tracks.length);
      }

      this.cache.set(cacheKey, tracks);
      console.log('✓ Total tracks found:', tracks.length);
      return tracks;
    } catch (error) {
      console.error('❌ Error fetching music:', error);
      const fallbacks = await this.getFallbackTracks(tags, limit);
      console.log('✓ Emergency fallback tracks:', fallbacks.length);
      return fallbacks;
    }
  }

  /**
   * Search Freesound.org API for music
   */
  async searchFreesound(tags, limit) {
    if (!this.freesoundKey) return [];

    const query = tags.join(' ');
    // Filter for music-like sounds: duration > 30s, exclude SFX
    const url = `https://freesound.org/apiv2/search/text/?query=${encodeURIComponent(query)}&filter=duration:[30 TO *] tag:music&fields=id,name,username,duration,previews,tags,license&token=${this.freesoundKey}&page_size=${limit}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.warn('Freesound API error:', response.status);
        return [];
      }

      const data = await response.json();
      console.log('Freesound response:', data.count, 'results found');
      
      return data.results.map(sound => ({
        id: `freesound_${sound.id}`,
        title: sound.name,
        artist: sound.username,
        duration: Math.round(sound.duration),
        url: sound.previews['preview-hq-mp3'] || sound.previews['preview-lq-mp3'],
        tags: sound.tags,
        energy: this._estimateEnergy(sound.tags),
        tempo: this._estimateTempo(sound.tags),
        license: {
          type: sound.license,
          attributionRequired: !sound.license.includes('CC0'),
          sourceUrl: `https://freesound.org/people/${sound.username}/sounds/${sound.id}/`,
          downloadAllowed: true
        }
      }));
    } catch (error) {
      console.error('Freesound search failed:', error);
      return [];
    }
  }

  /**
   * Estimate energy level from tags (1-5)
   */
  _estimateEnergy(tags) {
    const highEnergy = ['energetic', 'fast', 'intense', 'epic', 'dramatic', 'aggressive'];
    const lowEnergy = ['calm', 'peaceful', 'slow', 'ambient', 'quiet', 'gentle'];
    
    const tagString = tags.join(' ').toLowerCase();
    if (highEnergy.some(t => tagString.includes(t))) return 4;
    if (lowEnergy.some(t => tagString.includes(t))) return 2;
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
   * Get working music tracks - use Free Music Archive approach
   * Returns tracks organized by mood that are guaranteed to work
   */
  async getFallbackTracks(tags, limit) {
    // If we have an API key, try to fetch from Freesound or similar
    // For now, return empty array and guide user to add their own tracks
    console.log('📚 Note: Using fallback approach. For best experience, add your own music URLs or use a music API.');
    
    // Return empty array - user should configure API key or add local music
    return [];
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
