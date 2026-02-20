/**
 * SpotifyAPI - Spotify Web API Integration
 * 
 * NOTE ON SPOTIFY WEB API CHANGES:
 * - Recommendation and audio-feature endpoints are not used in this app.
 * - Search API is the primary discovery mechanism.
 * - preview_url was removed from track objects.
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
 * - Better coverage and curation for narrative moods
 * - Professional catalog with consistent quality
 * - Query-based mood matching with low-vocal filtering
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
 * - Search Reference: https://developer.spotify.com/documentation/web-api/reference/search
 */

import { SpotifyAuth } from '../auth/spotify-auth.js';
import { SpotifyMapper } from '../mappers/spotify-mapper.js';

export class SpotifyAPI {
  constructor() {
    this.auth = new SpotifyAuth();
    this.mapper = new SpotifyMapper();
    this.baseURL = 'https://api.spotify.com/v1';
    this.maxSearchResultsPerRequest = 10; // Spotify Search API max (tracks)
    
    // Rate limiting
    this.lastRequestTime = 0;
    this.minRequestInterval = 100; // 100ms between requests
    this.rateLimitedUntil = 0;
    this._lastRateLimitLogUntil = 0;
    this._hasLoggedMoodAlignmentScoring = false;
    
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
   * Read persisted music settings safely.
   * @private
   */
  _getSettings() {
    try {
      return JSON.parse(localStorage.getItem('booksWithMusic-settings') || '{}');
    } catch (_) {
      return {};
    }
  }

  /**
   * Resolve Spotify search market.
   * Defaults to GB to avoid over-localized catalog bias from account country.
   * Set `spotifySearchMarket` to `AUTO` in settings to let Spotify decide.
   * @private
   */
  _getPreferredSearchMarket(settings = null) {
    const effectiveSettings = settings || this._getSettings();
    const rawMarket = String(
      effectiveSettings.spotifySearchMarket ||
      'GB'
    )
      .trim()
      .toUpperCase();

    if (rawMarket === 'AUTO') {
      // Keep GB as default unless user explicitly opts into locale-driven catalogs.
      return effectiveSettings.spotifyUseAutoMarket === true ? '' : 'GB';
    }

    return /^[A-Z]{2}$/.test(rawMarket) ? rawMarket : 'GB';
  }

  /**
   * Check if verbose logging is enabled in UI settings.
   * @private
   */
  _isVerboseLoggingEnabled() {
    const settings = this._getSettings();
    return settings.verboseLogging !== false;
  }

  /**
   * Verbose-only log helper.
   * @private
   */
  _debugLog(...args) {
    if (this._isVerboseLoggingEnabled()) {
      console.log(...args);
    }
  }

  /**
   * Verbose-only warning helper.
   * @private
   */
  _debugWarn(...args) {
    if (this._isVerboseLoggingEnabled()) {
      console.warn(...args);
    }
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
      this._debugWarn(`⚠️ Invalid Spotify genres filtered out: [${invalid.join(', ')}]`);
    }
    
    return validated;
  }

  /**
   * Detect whether chapter context intentionally asks for soundtrack/cinematic music.
   * @private
   */
  _shouldPreferCinematicMood(mood, terms = []) {
    const cinematicMoods = new Set(['epic', 'dramatic', 'adventure', 'action', 'fantasy', 'war']);
    if (cinematicMoods.has(String(mood || '').toLowerCase())) {
      return true;
    }

    return terms.some((term) => /cinematic|orchestral|score|trailer|soundtrack/i.test(String(term || '')));
  }

  /**
   * Detect explicit game-music intent from mood/keywords.
   * @private
   */
  _hasExplicitGameMusicIntent(terms = [], mood = '') {
    const joinedTerms = terms
      .map((term) => String(term || '').toLowerCase())
      .join(' ');
    const moodText = String(mood || '').toLowerCase();
    return /video game|game music|game soundtrack|\bbgm\b|\bost\b|chiptune|8-?bit/.test(joinedTerms + ' ' + moodText);
  }

  /**
   * Build optional negative query clause for game-heavy results.
   * @private
   */
  _buildNegativeQuerySuffix({ avoidGameMusic = true } = {}) {
    if (!avoidGameMusic) return '';
    return 'NOT "video game" NOT "game music" NOT bgm NOT ost NOT chiptune';
  }

  /**
   * Build a Spotify-safe genre clause using OR across multiple candidate genres.
   * Example: "(genre:ambient OR genre:new-age)"
   * @private
   */
  _buildGenreQueryClause(genres = []) {
    const cleaned = [...new Set(
      (Array.isArray(genres) ? genres : [])
        .map((genre) => String(genre || '').toLowerCase().trim())
        .filter((genre) => /^[a-z0-9-]+$/.test(genre))
    )];

    if (cleaned.length === 0) return '';
    if (cleaned.length === 1) return `genre:${cleaned[0]}`;
    return `(${cleaned.map((genre) => `genre:${genre}`).join(' OR ')})`;
  }

