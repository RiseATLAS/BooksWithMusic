import { CacheManager } from '../storage/cache-manager.js';
import { AIProcessor } from './ai-processor.js';
import { MusicAPI } from './music-api.js';

export class MusicManager {
  constructor(db) {
    this.db = db;
    this.cache = new CacheManager();
    this.aiProcessor = new AIProcessor();
    this.musicAPI = new MusicAPI();
    this.bookAnalysis = null;
    this.chapterMappings = {};
    this.availableTracks = [];
    this.eventHandlers = {}; // Event emitter
    this.currentBookId = null;
    this.chapters = [];
  }

  async initialize(bookId, chapters) {
    try {
      // Check if music is enabled
      const settings = JSON.parse(localStorage.getItem('booksWithMusic-settings') || '{}');
      const musicEnabled = settings.musicEnabled !== false; // Default true for backward compatibility
      
      if (!musicEnabled) {
        console.log('🔇 Music disabled by user - skipping initialization');
        this.availableTracks = [];
        this.chapterMappings = {};
        return;
      }
      
      this.currentBookId = bookId;
      this.chapters = chapters;
      
      // Load available tracks from API
      await this.loadTracksFromAPI();
      
      // Check and report caching status
      await this.verifyCaching();
      
      // Analyze book with AI to determine chapter-specific music
      this.bookAnalysis = await this.aiProcessor.analyzeBook({ id: bookId, title: 'Current Book', chapters });
      
      // Generate mappings using available tracks
      const mappings = this.aiProcessor.generateChapterMappings(
        { id: bookId, title: 'Current Book', chapters },
        this.bookAnalysis.chapterAnalyses,
        this.availableTracks
      );
      
      // Store mappings for quick lookup
      mappings.forEach(mapping => {
        this.chapterMappings[mapping.chapterId] = mapping;
      });
      
    } catch (error) {
      console.error('❌ Error initializing music manager:', error);
      console.error('Stack trace:', error.stack);
      // Continue with empty track list - app should still work without music
      this.availableTracks = [];
      this.bookAnalysis = null;
    }
  }

  onChapterChange(chapterIndex) {
    // Check if music manager is fully initialized
    if (!this.bookAnalysis || !this.chapters || !this.chapters[chapterIndex]) {
      return;
    }
    
    const chapter = this.chapters[chapterIndex];
    const analysis = this.bookAnalysis.chapterAnalyses?.[chapterIndex];
    const mapping = this.chapterMappings[chapter.id || chapter.title];
    
    if (analysis && mapping) {
      // Emit event that music panel can listen to
      this.emit('chapterMusicChanged', {
        chapterIndex,
        analysis,
        recommendedTracks: mapping.tracks || []
      });
    }
  }

  async getTracksForChapter(book, chapter) {
    const mappings = await this.db.getMappingsByBook(book.id);
    const chapterMapping = mappings.find(m => m.chapterId === chapter.id);

    if (chapterMapping?.trackIds) {
      const tracks = await Promise.all(
        chapterMapping.trackIds.map(id => this.db.getTrack(id))
      );
      return tracks.filter(t => t !== undefined);
    }

    return this._selectDefaultTracks(3);
  }

