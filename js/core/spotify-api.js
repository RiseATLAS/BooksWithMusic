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
    
    // Rate limiting
    this.lastRequestTime = 0;
    this.minRequestInterval = 100; // 100ms between requests
    this.rateLimitedUntil = 0;
    
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
   * Defaults to US to avoid over-localized catalog bias from account country.
   * Set `spotifySearchMarket` to `AUTO` in settings to let Spotify decide.
   * @private
   */
  _getPreferredSearchMarket(settings = null) {
    const effectiveSettings = settings || this._getSettings();
    const rawMarket = String(
      effectiveSettings.spotifySearchMarket ||
      'US'
    )
      .trim()
      .toUpperCase();

    if (rawMarket === 'AUTO') {
      // Keep US as default unless user explicitly opts into locale-driven catalogs.
      return effectiveSettings.spotifyUseAutoMarket === true ? '' : 'US';
    }

    return /^[A-Z]{2}$/.test(rawMarket) ? rawMarket : 'US';
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

    return await this.searchByQuery([moodTerm], Math.min(20, limit), {
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
    const safeLimit = Math.max(1, Math.min(20, Math.floor(limit) || 10));
    const market = this._getPreferredSearchMarket(this._getSettings());
    
    if (instrumentalOnly) {
      searchQuery += ' genre:instrumental OR genre:ambient OR genre:classical';
    }

    const params = new URLSearchParams({
      q: searchQuery,
      type: 'track'
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
   * @param {number} limit - Number of results (1-50, default 15)
   * @param {Object} options - Additional context (mood, energy, keywords)
   * @returns {Array} Array of track objects
   */
  async searchByQuery(queryTerms, limit = 15, options = {}) {
    if (!await this.isConfigured()) {
      this._debugWarn('⚠️ Spotify not authenticated');
      return [];
    }

    // Clamp to a conservative per-request window to keep response size predictable.
    // We fan out across multiple focused queries below for diversity.
    limit = Math.max(1, Math.min(20, Math.floor(limit) || 15));

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

      const baseQueries = queryPlans.map((plan) => ({
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
        const tracks = await this._searchTracksByQueryString(
          query,
          i === 0 ? Math.max(limit, 10) : Math.max(6, Math.min(10, limit)),
          label,
          { market: preferredSearchMarket }
        );
        addTracks(tracks);

        const provisional = this._filterAndSortTracks(Array.from(collectedTracks.values()), limit, {
          instrumentalOnly,
          avoidGameMusic,
          lowVocalPreference: true,
          preferredGenres: candidateGenres
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

        for (let i = 0; i < fallbackQueries.length; i++) {
          const query = fallbackQueries[i];
          const tracks = await this._searchTracksByQueryString(
            query,
            i === 0 ? Math.max(limit, 10) : Math.max(6, Math.min(10, limit)),
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
        preferredGenres: candidateGenres
      });
      const selectionLabel = instrumentalOnly ? 'low-vocal tracks' : 'tracks';

      this._debugLog(
        `✅ Spotify candidate pool: ${allTracks.length} tracks, returning ${filteredTracks.length} ${selectionLabel} (mood=${effectiveMood}, energy=${effectiveEnergy}, avoidGameMusic=${avoidGameMusic})`
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
  async _searchTracksByQueryString(searchQuery, limit, label = 'query', options = {}) {
    const safeLimit = Math.max(1, Math.min(20, Math.floor(limit) || 10));
    const market = typeof options.market === 'string'
      ? options.market
      : this._getPreferredSearchMarket(this._getSettings());
    const params = new URLSearchParams({
      q: searchQuery,
      type: 'track'
    });
    if (market) {
      params.set('market', market);
    }
    const endpoint = `/search?${params.toString()}`;

    this._debugLog(
      `🔍 Spotify search (${label}): "${searchQuery}" (market=${market || 'AUTO'}, api limit=default, client limit=${safeLimit})`
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
        preferredGenres: options.preferredGenres
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
      score += this._scoreLanguageAndMarketBias(track, { instrumentalness });
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
  _scoreLanguageAndMarketBias(track, options = {}) {
    const title = String(track?.title || '');
    const artist = String(track?.artist || '');
    const combined = `${title} ${artist}`;
    const normalized = ` ${combined.toLowerCase()} `;
    let scoreDelta = 0;

    // Norwegian/Nordic character hints.
    if (/[æøåäö]/i.test(combined)) {
      scoreDelta -= 14;
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
      ' for alltid '
    ];
    const norwegianHits = norwegianMarkers.reduce(
      (count, marker) => count + (normalized.includes(marker) ? 1 : 0),
      0
    );
    scoreDelta -= Math.min(24, norwegianHits * 8);

    // Market availability bias.
    const markets = Array.isArray(track?.availableMarkets) ? track.availableMarkets : [];
    if (markets.length > 0) {
      if (markets.includes('US') || markets.includes('GB')) {
        scoreDelta += 4;
      } else {
        scoreDelta -= 6;
      }
    }

    // If a track is highly instrumental, language matters less.
    const instrumentalness = Number(options.instrumentalness ?? track?.instrumentalness);
    if (Number.isFinite(instrumentalness) && instrumentalness >= 0.8 && scoreDelta < 0) {
      scoreDelta = Math.round(scoreDelta * 0.5);
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
   * @returns {Promise<Array>} Array of track objects
   */
  async searchByMood(mood, energy, keywords = [], limit = 20) {
    // Default values for safety
    mood = mood || 'peaceful';
    energy = this._normalizeEnergyLevel(energy || 3);
    
    // Search API supports max 20 results (reduced from 50 as of Feb 2026)
    limit = Math.max(1, Math.min(20, Math.floor(limit) || 20));
    
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
      instrumentalOnly
    });
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
    const fetchOptions = {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
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
      console.error('❌ Spotify API request failed:', error);
      throw error;
    }
  }
}