  /**
   * Resolve mood proxy genres/terms used for ranking.
   * @private
   */
  _getMoodProxyGenres(mood) {
    const normalizedMood = String(mood || '').toLowerCase().trim();
    if (!normalizedMood) return [];

    const mapperGenres = Array.isArray(this.mapper?.moodToGenres?.[normalizedMood])
      ? this.mapper.moodToGenres[normalizedMood]
      : [];

    const moodKeywordMap = {
      peaceful: ['calm', 'meditative', 'sleep', 'relaxing', 'soft'],
      dark: ['dark', 'brooding', 'shadow', 'ominous'],
      mysterious: ['mysterious', 'enigmatic', 'noir', 'suspense'],
      romantic: ['romantic', 'love', 'warm', 'tender'],
      sad: ['sad', 'melancholic', 'emotional', 'piano'],
      epic: ['epic', 'cinematic', 'orchestral', 'anthemic'],
      tense: ['tense', 'suspense', 'thriller', 'pulse'],
      joyful: ['joyful', 'happy', 'uplifting', 'cheerful'],
      adventure: ['adventure', 'journey', 'heroic', 'exploration'],
      magical: ['magical', 'dreamy', 'ethereal', 'fantasy']
    };

    return [...new Set(
      [...mapperGenres, ...(moodKeywordMap[normalizedMood] || [])]
        .map((item) => String(item || '').toLowerCase().trim())
        .filter(Boolean)
    )];
  }

  /**
   * Resolve opposing proxies to penalize mismatched mood tracks.
   * @private
   */
  _getMoodMismatchGenres(mood) {
    const normalizedMood = String(mood || '').toLowerCase().trim();
    if (!normalizedMood) return [];

    const mismatchMap = {
      peaceful: ['metal', 'industrial', 'hardstyle', 'drum-and-bass', 'aggressive'],
      dark: ['happy', 'summer', 'party', 'joyful', 'cheerful'],
      mysterious: ['kids', 'party', 'dance', 'happy'],
      romantic: ['metal', 'industrial', 'hard-rock', 'horror'],
      sad: ['party', 'summer', 'work-out', 'edm'],
      epic: ['sleep', 'study', 'soft', 'lullaby'],
      tense: ['sleep', 'meditation', 'calm', 'lofi'],
      joyful: ['dark', 'goth', 'sad', 'funeral'],
      adventure: ['sleep', 'minimal', 'lullaby', 'ambient'],
      magical: ['hardcore', 'industrial', 'heavy-metal', 'dark']
    };

    return (mismatchMap[normalizedMood] || [])
      .map((item) => String(item || '').toLowerCase().trim())
      .filter(Boolean);
  }

  /**
   * Score track mood alignment using genre/tag proxies, with metadata fallback.
   * @private
   */
  _scoreMoodAlignment(track, targetMood) {
    const mood = String(targetMood || '').toLowerCase().trim();
    if (!mood) return 0;

    const targetProxies = this._getMoodProxyGenres(mood);
    if (targetProxies.length === 0) return 0;

    const opposingProxies = this._getMoodMismatchGenres(mood);
    const normalizedTags = Array.isArray(track?.tags)
      ? track.tags.map((tag) => String(tag || '').toLowerCase())
      : [];
    const metadata = `${track?.title || ''} ${track?.artist || ''} ${track?.album || ''}`.toLowerCase();
    const hasTagData = normalizedTags.length > 0;

    const positivePerHit = 16; // strong boost for aligned mood proxies
    const negativePerHit = 18; // strong penalty for mood mismatch
    const metadataPositivePerHit = 4; // weaker fallback when genre tags are unavailable
    const metadataNegativePerHit = 6;

    let scoreDelta = 0;

    for (const proxy of targetProxies) {
      if (hasTagData && normalizedTags.some((tag) => tag.includes(proxy))) {
        scoreDelta += positivePerHit;
      } else if (!hasTagData && metadata.includes(proxy)) {
        scoreDelta += metadataPositivePerHit;
      }
    }

    for (const proxy of opposingProxies) {
      if (hasTagData && normalizedTags.some((tag) => tag.includes(proxy))) {
        scoreDelta -= negativePerHit;
      } else if (!hasTagData && metadata.includes(proxy)) {
        scoreDelta -= metadataNegativePerHit;
      }
    }

    if (hasTagData && normalizedTags.some((tag) => tag.includes(mood))) {
      scoreDelta += 10;
    } else if (!hasTagData && metadata.includes(mood)) {
      scoreDelta += 3;
    }

    // Keep mood adjustment bounded so popularity/instrumental signals still matter.
    return Math.max(-55, Math.min(55, scoreDelta));
  }

  /**
   * Build normalized rate-limit error object.
   * @private
   */
  _createRateLimitError(retryAfterSeconds = 60, source = 'response') {
    const safeSeconds = Math.max(1, Math.ceil(Number(retryAfterSeconds) || 60));
    const retryAfterMs = safeSeconds * 1000;
    const error = new Error(`Spotify API rate limit reached. Retry after ${safeSeconds} seconds.`);
    error.code = 'SPOTIFY_RATE_LIMIT';
    error.source = source;
    error.retryAfterSeconds = safeSeconds;
    error.retryAfterMs = retryAfterMs;
    error.rateLimitedUntil = Date.now() + retryAfterMs;
    return error;
  }

