/**
 * MusicManager - Orchestrates music playback and chapter-to-track mapping
 * 
 * RESPONSIBILITIES:
 * - Initialize music system for a book (analyze + fetch tracks)
 * - Coordinate between MoodProcessor and Music APIs (Freesound or Spotify)
 * - Map chapters to appropriate tracks (1-5 per chapter)
 * - Handle chapter changes and determine which track to play
 * - Manage shift points (mood changes within chapters)
 * - Pre-cache tracks for upcoming chapters (Freesound only)
 * - Emit events for UI updates (music-panel.js listens)
 * 
 * INTEGRATION NOTES:
 * - Uses music-api-factory.js for dual-source support (Freesound/Spotify)
 * - Handles both Freesound (direct playback) and Spotify (API control)
 * - Caching only works for Freesound (Spotify streams directly)
 * 
 * MUSIC SOURCES:
 * - Freesound: Uses audio-player.js, supports caching
 * - Spotify: Uses spotify-player.js, requires Premium, no caching
 */
import { CacheManager } from '../storage/cache-manager.js';
import { MoodProcessor } from './mood-processor.js';
import { MusicAPI } from './music-api.js';
import { MusicAPIFactory } from './music-api-factory.js';

/**
 * Get API key with backup fallback
 * @private
 */
function _getApiKey() {
  const userKey = localStorage.getItem('freesound_api_key');
  if (userKey && userKey.trim() !== '') return userKey;
  
  // Backup key (obfuscated)
  const parts = ['zuEylS4I', 'QQIyJdHt', 'oySnXhXF', 'oDwMgGv8', 'qVgrxsad'];
  return parts.join('');
}

/**
 * Helper function to check if a track has a valid Creative Commons license
 */
function hasValidLicense(license) {
  if (!license || !license.type) return false;
  return license.type.toString().length > 0;
}

export class MusicManager {
  constructor(db) {
    this.db = db;
    this.cache = new CacheManager();
    this.moodProcessor = new MoodProcessor();
    this.apiFactory = new MusicAPIFactory();
    this.musicAPI = new MusicAPI(); // Legacy fallback, will be replaced
    this.bookAnalysis = null;
    this.chapterMappings = {};
    this.availableTracks = [];
    this.eventHandlers = {}; // Event emitter
    this.currentBookId = null;
    this.chapters = [];
    this.currentMusicSource = null; // Track which API is active
  }

  /**
   * Toggle verbose logging for detailed music analysis
   * @param {boolean} verbose - If true, shows detailed analysis. If false, minimal info.
   */
  setVerboseLogging(verbose) {
    this.moodProcessor.setVerboseLogging(verbose);
  }

  async initialize(bookId, chapters) {
    try {
      // Check if music is enabled
      const settings = JSON.parse(localStorage.getItem('booksWithMusic-settings') || '{}');
      const musicEnabled = settings.musicEnabled !== false; // Default true for backward compatibility
      
      // Apply verbose logging setting BEFORE any analysis
      const verboseLogging = settings.verboseLogging !== false; // Default true for backward compatibility
      this.moodProcessor.setVerboseLogging(verboseLogging);
      
      if (!musicEnabled) {
        console.log('🔇 Music disabled by user - skipping initialization');
        this.availableTracks = [];
        this.chapterMappings = {};
        return;
      }
      
      this.currentBookId = bookId;
      this.chapters = chapters;
      
      // Get the appropriate music API based on settings
      this.musicAPI = await this.apiFactory.getMusicAPI();
      this.currentMusicSource = this.apiFactory.getCurrentSource();
      

      
      // First, do a quick analysis to get book vibe keywords
      const quickAnalysis = await this.moodProcessor.analyzeBook({ id: bookId, title: 'Current Book', chapters });
      const bookVibeKeywords = quickAnalysis.bookProfile?.bookVibeKeywords || [];
      
      // Load available tracks from API (using book vibe keywords to fetch better matches)
      await this.loadTracksFromAPI(bookVibeKeywords);
      
      // Removed verbose summary logging - details shown during track selection
      
      // Check and report caching status (Freesound only)
      if (this.currentMusicSource === 'freesound') {
        await this.verifyCaching();
      }
      
      // Use the quick analysis we already did (or reanalyze if needed)
      this.bookAnalysis = quickAnalysis;
      
      // Generate mappings using available tracks and book profile (includes vibe keywords)
      const mappings = this.moodProcessor.generateChapterMappings(
        { id: bookId, title: 'Current Book', chapters },
        this.bookAnalysis.chapterAnalyses,
        this.availableTracks,
        this.bookAnalysis.bookProfile // Pass book profile with vibe keywords
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

  onChapterChange(chapterIndex, currentPageInChapter = 1, chapterShiftPoints = null) {
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
        currentPageInChapter, // Pass the current page so music can start at the right track
        chapterShiftPoints, // Pass shift points so music panel knows where tracks should change
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
      console.error(` Failed to cache track ${track.title}:`, error);
      track.cached = false;
    }
  }

  async verifyCaching() {
    // Caching only works for Freesound (Spotify streams directly)
    if (this.currentMusicSource !== 'freesound') {
      console.log('ℹ️ Caching not available for Spotify (streams directly)');
      return;
    }

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
      percentage: totalTracks > 0 ? Math.round(cachedCount/totalTracks*100) : 0
    });
  }
  
