/**
 * LastFmAPI - Last.fm metadata discovery for Spotify track matching.
 *
 * RESPONSIBILITIES:
 * - Query Last.fm top tracks by tag + fallback text search
 * - Rank candidates with weighted mood keywords
 * - Normalize auth/rate-limit errors for manager retry handling
 */
export class LastFmAPI {
  constructor() {
    this.baseURL = 'https://ws.audioscrobbler.com/2.0/';
    this.lastRequestTime = 0;
    this.minRequestInterval = 220;
    this.rateLimitedUntil = 0;
    this._lastRateLimitLogUntil = 0;
  }

  _getSettings() {
    try {
      return JSON.parse(localStorage.getItem('booksWithMusic-settings') || '{}');
    } catch (_) {
      return {};
    }
  }

  _getApiKey() {
    const settings = this._getSettings();
    const fromSettings = String(settings.lastfmApiKey || '').trim();
    const fromStorage = String(localStorage.getItem('lastfm_api_key') || '').trim();
    const key = fromSettings || fromStorage;

    if (!key || key === 'null' || key === 'undefined') {
      return '';
    }

    return key;
  }

  isConfigured() {
    return this._getApiKey().length > 0;
  }

  _createRateLimitError(retryAfterSeconds = 30, source = 'response') {
    const safeSeconds = Math.max(1, Math.ceil(Number(retryAfterSeconds) || 30));
    const retryAfterMs = safeSeconds * 1000;
    const error = new Error(`Last.fm API rate limit reached. Retry after ${safeSeconds} seconds.`);
    error.code = 'LASTFM_RATE_LIMIT';
    error.source = source;
    error.retryAfterSeconds = safeSeconds;
    error.retryAfterMs = retryAfterMs;
    error.rateLimitedUntil = Date.now() + retryAfterMs;
    return error;
  }

  _createAuthError(message) {
    const error = new Error(message || 'Last.fm API key unavailable.');
    error.code = 'LASTFM_AUTH';
    return error;
  }

  _isRateLimitError(error) {
    return error?.code === 'LASTFM_RATE_LIMIT' ||
      /rate limit|too many requests|429/i.test(String(error?.message || ''));
  }

  _isAuthError(error) {
    const message = String(error?.message || '').toLowerCase();
    return error?.code === 'LASTFM_AUTH' ||
      message.includes('invalid api key') ||
      message.includes('authentication') ||
      message.includes('no last.fm api key') ||
      message.includes('no lastfm api key');
  }

  _normalizeKeywordEntry(entry) {
    if (!entry) return null;

    if (typeof entry === 'string') {
      const keyword = entry.trim().toLowerCase();
      if (!keyword) return null;
      return { keyword, weight: 0.5 };
    }

    const keyword = String(entry.keyword || '').trim().toLowerCase();
    if (!keyword) return null;

    const weightRaw = Number(entry.weight);
    const weight = Number.isFinite(weightRaw) ? Math.max(-1, Math.min(1, weightRaw)) : 0.5;

    return { keyword, weight };
  }

  _buildTagQueries(positiveKeywords, mood = 'peaceful', options = {}) {
    const defaultTagsByMood = {
      dark: ['dark ambient', 'gothic', 'atmospheric', 'instrumental'],
      mysterious: ['mystical', 'ambient', 'cinematic', 'instrumental'],
      romantic: ['romantic', 'piano', 'soft', 'instrumental'],
      sad: ['sad', 'melancholic', 'piano', 'instrumental'],
      epic: ['epic', 'cinematic', 'orchestral', 'instrumental'],
      peaceful: ['ambient', 'calm', 'peaceful', 'instrumental'],
      tense: ['suspense', 'dark ambient', 'cinematic', 'instrumental'],
      joyful: ['uplifting', 'happy', 'acoustic', 'instrumental'],
      adventure: ['adventure', 'orchestral', 'cinematic', 'instrumental'],
      magical: ['fantasy', 'ethereal', 'ambient', 'instrumental']
    };

    const result = [];
    const instrumentalOnly = options.instrumentalOnly !== false;
    const fromMood = String(options.fromMood || '').toLowerCase().trim();
    const energy = Math.max(1, Math.min(5, Math.round(Number(options.energy) || 3)));
    const add = (tag, weight = 0.6) => {
      const normalized = String(tag || '').toLowerCase().trim().replace(/\s+/g, ' ');
      if (!normalized || normalized.length < 2) return;
      if (result.some((item) => item.tag === normalized)) return;
      result.push({ tag: normalized, weight: Math.max(0.05, Math.min(1, Number(weight) || 0.6)) });
    };

    if (instrumentalOnly) {
      add(`${mood} instrumental`, 1);
      add('instrumental', 0.98);
      add(energy >= 4 ? 'orchestral' : 'ambient', 0.86);
      if (energy <= 2) {
        add('calm ambient', 0.8);
      } else if (energy >= 4) {
        add('dramatic orchestral', 0.8);
      } else {
        add('atmospheric', 0.74);
      }
      if (fromMood && fromMood !== mood) {
        add(`${fromMood} ${mood}`, 0.46);
        add(fromMood, 0.34);
      }
      add(mood, 0.5);
    } else {
      add(mood, 1);
    }

    (defaultTagsByMood[mood] || defaultTagsByMood.peaceful).forEach((tag, index) => {
      add(tag, Math.max(0.4, 0.9 - (index * 0.12)));
    });

    positiveKeywords
      .filter((item) => item.keyword.length >= 3)
      .slice(0, 8)
      .forEach((item, index) => {
        if (instrumentalOnly && /\b(vocal|lyrics?|singer|songwriter|spoken word|podcast)\b/i.test(item.keyword)) {
          return;
        }
        const dynamicWeight = Math.max(0.25, Math.min(0.82, Math.abs(Number(item.weight) || 0.5)));
        add(item.keyword, Math.max(0.24, dynamicWeight - (index * 0.04)));
      });

    return result
      .sort((a, b) => b.weight - a.weight)
      .slice(0, instrumentalOnly ? 5 : 4);
  }

