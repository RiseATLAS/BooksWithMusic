import { Track, Book, Chapter } from '../types/interfaces';
import { DatabaseManager } from '../storage/indexeddb';
import { CacheManager } from '../storage/cache-manager';

export class MusicManager {
  private db: DatabaseManager;
  private cache: CacheManager;
  private defaultTracks: Track[] = [];

  constructor(db: DatabaseManager) {
    this.db = db;
    this.cache = new CacheManager();
    this.initializeDefaultTracks();
  }

  private initializeDefaultTracks() {
    this.defaultTracks = [
      {
        id: 'ambient-1',
        title: 'Peaceful Reading',
        artist: 'Calm Library',
        duration: 180,
        url: '/music/ambient-1.mp3',
        source: 'bundled',
        license: {
          type: 'CC0',
          attributionRequired: false,
          sourceUrl: 'bundled',
          downloadAllowed: true,
        },
        tags: ['ambient', 'calm', 'peaceful'],
      },
      {
        id: 'classical-1',
        title: 'Gentle Piano',
        artist: 'Reading Ensemble',
        duration: 200,
        url: '/music/classical-1.mp3',
        source: 'bundled',
        license: {
          type: 'CC0',
          attributionRequired: false,
          sourceUrl: 'bundled',
          downloadAllowed: true,
        },
        tags: ['piano', 'classical', 'gentle'],
      },
      {
        id: 'nature-1',
        title: 'Forest Ambience',
        artist: 'Nature Sounds',
        duration: 240,
        url: '/music/nature-1.mp3',
        source: 'bundled',
        license: {
          type: 'CC0',
          attributionRequired: false,
          sourceUrl: 'bundled',
          downloadAllowed: true,
        },
        tags: ['nature', 'ambient', 'relaxing'],
      },
    ];
  }

  async getTracksForChapter(book: Book, chapter: Chapter): Promise<Track[]> {
    const mappings = await this.db.getMappingsByBook(book.id);
    const chapterMapping = mappings.find(m => m.chapterId === chapter.id);

    if (chapterMapping?.trackIds) {
      const tracks = await Promise.all(
        chapterMapping.trackIds.map(id => this.db.getTrack(id))
      );
      return tracks.filter((t): t is Track => t !== undefined);
    }

    return this.selectDefaultTracks(3);
  }

  private selectDefaultTracks(count: number): Track[] {
    const shuffled = [...this.defaultTracks].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  async cacheTrack(track: Track): Promise<void> {
    try {
      const response = await fetch(track.url);
      const blob = await response.blob();
      await this.cache.cacheTrack(track.id, blob);
      track.cached = true;
      await this.db.addTrack(track);
    } catch (error) {
      console.error('Failed to cache track:', error);
    }
  }

  async getAllAvailableTracks(): Promise<Track[]> {
    const dbTracks = await this.db.getAllTracks();
    return [...this.defaultTracks, ...dbTracks];
  }
}
