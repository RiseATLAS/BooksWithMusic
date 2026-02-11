/**
 * SpotifyMusicManager - Spotify-specific music management
 * 
 * RESPONSIBILITIES:
 * - Initialize Spotify player and manage track selection
 * - Use Spotify's recommendation API instead of search-based approach
 * - Handle chapter-to-track mapping for Spotify content
 * - Manage playback through Spotify SDK player
 * 
 * DIFFERENCES FROM FREESOUND:
 * - No pre-loading track library (uses dynamic search/recommendations)
 * - No caching (Spotify streams directly)
 * - Uses audio features (energy, valence, tempo) for matching
 * - Relies on Spotify's recommendation engine
 * 
 * INTEGRATION:
 * - Used by music-manager.js when music source is 'spotify'
 * - Coordinates with spotify-sdk-player.js for playback
 * - Uses same MoodProcessor for chapter analysis
 */

import { MoodProcessor } from './mood-processor.js';
import { SpotifyAPI } from './spotify-api.js';

export class SpotifyMusicManager {
  constructor() {
    this.moodProcessor = new MoodProcessor();
    this.spotifyAPI = new SpotifyAPI();
    this.bookAnalysis = null;
    this.chapterMappings = {};
    this.currentBookId = null;
    this.chapters = [];
    this.eventHandlers = {};
  }

  /**
   * Initialize Spotify music for a book
   * @param {string} bookId - Book identifier
   * @param {Array} chapters - Book chapters
   */
  async initialize(bookId, chapters) {
    try {
      const settings = JSON.parse(localStorage.getItem('booksWithMusic-settings') || '{}');
      const musicEnabled = settings.musicEnabled !== false;
      
      if (!musicEnabled) {
        console.log('🔇 Music disabled by user - skipping Spotify initialization');
        return;
      }
      
      const verboseLogging = settings.verboseLogging !== false;
      this.moodProcessor.setVerboseLogging(verboseLogging);
      
      this.currentBookId = bookId;
      this.chapters = chapters;
      
      // Check Spotify authentication
      if (!await this.spotifyAPI.isConfigured()) {
        console.error('❌ Spotify not configured. Please log in to Spotify.');
        return;
      }
      
      console.log('🎵 Initializing Spotify music manager...');
      
      // Analyze book for mood/vibe
      this.bookAnalysis = await this.moodProcessor.analyzeBook({ 
        id: bookId, 
        title: 'Current Book', 
        chapters 
      });
      
      // Generate chapter mappings (tracks will be fetched on-demand per chapter)
      this.generateChapterMappings();
      
      console.log('✅ Spotify music manager initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize Spotify music manager:', error);
    }
  }

  /**
   * Generate chapter-to-track mappings using Spotify recommendations
   */
  generateChapterMappings() {
    if (!this.bookAnalysis || !this.bookAnalysis.chapterAnalyses) {
      console.error('❌ No book analysis available for mapping');
      return;
    }

    // Create mappings but don't fetch tracks yet
    // Tracks will be fetched when chapter changes
    this.bookAnalysis.chapterAnalyses.forEach((analysis, index) => {
      const chapterIndex = index + 1;
      
      this.chapterMappings[chapterIndex] = {
        chapterIndex,
        mood: analysis.primaryMood || 'peaceful',
        energy: analysis.energy || 3,
        keywords: analysis.keywords || [],
        tracks: [], // Will be populated on-demand
        tracksFetched: false
      };
    });

    console.log(`📖 Created Spotify mappings for ${Object.keys(this.chapterMappings).length} chapters`);
  }

  /**
   * Get tracks for a specific chapter (fetch on-demand)
   * @param {number} chapterIndex - Chapter number (1-indexed)
   * @returns {Promise<Array>} Array of Spotify track objects
   */
  async getTracksForChapter(chapterIndex) {
    const mapping = this.chapterMappings[chapterIndex];
    
    if (!mapping) {
      console.warn(`⚠️ No mapping found for chapter ${chapterIndex}`);
      return [];
    }

    // Return cached tracks if already fetched
    if (mapping.tracksFetched && mapping.tracks.length > 0) {
      return mapping.tracks;
    }

    try {
      console.log(`🎵 Fetching Spotify tracks for chapter ${chapterIndex}...`);
      
      // Use Spotify's recommendation API with chapter mood/energy
      const tracks = await this.spotifyAPI.searchByMood(
        mapping.mood,
        mapping.energy,
        mapping.keywords,
        5 // Get 5 tracks per chapter
      );

      mapping.tracks = tracks;
      mapping.tracksFetched = true;

      console.log(`✅ Loaded ${tracks.length} Spotify tracks for chapter ${chapterIndex}`);
      
      return tracks;
    } catch (error) {
      console.error(`❌ Failed to fetch Spotify tracks for chapter ${chapterIndex}:`, error);
      return [];
    }
  }

  /**
   * Get the current chapter's track to play
   * @param {number} chapterIndex - Chapter number
   * @param {number} pageInChapter - Current page within chapter
   * @returns {Promise<Object|null>} Spotify track object or null
   */
  async getCurrentTrack(chapterIndex, pageInChapter = 0) {
    const tracks = await this.getTracksForChapter(chapterIndex);
    
    if (!tracks || tracks.length === 0) {
      return null;
    }

    // Simple rotation: use page number to select track
    const trackIndex = pageInChapter % tracks.length;
    return tracks[trackIndex];
  }

  /**
   * Handle chapter change event
   * @param {number} chapterIndex - New chapter index
   */
  async onChapterChange(chapterIndex) {
    console.log(`📖 Chapter changed to ${chapterIndex} (Spotify)`);
    
    // Pre-fetch tracks for current and next chapter
    await this.getTracksForChapter(chapterIndex);
    
    if (this.chapterMappings[chapterIndex + 1]) {
      this.getTracksForChapter(chapterIndex + 1).catch(err => {
        console.warn('Failed to pre-fetch next chapter tracks:', err);
      });
    }

    // Emit event for UI
    this.emit('chapterChange', { 
      chapterIndex,
      mapping: this.chapterMappings[chapterIndex]
    });
  }

  /**
   * Event emitter - register handler
   */
  on(event, handler) {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event].push(handler);
  }

  /**
   * Event emitter - emit event
   */
  emit(event, data) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach(handler => handler(data));
    }
  }

  /**
   * Get chapter analysis for a specific chapter
   * @param {number} chapterIndex - Chapter number
   * @returns {Object|null} Chapter analysis object
   */
  getChapterAnalysis(chapterIndex) {
    const mapping = this.chapterMappings[chapterIndex];
    if (!mapping) return null;
    
    return {
      mood: mapping.mood,
      energy: mapping.energy,
      keywords: mapping.keywords
    };
  }

  /**
   * Get mapping for a specific chapter
   * @param {number} chapterIndex - Chapter number
   * @returns {Object|null} Chapter mapping
   */
  getMappingForChapter(chapterIndex) {
    return this.chapterMappings[chapterIndex] || null;
  }

  /**
   * Set verbose logging
   */
  setVerboseLogging(verbose) {
    this.moodProcessor.setVerboseLogging(verbose);
  }
}
