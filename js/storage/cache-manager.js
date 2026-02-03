/**
 * CacheManager - Audio Track Caching (Freesound Only)
 * 
 * RESPONSIBILITIES:
 * - Cache audio files from Freesound API in browser Cache API
 * - Provide offline playback capability for cached tracks
 * - Enforce cache size limits (max 100 tracks)
 * - Manage cache lifecycle (add, retrieve, remove)
 * - Only works with Freesound (Spotify streams directly)
 * 
 * CACHE STRATEGY:
 * - Cache name: 'booksWithMusic-audio-v1'
 * - Max cached tracks: 100
 * - LRU eviction when limit reached
 * - Stores audio/mpeg Response objects
 * 
 * USAGE:
 * - Called by MusicManager during track pre-caching
 * - Used by AudioPlayer for offline playback
 * - Not used for Spotify (streams in real-time)
 * 
 * NOTE: Spotify tracks cannot be cached due to DRM restrictions
 */

export class CacheManager {
  constructor() {
    this.CACHE_NAME = 'booksWithMusic-audio-v1';
    this.MAX_CACHE_SIZE = 100;
  }

  async cacheTrack(trackId, audioBlob) {
    if (!('caches' in window)) {
      console.warn('Cache API not available');
      return;
    }

    try {
      const cache = await caches.open(this.CACHE_NAME);
      const response = new Response(audioBlob, {
        headers: { 'Content-Type': 'audio/mpeg' },
      });
      await cache.put(`/audio/${trackId}`, response);
      await this._enforceCacheLimit();
    } catch (error) {
      console.error('Error caching track:', error);
    }
  }

  async getCachedTrack(trackId) {
    if (!('caches' in window)) return null;

    try {
      const cache = await caches.open(this.CACHE_NAME);
      const response = await cache.match(`/audio/${trackId}`);
      
      if (response) {
        return await response.blob();
      }
    } catch (error) {
      console.error('Error getting cached track:', error);
    }
    return null;
  }

  async isTrackCached(trackId) {
    if (!('caches' in window)) return false;

    try {
      const cache = await caches.open(this.CACHE_NAME);
      const response = await cache.match(`/audio/${trackId}`);
      return !!response;
    } catch (error) {
      console.error('Error checking cached track:', error);
      return false;
    }
  }

  async clearCache() {
    if (!('caches' in window)) return;
    try {
      await caches.delete(this.CACHE_NAME);
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  async _enforceCacheLimit() {
    try {
      const cache = await caches.open(this.CACHE_NAME);
      const keys = await cache.keys();
      
      if (keys.length > this.MAX_CACHE_SIZE) {
        const toRemove = keys.slice(0, keys.length - this.MAX_CACHE_SIZE);
        await Promise.all(toRemove.map(key => cache.delete(key)));
      }
    } catch (error) {
      console.error('Error enforcing cache limit:', error);
    }
  }
}
