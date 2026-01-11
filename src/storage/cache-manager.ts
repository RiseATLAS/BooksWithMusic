export class CacheManager {
  private readonly CACHE_NAME = 'booksWithMusic-audio-v1';
  private readonly MAX_CACHE_SIZE = 100;

  async cacheTrack(trackId: string, audioBlob: Blob): Promise<void> {
    if (!('caches' in window)) return;

    const cache = await caches.open(this.CACHE_NAME);
    const response = new Response(audioBlob, {
      headers: { 'Content-Type': 'audio/mpeg' },
    });
    await cache.put(`/audio/${trackId}`, response);
    await this.enforceCacheLimit();
  }

  async getCachedTrack(trackId: string): Promise<Blob | null> {
    if (!('caches' in window)) return null;

    const cache = await caches.open(this.CACHE_NAME);
    const response = await cache.match(`/audio/${trackId}`);
    
    if (response) {
      return await response.blob();
    }
    return null;
  }

  async isTrackCached(trackId: string): Promise<boolean> {
    if (!('caches' in window)) return false;

    const cache = await caches.open(this.CACHE_NAME);
    const response = await cache.match(`/audio/${trackId}`);
    return !!response;
  }

  async clearCache(): Promise<void> {
    if (!('caches' in window)) return;
    await caches.delete(this.CACHE_NAME);
  }

  private async enforceCacheLimit(): Promise<void> {
    const cache = await caches.open(this.CACHE_NAME);
    const keys = await cache.keys();
    
    if (keys.length > this.MAX_CACHE_SIZE) {
      const toRemove = keys.slice(0, keys.length - this.MAX_CACHE_SIZE);
      await Promise.all(toRemove.map(key => cache.delete(key)));
    }
  }
}