  _mergeCandidate(map, candidate) {
    const name = String(candidate?.title || '').trim();
    const artist = String(candidate?.artist || '').trim();
    if (!name || !artist) return;

    const key = `${name.toLowerCase()}|${artist.toLowerCase()}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        title: name,
        artist,
        baseScore: Number(candidate.baseScore) || 0,
        listeners: Number(candidate.listeners) || 0,
        reference: candidate.reference || '',
        matchedTags: new Set(candidate.matchedTags || [])
      });
      return;
    }

    existing.baseScore = Math.max(existing.baseScore, Number(candidate.baseScore) || 0);
    existing.listeners = Math.max(existing.listeners, Number(candidate.listeners) || 0);
    if (candidate.reference && !existing.reference) {
      existing.reference = candidate.reference;
    }
    (candidate.matchedTags || []).forEach((tag) => existing.matchedTags.add(tag));
  }

  _extractTopTracks(payload) {
    const tracks = payload?.tracks?.track;
    if (!tracks) return [];
    return Array.isArray(tracks) ? tracks : [tracks];
  }

  _extractSearchTracks(payload) {
    const tracks = payload?.results?.trackmatches?.track;
    if (!tracks) return [];
    return Array.isArray(tracks) ? tracks : [tracks];
  }

  _hasInstrumentalSignal(candidate) {
    const title = String(candidate?.title || '').toLowerCase();
    const artist = String(candidate?.artist || '').toLowerCase();
    const matchedTags = Array.isArray(candidate?.matchedTags)
      ? candidate.matchedTags.map((tag) => String(tag || '').toLowerCase())
      : [];
    const combined = `${title} ${artist} ${matchedTags.join(' ')}`;
    return /\b(instrumental|ambient|orchestral|piano|soundtrack|score|cinematic|classical|new age|lofi|meditation|sleep)\b/i.test(combined);
  }

  _hasStrongVocalSignal(candidate) {
    const title = String(candidate?.title || '').toLowerCase();
    const artist = String(candidate?.artist || '').toLowerCase();
    const combined = `${title} ${artist}`;
    return /\b(vocal|lyrics?|feat\.?|ft\.?|featuring|singer|songwriter|acapella|a cappella|live version|radio edit|cover)\b/i.test(combined);
  }

  _isInstrumentalFriendlyCandidate(candidate) {
    if (!candidate) return false;
    if (this._hasStrongVocalSignal(candidate)) return false;
    return this._hasInstrumentalSignal(candidate);
  }

  _scoreCandidate(candidate, positiveKeywords, negativeKeywords, options = {}) {
    let score = Number(candidate.baseScore) || 0;
    const matchedTags = Array.isArray(candidate?.matchedTags) ? candidate.matchedTags : [];
    const text = `${candidate.title} ${candidate.artist} ${matchedTags.join(' ')}`.toLowerCase();
    const mood = String(options.mood || '').toLowerCase().trim();
    const instrumentalOnly = options.instrumentalOnly !== false;
    const preferCinematicScores = options.preferCinematicScores === true;
    const hasInstrumentalSignal = this._hasInstrumentalSignal(candidate);
    const hasStrongVocalSignal = this._hasStrongVocalSignal(candidate);

    for (const entry of positiveKeywords) {
      if (text.includes(entry.keyword)) {
        score += 0.2 * Math.abs(entry.weight || 0.2);
      }
    }

    for (const entry of negativeKeywords) {
      if (text.includes(entry.keyword)) {
        score -= 0.35 * Math.abs(entry.weight || 0.2);
      }
    }

    if (mood && text.includes(mood)) {
      score += 0.22;
    }

    if (instrumentalOnly) {
      const instrumentalHint = /(instrumental|ambient|orchestral|piano|soundtrack|score|no vocals|cinematic)/i;
      const vocalHint = /(vocal|lyrics|feat\.| ft\.|karaoke|singer|songwriter|acapella|a cappella)/i;
      if (instrumentalHint.test(text)) {
        score += 0.35;
      }
      if (vocalHint.test(text)) {
        score -= 0.8;
      }
      if (!hasInstrumentalSignal) {
        score -= 0.4;
      }
      if (hasStrongVocalSignal) {
        score -= 0.45;
      }
    }

    if (!preferCinematicScores) {
      const gameHint = /(video game|game music|chiptune|\bost\b|\bbgm\b)/i;
      if (gameHint.test(text)) {
        score -= 0.45;
      }
    }

    if (candidate.listeners > 0) {
      score += Math.min(0.25, Math.log10(candidate.listeners + 1) / 20);
    }

    return score;
  }

  async searchTracksByKeywords(keywordWeights, limit = 10, options = {}) {
    if (!this.isConfigured()) {
      throw this._createAuthError('No Last.fm API key available. Add it in Music Settings > Music API.');
    }

    const normalizedKeywords = (Array.isArray(keywordWeights) ? keywordWeights : [])
      .map((entry) => this._normalizeKeywordEntry(entry))
      .filter(Boolean)
      .slice(0, 12);

    if (normalizedKeywords.length === 0) {
      return [];
    }

    const safeLimit = Math.max(1, Math.min(20, Math.floor(limit) || 10));
    const positiveKeywords = normalizedKeywords
      .filter((entry) => entry.weight >= 0)
      .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
    const negativeKeywords = normalizedKeywords
      .filter((entry) => entry.weight < 0)
      .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));

    const mood = String(options.mood || positiveKeywords[0]?.keyword || 'peaceful').toLowerCase();
    const tags = this._buildTagQueries(positiveKeywords, mood, {
      instrumentalOnly: options.instrumentalOnly,
      fromMood: options.fromMood,
      energy: options.energy
    });
    const perTagLimit = Math.max(6, Math.min(18, Math.ceil((safeLimit * 2) / Math.max(1, tags.length)) + 1));
    const contextLabel = String(options.contextLabel || 'default');
    const positivePreview = positiveKeywords
      .slice(0, 6)
      .map((entry) => `${entry.keyword}:${Math.abs(entry.weight).toFixed(2)}`)
      .join(', ');
    const negativePreview = negativeKeywords
      .slice(0, 4)
      .map((entry) => `${entry.keyword}:${Math.abs(entry.weight).toFixed(2)}`)
      .join(', ');
    const weightedTagPreview = tags
      .map((item) => `${item.tag}:${item.weight.toFixed(2)}`)
      .join(', ');

    const profileEnergy = Math.max(1, Math.min(5, Math.round(Number(options.energy) || 3)));

    console.info(
      `🧭 Last.fm plan [${contextLabel}] mood=${mood} from=${String(options.fromMood || 'n/a')} ` +
      `energy=${profileEnergy}/5 ` +
      `instrumentalOnly=${options.instrumentalOnly !== false} ` +
      `positive=[${positivePreview}] negative=[${negativePreview || 'none'}]`
    );

    console.info(
      `🔎 Last.fm query [${contextLabel}] tags=[${weightedTagPreview}] ` +
      `(perTagLimit=${perTagLimit})`
    );

    const candidateMap = new Map();

    for (let tagIndex = 0; tagIndex < tags.length; tagIndex += 1) {
      const tagEntry = tags[tagIndex];
      const payload = await this._makeRequest('tag.gettoptracks', {
        tag: tagEntry.tag,
        limit: perTagLimit,
        page: 1
      });
      const tracks = this._extractTopTracks(payload);
      tracks.forEach((track, rankIndex) => {
        this._mergeCandidate(candidateMap, {
          title: track?.name,
          artist: track?.artist?.name || track?.artist,
          listeners: Number(track?.listeners) || 0,
          reference: track?.url || '',
          matchedTags: [tagEntry.tag],
          baseScore:
            (tagEntry.weight * 1.3) +
            Math.max(0.15, 1 - (rankIndex / Math.max(1, perTagLimit)))
        });
      });
    }

    if (candidateMap.size < safeLimit) {
      const queryTerms = positiveKeywords
        .map((item) => item.keyword)
        .filter((term) => term.length >= 3)
        .slice(0, 4);

      if (queryTerms.length > 0) {
        const searchQuery = queryTerms.join(' ');
        const payload = await this._makeRequest('track.search', {
          track: searchQuery,
          limit: Math.max(20, safeLimit * 3),
          page: 1
        });
        const tracks = this._extractSearchTracks(payload);
        tracks.forEach((track, rankIndex) => {
          this._mergeCandidate(candidateMap, {
            title: track?.name,
            artist: track?.artist,
            listeners: Number(track?.listeners) || 0,
            reference: track?.url || '',
            matchedTags: [],
            baseScore: Math.max(0.08, 0.9 - (rankIndex * 0.035))
          });
        });
      }
    }

    let candidates = [...candidateMap.values()]
      .map((candidate) => {
        const confidence = this._scoreCandidate(candidate, positiveKeywords, negativeKeywords, {
          mood,
          instrumentalOnly: options.instrumentalOnly,
          preferCinematicScores: options.preferCinematicScores
        });
        return {
          title: candidate.title,
          artist: candidate.artist,
          source: 'lastfm',
          confidence,
          reference: candidate.reference,
          matchedTags: [...candidate.matchedTags]
        };
      })
      .sort((a, b) => b.confidence - a.confidence);

    if (options.instrumentalOnly !== false) {
      const strictCandidates = candidates.filter((candidate) => this._isInstrumentalFriendlyCandidate(candidate));
      if (strictCandidates.length >= Math.min(3, safeLimit)) {
        candidates = strictCandidates;
      }
    }

    candidates = candidates.slice(0, safeLimit);

    console.info(`✅ Last.fm returned ${candidates.length} candidate(s) [${contextLabel}]`);
    return candidates;
  }

  async _makeRequest(method, params = {}) {
    const now = Date.now();

    if (now < this.rateLimitedUntil) {
      const retryAfterSeconds = Math.max(1, Math.ceil((this.rateLimitedUntil - now) / 1000));
      const error = this._createRateLimitError(retryAfterSeconds, 'cooldown');
      error.rateLimitedUntil = this.rateLimitedUntil;
      throw error;
    }

    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minRequestInterval) {
      await new Promise((resolve) => setTimeout(resolve, this.minRequestInterval - elapsed));
    }

    const apiKey = this._getApiKey();
    if (!apiKey) {
      throw this._createAuthError('No Last.fm API key available.');
    }

    this.lastRequestTime = Date.now();
    const query = new URLSearchParams({
      method,
      api_key: apiKey,
      format: 'json',
      autocorrect: '1',
      ...Object.fromEntries(
        Object.entries(params).map(([key, value]) => [key, String(value)])
      )
    });

    try {
      const response = await fetch(`${this.baseURL}?${query.toString()}`);
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '30', 10);
        const safeRetryAfter = Number.isFinite(retryAfter) ? retryAfter : 30;
        this.rateLimitedUntil = Date.now() + (safeRetryAfter * 1000);
        const error = this._createRateLimitError(safeRetryAfter, 'response');
        error.rateLimitedUntil = this.rateLimitedUntil;
        throw error;
      }

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          payload?.message ||
          payload?.error?.message ||
          payload?.error ||
          response.statusText ||
          `HTTP ${response.status}`;
        throw new Error(`Last.fm API error: ${message}`);
      }

      if (payload?.error) {
        const code = Number(payload.error);
        const message = String(payload.message || 'Unknown Last.fm error');
        if (code === 29 || /rate limit/i.test(message)) {
          throw this._createRateLimitError(30, 'payload');
        }
        if (code === 4 || code === 10 || code === 26 || /api key|auth/i.test(message)) {
          throw this._createAuthError(`Last.fm auth error: ${message}`);
        }
        throw new Error(`Last.fm error (${payload.error}): ${message}`);
      }

      return payload || {};
    } catch (error) {
      if (this._isRateLimitError(error)) {
        const rateLimitedUntil = Number(error?.rateLimitedUntil || this.rateLimitedUntil || 0);
        if (rateLimitedUntil > this._lastRateLimitLogUntil) {
          const retryAfterSeconds = Math.max(1, Math.ceil((rateLimitedUntil - Date.now()) / 1000));
          console.warn(`⏳ Last.fm API rate-limited. Pausing requests for ~${retryAfterSeconds}s.`);
          this._lastRateLimitLogUntil = rateLimitedUntil;
        }
        throw error;
      }

      if (this._isAuthError(error)) {
        console.error(`❌ Last.fm auth error: ${error.message}`);
        throw error;
      }

      console.error('❌ Last.fm API request failed:', error);
      throw error;
    }
  }
}