  _selectDefaultTracks(count) {
    const shuffled = [...this.defaultTracks].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  async cacheTrack(track) {
    try {
      const response = await fetch(track.url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const blob = await response.blob();
      await this.cache.cacheTrack(track.id, blob);
      track.cached = true;
      await this.db.addTrack(track);
    } catch (error) {
      console.error(`❌ Failed to cache track ${track.title}:`, error);
      track.cached = false;
    }
  }

  async verifyCaching() {
    let cachedCount = 0;
    let totalTracks = this.availableTracks.length;
    
    for (const track of this.availableTracks) {
      const isCached = await this.cache.isTrackCached(track.id);
      if (isCached) {
        cachedCount++;
        track.cached = true;
      } else {
        track.cached = false;
      }
    }
    
    // Emit caching status for UI updates
    this.emit('cachingStatusUpdated', { 
      cachedCount, 
      totalTracks,
      percentage: Math.round(cachedCount/totalTracks*100)
    });
  }
  
  /**
   * Get current cache statistics
   */
  async getCacheStats() {
    let cachedCount = 0;
    for (const track of this.availableTracks) {
      const isCached = await this.cache.isTrackCached(track.id);
      if (isCached) cachedCount++;
    }
    return {
      cachedCount,
      totalTracks: this.availableTracks.length,
      percentage: this.availableTracks.length > 0 
        ? Math.round((cachedCount / this.availableTracks.length) * 100)
        : 0
    };
  }
  
  /**
   * Pre-cache tracks for a specific chapter
   */
  async preCacheChapterTracks(chapterIndex) {
    const chapter = this.chapters[chapterIndex];
    if (!chapter) return;
    
    const mapping = this.chapterMappings[chapter.id || chapter.title];
    if (!mapping || !mapping.tracks) return;
    
    console.log(`📥 Pre-caching ${mapping.tracks.length} tracks for chapter ${chapterIndex + 1}...`);
    let cached = 0;
    
    for (const trackMapping of mapping.tracks) {
      const track = this.availableTracks.find(t => t.id === trackMapping.trackId);
      if (track && !track.cached) {
        await this.cacheTrack(track);
        cached++;
      }
    }

    await this.verifyCaching(); // Update status
  }
  
  async getAllAvailableTracks() {
    if (this.availableTracks.length === 0) {
      await this.loadTracksFromAPI();
    }
    return this.availableTracks;
  }
  
  async loadTracksFromAPI() {
    try {
      // Check cache first
      const cachedTracks = await this._loadFromCache();
      if (cachedTracks && cachedTracks.length > 0) {
        return cachedTracks;
      }

      // Check if Freesound API key is configured
      const freesoundKey = localStorage.getItem('freesound_api_key');
      
      // No API key - use demo tracks
      if (!freesoundKey) {
        console.log('⚠️ No API key - using demo tracks');
        return this.getDemoTracks();
      }
      
      // Expanded query categories: moods, genres, styles, and reading contexts
      // Cast a wider net for more variety while maintaining quality through filters
      const queryCategories = [
        // MOODS
        ['calm', 'piano', 'ambient'],              // Calm piano/ambient
        ['epic', 'orchestral', 'cinematic'],       // Epic orchestral
        ['romantic', 'gentle', 'strings'],         // Romantic strings
        ['mysterious', 'ambient', 'ethereal'],     // Mysterious ethereal
        ['adventure', 'uplifting', 'journey'],     // Adventure journey
        ['dark', 'atmospheric', 'suspense'],       // Dark suspense
        ['tense', 'dramatic', 'intense'],          // Tense dramatic
        ['joyful', 'cheerful', 'bright'],          // Joyful bright
        ['peaceful', 'serene', 'tranquil'],        // Peaceful serene
        ['magical', 'fantasy', 'enchanting'],      // Magical fantasy
        ['sad', 'melancholy', 'emotional'],        // Sad melancholy
        ['hopeful', 'inspiring', 'uplifting'],     // Hopeful inspiring
        
        // GENRES & STYLES
        ['classical', 'piano', 'baroque'],         // Classical piano
        ['orchestral', 'symphony', 'strings'],     // Orchestral symphony
        ['ambient', 'atmospheric', 'soundscape'],  // Ambient soundscape
        ['acoustic', 'guitar', 'folk'],            // Acoustic folk
        ['electronic', 'ambient', 'chillout'],     // Electronic ambient
        ['jazz', 'smooth', 'mellow'],              // Jazz smooth
        ['folk', 'acoustic', 'storytelling'],      // Folk storytelling
        ['world', 'ethnic', 'cultural'],           // World music
        
        // READING CONTEXTS
        ['study', 'focus', 'concentration'],       // Study focus
        ['reading', 'background', 'subtle'],       // Reading background
        ['meditation', 'zen', 'mindful'],          // Meditation zen
        ['nature', 'forest', 'rain'],              // Nature sounds
        ['night', 'evening', 'twilight'],          // Night evening
        ['morning', 'dawn', 'sunrise'],            // Morning dawn
        
        // CINEMATIC & PRODUCTION
        ['cinematic', 'trailer', 'epic'],          // Cinematic trailer
        ['soundtrack', 'film', 'score'],           // Film soundtrack
        ['game', 'video-game', 'rpg'],             // Game RPG
        ['documentary', 'underscore', 'neutral']   // Documentary underscore
      ];
      
      // Load all music in parallel
      const trackPromises = queryCategories.map(queryTerms => 
        this.musicAPI.searchByQuery(queryTerms, 15)
          .catch(error => {
            console.error(`❌ Failed to load tracks for [${queryTerms.join(', ')}]:`, error);
            return [];
          })
      );
      
      const results = await Promise.allSettled(trackPromises);
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.length > 0) {
          this.availableTracks.push(...result.value);
        }
      });
      
      if (this.availableTracks.length === 0) {
        console.warn('⚠️ No tracks loaded from API');
      } else {
        // Remove duplicates
        const seen = new Set();
        this.availableTracks = this.availableTracks.filter(track => {
          if (seen.has(track.id)) return false;
          seen.add(track.id);
          return true;
        });
        
        // Apply energy level filter to all tracks
        const settings = JSON.parse(localStorage.getItem('booksWithMusic-settings') || '{}');
        const maxEnergyLevel = settings.maxEnergyLevel || 5;
        
        if (maxEnergyLevel < 5) {
          this.availableTracks = this.availableTracks.filter(track => track.energy <= maxEnergyLevel);
        }
        
        // Cache tracks for future use
        await this._saveToCache(this.availableTracks);
      }
    } catch (error) {
      console.error('Error loading tracks:', error);
      this.availableTracks = [];
    }
  }

  async _loadFromCache() {
    try {
      const cached = localStorage.getItem('music_tracks_cache');
      if (cached) {
        const data = JSON.parse(cached);
        // Cache expires after 24 hours
        if (Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
          return data.tracks;
        }
      }
    } catch (error) {
      console.warn('Error loading tracks from cache:', error);
    }
    return null;
  }

  async _saveToCache(tracks) {
    try {
      const cacheData = {
        tracks: tracks,
        timestamp: Date.now()
      };
      localStorage.setItem('music_tracks_cache', JSON.stringify(cacheData));
      console.log('✓ Tracks cached to localStorage');
    } catch (error) {
      console.warn('Error saving tracks to cache:', error);
    }
  }

  getChapterAnalysis(chapterIndex) {
    return this.bookAnalysis?.chapterAnalyses[chapterIndex];
  }

  getBookProfile() {
    return this.bookAnalysis?.bookProfile;
  }

  // Event emitter
  on(event, handler) {
    if (!this.eventHandlers) this.eventHandlers = {};
    if (!this.eventHandlers[event]) this.eventHandlers[event] = [];
    if (typeof handler === 'function') {
      this.eventHandlers[event].push(handler);
    }
  }

  emit(event, data) {
    if (this.eventHandlers?.[event]) {
      this.eventHandlers[event].forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }
}
