/**
 * SpotifyMusicManager - Spotify-specific music management
 * 
 * RESPONSIBILITIES:
 * - Initialize Spotify player and manage tr    try {
      console.log(`🎵 Fetching Spotify tracks for chapter ${chapterIndex}...`);
      
      // Use Spotify's recommendation API with chapter mood/energy
      // Max 20 tracks per chapter (Spotify API safe limit)
      const tracks = await this.spotifyAPI.searchByMood(
        mapping.mood,
        mapping.energy,
        mapping.keywords,
        20 // Max 20 tracks per chapter (safe Spotify API limit)
      );on
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
    
    // Track current state to detect significant changes
    this.lastMood = null;
    this.lastEnergy = null;
    this.lastKeywords = [];
    this.currentTrackIndex = 0;
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
      // Reader uses 0-based chapter indexes; keep mapping aligned.
      const chapterIndex = index;
      
      // Generate shift points within the chapter
      const shiftPoints = this._generateShiftPoints(analysis);
      
      this.chapterMappings[chapterIndex] = {
        chapterIndex,
        mood: analysis.primaryMood || 'peaceful',
        energy: analysis.energy || 3,
        keywords: analysis.keywords || [],
        estimatedPages: analysis.estimatedPages || 1,
        shiftPoints: shiftPoints, // Mood shifts within chapter
        tracks: [], // Will be populated on-demand
        tracksFetched: false
      };
    });

    console.log(`📖 Created Spotify mappings for ${Object.keys(this.chapterMappings).length} chapters`);
  }

  /**
   * Generate shift points within a chapter based on mood changes
   * @private
   */
  _generateShiftPoints(chapterAnalysis) {
    const shiftPoints = [];
    
    // If chapter has mood shifts, create shift points
    if (chapterAnalysis.moodShifts && chapterAnalysis.moodShifts.length > 0) {
      let previousMood = chapterAnalysis.primaryMood || 'peaceful';
      
      chapterAnalysis.moodShifts.forEach((shift, index) => {
        shiftPoints.push({
          page: shift.page || 1,
          pageInChapter: shift.page || 1,
          fromMood: previousMood,
          toMood: shift.mood || chapterAnalysis.primaryMood,
          mood: shift.mood || chapterAnalysis.primaryMood,
          energy: shift.energy || chapterAnalysis.energy,
          keywords: shift.keywords || chapterAnalysis.keywords,
          description: shift.description || `Shift to ${shift.mood}`
        });
        previousMood = shift.mood || chapterAnalysis.primaryMood;
      });
    }
    
    // If no explicit shifts, create one shift point at the beginning
    if (shiftPoints.length === 0) {
      const primaryMood = chapterAnalysis.primaryMood || 'peaceful';
      shiftPoints.push({
        page: 1,
        pageInChapter: 1,
        fromMood: primaryMood,
        toMood: primaryMood,
        mood: primaryMood,
        energy: chapterAnalysis.energy || 3,
        keywords: chapterAnalysis.keywords || [],
        description: 'Chapter opening'
      });
    }
    
    return shiftPoints.sort((a, b) => a.pageInChapter - b.pageInChapter);
  }

  /**
   * Get tracks for a specific chapter (fetch on-demand)
   * @param {number} chapterIndex - Chapter index (0-indexed)
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
      const desiredTrackCount = this._getDesiredTrackCount(mapping);

      // Build one search profile per shift so early playlist tracks align with mood transitions.
      const shiftProfiles = this._buildShiftSearchProfiles(mapping);
      const perProfileLimit = Math.max(4, Math.ceil(desiredTrackCount / shiftProfiles.length));
      const searchedTracksByProfile = [];

      for (const profile of shiftProfiles) {
        const tracks = await this.spotifyAPI.searchByMood(
          profile.mood,
          profile.energy,
          profile.keywords,
          perProfileLimit
        );
        searchedTracksByProfile.push({ profile, tracks });
      }

      // Ensure each shift mood gets at least one "anchor" track at the front of the playlist.
      const orderedTracks = [];
      const usedTrackIds = new Set();
      const addTrack = (track, profile) => {
        if (!track?.id || usedTrackIds.has(track.id)) return;
        usedTrackIds.add(track.id);
        orderedTracks.push(this._withReasoningForProfile(track, profile, mapping));
      };

      for (const { profile, tracks } of searchedTracksByProfile) {
        if (tracks && tracks.length > 0) {
          addTrack(tracks[0], profile);
        }
      }

      for (const { profile, tracks } of searchedTracksByProfile) {
        for (const track of tracks || []) {
          addTrack(track, profile);
        }
      }

      // Fallback to chapter-level mood if shift-based queries return nothing.
      if (orderedTracks.length === 0) {
        const fallbackTracks = await this.spotifyAPI.searchByMood(
          mapping.mood,
          mapping.energy,
          mapping.keywords,
          Math.max(10, desiredTrackCount)
        );
        for (const track of fallbackTracks) {
          addTrack(track, {
            mood: mapping.mood,
            energy: mapping.energy,
            keywords: mapping.keywords,
            pageInChapter: 1
          });
        }
      }

      const tracksWithReasoning = orderedTracks.slice(0, desiredTrackCount);

      mapping.tracks = tracksWithReasoning;
      mapping.tracksFetched = true;

      console.log(`✅ Loaded ${tracksWithReasoning.length} Spotify tracks for chapter ${chapterIndex}`);
      
      return tracksWithReasoning;
    } catch (error) {
      console.error(`❌ Failed to fetch Spotify tracks for chapter ${chapterIndex}:`, error);
      return [];
    }
  }

  /**
   * Resolve desired tracks per chapter from UI settings.
   * Mirrors Freesound logic and enforces Spotify's practical max of 20.
   * @private
   */
  _getDesiredTrackCount(mapping) {
    const settings = JSON.parse(localStorage.getItem('booksWithMusic-settings') || '{}');
    const songsPerChapter = Math.max(1, Math.min(20, Math.floor(Number(settings.songsPerChapter) || 5)));
    const minSongsPerPages = Math.max(1, Math.min(10, Math.floor(Number(settings.minSongsPerPages) || 1)));
    const estimatedPages = Math.max(1, Math.floor(Number(mapping?.estimatedPages) || 1));
    const minTracksForPages = Math.ceil(estimatedPages / minSongsPerPages);
    return Math.min(20, Math.max(songsPerChapter, minTracksForPages));
  }

  /**
   * Create search profiles from chapter shift points.
   * Guarantees at least one profile.
   * @private
   */
  _buildShiftSearchProfiles(mapping) {
    const shiftPoints = (mapping?.shiftPoints || [])
      .slice()
      .sort((a, b) => (a.pageInChapter || 1) - (b.pageInChapter || 1));

    const profiles = [{
      key: `${String(mapping?.mood || 'peaceful').toLowerCase()}|${Math.round(mapping?.energy || 3)}|${(mapping?.keywords || []).slice(0, 3).join(',').toLowerCase()}`,
      mood: mapping?.mood || 'peaceful',
      energy: mapping?.energy || 3,
      keywords: mapping?.keywords || [],
      pageInChapter: 1
    }];

    for (const shift of shiftPoints) {
      const mood = shift?.mood || shift?.toMood || mapping.mood;
      const energy = shift?.energy || mapping.energy || 3;
      const keywords = Array.isArray(shift?.keywords)
        ? shift.keywords
        : (mapping.keywords || []);

      const key = `${String(mood).toLowerCase()}|${Math.round(energy)}|${keywords.slice(0, 3).join(',').toLowerCase()}`;
      if (profiles.some(profile => profile.key === key)) {
        continue;
      }

      profiles.push({
        key,
        mood,
        energy,
        keywords,
        pageInChapter: shift?.pageInChapter || shift?.page || 1
      });
    }

    return profiles;
  }

  /**
   * Apply reader-provided shift points to chapter mapping so Spotify targeting
   * uses the same page/mood transitions shown in the UI.
   * @private
   */
  _applyExternalShiftPoints(chapterIndex, chapterShiftPoints) {
    const mapping = this.chapterMappings[chapterIndex];
    if (!mapping) return;

    const rawShiftPoints = Array.isArray(chapterShiftPoints?.shiftPoints)
      ? chapterShiftPoints.shiftPoints
      : (Array.isArray(chapterShiftPoints) ? chapterShiftPoints : []);

    if (rawShiftPoints.length === 0) {
      return;
    }

    const sorted = rawShiftPoints
      .slice()
      .sort((a, b) => {
        const pageA = Number(a?.pageInChapter ?? a?.page ?? Number.MAX_SAFE_INTEGER);
        const pageB = Number(b?.pageInChapter ?? b?.page ?? Number.MAX_SAFE_INTEGER);
        return pageA - pageB;
      });

    const normalized = [];
    let previousMood = mapping.mood || 'peaceful';

    for (const shift of sorted) {
      const page = Number(shift?.pageInChapter ?? shift?.page ?? 1);
      if (!Number.isFinite(page) || page < 1) continue;

      const toMood = shift?.toMood || shift?.mood || previousMood;
      const fromMood = shift?.fromMood || previousMood;
      const keywords = Array.isArray(shift?.keywords)
        ? shift.keywords
        : [];

      normalized.push({
        ...shift,
        page,
        pageInChapter: page,
        fromMood,
        toMood,
        mood: toMood,
        energy: shift?.energy || mapping.energy || 3,
        keywords
      });

      previousMood = toMood;
    }

    if (normalized.length === 0) {
      return;
    }

    const signature = normalized
      .map((shift) => `${shift.pageInChapter}:${String(shift.mood).toLowerCase()}`)
      .join('|');

    if (mapping.shiftSignature !== signature) {
      mapping.shiftPoints = normalized;
      mapping.shiftSignature = signature;
      // Reader shift model changed; invalidate chapter track cache.
      mapping.tracks = [];
      mapping.tracksFetched = false;
    }
  }

  /**
   * Attach UI reasoning/context for a selected track.
   * @private
   */
  _withReasoningForProfile(track, profile, mapping) {
    const mood = profile?.mood || mapping?.mood || 'peaceful';
    const keywords = Array.isArray(profile?.keywords) && profile.keywords.length > 0
      ? profile.keywords
      : (mapping?.keywords || []);
    const pageText = profile?.pageInChapter > 1 ? ` from page ${profile.pageInChapter}` : '';
    const keywordText = keywords.length > 0 ? ` with ${keywords.slice(0, 2).join(', ')} themes` : '';

    return {
      ...track,
      targetMood: mood,
      targetEnergy: profile?.energy || mapping?.energy || 3,
      targetPage: profile?.pageInChapter || 1,
      reasoning: `Selected for ${mood} mood${pageText}${keywordText}`
    };
  }

  /**
   * Get the current chapter's track to play
   * Only switches tracks when mood/energy/keywords significantly change
   * @param {number} chapterIndex - Chapter number
   * @param {number} pageInChapter - Current page within chapter
   * @param {Object} currentMood - Current mood analysis (optional)
   * @returns {Promise<Object|null>} Spotify track object or null
   */
  async getCurrentTrack(chapterIndex, pageInChapter = 0, currentMood = null) {
    const tracks = await this.getTracksForChapter(chapterIndex);
    
    if (!tracks || tracks.length === 0) {
      return null;
    }

    // If no mood info provided, use chapter-level mapping
    const mapping = this.chapterMappings[chapterIndex];
    const mood = currentMood?.mood || mapping?.mood;
    const energy = currentMood?.energy || mapping?.energy;
    const keywords = currentMood?.keywords || mapping?.keywords || [];

    // Check if there's a significant change
    const shouldSwitchTrack = this._hasSignificantChange(mood, energy, keywords);

    if (shouldSwitchTrack) {
      // Significant change detected - advance to next track
      this.currentTrackIndex = (this.currentTrackIndex + 1) % tracks.length;
      console.log(`🔄 Mood/scenario changed - switching to track ${this.currentTrackIndex + 1}/${tracks.length}`);
    }

    // Update last known state
    this.lastMood = mood;
    this.lastEnergy = energy;
    this.lastKeywords = keywords;

    return tracks[this.currentTrackIndex];
  }

  /**
   * Pre-fetch next chapter's tracks (called when near end of current chapter)
   * @param {number} currentChapterIndex - Current chapter index
   */
  async preFetchNextChapter(currentChapterIndex) {
    const nextChapterIndex = currentChapterIndex + 1;
    
    if (!this.chapterMappings[nextChapterIndex]) {
      return; // No next chapter
    }
    
    const mapping = this.chapterMappings[nextChapterIndex];
    
    // Only pre-fetch if not already fetched
    if (mapping.tracksFetched && mapping.tracks.length > 0) {
      return; // Already have tracks
    }
    
    console.log(`⏩ Pre-fetching tracks for next chapter ${nextChapterIndex}...`);
    
    try {
      await this.getTracksForChapter(nextChapterIndex);
    } catch (error) {
      console.warn(`Failed to pre-fetch chapter ${nextChapterIndex}:`, error);
    }
  }

  /**
   * Check if there's a significant change in mood, energy, or keywords
   * @private
   */
  _hasSignificantChange(mood, energy, keywords) {
    // First track - no previous state to compare
    if (this.lastMood === null) {
      return false;
    }

    // Mood changed (e.g., peaceful → tense)
    if (mood !== this.lastMood) {
      console.log(`📊 Mood changed: ${this.lastMood} → ${mood}`);
      return true;
    }

    // Significant energy shift (2+ levels)
    if (Math.abs(energy - this.lastEnergy) >= 2) {
      console.log(`📊 Energy changed significantly: ${this.lastEnergy} → ${energy}`);
      return true;
    }

    // Scenario/location change (different keywords)
    const keywordChanged = keywords.some(kw => !this.lastKeywords.includes(kw)) ||
                          this.lastKeywords.some(kw => !keywords.includes(kw));
    
    if (keywordChanged && keywords.length > 0) {
      console.log(`📊 Scenario changed: [${this.lastKeywords.join(', ')}] → [${keywords.join(', ')}]`);
      return true;
    }

    // No significant change
    return false;
  }

  /**
   * Handle chapter change event
   * @param {number} chapterIndex - New chapter index
   */
  async onChapterChange(chapterIndex, currentPageInChapter = 1, chapterShiftPoints = null) {
    console.log(`📖 Chapter changed to ${chapterIndex} (Spotify)`);
    
    const mapping = this.chapterMappings[chapterIndex];
    if (!mapping) {
      console.warn(`⚠️ No mapping found for chapter ${chapterIndex}`);
      return;
    }

    // Prefer the reader's section-analysis shift points when available.
    this._applyExternalShiftPoints(chapterIndex, chapterShiftPoints);

    // Reset track state when chapter changes
    this.currentChapterIndex = chapterIndex;
    this.currentPageInChapter = Number(currentPageInChapter) || 1;
    this.currentTrackIndex = 0;
    this.lastMood = null;
    this.lastEnergy = null;
    this.lastKeywords = [];
    
    // Fetch tracks for current chapter only
    const tracks = await this.getTracksForChapter(chapterIndex);
    
    // Get current mood based on current page
    const currentShift = this._getCurrentShiftPoint(chapterIndex, this.currentPageInChapter);
    
    // Emit event for UI in the format music-panel expects
    this.emit('chapterMusicChanged', { 
      chapterIndex,
      currentPageInChapter: this.currentPageInChapter,
      chapterShiftPoints: chapterShiftPoints || { shiftPoints: mapping?.shiftPoints || [] },
      analysis: {
        mood: currentShift?.mood || mapping?.mood,
        energy: currentShift?.energy || mapping?.energy,
        keywords: currentShift?.keywords || mapping?.keywords || []
      },
      recommendedTracks: tracks.map((track, index) => ({
        trackId: track.id,
        score: 100 - (index * 10),
        reasoning: track.reasoning || `Spotify track ${index + 1} for ${currentShift?.mood || mapping?.mood} mood`
      }))
    });
  }

  /**
   * Handle page change within a chapter
   * @param {number} chapterIndex - Current chapter index
   * @param {number} pageInChapter - Current page within chapter
   */
  async onPageChange(chapterIndex, pageInChapter) {
    // Update current position
    this.currentChapterIndex = chapterIndex;
    this.currentPageInChapter = pageInChapter;
    
    // Check if we crossed a shift point
    const newShift = this._getCurrentShiftPoint(chapterIndex, pageInChapter);
    const mapping = this.chapterMappings[chapterIndex];
    
    if (!newShift || !mapping) return;
    
    // Check if mood/energy changed significantly
    const moodChanged = newShift.mood !== this.lastMood;
    const energyChanged = Math.abs((newShift.energy || 3) - (this.lastEnergy || 3)) >= 2;
    
    if (moodChanged || energyChanged) {
      console.log(`🎵 Mood shift detected at page ${pageInChapter}: ${this.lastMood || 'start'} → ${newShift.mood}`);
      
      // Fetch new tracks for the new mood if needed
      // For now, we'll just emit the shift event
      this.emit('moodShiftDetected', {
        chapterIndex,
        pageInChapter,
        oldMood: this.lastMood,
        newMood: newShift.mood,
        oldEnergy: this.lastEnergy,
        newEnergy: newShift.energy
      });
      
      this.lastMood = newShift.mood;
      this.lastEnergy = newShift.energy;
      this.lastKeywords = newShift.keywords || [];
    }
  }

  /**
   * Get the current shift point for a given page in a chapter
   * @private
   */
  _getCurrentShiftPoint(chapterIndex, pageInChapter) {
    const mapping = this.chapterMappings[chapterIndex];
    if (!mapping || !mapping.shiftPoints) return null;
    
    // Start with chapter opening mood and then apply shifts up to this page.
    let currentShift = {
      page: 1,
      pageInChapter: 1,
      fromMood: mapping.mood,
      toMood: mapping.mood,
      mood: mapping.mood,
      energy: mapping.energy,
      keywords: mapping.keywords || [],
      description: 'Chapter opening'
    };
    
    for (const shift of mapping.shiftPoints) {
      if (shift.pageInChapter <= pageInChapter) {
        currentShift = shift;
      } else {
        break;
      }
    }
    
    return currentShift;
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
      primaryMood: mapping.mood,
      mood: mapping.mood,
      energy: mapping.energy,
      keywords: mapping.keywords,
      estimatedPages: mapping.estimatedPages
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
