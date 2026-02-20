/**
 * SpotifyMusicManager - Spotify-specific music management
 *
 * RESPONSIBILITIES:
 * - Initialize Spotify API integration and chapter mappings
 * - Fetch chapter playlists via Last.fm metadata discovery + Spotify resolution
 * - Handle chapter-to-track mapping for Spotify content
 * - Manage playback through Spotify SDK player
 *
 * DIFFERENCES FROM FREESOUND:
 * - No pre-loading track library (uses dynamic Last.fm + Spotify discovery)
 * - No caching (Spotify streams directly)
 * - Uses mood/keyword targeting with low-vocal ranking
 *
 * INTEGRATION:
 * - Used by music-manager.js when music source is 'spotify'
 * - Coordinates with spotify-sdk-player.js for playback
 * - Uses same MoodProcessor for chapter analysis
 */

import { MoodProcessor } from './mood-processor.js';
import { SpotifyAPI } from './spotify-api.js';
import { LastFmAPI } from './lastfm-api.js';

export class SpotifyMusicManager {
  constructor() {
    this.moodProcessor = new MoodProcessor();
    this.spotifyAPI = new SpotifyAPI();
    this.lastFmAPI = new LastFmAPI();
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

    // Track-fetch retry policy (for rate limits / temporary API failures).
    this._trackRetryDelayMs = 30000;
    this._maxTrackRetryAttempts = 5;
    this._maxProfileQueriesPerChapter = 5;
    this._trackRetryStateByChapter = {};
    this._trackFetchPromises = {};
    this._chapterContextByIndex = {};
    this._latestChapterChangeRequestId = 0;
    this._hasLoggedMissingLastFmKey = false;
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

      if (!this.lastFmAPI.isConfigured()) {
        console.error('❌ Last.fm API key missing. Add key in Music Settings > Music API.');
      } else {
        this._hasLoggedMissingLastFmKey = false;
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
   * Generate chapter-to-track mappings using Spotify search profiles
   */
  generateChapterMappings() {
    if (!this.bookAnalysis || !this.bookAnalysis.chapterAnalyses) {
      console.error('❌ No book analysis available for mapping');
      return;
    }

    // Clear pending retry timers when switching/rebuilding mappings.
    Object.values(this._trackRetryStateByChapter).forEach((state) => {
      if (state?.timerId) {
        window.clearTimeout(state.timerId);
      }
    });
    this._trackRetryStateByChapter = {};
    this._trackFetchPromises = {};
    this._chapterContextByIndex = {};
    this._latestChapterChangeRequestId = 0;

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
        keywords: [
          ...(analysis.keywords || []),
          ...(analysis.musicTags || []),
          ...(analysis.recommendedGenres || []),
          analysis.primaryMood
        ]
          .map((keyword) => String(keyword || '').toLowerCase().trim())
          .filter(Boolean)
          .filter((keyword, idx, array) => array.indexOf(keyword) === idx)
          .slice(0, 16),
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

  _getTrackRetryState(chapterIndex) {
    if (!this._trackRetryStateByChapter[chapterIndex]) {
      this._trackRetryStateByChapter[chapterIndex] = {
        attempts: 0,
        timerId: null,
        nextRetryAt: 0
      };
    }
    return this._trackRetryStateByChapter[chapterIndex];
  }

  _clearTrackRetryState(chapterIndex) {
    const state = this._trackRetryStateByChapter[chapterIndex];
    if (!state) return;
    if (state.timerId) {
      window.clearTimeout(state.timerId);
    }
    this._trackRetryStateByChapter[chapterIndex] = {
      attempts: 0,
      timerId: null,
      nextRetryAt: 0
    };
  }

  _scheduleTrackRetry(chapterIndex, reason = 'fetch-failed', delayMs = this._trackRetryDelayMs) {
    const state = this._getTrackRetryState(chapterIndex);
    const normalizedDelayMs = Math.max(
      this._trackRetryDelayMs,
      Math.floor(Number(delayMs) || this._trackRetryDelayMs)
    );
    const requestedNextRetryAt = Date.now() + normalizedDelayMs;

    if (state.attempts >= this._maxTrackRetryAttempts) {
      console.error(
        `❌ Spotify retry limit reached for chapter ${chapterIndex}. ` +
        `Stopping after ${this._maxTrackRetryAttempts} attempts.`
      );
      return;
    }

    if (state.timerId) {
      // Keep the existing timer when it already waits long enough.
      if (state.nextRetryAt >= requestedNextRetryAt - 500) {
        return;
      }
      window.clearTimeout(state.timerId);
      state.timerId = null;
    }

    const nextAttempt = state.attempts + 1;
    state.nextRetryAt = requestedNextRetryAt;
    state.timerId = window.setTimeout(() => {
      state.timerId = null;
      this._runTrackRetry(chapterIndex).catch((error) => {
        console.error(`❌ Scheduled Spotify retry failed for chapter ${chapterIndex}:`, error);
      });
    }, normalizedDelayMs);

    console.warn(
      `⏳ Scheduling Spotify retry ${nextAttempt}/${this._maxTrackRetryAttempts} ` +
      `for chapter ${chapterIndex} in ${Math.round(normalizedDelayMs / 1000)}s (${reason}).`
    );
  }

  async _runTrackRetry(chapterIndex) {
    const state = this._getTrackRetryState(chapterIndex);
    if (state.attempts >= this._maxTrackRetryAttempts) {
      return;
    }

    state.attempts += 1;
    state.nextRetryAt = 0;

    console.log(
      `🔄 Retrying Spotify tracks for chapter ${chapterIndex} ` +
      `(${state.attempts}/${this._maxTrackRetryAttempts})...`
    );

    const tracks = await this.getTracksForChapter(chapterIndex, { bypassRetryGate: true });
    if (tracks.length > 0) {
      this._clearTrackRetryState(chapterIndex);
      if (chapterIndex === this.currentChapterIndex) {
        this._emitChapterMusicChanged(chapterIndex, tracks);
      }
    }
  }

  _isRateLimitError(error) {
    return error?.code === 'SPOTIFY_RATE_LIMIT' ||
      error?.code === 'LASTFM_RATE_LIMIT' ||
      /rate limit/i.test(String(error?.message || ''));
  }

  _isAuthError(error) {
    const message = String(error?.message || '').toLowerCase();
    return error?.code === 'SPOTIFY_AUTH' ||
      error?.code === 'LASTFM_AUTH' ||
      message.includes('no spotify access token') ||
      message.includes('no last.fm api key') ||
      message.includes('no lastfm api key') ||
      message.includes('no token provided') ||
      message.includes('re-authenticate') ||
      message.includes('authorization failed');
  }

  _getRetryDelayMsFromError(error) {
    if (Number.isFinite(Number(error?.retryAfterMs))) {
      return Math.max(this._trackRetryDelayMs, Math.floor(Number(error.retryAfterMs)));
    }
    const match = String(error?.message || '').match(/retry after\s+(\d+)/i);
    if (match && Number.isFinite(Number(match[1]))) {
      return Math.max(this._trackRetryDelayMs, Number(match[1]) * 1000);
    }
    return this._trackRetryDelayMs;
  }

  _buildLastFmKeywordsForProfile(profile, mapping) {
    const effectiveEnergy = this._getEffectiveProfileEnergy(profile?.energy || mapping?.energy || 3);
    const profileKeywords = Array.isArray(profile?.keywords) && profile.keywords.length > 0
      ? profile.keywords
      : (mapping?.keywords || []);

    return this.moodProcessor.buildDiscoveryKeywordProfile(
      {
        mood: profile?.mood || mapping?.mood || 'peaceful',
        fromMood: profile?.fromMood || null,
        energy: effectiveEnergy,
        keywords: profileKeywords
      },
      this.bookAnalysis?.bookProfile || null
    );
  }

  _getEffectiveProfileEnergy(rawEnergy) {
    const requestedEnergy = Math.max(1, Math.min(5, Math.round(Number(rawEnergy) || 3)));
    const settings = JSON.parse(localStorage.getItem('booksWithMusic-settings') || '{}');
    const configuredMaxEnergy = settings.maxEnergyLevel;
    const maxEnergyLevel = configuredMaxEnergy !== undefined
      ? Math.max(1, Math.min(5, Math.round(Number(configuredMaxEnergy) || 5)))
      : 5;
    return Math.min(requestedEnergy, maxEnergyLevel);
  }

  _normalizeTrackIdentityText(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/['"`]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  _extractPrimaryArtistName(track) {
    const artistText = String(track?.artist || '').trim();
    if (!artistText) return '';

    const split = artistText.split(/,|&|\bfeat\.?\b|\bft\.?\b/i);
    return String(split[0] || '').trim();
  }

  _canonicalizeTrackTitle(title) {
    const raw = String(title || '').trim();
    if (!raw) return '';

    const withoutBrackets = raw.replace(/[\(\[\{].*?[\)\]\}]/g, ' ');
    const normalized = withoutBrackets.replace(/\s+/g, ' ').trim();
    const separatorMatch = normalized.match(/^(.+?)\s[-:|]\s(.+)$/);
    const qualifierRegex = /\b(instrumental|version|remix|remaster|edit|mix|score|theme|soundtrack|ost|bgm|live|karaoke|radio|extended|demo|acoustic|lofi|slowed|reverb|tv|trailer)\b/i;
    const maybeReduced = separatorMatch && qualifierRegex.test(separatorMatch[2])
      ? separatorMatch[1]
      : normalized;

    return this._normalizeTrackIdentityText(maybeReduced);
  }

  _getTrackIdentityKeys(track) {
    const title = String(track?.title || '').trim();
    if (!title) return [];

    const primaryArtist = this._extractPrimaryArtistName(track);
    const normalizedTitle = this._normalizeTrackIdentityText(title);
    const canonicalTitle = this._canonicalizeTrackTitle(title);
    const normalizedArtist = this._normalizeTrackIdentityText(primaryArtist);
    const keys = new Set();

    if (normalizedArtist && normalizedTitle) {
      keys.add(`artist-title:${normalizedArtist}|${normalizedTitle}`);
    }

    if (normalizedArtist && canonicalTitle) {
      keys.add(`artist-canonical:${normalizedArtist}|${canonicalTitle}`);
    }

    return [...keys];
  }

  _registerTrackIdentity(track, identitySet) {
    if (!(identitySet instanceof Set)) return;
    this._getTrackIdentityKeys(track).forEach((key) => identitySet.add(key));
  }

  _hasTrackIdentityCollision(track, localIdentitySet, excludedIdentitySet = null) {
    return this._getTrackIdentityCollisionSource(track, localIdentitySet, excludedIdentitySet) !== null;
  }

  _getTrackIdentityCollisionSource(track, localIdentitySet, excludedIdentitySet = null) {
    const identityKeys = this._getTrackIdentityKeys(track);
    if (identityKeys.length === 0) {
      return null;
    }

    if (identityKeys.some((key) => localIdentitySet?.has(key))) {
      return 'local';
    }

    if (identityKeys.some((key) => excludedIdentitySet?.has(key))) {
      return 'excluded';
    }

    return null;
  }

  async _resolveProfileTracksViaLastFm(profile, perProfileLimit, chapterIndex, mapping, runtimeOptions = {}) {
    if (!this.lastFmAPI.isConfigured()) {
      if (!this._hasLoggedMissingLastFmKey) {
        console.error('❌ Last.fm API key missing. Add key in Music Settings > Music API.');
        this._hasLoggedMissingLastFmKey = true;
      }
      const error = new Error('No Last.fm API key available.');
      error.code = 'LASTFM_AUTH';
      throw error;
    }

    const keywordProfile = this._buildLastFmKeywordsForProfile(profile, mapping);
    if (keywordProfile.length === 0) {
      return [];
    }

    const contextLabel =
      `chapter-${chapterIndex}` +
      `-page-${Number(profile?.pageInChapter || 1)}` +
      `-${String(profile?.mood || mapping?.mood || 'unknown').toLowerCase()}`;

    const settings = JSON.parse(localStorage.getItem('booksWithMusic-settings') || '{}');
    const effectiveProfileEnergy = this._getEffectiveProfileEnergy(profile?.energy || mapping?.energy || 3);
    const lastFmCandidates = await this.lastFmAPI.searchTracksByKeywords(
      keywordProfile,
      Math.max(perProfileLimit * 3, 8),
      {
        contextLabel,
        mood: profile?.mood || mapping?.mood || 'peaceful',
        fromMood: profile?.fromMood || null,
        energy: effectiveProfileEnergy,
        instrumentalOnly: settings.instrumentalOnly !== false
      }
    );

    if (lastFmCandidates.length === 0) {
      return [];
    }

    const candidateLimit = Math.max(4, perProfileLimit * 2);
    const candidatesToResolve = lastFmCandidates.slice(0, candidateLimit);

    const preferredMarket = typeof this.spotifyAPI._getPreferredSearchMarket === 'function' &&
      typeof this.spotifyAPI._getSettings === 'function'
      ? this.spotifyAPI._getPreferredSearchMarket(this.spotifyAPI._getSettings())
      : '';

    const resolveCache = runtimeOptions.resolveCache instanceof Map
      ? runtimeOptions.resolveCache
      : new Map();
    const excludedTrackIds = runtimeOptions.excludedTrackIds instanceof Set
      ? runtimeOptions.excludedTrackIds
      : new Set();
    const excludedTrackSignatures = runtimeOptions.excludedTrackSignatures instanceof Set
      ? runtimeOptions.excludedTrackSignatures
      : new Set();

    const orderedResolvedTracks = [];
    const usedSpotifyTrackIds = new Set();
    const usedTrackSignatures = new Set();
    const maxFreshResolveLookups = Math.max(4, Math.min(candidateLimit, perProfileLimit + 2));
    let freshResolveLookups = 0;
    const unresolvedSamples = [];
    const diagnostics = {
      missingMetadata: 0,
      cacheHits: 0,
      cacheMisses: 0,
      unresolvedAfterLookup: 0,
      duplicateTrackIdWithinProfile: 0,
      duplicateTrackIdAcrossChapter: 0,
      duplicateIdentityWithinProfile: 0,
      duplicateIdentityAcrossChapter: 0,
      lookupBudgetHit: false
    };

    for (const candidate of candidatesToResolve) {
      const title = String(candidate?.title || '').trim();
      const artist = String(candidate?.artist || '').trim();
      if (!title || !artist) {
        diagnostics.missingMetadata += 1;
        continue;
      }

      const resolveKey = `${title.toLowerCase()}|${artist.toLowerCase()}`;
      const hasCachedResolution = resolveCache.has(resolveKey);
      let resolved = resolveCache.get(resolveKey);
      if (hasCachedResolution) {
        diagnostics.cacheHits += 1;
      } else {
        diagnostics.cacheMisses += 1;
        if (freshResolveLookups >= maxFreshResolveLookups) {
          diagnostics.lookupBudgetHit = true;
          break;
        }
        freshResolveLookups += 1;
        resolved = await this.spotifyAPI.searchTrackByTitleArtist(
          title,
          artist,
          {
            market: preferredMarket,
            instrumentalOnly: settings.instrumentalOnly !== false,
            targetMood: profile?.mood || mapping?.mood || 'peaceful'
          }
        );
        resolveCache.set(resolveKey, resolved || null);
      }

      if (!resolved) {
        diagnostics.unresolvedAfterLookup += 1;
        if (unresolvedSamples.length < 5) {
          unresolvedSamples.push({
            title,
            artist,
            confidence: Number(candidate?.confidence) || 0
          });
        }
        continue;
      }
      if (usedSpotifyTrackIds.has(resolved.id)) {
        diagnostics.duplicateTrackIdWithinProfile += 1;
        continue;
      }
      if (excludedTrackIds.has(resolved.id)) {
        diagnostics.duplicateTrackIdAcrossChapter += 1;
        continue;
      }
      const identityCollisionSource = this._getTrackIdentityCollisionSource(
        resolved,
        usedTrackSignatures,
        excludedTrackSignatures
      );
      if (identityCollisionSource === 'local') {
        diagnostics.duplicateIdentityWithinProfile += 1;
        continue;
      }
      if (identityCollisionSource === 'excluded') {
        diagnostics.duplicateIdentityAcrossChapter += 1;
        continue;
      }

      usedSpotifyTrackIds.add(resolved.id);
      this._registerTrackIdentity(resolved, usedTrackSignatures);
      orderedResolvedTracks.push({
        ...resolved,
        lastFmConfidence: candidate.confidence,
        lastFmReference: candidate.reference || ''
      });

      if (orderedResolvedTracks.length >= perProfileLimit) {
        break;
      }
    }

    if (orderedResolvedTracks.length < perProfileLimit) {
      const mood = profile?.mood || mapping?.mood || 'unknown';
      const topKeywords = keywordProfile
        .slice(0, 6)
        .map((entry) => `${entry.keyword}:${Number(entry.weight || 0).toFixed(2)}`)
        .join(', ');
      console.error(
        `❌ Last.fm→Spotify underfilled profile for chapter ${chapterIndex} ` +
        `(mood=${mood}, page=${Number(profile?.pageInChapter || 1)}): ` +
        `resolved=${orderedResolvedTracks.length}/${perProfileLimit}, ` +
        `lastFmCandidates=${lastFmCandidates.length}, candidateLimit=${candidateLimit}, ` +
        `freshLookups=${freshResolveLookups}/${maxFreshResolveLookups}, ` +
        `cacheHits=${diagnostics.cacheHits}, cacheMisses=${diagnostics.cacheMisses}, ` +
        `lookupBudgetHit=${diagnostics.lookupBudgetHit}, missingMetadata=${diagnostics.missingMetadata}, ` +
        `unresolved=${diagnostics.unresolvedAfterLookup}, ` +
        `dupTrackProfile=${diagnostics.duplicateTrackIdWithinProfile}, ` +
        `dupTrackChapter=${diagnostics.duplicateTrackIdAcrossChapter}, ` +
        `dupIdentityProfile=${diagnostics.duplicateIdentityWithinProfile}, ` +
        `dupIdentityChapter=${diagnostics.duplicateIdentityAcrossChapter}.`
      );
      console.error(`❌ Last.fm profile keywords [${contextLabel}]: [${topKeywords}]`);
      if (unresolvedSamples.length > 0) {
        const unresolvedSampleText = unresolvedSamples
          .map((item) => `${item.title} — ${item.artist} (confidence=${Math.round(item.confidence)}%)`)
          .join(' | ');
        console.error(`❌ Last.fm unresolved samples [${contextLabel}]: ${unresolvedSampleText}`);
      }
    }

    console.info(
      `🔗 Last.fm→Spotify resolved ${orderedResolvedTracks.length}/${candidatesToResolve.length} ` +
      `(freshLookups=${freshResolveLookups}/${maxFreshResolveLookups}, ` +
      `unresolved=${diagnostics.unresolvedAfterLookup}, ` +
      `dupIdentity=${diagnostics.duplicateIdentityWithinProfile + diagnostics.duplicateIdentityAcrossChapter}) ` +
      `track(s) for chapter ${chapterIndex} mood=${profile?.mood || mapping?.mood || 'unknown'}`
    );

    return orderedResolvedTracks;
  }

  /**
   * Get tracks for a specific chapter (fetch on-demand)
   * @param {number} chapterIndex - Chapter index (0-indexed)
   * @returns {Promise<Array>} Array of Spotify track objects
   */
  async getTracksForChapter(chapterIndex, { bypassRetryGate = false } = {}) {
    const mapping = this.chapterMappings[chapterIndex];
    
    if (!mapping) {
      console.warn(`⚠️ No mapping found for chapter ${chapterIndex}`);
      return [];
    }

    // Return cached tracks if already fetched
    if (mapping.tracksFetched && mapping.tracks.length > 0) {
      return mapping.tracks;
    }

    if (this._trackFetchPromises[chapterIndex]) {
      return this._trackFetchPromises[chapterIndex];
    }

    const retryState = this._getTrackRetryState(chapterIndex);
    if (
      !bypassRetryGate &&
      retryState.nextRetryAt > Date.now() &&
      mapping.tracks.length === 0
    ) {
      return [];
    }

    if (
      !bypassRetryGate &&
      retryState.attempts >= this._maxTrackRetryAttempts &&
      mapping.tracks.length === 0
    ) {
      return [];
    }

    const fetchPromise = this._fetchTracksForChapter(chapterIndex, mapping);
    this._trackFetchPromises[chapterIndex] = fetchPromise;

    try {
      return await fetchPromise;
    } finally {
      delete this._trackFetchPromises[chapterIndex];
    }
  }

  async _fetchTracksForChapter(chapterIndex, mapping) {
    try {
      console.log(`🎵 Fetching Spotify tracks for chapter ${chapterIndex}...`);
      const desiredTrackCount = this._getDesiredTrackCount(mapping);

      // Build one search profile per shift so early playlist tracks align with mood transitions.
      const shiftProfiles = this._buildShiftSearchProfiles(mapping);
      const maxProfileQueries = Math.max(
        1,
        Math.min(this._maxProfileQueriesPerChapter, desiredTrackCount)
      );
      const selectedProfiles = this._selectProfilesForFetch(shiftProfiles, maxProfileQueries);
      const perProfileLimit = Math.max(
        2,
        Math.min(
          this.spotifyAPI.maxSearchResultsPerRequest || 10,
          Math.ceil(desiredTrackCount / Math.max(1, selectedProfiles.length)) + 1
        )
      );
      const searchedTracksByProfile = [];
      const resolveCache = new Map();
      const reservedTrackIds = new Set();
      const reservedTrackSignatures = new Set();

      if (selectedProfiles.length < shiftProfiles.length) {
        console.log(
          `🎛️ Last.fm profile budget: selected ${selectedProfiles.length}/${shiftProfiles.length} mood profiles ` +
          `(perProfileLimit=${perProfileLimit}, apiMax=${this.spotifyAPI.maxSearchResultsPerRequest || 10})`
        );
      }

      for (const profile of selectedProfiles) {
        const tracks = await this._resolveProfileTracksViaLastFm(
          profile,
          perProfileLimit,
          chapterIndex,
          mapping,
          {
            resolveCache,
            excludedTrackIds: reservedTrackIds,
            excludedTrackSignatures: reservedTrackSignatures
          }
        );
        searchedTracksByProfile.push({ profile, tracks });
        (tracks || []).forEach((track) => {
          if (track?.id) {
            reservedTrackIds.add(track.id);
          }
          this._registerTrackIdentity(track, reservedTrackSignatures);
        });
      }

      // Ensure each shift mood gets at least one "anchor" track at the front of the playlist.
      const orderedTracks = [];
      const usedTrackIds = new Set();
      const usedTrackSignatures = new Set();
      let identityFilteredCount = 0;
      const addTrack = (track, profile) => {
        if (!track?.id || usedTrackIds.has(track.id)) return;
        if (this._hasTrackIdentityCollision(track, usedTrackSignatures)) {
          identityFilteredCount += 1;
          return;
        }
        usedTrackIds.add(track.id);
        this._registerTrackIdentity(track, usedTrackSignatures);
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

      const tracksWithReasoning = orderedTracks.slice(0, desiredTrackCount);
      mapping.tracks = tracksWithReasoning;
      mapping.tracksFetched = tracksWithReasoning.length > 0;

      if (identityFilteredCount > 0) {
        console.info(
          `🧬 Diversity filter skipped ${identityFilteredCount} near-duplicate chapter track candidate(s) ` +
          `for chapter ${chapterIndex}.`
        );
      }

      if (tracksWithReasoning.length > 0) {
        this._clearTrackRetryState(chapterIndex);
        console.log(`✅ Loaded ${tracksWithReasoning.length} Spotify tracks for chapter ${chapterIndex}`);
        return tracksWithReasoning;
      }

      console.warn(`⚠️ No Last.fm-discovered Spotify tracks returned for chapter ${chapterIndex}`);
      this._scheduleTrackRetry(chapterIndex, 'no-tracks');
      return [];
    } catch (error) {
      mapping.tracks = [];
      mapping.tracksFetched = false;
      if (this._isAuthError(error)) {
        if (error?.code === 'LASTFM_AUTH' || /last\.?fm/i.test(String(error?.message || ''))) {
          console.error(
            `❌ Last.fm auth error while fetching chapter ${chapterIndex}. ` +
            'Add a valid Last.fm API key in Music Settings > Music API.',
            error
          );
        } else {
          console.error(
            `❌ Spotify auth error while fetching chapter ${chapterIndex}. ` +
            'Reconnect Spotify to resume chapter music.',
            error
          );
        }
        this._clearTrackRetryState(chapterIndex);
        return [];
      }

      if (this._isRateLimitError(error)) {
        const retryDelayMs = this._getRetryDelayMsFromError(error);
        const sourceLabel = error?.code === 'LASTFM_RATE_LIMIT' ? 'Last.fm' : 'Spotify';
        console.warn(
          `⏳ ${sourceLabel} rate limit hit for chapter ${chapterIndex}. ` +
          `Retrying in ${Math.round(retryDelayMs / 1000)}s.`
        );
        this._scheduleTrackRetry(chapterIndex, 'rate-limited', retryDelayMs);
        return [];
      }

      console.error(`❌ Failed to fetch Spotify tracks for chapter ${chapterIndex}:`, error);
      this._scheduleTrackRetry(chapterIndex, 'request-failed', this._trackRetryDelayMs);
      return [];
    }
  }

  /**
   * Resolve desired tracks per chapter from UI settings.
   * Mirrors Freesound logic and caps chapter playlists at 20.
   * Spotify Search is max 10 per request, but we merge multiple targeted queries.
   * @private
   */
  _getDesiredTrackCount(mapping) {
    const settings = JSON.parse(localStorage.getItem('booksWithMusic-settings') || '{}');
    const songsPerChapter = Math.max(1, Math.min(20, Math.floor(Number(settings.songsPerChapter) || 5)));
    const minSongsPerPages = Math.max(1, Math.min(10, Math.floor(Number(settings.minSongsPerPages) || 1)));
    const estimatedPages = Math.max(1, Math.floor(Number(mapping?.estimatedPages) || 1));
    const minTracksForPages = Math.ceil(estimatedPages / minSongsPerPages);
    const shiftPoints = Array.isArray(mapping?.shiftPoints) ? mapping.shiftPoints : [];
    const validShiftCount = shiftPoints.filter((shift) => {
      const page = Number(shift?.pageInChapter ?? shift?.page ?? NaN);
      return Number.isFinite(page) && page > 1;
    }).length;
    const minTracksForShifts = validShiftCount + 1;
    return Math.min(20, Math.max(songsPerChapter, minTracksForPages, minTracksForShifts));
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
      key: [
        String(mapping?.mood || 'peaceful').toLowerCase(),
        Math.round(mapping?.energy || 3),
        (mapping?.keywords || []).slice(0, 3).join(',').toLowerCase(),
        ''
      ].join('|'),
      mood: mapping?.mood || 'peaceful',
      fromMood: null,
      energy: mapping?.energy || 3,
      keywords: mapping?.keywords || [],
      pageInChapter: 1
    }];

    for (const shift of shiftPoints) {
      const mood = shift?.mood || shift?.toMood || mapping.mood;
      const fromMood = shift?.fromMood || null;
      const energy = shift?.energy || mapping.energy || 3;
      const keywords = Array.isArray(shift?.keywords)
        ? shift.keywords
        : (mapping.keywords || []);

      const key = [
        String(mood).toLowerCase(),
        Math.round(energy),
        keywords.slice(0, 3).join(',').toLowerCase(),
        String(fromMood || '').toLowerCase().trim()
      ].join('|');
      if (profiles.some(profile => profile.key === key)) {
        continue;
      }

      profiles.push({
        key,
        mood,
        fromMood,
        energy,
        keywords,
        pageInChapter: shift?.pageInChapter || shift?.page || 1
      });
    }

    return profiles;
  }

  /**
   * Reduce API pressure by sampling shift profiles across chapter timeline.
   * Always keeps chapter start profile, then spreads remaining picks.
   * @private
   */
  _selectProfilesForFetch(profiles, maxProfiles) {
    const source = Array.isArray(profiles) ? profiles : [];
    const cappedMax = Math.max(1, Math.floor(Number(maxProfiles) || 1));

    if (source.length <= cappedMax) {
      return source;
    }

    const selected = [source[0]];
    if (cappedMax === 1) {
      return selected;
    }

    const remaining = source.slice(1);
    const remainingSlots = cappedMax - 1;

    for (let i = 0; i < remainingSlots; i++) {
      const idx = remainingSlots === 1
        ? remaining.length - 1
        : Math.round((i * (remaining.length - 1)) / (remainingSlots - 1));
      const candidate = remaining[idx];
      if (candidate && !selected.includes(candidate)) {
        selected.push(candidate);
      }
    }

    if (selected.length < cappedMax) {
      for (const candidate of remaining) {
        if (!selected.includes(candidate)) {
          selected.push(candidate);
        }
        if (selected.length >= cappedMax) {
          break;
        }
      }
    }

    return selected.slice(0, cappedMax);
  }

  /**
   * Apply reader-provided shift points to chapter mapping so Spotify targeting
   * uses the same page/mood transitions shown in the UI.
   * @private
   */
  _applyExternalShiftPoints(chapterIndex, chapterShiftPoints) {
    const mapping = this.chapterMappings[chapterIndex];
    if (!mapping) return false;

    const rawShiftPoints = Array.isArray(chapterShiftPoints?.shiftPoints)
      ? chapterShiftPoints.shiftPoints
      : (Array.isArray(chapterShiftPoints) ? chapterShiftPoints : []);

    if (rawShiftPoints.length === 0) {
      return false;
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
      if (String(toMood).toLowerCase().trim() === String(previousMood).toLowerCase().trim()) {
        continue; // Skip no-op shifts (e.g. dark -> dark)
      }
      const fromMood = shift?.fromMood || previousMood;
      const keywords = Array.isArray(shift?.keywords)
        ? shift.keywords
        : (mapping.keywords || []);

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
      return false;
    }

    const signature = normalized
      .map((shift) => {
        const mood = String(shift.mood || '').toLowerCase().trim();
        const energy = Number.isFinite(Number(shift.energy))
          ? Math.round(Number(shift.energy))
          : '';
        const keywordSig = (shift.keywords || [])
          .slice(0, 3)
          .map((keyword) => String(keyword).toLowerCase().trim())
          .join(',');
        return `${mood}|${energy}|${keywordSig}`;
      })
      .join('||');

    const profileChanged = mapping.shiftSignature !== signature;
    mapping.shiftPoints = normalized;
    mapping.shiftSignature = signature;

    if (profileChanged) {
      // Reader shift profiles changed in a way that affects track targeting.
      mapping.tracks = [];
      mapping.tracksFetched = false;
    }

    return profileChanged;
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
    const moodHints = {
      dark: ['ominous', 'atmospheric'],
      mysterious: ['enigmatic', 'ambient'],
      romantic: ['warm', 'tender'],
      sad: ['melancholic', 'emotional'],
      epic: ['cinematic', 'orchestral'],
      peaceful: ['calm', 'serene'],
      tense: ['suspenseful', 'dramatic'],
      joyful: ['uplifting', 'bright'],
      adventure: ['inspiring', 'exploratory'],
      magical: ['ethereal', 'fantasy']
    };
    const genericTerms = new Set([
      'instrumental', 'no vocals', 'ambient', 'cinematic score', 'calm',
      'atmospheric', 'balanced', 'flowing', 'gentle', 'soft'
    ]);
    const hintSet = new Set([mood, ...(moodHints[mood] || [])].map((item) => item.toLowerCase()));
    const alignedProfileThemes = keywords
      .map((keyword) => String(keyword || '').toLowerCase().trim())
      .filter((keyword) => keyword.length >= 3)
      .filter((keyword) => !genericTerms.has(keyword))
      .filter((keyword) => hintSet.has(keyword))
      .slice(0, 2);
    const reasoningThemes = alignedProfileThemes.length > 0
      ? alignedProfileThemes
      : (moodHints[mood] || []).slice(0, 2);
    const keywordText = reasoningThemes.length > 0 ? ` with ${reasoningThemes.join(', ')} themes` : '';

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

    // Skip noisy duplicate prefetch logs/calls while an existing fetch is in flight.
    if (this._trackFetchPromises[nextChapterIndex]) {
      return;
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

  _emitChapterMusicChanged(chapterIndex, tracks = []) {
    const mapping = this.chapterMappings[chapterIndex];
    if (!mapping) return;

    const context = this._chapterContextByIndex[chapterIndex] || {};
    const currentPageInChapter = Number(context.currentPageInChapter || this.currentPageInChapter || 1);
    const chapterShiftPoints = context.chapterShiftPoints || { shiftPoints: mapping?.shiftPoints || [] };
    const currentShift = this._getCurrentShiftPoint(chapterIndex, currentPageInChapter);

    this.emit('chapterMusicChanged', {
      chapterIndex,
      currentPageInChapter,
      chapterShiftPoints,
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
   * Handle chapter change event
   * @param {number} chapterIndex - New chapter index
   */
  async onChapterChange(chapterIndex, currentPageInChapter = 1, chapterShiftPoints = null) {
    console.log(`📖 Chapter changed to ${chapterIndex} (Spotify)`);
    const requestId = ++this._latestChapterChangeRequestId;
    
    const mapping = this.chapterMappings[chapterIndex];
    if (!mapping) {
      console.warn(`⚠️ No mapping found for chapter ${chapterIndex}`);
      return;
    }

    // Prefer the reader's section-analysis shift points when available.
    const profileChanged = this._applyExternalShiftPoints(chapterIndex, chapterShiftPoints);

    const sameChapter = this.currentChapterIndex === chapterIndex;
    const hasCachedTracks = mapping.tracksFetched && mapping.tracks.length > 0;
    if (sameChapter && !profileChanged && hasCachedTracks) {
      this.currentPageInChapter = Number(currentPageInChapter) || this.currentPageInChapter || 1;
      this._chapterContextByIndex[chapterIndex] = {
        currentPageInChapter: this.currentPageInChapter,
        chapterShiftPoints: chapterShiftPoints || { shiftPoints: mapping?.shiftPoints || [] }
      };
      this._emitChapterMusicChanged(chapterIndex, mapping.tracks);
      return;
    }

    // Reset track state when chapter changes
    this.currentChapterIndex = chapterIndex;
    this.currentPageInChapter = Number(currentPageInChapter) || 1;
    this._chapterContextByIndex[chapterIndex] = {
      currentPageInChapter: this.currentPageInChapter,
      chapterShiftPoints: chapterShiftPoints || { shiftPoints: mapping?.shiftPoints || [] }
    };
    this.currentTrackIndex = 0;
    const initialShift = this._getCurrentShiftPoint(chapterIndex, this.currentPageInChapter);
    this.lastMood = initialShift?.mood || mapping?.mood || null;
    this.lastEnergy = initialShift?.energy || mapping?.energy || null;
    this.lastKeywords = initialShift?.keywords || mapping?.keywords || [];
    
    // Fetch tracks for current chapter only
    const tracks = await this.getTracksForChapter(chapterIndex);

    // Ignore stale async completions when chapter changes quickly.
    if (requestId !== this._latestChapterChangeRequestId || this.currentChapterIndex !== chapterIndex) {
      return;
    }
    
    // Emit event for UI in the format music-panel expects
    this._emitChapterMusicChanged(chapterIndex, tracks);
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
    if (this._chapterContextByIndex[chapterIndex]) {
      this._chapterContextByIndex[chapterIndex].currentPageInChapter = pageInChapter;
    }
    
    // Check if we crossed a shift point
    const newShift = this._getCurrentShiftPoint(chapterIndex, pageInChapter);
    const mapping = this.chapterMappings[chapterIndex];
    
    if (!newShift || !mapping) return;
    
    // Check if mood/energy changed significantly
    const moodChanged = newShift.mood !== this.lastMood;
    const energyChanged = Math.abs((newShift.energy || 3) - (this.lastEnergy || 3)) >= 2;
    
    if (moodChanged || energyChanged) {
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