  /**
   * Build normalized auth error object.
   * @private
   */
  _createAuthError(message) {
    const error = new Error(message || 'Spotify authentication unavailable.');
    error.code = 'SPOTIFY_AUTH';
    return error;
  }

  /**
   * @private
   */
  _isRateLimitError(error) {
    return error?.code === 'SPOTIFY_RATE_LIMIT' ||
      /rate limit/i.test(String(error?.message || ''));
  }

  /**
   * @private
   */
  _isAuthError(error) {
    const message = String(error?.message || '').toLowerCase();
    return error?.code === 'SPOTIFY_AUTH' ||
      message.includes('no spotify access token') ||
      message.includes('no token provided') ||
      message.includes('re-authenticate') ||
      message.includes('authorization failed');
  }

  /**
   * Search for tracks using Spotify Search API (keyword-based)
   * NOTE: Recommendations API is deprecated (Nov 2024) and unavailable for new apps
   * 
   * @param {Array<string>} keywords - Keywords from MoodProcessor
   * @param {number} limit - Number of tracks to return (1-10)
   * @param {Object} chapterAnalysis - Full chapter analysis from MoodProcessor
   * @returns {Array} Array of track objects
   */
  async searchTracks(keywords, limit = 10, chapterAnalysis = null, bookProfile = null) {
    if (!await this.isConfigured()) {
      this._debugWarn('⚠️ Spotify not authenticated');
      return [];
    }

    // Get settings
    const settings = this._getSettings();
    const instrumentalOnly = settings.instrumentalOnly !== false;

    // Keep free-text query centered on mood; feed detailed keywords as
    // genre-mapping context instead of title-matching terms.
    const moodTerm = String(chapterAnalysis?.mood || keywords?.[0] || 'ambient').trim() || 'ambient';
    const keywordContext = []
      .concat(Array.isArray(chapterAnalysis?.genres) ? chapterAnalysis.genres.slice(0, 2) : [])
      .concat(Array.isArray(keywords) ? keywords.slice(0, 3) : [])
      .filter(Boolean);

    return await this.searchByQuery([moodTerm], Math.min(this.maxSearchResultsPerRequest, limit), {
      mood: moodTerm,
      keywords: keywordContext,
      instrumentalOnly
    });
  }

