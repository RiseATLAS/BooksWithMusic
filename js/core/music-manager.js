import { CacheManager } from '../storage/cache-manager.js';

export class MusicManager {
  constructor(db) {
    this.db = db;
    this.cache = new CacheManager();
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
    this.currentBookId = null;
    this.chapters = [];
  }

  async initialize(bookId, chapters) {
    this.currentBookId = bookId;
    this.chapters = chapters;
  }

  onChapterChange(chapterIndex) {
    // Called when chapter changes - can be used to update music selection
    console.log('Chapter changed to:', chapterIndex);
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
      const blob = await response.blob();
      await this.cache.cacheTrack(track.id, blob);
      track.cached = true;
      await this.db.addTrack(track);
    } catch (error) {
      console.error('Failed to cache track:', error);
    }
  }

  async getAllAvailableTracks() {
    const dbTracks = await this.db.getAllTracks();
    return [...this.defaultTracks, ...dbTracks];
  }
}
