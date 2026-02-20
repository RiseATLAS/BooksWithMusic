/**
 * CyaniteAPI - Cyanite keyword-based discovery for Spotify track candidates.
 *
 * RESPONSIBILITIES:
 * - Query Cyanite keyword search with weighted mood/profile keywords
 * - Return ranked Spotify track candidates (id + title)
 * - Normalize auth/rate-limit errors for higher-level retry logic
 *
 * AUTH:
 * - Reads token from localStorage `cyanite_access_token`
 * - Optionally also supports `booksWithMusic-settings.cyaniteAccessToken`
 */
export class CyaniteAPI {
  constructor() {
    this.baseURL = 'https://api.cyanite.ai/graphql';
    this.lastRequestTime = 0;
    this.minRequestInterval = 125;
    this.rateLimitedUntil = 0;
    this._lastRateLimitLogUntil = 0;
  }

  /**
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
   * @private
   */
  _getAccessToken() {
    const settings = this._getSettings();
    const fromSettings = String(settings.cyaniteAccessToken || '').trim();
    const fromStorage = String(localStorage.getItem('cyanite_access_token') || '').trim();
    const token = fromSettings || fromStorage;

    if (!token || token === 'null' || token === 'undefined') {
      return '';
    }

    return token;
  }

  /**
   * Check whether Cyanite token is available.
   */
  isConfigured() {
    return this._getAccessToken().length > 0;
  }

  /**
   * @private
   */
  _createRateLimitError(retryAfterSeconds = 60, source = 'response') {
    const safeSeconds = Math.max(1, Math.ceil(Number(retryAfterSeconds) || 60));
    const retryAfterMs = safeSeconds * 1000;
    const error = new Error(`Cyanite API rate limit reached. Retry after ${safeSeconds} seconds.`);
    error.code = 'CYANITE_RATE_LIMIT';
    error.source = source;
    error.retryAfterSeconds = safeSeconds;
    error.retryAfterMs = retryAfterMs;
    error.rateLimitedUntil = Date.now() + retryAfterMs;
    return error;
  }

  /**
   * @private
   */
  _createAuthError(message) {
    const error = new Error(message || 'Cyanite authentication unavailable.');
    error.code = 'CYANITE_AUTH';
    return error;
  }

  /**
   * @private
   */
  _isRateLimitError(error) {
    return error?.code === 'CYANITE_RATE_LIMIT' ||
      /rate limit|too many requests|429/i.test(String(error?.message || ''));
  }

  /**
   * @private
   */
  _isAuthError(error) {
    const message = String(error?.message || '').toLowerCase();
    return error?.code === 'CYANITE_AUTH' ||
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      message.includes('invalid token') ||
      message.includes('no token');
  }

  /**
   * @private
   */
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