  /**
   * Text-based search (fallback method)
   * @private
   */
  async _textSearch(keywords, limit, instrumentalOnly) {
    const query = keywords.join(' ');
    let searchQuery = `track:${query}`;
    const safeLimit = Math.max(1, Math.min(this.maxSearchResultsPerRequest, Math.floor(limit) || this.maxSearchResultsPerRequest));
    const market = this._getPreferredSearchMarket(this._getSettings());
    
    if (instrumentalOnly) {
      searchQuery += ' genre:instrumental OR genre:ambient OR genre:classical';
    }

    const params = new URLSearchParams({
      q: searchQuery,
      type: 'track',
      limit: String(safeLimit)
    });
    if (market) {
      params.set('market', market);
    }
    const endpoint = `/search?${params.toString()}`;

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
   * Uses Spotify-supported query fields (genre:) with layered fallback queries.
   * 
   * @param {Array<string>} queryTerms - Terms to search for (e.g., ['epic', 'orchestral'])
   * @param {number} limit - Number of results (1-10, default 10)
   * @param {Object} options - Additional context (mood, energy, keywords)
   * @returns {Array} Array of track objects
   */
  async searchByQuery(queryTerms, limit = 10, options = {}) {
    if (!await this.isConfigured()) {
      this._debugWarn('⚠️ Spotify not authenticated');
      return [];
    }

    // Clamp to a conservative per-request window to keep response size predictable.
    // We fan out across multiple focused queries below for diversity.
    limit = Math.max(1, Math.min(this.maxSearchResultsPerRequest, Math.floor(limit) || this.maxSearchResultsPerRequest));
    const maxBaseQueries = Math.max(1, Math.min(3, Math.floor(Number(options.maxBaseQueries) || 3)));
    const maxFallbackQueries = Math.max(1, Math.min(3, Math.floor(Number(options.maxFallbackQueries) || 1)));

    const settings = this._getSettings();
    const instrumentalOnly = options?.instrumentalOnly !== undefined
      ? options.instrumentalOnly !== false
      : settings.instrumentalOnly !== false;

    const safeTerms = (Array.isArray(queryTerms) ? queryTerms : [])
      .map(term => (term || '').trim())
      .filter(Boolean);
    const contextKeywords = (Array.isArray(options?.keywords) ? options.keywords : [])
      .map(term => (term || '').trim())
      .filter(Boolean);
    const normalizedTerms = safeTerms.length > 0 ? safeTerms : ['ambient'];
    const effectiveMood = String(options?.mood || normalizedTerms[0] || 'peaceful').toLowerCase();
    const termsForGenreMapping = [...normalizedTerms, ...contextKeywords]
      .filter(term => term.toLowerCase() !== 'instrumental');
    const uniqueTerms = [...new Map(termsForGenreMapping.map(term => [term.toLowerCase(), term])).values()];
    const effectiveEnergy = this._normalizeEnergyLevel(options?.energy);
    const energyProfile = this._getEnergySearchProfile(effectiveEnergy);
    const preferCinematicScores = settings.preferCinematicScores === true;
    const preferCinematic = preferCinematicScores &&
      this._shouldPreferCinematicMood(effectiveMood, uniqueTerms);
    const preferredSearchMarket = this._getPreferredSearchMarket(settings);
    const avoidGameMusic = options?.avoidGameMusic !== undefined
      ? options.avoidGameMusic !== false
      : !this._hasExplicitGameMusicIntent([...uniqueTerms, ...contextKeywords], effectiveMood);
    const negativeSuffix = this._buildNegativeQuerySuffix({ avoidGameMusic });
    const mappedGenres = this.validateGenres(
      this.mapper
        .mapKeywordsToGenres(uniqueTerms.length > 0 ? uniqueTerms : [effectiveMood], effectiveMood)
        .map(genre => String(genre).toLowerCase())
    );
    const filteredMappedGenres = preferCinematic
      ? mappedGenres
      : mappedGenres.filter((genre) => genre !== 'soundtrack');
    const candidateGenres = [
      ...new Set([
        ...filteredMappedGenres,
        'classical',
        'ambient',
        ...energyProfile.genres,
        ...(preferCinematic ? ['soundtrack'] : [])
      ])
    ].slice(0, 5);
    // Keep query text mood-centric so genre filters do most of the relevance work.
    const strictQueryCore = [effectiveMood, energyProfile.queryHint].filter(Boolean).join(' ');
    const relaxedQueryCore = effectiveMood;
    const collectedTracks = new Map();

    if (!this._hasLoggedMoodAlignmentScoring) {
      console.info(
        '🎯 Spotify mood-alignment scoring enabled (strong proxy boost + mismatch penalty, tags-first).'
      );
      this._hasLoggedMoodAlignmentScoring = true;
    }

    const addTracks = (tracks) => {
      for (const track of tracks) {
        if (track?.id && !collectedTracks.has(track.id)) {
          collectedTracks.set(track.id, track);
        }
      }
    };

    try {
      const primaryGenre = candidateGenres[0];
      const secondaryGenre = candidateGenres[1];
      const tertiaryGenre = candidateGenres[2];
      const queryPlans = [
        {
          label: 'base-1',
          core: strictQueryCore,
          genres: [primaryGenre, secondaryGenre]
        },
        {
          label: 'base-2',
          core: relaxedQueryCore,
          genres: [secondaryGenre, primaryGenre, tertiaryGenre]
        },
        {
          label: 'base-3',
          core: relaxedQueryCore,
          genres: [tertiaryGenre, primaryGenre]
        }
      ].filter((plan) => Boolean(plan.core) && plan.genres.some(Boolean));

      const baseQueries = queryPlans.slice(0, maxBaseQueries).map((plan) => ({
        label: plan.label,
        query: [
          plan.core,
          instrumentalOnly ? 'instrumental' : null,
          this._buildGenreQueryClause(plan.genres),
          negativeSuffix
        ]
          .filter(Boolean)
          .join(' ')
      }));

      if (baseQueries.length === 0) {
        baseQueries.push({
          label: 'base-fallback',
          query: [
            strictQueryCore,
            instrumentalOnly ? 'instrumental' : null,
            this._buildGenreQueryClause(['classical', 'ambient']),
            negativeSuffix
          ]
            .filter(Boolean)
            .join(' ')
        });
      }

      this._debugLog(
        `🧭 Spotify query plan: ${baseQueries.length} base query(ies), candidateGenres=[${candidateGenres.join(', ')}]`
      );

      for (let i = 0; i < baseQueries.length; i++) {
        const { query, label } = baseQueries[i];
        const requestLimit = i === 0
          ? this.maxSearchResultsPerRequest
          : Math.max(4, Math.min(6, this.maxSearchResultsPerRequest, limit));
        const tracks = await this._searchTracksByQueryString(
          query,
          requestLimit,
          label,
          { market: preferredSearchMarket }
        );
        addTracks(tracks);

        const provisional = this._filterAndSortTracks(Array.from(collectedTracks.values()), limit, {
          instrumentalOnly,
          avoidGameMusic,
          lowVocalPreference: true,
          preferredGenres: candidateGenres,
          targetMood: effectiveMood
        });
        if (provisional.length >= limit) {
          break;
        }
      }

      // If strict field-filtered queries fail, fall back to broader plain-text searches.
      if (collectedTracks.size === 0) {
        const fallbackQueries = (instrumentalOnly
          ? [
              preferCinematic
                ? `${relaxedQueryCore} instrumental cinematic score OR orchestral`
                : `${relaxedQueryCore} instrumental ambient OR classical OR piano`,
              preferCinematic
                ? `${effectiveMood} instrumental cinematic score`
                : `${effectiveMood} instrumental ambient`,
              preferCinematic
                ? 'instrumental cinematic orchestral'
                : 'instrumental ambient classical'
            ]
          : [
              preferCinematic
                ? `${relaxedQueryCore} cinematic score OR orchestral`
                : `${relaxedQueryCore} ambient OR classical OR acoustic`,
              preferCinematic
                ? `${effectiveMood} cinematic instrumental`
                : `${effectiveMood} ambient instrumental`,
              preferCinematic
                ? 'cinematic ambient orchestral'
                : 'ambient classical piano'
            ])
          .map((query) => [query, negativeSuffix].filter(Boolean).join(' '));

        const fallbackCount = Math.min(fallbackQueries.length, maxFallbackQueries);
        for (let i = 0; i < fallbackCount; i++) {
          const query = fallbackQueries[i];
          const tracks = await this._searchTracksByQueryString(
            query,
            i === 0 ? this.maxSearchResultsPerRequest : Math.max(4, Math.min(6, this.maxSearchResultsPerRequest, limit)),
            `fallback-${i + 1}`,
            { market: preferredSearchMarket }
          );
          addTracks(tracks);

          if (collectedTracks.size >= limit) {
            break;
          }
        }
      }

      const allTracks = Array.from(collectedTracks.values());
      const filteredTracks = this._filterAndSortTracks(allTracks, limit, {
        instrumentalOnly,
        avoidGameMusic,
        lowVocalPreference: true,
        preferredGenres: candidateGenres,
        targetMood: effectiveMood
      });
      const selectionLabel = instrumentalOnly ? 'low-vocal tracks' : 'tracks';

      this._debugLog(
        `✅ Spotify candidate pool: ${allTracks.length} tracks, returning ${filteredTracks.length} ${selectionLabel} (mood=${effectiveMood}, energy=${effectiveEnergy}, avoidGameMusic=${avoidGameMusic})`
      );

      return filteredTracks;
    } catch (error) {
      if (this._isRateLimitError(error) || this._isAuthError(error)) {
        throw error;
      }
      console.error('❌ Spotify searchByQuery error:', error);
      return [];
    }
  }

  /**
   * Execute one Spotify query-string search request.
   * @private
   */
  async _searchTracksByQueryString(searchQuery, limit, label = 'query', options = {}) {
    const safeLimit = Math.max(1, Math.min(this.maxSearchResultsPerRequest, Math.floor(limit) || this.maxSearchResultsPerRequest));
    const market = typeof options.market === 'string'
      ? options.market
      : this._getPreferredSearchMarket(this._getSettings());
    const params = new URLSearchParams({
      q: searchQuery,
      type: 'track',
      limit: String(safeLimit)
    });
    if (market) {
      params.set('market', market);
    }
    const endpoint = `/search?${params.toString()}`;

    console.info(`🔎 Spotify search query [${label}] q="${searchQuery}" (market=${market || 'AUTO'}, limit=${safeLimit})`);
    this._debugLog(
      `🔍 Spotify search (${label}): "${searchQuery}" (market=${market || 'AUTO'}, api limit=${safeLimit})`
    );

    const data = await this._makeRequest(endpoint);
    if (!data?.tracks?.items) {
      this._debugLog(`📦 Spotify search (${label}) returned 0 tracks`);
      return [];
    }

    this._debugLog(`📦 Spotify search (${label}) returned ${data.tracks.items.length} tracks`);

    return data.tracks.items
      .slice(0, safeLimit)
      .map(track => this._formatTrack(track));
  }

  /**
   * Normalize energy level to integer range 1-5.
   * @private
   */
  _normalizeEnergyLevel(energy) {
    const parsed = Number(energy);
    if (!Number.isFinite(parsed)) return 3;
    return Math.max(1, Math.min(5, Math.round(parsed)));
  }

  /**
   * Convert energy level to search-friendly text/genre bias.
   * Spotify Search doesn't support target_energy, so we bias terms instead.
   * @private
   */
  _getEnergySearchProfile(energyLevel) {
    if (energyLevel <= 2) {
      return {
        queryHint: 'calm',
        genres: ['ambient', 'new-age', 'piano']
      };
    }

    if (energyLevel >= 4) {
      return {
        queryHint: 'intense',
        genres: ['electronic', 'metal', 'classical']
      };
    }

    return {
      queryHint: 'atmospheric',
      genres: ['classical', 'ambient', 'new-age']
    };
  }

  /**
   * Post-filter and rank candidates.
   * @private
   */
  _filterAndSortTracks(tracks, limit, options = {}) {
    const instrumentalOnly = options.instrumentalOnly !== false;
    const avoidGameMusic = options.avoidGameMusic !== false;
    const lowVocalPreference = options.lowVocalPreference !== false;
    const preferEnglishMetadata = options.preferEnglishMetadata !== false;
    let candidateTracks = tracks.slice();

    if (instrumentalOnly) {
      candidateTracks = candidateTracks.filter(track => this._isLikelyInstrumental(track));
    }

    // Safety fallback: if heuristics are too strict, prefer returning playable music over silence.
    if (instrumentalOnly && candidateTracks.length === 0 && tracks.length > 0) {
      this._debugWarn('⚠️ Strict instrumental filter removed all Spotify candidates, using relaxed fallback.');
      candidateTracks = tracks.filter(track => !this._isLikelyVocalTrack(track));
      if (candidateTracks.length === 0) {
        candidateTracks = tracks.slice();
      }
    }

    const scoredTracks = candidateTracks.map((track) => ({
      track,
      score: this._scoreTrackForSelection(track, {
        instrumentalOnly,
        avoidGameMusic,
        lowVocalPreference,
        preferEnglishMetadata,
        preferredGenres: options.preferredGenres,
        targetMood: options.targetMood
      })
    }));

    scoredTracks.sort((a, b) => b.score - a.score);
    return scoredTracks.slice(0, limit).map(({ track }) => track);
  }

  /**
   * Rank tracks with emphasis on low-vocal, non-game tracks.
   * @private
   */
  _scoreTrackForSelection(track, options = {}) {
    const avoidGameMusic = options.avoidGameMusic !== false;
    const lowVocalPreference = options.lowVocalPreference !== false;
    const instrumentalOnly = options.instrumentalOnly !== false;
    const preferEnglishMetadata = options.preferEnglishMetadata !== false;
    let score = Number(track?.popularity || 0);
    const instrumentalness = Number(track?.instrumentalness);

    if (Number.isFinite(instrumentalness)) {
      score += instrumentalness * 35;
      if (lowVocalPreference && instrumentalness < 0.35) {
        score -= 18;
      }
      if (instrumentalOnly && instrumentalness < 0.5) {
        score -= 40;
      }
    } else if (this._isLikelyInstrumental(track)) {
      score += 14;
    } else if (lowVocalPreference && this._isLikelyVocalTrack(track)) {
      score -= 20;
    }

    if (avoidGameMusic && this._isLikelyGameTrack(track)) {
      score -= 30;
    }

    if (preferEnglishMetadata) {
      score += this._scoreLanguageAndMarketBias(track);
    }

    const targetMood = String(options.targetMood || '').toLowerCase().trim();
    if (targetMood) {
      score += this._scoreMoodAlignment(track, targetMood);
    }

    const preferredGenres = Array.isArray(options.preferredGenres)
      ? options.preferredGenres.map((genre) => String(genre || '').toLowerCase()).filter(Boolean)
      : [];
    const tags = Array.isArray(track?.tags)
      ? track.tags.map((tag) => String(tag || '').toLowerCase())
      : [];
    if (preferredGenres.length > 0 && tags.length > 0) {
      const genreHits = preferredGenres.reduce((count, genre) => {
        return count + (tags.some((tag) => tag.includes(genre)) ? 1 : 0);
      }, 0);
      score += Math.min(20, genreHits * 6);
    }

    return score;
  }

  /**
   * Bias away from heavily localized/non-English metadata to keep results broadly readable.
   * Helps avoid overfitting to account-country catalogs.
   * @private
   */
  _scoreLanguageAndMarketBias(track) {
    const title = String(track?.title || '');
    const artist = String(track?.artist || '');
    const combined = `${title} ${artist}`;
    const normalized = ` ${combined.toLowerCase()} `;
    let scoreDelta = 0;
    let nordicSignalCount = 0;

    // Norwegian/Nordic character hints.
    if (/[æøåäö]/i.test(combined)) {
      scoreDelta -= 24;
      nordicSignalCount += 1;
    }

    // Common Norwegian words/phrases in track metadata.
    const norwegianMarkers = [
      ' og ',
      ' ikke ',
      ' jeg ',
      ' deg ',
      ' kjærlighet ',
      ' hjerte ',
      ' natt ',
      ' norsk ',
      ' norge ',
      ' med deg ',
      ' for alltid ',
      ' jule ',
      ' jul ',
      ' sangen ',
      ' versjon ',
      ' musikk ',
      ' rolig '
    ];
    const norwegianHits = norwegianMarkers.reduce(
      (count, marker) => count + (normalized.includes(marker) ? 1 : 0),
      0
    );
    if (norwegianHits > 0) {
      nordicSignalCount += norwegianHits;
    }
    scoreDelta -= Math.min(42, norwegianHits * 12);

    // Catch common compound forms (e.g. "Julehjerte", "Pianomusikk")
    const norwegianFragments = [
      'jule',
      'hjerte',
      'sangen',
      'pianomusikk',
      'bakgrunnsmusikk',
      'avslappning',
      'avslapning',
      'rolig',
      'norsk',
      'norge'
    ];
    const fragmentHits = norwegianFragments.reduce(
      (count, fragment) => count + (normalized.includes(fragment) ? 1 : 0),
      0
    );
    if (fragmentHits > 0) {
      nordicSignalCount += fragmentHits;
      scoreDelta -= Math.min(28, fragmentHits * 8);
    }

    // Strong localized metadata should outweigh mood-match boosts.
    if (nordicSignalCount >= 2) {
      scoreDelta -= 22;
    }

    // Market availability bias.
    const markets = Array.isArray(track?.availableMarkets) ? track.availableMarkets : [];
    if (markets.length > 0) {
      if (markets.includes('US') || markets.includes('GB')) {
        scoreDelta += 4;
      } else {
        scoreDelta -= 6;
      }
    }

    // Slightly favor broadly-known tracks when metadata quality is similar.
    const popularity = Number(track?.popularity);
    if (Number.isFinite(popularity)) {
      if (popularity >= 45) {
        scoreDelta += 4;
      } else if (popularity <= 12) {
        scoreDelta -= 8;
      }
    }

    return scoreDelta;
  }

  /**
   * Heuristic vocal detection for low-vocal preference mode.
   * @private
   */
  _isLikelyVocalTrack(track) {
    const titleLower = track?.title?.toLowerCase() || '';
    const artistLower = track?.artist?.toLowerCase() || '';
    const combined = `${titleLower} ${artistLower}`;
    if (/\b(feat\.?|ft\.?|featuring|vocals?|singer|lyrics?)\b/.test(combined)) {
      return true;
    }
    const instrumentalness = Number(track?.instrumentalness);
    if (Number.isFinite(instrumentalness)) {
      return instrumentalness < 0.2;
    }
    return false;
  }

  /**
   * Heuristic for game-heavy tracks to down-rank unless explicitly requested.
   * @private
   */
  _isLikelyGameTrack(track) {
    const titleLower = track?.title?.toLowerCase() || '';
    const artistLower = track?.artist?.toLowerCase() || '';
    const combined = `${titleLower} ${artistLower}`;
    return /video game|game music|game soundtrack|chiptune|8-?bit|\bbgm\b|\bost\b/.test(combined);
  }

  /**
   * Search by mood/energy characteristics using Spotify Search API.
   * 
   * @param {string} mood - Chapter mood (e.g., 'tense', 'peaceful', 'epic')
   * @param {number} energy - Energy level 1-5
   * @param {Array<string>} keywords - Additional mood keywords
   * @param {number} limit - Max tracks to return
   * @param {Object} options - Query budget options
   * @returns {Promise<Array>} Array of track objects
   */
  async searchByMood(mood, energy, keywords = [], limit = this.maxSearchResultsPerRequest, options = {}) {
    // Default values for safety
    mood = mood || 'peaceful';
    energy = this._normalizeEnergyLevel(energy || 3);
    
    // Search API supports max 10 results per request.
    limit = Math.max(1, Math.min(this.maxSearchResultsPerRequest, Math.floor(limit) || this.maxSearchResultsPerRequest));
    
    // Keep text query mood-centric; use keywords as genre context only.
    const queryTerms = [mood];
    
    // Get settings
    const settings = this._getSettings();
    const instrumentalOnly = settings.instrumentalOnly !== false;
    const configuredMaxEnergy = settings.maxEnergyLevel;
    const maxEnergyLevel = configuredMaxEnergy !== undefined
      ? Math.max(1, Math.min(5, Math.round(configuredMaxEnergy)))
      : 5;
    const effectiveEnergy = Math.min(energy, maxEnergyLevel);
    
    this._debugLog(
      `🔍 Spotify Search: mood="${mood}", energy=${effectiveEnergy}${effectiveEnergy !== energy ? ` (capped from ${energy})` : ''}, genre-context=[${keywords.slice(0, 3).join(', ')}]`
    );
    
    return await this.searchByQuery(queryTerms, limit, {
      mood,
      energy: effectiveEnergy,
      keywords,
      instrumentalOnly,
      maxBaseQueries: options.maxBaseQueries,
      maxFallbackQueries: options.maxFallbackQueries
    });
  }

  /**
   * Resolve a single Spotify track by exact Spotify track ID.
   * @param {string} trackId
   * @param {Object} options
   * @returns {Promise<Object|null>}
   */
  async getTrackById(trackId, options = {}) {
    const results = await this.getTracksByIds([trackId], options);
    return results[0] || null;
  }

  /**
   * Resolve multiple Spotify tracks by ID while preserving requested order.
   * @param {Array<string>} trackIds
   * @param {Object} options
   * @returns {Promise<Array<Object>>}
   */
  async getTracksByIds(trackIds, options = {}) {
    if (!await this.isConfigured()) {
      this._debugWarn('⚠️ Spotify not authenticated');
      return [];
    }

    const normalizedIds = [...new Set(
      (Array.isArray(trackIds) ? trackIds : [])
        .map((id) => String(id || '').trim())
        .filter((id) => /^[A-Za-z0-9]{10,32}$/.test(id))
    )];

    if (normalizedIds.length === 0) {
      return [];
    }

    const market = typeof options.market === 'string'
      ? options.market
      : this._getPreferredSearchMarket(this._getSettings());

    // Spotify supports up to 50 IDs per request.
    const idsChunk = normalizedIds.slice(0, 50);
    const params = new URLSearchParams({
      ids: idsChunk.join(',')
    });
    if (market) {
      params.set('market', market);
    }

    const endpoint = `/tracks?${params.toString()}`;
    const data = await this._makeRequest(endpoint);
    const rawTracks = Array.isArray(data?.tracks) ? data.tracks : [];
    const formatted = rawTracks
      .filter(Boolean)
      .map((track) => this._formatTrack(track));

    const byId = new Map(formatted.map((track) => [track.id, track]));
    return idsChunk
      .map((id) => byId.get(id))
      .filter(Boolean);
  }

  /**
   * Resolve track using exact title + artist query fields.
   * Useful when external services provide metadata but not Spotify IDs.
   * @param {string} title
   * @param {string} artist
   * @param {Object} options
   * @returns {Promise<Object|null>}
   */
  async searchTrackByTitleArtist(title, artist, options = {}) {
    if (!await this.isConfigured()) {
      this._debugWarn('⚠️ Spotify not authenticated');
      return null;
    }

    const cleanTitle = String(title || '').trim();
    const cleanArtist = String(artist || '').trim();
    if (!cleanTitle || !cleanArtist) {
      return null;
    }

    const market = typeof options.market === 'string'
      ? options.market
      : this._getPreferredSearchMarket(this._getSettings());

    const query = `track:"${cleanTitle}" artist:"${cleanArtist}"`;
    const matches = await this._searchTracksByQueryString(
      query,
      1,
      'resolve-title-artist',
      { market }
    );

    return matches[0] || null;
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
      'original score', 'film score', 'movie score',
      'ambient', 'piano solo', 'guitar solo',
      'classical', 'concerto', 'sonata', 'prelude',
      'trailer', 'cinematic', 'epic music', 'dramatic music',
      'background music',
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
      'orchestral', 'post-rock', 'downtempo',
      'cinematic', 'trailer', 'new-age'
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
    this._debugLog(`🚫 Filtered likely vocal track: "${track.title}" by ${track.artist}`);
    return false;
  }

  /**
   * Make authenticated request to Spotify API
   * @private
   */
  async _makeRequest(endpoint, method = 'GET', body = null, requestOptions = {}) {
    const suppressStatusErrors = Array.isArray(requestOptions?.suppressStatusErrors)
      ? requestOptions.suppressStatusErrors
      : [];

    // Check rate limit
    const now = Date.now();
    if (now < this.rateLimitedUntil) {
      const retryAfterSeconds = Math.max(1, Math.ceil((this.rateLimitedUntil - now) / 1000));
      const error = this._createRateLimitError(retryAfterSeconds, 'cooldown');
      error.rateLimitedUntil = this.rateLimitedUntil;
      throw error;
    }

    // Enforce minimum interval between requests
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.minRequestInterval) {
      const delay = this.minRequestInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    // Get access token (will auto-refresh if expired)
    const token = await this.auth.getAccessToken();
    const normalizedToken = String(token || '').trim();
    if (!normalizedToken || normalizedToken === 'null' || normalizedToken === 'undefined') {
      throw this._createAuthError('No Spotify access token available. Please authenticate.');
    }

    const url = `${this.baseURL}${endpoint}`;
    const fetchOptions = {
      method,
      headers: {
        'Authorization': `Bearer ${normalizedToken}`,
        'Content-Type': 'application/json'
      }
    };

    if (body) {
      fetchOptions.body = JSON.stringify(body);
    }

    this.lastRequestTime = Date.now();

    try {
      const response = await fetch(url, fetchOptions);

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
        this.rateLimitedUntil = Date.now() + (retryAfter * 1000);
        const error = this._createRateLimitError(retryAfter, 'response');
        error.rateLimitedUntil = this.rateLimitedUntil;
        throw error;
      }

      // Handle authentication errors
      if (response.status === 401) {
        const authPayload = await response.json().catch(() => ({}));
        const authMessage = authPayload?.error?.message || authPayload?.error || 'Unauthorized';

        if (requestOptions?._hasRetried401) {
          const authError = this._createAuthError(`Spotify authorization failed: ${authMessage}`);
          authError.status = 401;
          throw authError;
        }

        console.warn('⚠️ Spotify token invalid, attempting refresh...');
        await this.auth.refreshAccessToken();
        return await this._makeRequest(endpoint, method, body, {
          ...requestOptions,
          _hasRetried401: true
        });
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        const errorMessage = error.error?.message || error.error || response.statusText || 'Unknown Spotify API error';

        if (suppressStatusErrors.includes(response.status)) {
          this._debugWarn(`⚠️ Spotify optional endpoint unavailable (${response.status}): ${errorMessage}`);
          return null;
        }

        console.error('❌ Spotify API Error Response:', {
          status: response.status,
          statusText: response.statusText,
          error: error,
          url: url
        });
        throw new Error(`Spotify API error: ${errorMessage}`);
      }

      // Handle empty responses (e.g., from DELETE requests)
      if (response.status === 204) {
        return { success: true };
      }

      return await response.json();
    } catch (error) {
      if (this._isRateLimitError(error)) {
        const rateLimitedUntil = Number(error?.rateLimitedUntil || this.rateLimitedUntil || 0);
        if (rateLimitedUntil > this._lastRateLimitLogUntil) {
          const retryAfterSeconds = Math.max(1, Math.ceil((rateLimitedUntil - Date.now()) / 1000));
          console.warn(`⏳ Spotify API rate-limited. Pausing requests for ~${retryAfterSeconds}s.`);
          this._lastRateLimitLogUntil = rateLimitedUntil;
        }
        throw error;
      }

      if (this._isAuthError(error)) {
        this._debugWarn(`⚠️ Spotify auth request blocked: ${error.message}`);
        throw error;
      }

      console.error('❌ Spotify API request failed:', error);
      throw error;
    }
  }
}
