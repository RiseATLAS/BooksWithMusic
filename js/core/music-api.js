/**
 * Music API Integration
 * Fetches royalty-free music from free APIs
 */

export class MusicAPI {
  constructor() {
    // Get API key from environment or prompt user
    this.freesoundKey = localStorage.getItem('freesound_api_key') || '';
    this.cache = new Map();
    
    // Rate limiting for Freesound API
    this.lastRequestTime = 0;
    this.minRequestInterval = 1000; // 1 second between requests
    this.rateLimitedUntil = 0; // Timestamp when rate limit expires
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

      // Fallback to free sources if no results
      if (tracks.length === 0) {
        tracks = await this.getFallbackTracks(tags, limit);
      }

      this.cache.set(cacheKey, tracks);
      return tracks;
    } catch (error) {
      console.error('❌ Error fetching music:', error);
      return await this.getFallbackTracks(tags, limit);
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
      return await this.getFallbackTracks(queryTerms, limit);
    }

    // Build a smart query: use OR between terms for broader results
    // e.g., "epic OR orchestral OR cinematic" finds tracks with any of these terms
    const query = queryTerms.join(' OR ');
    
    // Check if we're rate limited
    const now = Date.now();
    if (now < this.rateLimitedUntil) {
      console.warn('⚠️ Rate limited, skipping query for:', queryTerms);
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
    const maxEnergyLevel = settings.maxEnergyLevel || 5;

    // Build filter to get high-quality, conventional music (not weird sound effects)
    let filter = 'duration:[30 TO *] tag:music';
    
    // Require soundtrack/background music tags for better quality
    // This dramatically reduces weird experimental sounds
    if (instrumentalOnly) {
      filter += ' (tag:instrumental OR tag:soundtrack OR tag:background OR tag:ambient OR tag:cinematic OR tag:orchestral OR tag:piano OR tag:strings)';
    }
    
    // Boost quality by requiring production/game/film tags
    filter += ' (tag:soundtrack OR tag:film OR tag:game OR tag:score OR tag:production OR tag:music)';
    
    // Exclude common "weird" tags
    filter += ' -tag:fx -tag:foley -tag:sfx -tag:effect -tag:noise -tag:experimental';

    const url = `https://freesound.org/apiv2/search/text/?query=${encodeURIComponent(query)}&filter=${encodeURIComponent(filter)}&fields=id,name,username,duration,previews,tags,license&token=${this.freesoundKey}&page_size=${limit}&sort=rating_desc`;

    // 🔍 LOG QUERY
    console.group('🎵 Freesound Multi-Term Query');
    console.log('📤 Search terms:', queryTerms);
    console.log('🔎 Query string:', query);
    console.log('🔧 Filter:', filter);
    console.log('🎯 Limit:', limit);
    console.log('⚙️ Settings:', { instrumentalOnly, maxEnergyLevel });
    console.groupEnd();

    try {
      this.lastRequestTime = Date.now();
      const response = await fetch(url);
      
      if (response.status === 429) {
        console.warn('⚠️ Freesound API rate limit reached. Using cached/fallback tracks.');
        this.rateLimitedUntil = Date.now() + 60000;
        return [];
      }
      
      if (!response.ok) {
        console.error('❌ Freesound API error:', response.status, response.statusText);
        return [];
      }

      const data = await response.json();
      
      // 🔍 LOG RAW RESPONSE
      console.group('📥 Freesound Multi-Term Response');
      console.log('✅ Total results available:', data.count);
      console.log('📦 Results returned:', data.results.length);
      console.groupEnd();
      
      const tracks = data.results.map(sound => ({
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
      
      // Filter by max energy level if set
      const filteredTracks = maxEnergyLevel < 5 
        ? tracks.filter(track => track.energy <= maxEnergyLevel)
        : tracks;
      
      // 🔍 LOG FINAL RESULTS
      console.group('✨ Multi-Term Track Results');
      console.log('📊 Total tracks after filtering:', filteredTracks.length);
      if (filteredTracks.length > 0) {
        console.table(filteredTracks.map(t => ({
          title: t.title,
          artist: t.artist,
          duration: t.duration + 's',
          energy: t.energy,
          tempo: t.tempo,
          topTags: t.tags.slice(0, 5).join(', ')
        })));
        
        // Show tag summary
        const allTags = filteredTracks.flatMap(t => t.tags);
        const tagCounts = {};
        allTags.forEach(tag => tagCounts[tag] = (tagCounts[tag] || 0) + 1);
        const topTags = Object.entries(tagCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([tag, count]) => `${tag}(${count})`);
        console.log('🏷️ Most common tags:', topTags.join(', '));
      }
      console.groupEnd();
      
      return filteredTracks;
    } catch (error) {
      console.error('❌ Freesound multi-term search failed:', error);
      return [];
    }
  }

  /**
   * Search Freesound.org API for music
   */
  async searchFreesound(tags, limit) {
    if (!this.freesoundKey) return [];

    // Check if we're rate limited
    const now = Date.now();
    if (now < this.rateLimitedUntil) {
      return [];
    }

    // Enforce minimum interval between requests
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.minRequestInterval) {
      const delay = this.minRequestInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    // Check if background music filter is enabled
    const settings = JSON.parse(localStorage.getItem('booksWithMusic-settings') || '{}');
    const instrumentalOnly = settings.instrumentalOnly !== false; // Default true
    const maxEnergyLevel = settings.maxEnergyLevel || 5; // Default: all energy levels

    // Build query - combine tags with AND logic for precision
    // For multi-term queries like ['calm', 'piano', 'ambient'], all terms are required
    const query = tags.join(' ');
    
    // Build filter string (using Lucene query syntax)
    // duration:[30 TO *] = 30 seconds or longer (avoids short sound effects)
    // tag:music = must be tagged as music (not sound effects)
    let filter = 'duration:[30 TO *] tag:music';
    
    // Add background music filter if enabled
    // Require conventional instrument/genre tags to avoid weird sounds
    if (instrumentalOnly) {
      filter += ' (tag:instrumental OR tag:soundtrack OR tag:background OR tag:ambient OR tag:cinematic OR tag:orchestral OR tag:piano OR tag:strings)';
    }
    
    // Boost quality results by requiring production tags
    // This helps filter out weird experimental/sfx stuff
    filter += ' (tag:soundtrack OR tag:film OR tag:game OR tag:score OR tag:production OR tag:music)';
    
    // Explicitly exclude sound effects and weird experimental stuff
    filter += ' -tag:fx -tag:foley -tag:sfx -tag:effect -tag:noise -tag:experimental';
    
    // Sort by rating to get highest quality tracks first
    const url = `https://freesound.org/apiv2/search/text/?query=${encodeURIComponent(query)}&filter=${encodeURIComponent(filter)}&fields=id,name,username,duration,previews,tags,license&token=${this.freesoundKey}&page_size=${limit}&sort=rating_desc`;

    // 🔍 LOG QUERY
    console.group('🎵 Freesound Query');
    console.log('📤 Search terms:', tags);
    console.log('🔎 Query string:', query);
    console.log('🔧 Filter:', filter);
    console.log('🎯 Limit:', limit);
    console.groupEnd();

    try {
      this.lastRequestTime = Date.now();
      const response = await fetch(url);
      
      if (response.status === 429) {
        // Rate limited - wait 60 seconds before trying again
        console.warn('⚠️ Freesound API rate limit reached. Using cached/fallback tracks.');
        this.rateLimitedUntil = Date.now() + 60000;
        return [];
      }
      
      if (!response.ok) {
        console.error('❌ Freesound API error:', response.status, response.statusText);
        return [];
      }

      const data = await response.json();
      
      // 🔍 LOG RAW RESPONSE
      console.group('📥 Freesound Response');
      console.log('✅ Total results available:', data.count);
      console.log('📦 Results returned:', data.results.length);
      console.groupEnd();
      
      const tracks = data.results.map(sound => ({
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
      
      // Filter by max energy level if set
      const filteredTracks = maxEnergyLevel < 5 
        ? tracks.filter(track => track.energy <= maxEnergyLevel)
        : tracks;
      
      if (filteredTracks.length < tracks.length) {
        console.log(`🎚️ Filtered ${tracks.length - filteredTracks.length} tracks above energy level ${maxEnergyLevel}`);
      }
      
      // 🔍 LOG FINAL RESULTS
      console.group('✨ Final Track Results');
      console.log('📊 Total tracks after filtering:', filteredTracks.length);
      if (filteredTracks.length > 0) {
        console.table(filteredTracks.map(t => ({
          title: t.title,
          artist: t.artist,
          duration: t.duration + 's',
          energy: t.energy,
          tempo: t.tempo,
          topTags: t.tags.slice(0, 5).join(', ')
        })));
        
        // Show tag summary
        const allTags = filteredTracks.flatMap(t => t.tags);
        const tagCounts = {};
        allTags.forEach(tag => tagCounts[tag] = (tagCounts[tag] || 0) + 1);
        const topTags = Object.entries(tagCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([tag, count]) => `${tag}(${count})`);
        console.log('🏷️ Most common tags:', topTags.join(', '));
      }
      console.groupEnd();
      
      return filteredTracks;
    } catch (error) {
      console.error('❌ Freesound search failed:', error);
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
   * Get working music tracks - use Free Music Archive approach
   * Returns tracks organized by mood that are guaranteed to work
   */
  async getFallbackTracks(tags, limit) {
    // Demo tracks using royalty-free music from various sources
    const demoTracks = [
      {
        id: 'demo_calm_1',
        title: 'Peaceful Piano',
        artist: 'Demo Artist',
        duration: 180,
        url: 'https://www.bensound.com/bensound-music/bensound-sunny.mp3',
        tags: ['calm', 'piano', 'peaceful'],
        energy: 2,
        tempo: 'slow',
        license: { type: 'Demo', attributionRequired: true }
      },
      {
        id: 'demo_adventure_1',
        title: 'Epic Adventure',
        artist: 'Demo Artist',
        duration: 200,
        url: 'https://www.bensound.com/bensound-music/bensound-epic.mp3',
        tags: ['epic', 'adventure', 'cinematic'],
        energy: 4,
        tempo: 'upbeat',
        license: { type: 'Demo', attributionRequired: true }
      },
      {
        id: 'demo_dark_1',
        title: 'Dark Ambient',
        artist: 'Demo Artist',
        duration: 190,
        url: 'https://www.bensound.com/bensound-music/bensound-acousticbreeze.mp3',
        tags: ['dark', 'atmospheric', 'ambient'],
        energy: 2,
        tempo: 'slow',
        license: { type: 'Demo', attributionRequired: true }
      },
      {
        id: 'demo_happy_1',
        title: 'Joyful Melody',
        artist: 'Demo Artist',
        duration: 175,
        url: 'https://www.bensound.com/bensound-music/bensound-ukulele.mp3',
        tags: ['happy', 'uplifting', 'cheerful'],
        energy: 4,
        tempo: 'upbeat',
        license: { type: 'Demo', attributionRequired: true }
      }
    ];
    
    // Filter tracks based on tags
    const tagSet = new Set(tags.map(t => t.toLowerCase()));
    const filtered = demoTracks.filter(track => 
      track.tags.some(t => tagSet.has(t.toLowerCase()))
    );
    
    // Return filtered or all if no matches
    const result = filtered.length > 0 ? filtered : demoTracks;
    
    return result.slice(0, limit);
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