  /**
   * Search Cyanite for Spotify candidates using weighted keywords.
   *
   * @param {Array<{keyword:string, weight:number}>} keywordWeights
   * @param {number} limit
   * @param {Object} options
   * @returns {Promise<Array<{id:string,title:string,source:string,confidence:number|null}>>}
   */
  async searchSpotifyTracksByKeywords(keywordWeights, limit = 10, options = {}) {
    if (!this.isConfigured()) {
      throw this._createAuthError('Cyanite access token missing. Add it in Music API settings.');
    }

    const normalizedKeywords = (Array.isArray(keywordWeights) ? keywordWeights : [])
      .map((entry) => this._normalizeKeywordEntry(entry))
      .filter(Boolean)
      .slice(0, 12);

    if (normalizedKeywords.length === 0) {
      return [];
    }

    const safeLimit = Math.max(1, Math.min(25, Math.floor(limit) || 10));
    const contextLabel = String(options.contextLabel || 'default');
    const queryPreview = normalizedKeywords
      .map((item) => `${item.keyword}:${item.weight.toFixed(2)}`)
      .join(', ');

    console.info(
      `🧠 Cyanite keyword query [${contextLabel}] keywords=[${queryPreview}] limit=${safeLimit}`
    );

    const query = `
      query CyaniteKeywordSearch(
        $target: KeywordSearchTarget!
        $keywords: [KeywordSearchKeyword!]!
        $first: Int!
      ) {
        keywordSearch(target: $target, keywords: $keywords, first: $first) {
          ... on KeywordSearchError {
            code
            message
          }
          ... on KeywordSearchConnection {
            edges {
              score
              node {
                id
                title
              }
            }
          }
        }
      }
    `;

    const payload = await this._makeRequest(query, {
      target: { spotify: {} },
      keywords: normalizedKeywords,
      first: safeLimit
    });

    const result = payload?.data?.keywordSearch;
    if (!result) {
      return [];
    }

    if (typeof result.code === 'string' && result.message) {
      const message = `Cyanite keywordSearch error (${result.code}): ${result.message}`;
      if (/auth|forbidden|token|unauthor/i.test(message)) {
        throw this._createAuthError(message);
      }
      if (/rate|429|limit/i.test(message)) {
        throw this._createRateLimitError(60, 'graphql');
      }
      throw new Error(message);
    }

    const edges = Array.isArray(result.edges) ? result.edges : [];
    const candidates = [];
    const seenIds = new Set();

    for (const edge of edges) {
      const node = edge?.node || edge?.track || edge?.result?.node;
      const id = String(node?.id || '').trim();
      if (!id || seenIds.has(id)) continue;

      seenIds.add(id);
      const scoreRaw = Number(edge?.score);
      candidates.push({
        id,
        title: String(node?.title || '').trim(),
        source: 'cyanite',
        confidence: Number.isFinite(scoreRaw) ? scoreRaw : null
      });

      if (candidates.length >= safeLimit) {
        break;
      }
    }

    console.info(`✅ Cyanite returned ${candidates.length} Spotify candidate(s) [${contextLabel}]`);
    return candidates;
  }

  /**
   * Execute GraphQL request with auth + rate-limit handling.
   * @private
   */
  async _makeRequest(query, variables = {}) {
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

    const token = this._getAccessToken();
    if (!token) {
      throw this._createAuthError('No Cyanite access token available.');
    }

    this.lastRequestTime = Date.now();

    try {
      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query, variables })
      });

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
        const safeRetryAfter = Number.isFinite(retryAfter) ? retryAfter : 60;
        this.rateLimitedUntil = Date.now() + safeRetryAfter * 1000;
        const error = this._createRateLimitError(safeRetryAfter, 'response');
        error.rateLimitedUntil = this.rateLimitedUntil;
        throw error;
      }

      if (response.status === 401 || response.status === 403) {
        const authPayload = await response.json().catch(() => ({}));
        const authMessage =
          authPayload?.error?.message ||
          authPayload?.message ||
          authPayload?.error ||
          `HTTP ${response.status}`;
        throw this._createAuthError(`Cyanite authorization failed: ${authMessage}`);
      }

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const errorMessage =
          payload?.error?.message ||
          payload?.message ||
          payload?.error ||
          response.statusText ||
          'Unknown Cyanite API error';
        throw new Error(`Cyanite API error: ${errorMessage}`);
      }

      if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
        const message = payload.errors
          .map((item) => String(item?.message || '').trim())
          .filter(Boolean)
          .join('; ');

        if (/auth|forbidden|token|unauthor/i.test(message)) {
          throw this._createAuthError(`Cyanite GraphQL auth error: ${message}`);
        }
        if (/rate|429|limit|too many/i.test(message)) {
          throw this._createRateLimitError(60, 'graphql-errors');
        }
        throw new Error(`Cyanite GraphQL error: ${message || 'Unknown GraphQL error'}`);
      }

      return payload || {};
    } catch (error) {
      if (this._isRateLimitError(error)) {
        const rateLimitedUntil = Number(error?.rateLimitedUntil || this.rateLimitedUntil || 0);
        if (rateLimitedUntil > this._lastRateLimitLogUntil) {
          const retryAfterSeconds = Math.max(1, Math.ceil((rateLimitedUntil - Date.now()) / 1000));
          console.warn(`⏳ Cyanite API rate-limited. Pausing requests for ~${retryAfterSeconds}s.`);
          this._lastRateLimitLogUntil = rateLimitedUntil;
        }
        throw error;
      }

      if (this._isAuthError(error)) {
        console.error(`❌ Cyanite auth error: ${error.message}`);
        throw error;
      }

      console.error('❌ Cyanite API request failed:', error);
      throw error;
    }
  }
}