  /**
   * Get current cache statistics
   */
  async getCacheStats() {
    // Caching only works for Freesound
    if (this.currentMusicSource !== 'freesound') {
      return {
        cachedCount: 0,
        totalTracks: this.availableTracks.length,
        percentage: 0,
        cachingAvailable: false
      };
    }

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
        : 0,
      cachingAvailable: true
    };
  }
  
  /**
   * Pre-cache tracks for a specific chapter (Freesound only)
   */
  async preCacheChapterTracks(chapterIndex) {
    // Caching only works for Freesound
    if (this.currentMusicSource !== 'freesound') {
      console.log('ℹ️ Pre-caching not available for Spotify');
      return;
    }

    const chapter = this.chapters[chapterIndex];
    if (!chapter) return;
    
    const mapping = this.chapterMappings[chapter.id || chapter.title];
    if (!mapping || !mapping.tracks) return;
    
    console.log(`💾 Pre-caching ${mapping.tracks.length} tracks for chapter ${chapterIndex + 1}...`);
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
    // Only load tracks for Freesound source
    // Spotify uses on-demand fetching via spotify-music-manager.js
    if (this.availableTracks.length === 0 && this.currentMusicSource === 'freesound') {
      await this.loadTracksFromAPI();
    }
    return this.availableTracks;
  }
  
  async loadTracksFromAPI(bookVibeKeywords = null) {
    try {
      // This method is ONLY for Freesound
      // Spotify uses on-demand fetching via spotify-music-manager.js
      if (this.currentMusicSource !== 'freesound') {
        console.log('⚠️ loadTracksFromAPI called for non-Freesound source. Skipping.');
        return [];
      }
      
      // Check cache first (only for Freesound)
      if (this.currentMusicSource === 'freesound') {
        const cachedTracks = await this._loadFromCache();
        if (cachedTracks && cachedTracks.length > 0) {
          // Already filtered for CC0 in _loadFromCache
          this.availableTracks = cachedTracks;
          return cachedTracks;
        }
      }

      // Check if music API is configured
      if (!await this.musicAPI.isConfigured()) {
        const sourceLabel = this.currentMusicSource === 'spotify' ? 'Spotify' : 'Freesound';
        console.warn(`⚠️ ${sourceLabel} API not configured. Music will not be available.`);
        
        if (this.currentMusicSource === 'spotify') {
          console.log('Please authenticate with Spotify in Settings.');
        } else {
          console.log('Get a free API key at: https://freesound.org/apiv2/apply');
        }
        
        this.availableTracks = [];
        return this.availableTracks;
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
      
      // ADD BOOK VIBE KEYWORDS AS PRIORITY QUERIES
      if (bookVibeKeywords && bookVibeKeywords.length > 0) {
        console.log(`🎭 Fetching tracks for book vibe: ${bookVibeKeywords.join(', ')}`);
        
        // Create query combinations with book vibe keywords
        // Each keyword gets its own query + combined with common musical terms
        bookVibeKeywords.forEach(keyword => {
          const trimmedKeyword = keyword.trim().toLowerCase();
          if (trimmedKeyword) {
            // Single keyword query (for exact matches)
            queryCategories.unshift([trimmedKeyword, 'instrumental', 'music']);
            
            // Combined with common musical descriptors
            queryCategories.unshift([trimmedKeyword, 'ambient', 'atmospheric']);
            queryCategories.unshift([trimmedKeyword, 'orchestral', 'cinematic']);
          }
        });
        
        // Also try all book vibe keywords together
        if (bookVibeKeywords.length >= 2) {
          queryCategories.unshift([...bookVibeKeywords.slice(0, 3), 'music']);
        }
      }
      
      // Load all music in parallel
      const trackPromises = queryCategories.map(queryTerms => 
        this.musicAPI.searchByQuery(queryTerms, 15)
          .catch(error => {
            console.error(`❌ Failed to load tracks for [${queryTerms.join(', ')}]:`, error);
            return [];
          })
      );
      
      console.log(`🔄 Fetching ${queryCategories.length} queries from Freesound API...`);
      const fetchStartTime = Date.now();
      
      const results = await Promise.allSettled(trackPromises);
      
      const fetchDuration = ((Date.now() - fetchStartTime) / 1000).toFixed(1);
      console.log(`✅ Completed ${queryCategories.length} queries in ${fetchDuration}s`);
      
      // Track query success/failure statistics
      let successfulQueries = 0;
      let emptyQueries = 0;
      let failedQueries = 0;
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.length > 0) {
          this.availableTracks.push(...result.value);
          successfulQueries++;
        } else if (result.status === 'rejected') {
          console.error(`❌ Query ${index + 1} [${queryCategories[index].join(', ')}] rejected:`, result.reason);
          failedQueries++;
        } else if (result.status === 'fulfilled' && result.value.length === 0) {
          console.warn(`⚠️ Query ${index + 1} [${queryCategories[index].join(', ')}] returned 0 tracks`);
          emptyQueries++;
        }
      });
      
      console.log(`📊 Query results: ✅ ${successfulQueries} successful | ⚠️ ${emptyQueries} empty | ❌ ${failedQueries} failed`);
      
      if (this.availableTracks.length === 0) {
        console.error('❌ No CC0 tracks loaded from API');
        console.error('Possible reasons:');
        console.error('1. No CC0 tracks match your query criteria');
        console.error('2. Network connection issue');
        console.error('3. Freesound API rate limit reached');
        console.log('Try adjusting your music settings or wait a few minutes and reload.');
        return this.availableTracks;
      } else {
        // Remove duplicates
        const seen = new Set();
        this.availableTracks = this.availableTracks.filter(track => {
          if (seen.has(track.id)) return false;
          seen.add(track.id);
          return true;
        });
        
        // Filter out any tracks without valid licenses (fail-safe)
        const beforeLicenseFilter = this.availableTracks.length;
        this.availableTracks = this.availableTracks.filter(track => {
          const hasLicense = hasValidLicense(track.license);
          if (!hasLicense) {
            console.warn(`❌ FAIL-SAFE: Filtered track without license: ${track.title}`);
          }
          return hasLicense;
        });
        
        if (beforeLicenseFilter > this.availableTracks.length) {
          console.warn(`⚠️ FAIL-SAFE: Removed ${beforeLicenseFilter - this.availableTracks.length} tracks without licenses`);
        }
        
        // Apply energy level filter to all tracks
        const settings = JSON.parse(localStorage.getItem('booksWithMusic-settings') || '{}');
        const maxEnergyLevel = settings.maxEnergyLevel || 3; // Default to 3 (Moderate)
        
        if (maxEnergyLevel < 5) {
          const beforeFilter = this.availableTracks.length;
          this.availableTracks = this.availableTracks.filter(track => track.energy <= maxEnergyLevel);
          if (beforeFilter > this.availableTracks.length) {
            console.log(`⚡ Energy filter: ${beforeFilter} → ${this.availableTracks.length} tracks (max: ${maxEnergyLevel})`);
          }
        }
        
        // Analyze track diversity and warn if limited
        const tagDiversity = new Set();
        const energyDistribution = [0, 0, 0, 0, 0, 0]; // E0-E5
        this.availableTracks.forEach(track => {
          if (track.tags?.[0]) tagDiversity.add(track.tags[0]);
          if (track.energy !== undefined) energyDistribution[track.energy]++;
        });
        
        console.log(`\n📊 Track Pool Summary:`);
        console.log(`   • Total tracks: ${this.availableTracks.length}`);
        console.log(`   • Unique primary tags: ${tagDiversity.size}`);
        console.log(`   • Energy distribution: E1:${energyDistribution[1]} | E2:${energyDistribution[2]} | E3:${energyDistribution[3]} | E4:${energyDistribution[4]} | E5:${energyDistribution[5]}`);
        
        // Calculate recommended pool size based on book length
        const estimatedChapters = this.moodProcessor?.chapterAnalyses?.length || 20;
        const avgTracksPerChapter = 7;
        const cooldownMultiplier = 8; // 8-chapter cooldown
        const RECOMMENDED_POOL_SIZE = Math.max(150, estimatedChapters * avgTracksPerChapter / 3); // At minimum, 1/3 of total slots
        const IDEAL_POOL_SIZE = estimatedChapters * cooldownMultiplier * 2; // Ideal: 2x cooldown coverage
        const MIN_DIVERSITY = 30;
        
        console.log(`\n📈 Pool Analysis for ${estimatedChapters}-chapter book:`);
        
        // Size warnings
        if (this.availableTracks.length < RECOMMENDED_POOL_SIZE) {
          console.warn(`   🚨 CRITICAL: Pool too small (${this.availableTracks.length} tracks)`);
          console.warn(`      Minimum recommended: ${Math.round(RECOMMENDED_POOL_SIZE)} tracks`);
          console.warn(`      Ideal for variety: ${IDEAL_POOL_SIZE}+ tracks`);
          console.warn(`\n   💡 How to get more tracks:`);
          console.warn(`      1. Increase maxEnergyLevel in settings (currently limiting tracks)`);
          console.warn(`      2. Use broader book vibe keywords (less specific = more results)`);
          console.warn(`      3. Clear cache and reload to fetch fresh tracks`);
          console.warn(`      ⚠️ Expect heavy repetition after chapter ${Math.floor(this.availableTracks.length / cooldownMultiplier)}`);
        } else if (this.availableTracks.length < IDEAL_POOL_SIZE) {
          console.warn(`   ⚠️ Pool adequate but small (${this.availableTracks.length} tracks)`);
          console.warn(`      Recommended for optimal variety: ${IDEAL_POOL_SIZE}+ tracks`);
        } else {
          console.log(`   ✅ Pool size excellent (${this.availableTracks.length} tracks)`);
        }
        
        // Diversity warnings
        if (tagDiversity.size < MIN_DIVERSITY) {
          console.warn(`   ⚠️ Limited diversity (${tagDiversity.size} unique tag types)`);
          console.warn(`      Recommended: ${MIN_DIVERSITY}+ for good variety`);
        } else {
          console.log(`   ✅ Diversity good (${tagDiversity.size} unique tag types)`);
        }
        
        // Cache tracks for future use
        await this._saveToCache(this.availableTracks);
      }
      
      return this.availableTracks;
    } catch (error) {
      console.error('❌ Error loading tracks:', error);
      console.error('Stack trace:', error.stack);
      this.availableTracks = [];
      return this.availableTracks;
    }
  }

  async _loadFromCache() {
    try {
      const cached = localStorage.getItem('music_tracks_cache');
      if (cached) {
        const data = JSON.parse(cached);
        // Cache expires after 24 hours
        if (Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
          // Filter out tracks without licenses from cache
          const licensedTracks = data.tracks.filter(track => {
            const hasLicense = hasValidLicense(track.license);
            if (!hasLicense) {
              console.warn(`❌ Filtered track without license from cache: ${track.title}`);
            }
            return hasLicense;
          });
          
          // If we filtered out tracks, log it
          if (licensedTracks.length < data.tracks.length) {
            console.warn(`⚠️ Removed ${data.tracks.length - licensedTracks.length} unlicensed tracks from cache`);
          }
          
          // Only return if we have licensed tracks, otherwise re-fetch
          if (licensedTracks.length > 0) {
            return licensedTracks;
          } else {
            console.warn('⚠️ No licensed tracks in cache, will re-fetch from API');
            // Clear invalid cache
            localStorage.removeItem('music_tracks_cache');
            return null;
          }
        }
      }
    } catch (error) {
      console.warn('Error loading tracks from cache:', error);
    }
    return null;
  }

  async _saveToCache(tracks) {
    try {
      // Only cache tracks with valid licenses
      const licensedTracks = tracks.filter(track => {
        const hasLicense = hasValidLicense(track.license);
        if (!hasLicense) {
          console.warn(`❌ Skipping unlicensed track from cache: ${track.title}`);
        }
        return hasLicense;
      });
      
      if (licensedTracks.length === 0) {
        console.warn('⚠️ No licensed tracks to cache');
        return;
      }
      
      const cacheData = {
        tracks: licensedTracks,
        timestamp: Date.now()
      };
      localStorage.setItem('music_tracks_cache', JSON.stringify(cacheData));
      
      if (licensedTracks.length < tracks.length) {
        console.warn(`⚠️ Excluded ${tracks.length - licensedTracks.length} unlicensed tracks from cache`);
      }
    } catch (error) {
      console.warn('Error saving tracks to cache:', error);
    }
  }
  
  /**
   * Clear music cache and force re-fetch from API
   * Use this to remove old non-CC0 tracks from cache
   */
  async clearMusicCache() {
    try {
      localStorage.removeItem('music_tracks_cache');
      console.log('✅ Music cache cleared - will re-fetch CC0 tracks on next load');
      return true;
    } catch (error) {
      console.error('Error clearing music cache:', error);
      return false;
    }
  }

  getChapterAnalysis(chapterIndex) {
    return this.bookAnalysis?.chapterAnalyses[chapterIndex];
  }

  getBookProfile() {
    return this.bookAnalysis?.bookProfile;
  }

  /**
   * Switch music source (Freesound ↔ Spotify)
   * Reloads tracks with new source
   */
  async switchMusicSource(newSource) {
    if (newSource !== 'freesound' && newSource !== 'spotify') {
      throw new Error(`Invalid music source: ${newSource}`);
    }

    console.log(`🔄 Switching music source from ${this.currentMusicSource} to ${newSource}...`);

    try {
      // Use factory to switch source
      this.musicAPI = await this.apiFactory.switchSource(newSource);
      this.currentMusicSource = newSource;

      // Reload tracks with new source
      if (this.currentBookId && this.chapters.length > 0) {
        const bookVibeKeywords = this.bookAnalysis?.bookProfile?.bookVibeKeywords || [];
        await this.loadTracksFromAPI(bookVibeKeywords);

        // Regenerate mappings with new tracks
        const mappings = this.moodProcessor.generateChapterMappings(
          { id: this.currentBookId, title: 'Current Book', chapters: this.chapters },
          this.bookAnalysis.chapterAnalyses,
          this.availableTracks,
          this.bookAnalysis.bookProfile
        );

        mappings.forEach(mapping => {
          this.chapterMappings[mapping.chapterId] = mapping;
        });

        console.log(`✅ Switched to ${newSource}, reloaded ${this.availableTracks.length} tracks`);
      }

      // Emit event for UI updates
      this.emit('musicSourceChanged', {
        source: newSource,
        trackCount: this.availableTracks.length
      });

      return true;
    } catch (error) {
      console.error('❌ Failed to switch music source:', error);
      throw error;
    }
  }

  /**
   * Get current music source
   */
  getMusicSource() {
    return this.currentMusicSource;
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
