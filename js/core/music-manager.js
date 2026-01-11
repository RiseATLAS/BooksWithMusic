import { CacheManager } from '../storage/cache-manager.js';
import { AIProcessor } from './ai-processor.js';
import { MusicAPI } from './music-api.js';

export class MusicManager {
  constructor(db) {
    this.db = db;
    this.cache = new CacheManager();
    this.aiProcessor = new AIProcessor();
    this.musicAPI = new MusicAPI();
    this.bookAnalysis = null;
    this.chapterMappings = {};
    this.availableTracks = [];
    this.eventHandlers = {}; // Event emitter
    this.currentBookId = null;
    this.chapters = [];
  }

  async initialize(bookId, chapters) {
    this.currentBookId = bookId;
    this.chapters = chapters;
    
    // Load available tracks from API
    await this.loadTracksFromAPI();
    
    // Analyze book with AI to determine chapter-specific music
    console.log('🤖 AI analyzing book for mood-based music selection...');
    const book = { id: bookId, title: 'Current Book', chapters };
    this.bookAnalysis = await this.aiProcessor.analyzeBook(book);
    
    // Generate mappings using available tracks
    const mappings = this.aiProcessor.generateChapterMappings(
      book,
      this.bookAnalysis.chapterAnalyses,
      this.availableTracks
    );
    
    // Store mappings for quick lookup
    mappings.forEach(mapping => {
      this.chapterMappings[mapping.chapterId] = mapping;
    });
    
    console.log(`✓ AI analysis complete. Book mood: ${this.bookAnalysis.bookProfile.dominantMood}`);
    console.log(`♪ Available tracks: ${this.availableTracks.length}`);
  }

  onChapterChange(chapterIndex) {
    console.log('📖 onChapterChange called:', chapterIndex);
    console.log('   Book analysis:', !!this.bookAnalysis);
    console.log('   Chapters:', this.chapters?.length);
    
    if (!this.bookAnalysis || !this.chapters[chapterIndex]) {
      console.log('⚠️ Missing analysis or chapter');
      return;
    }
    
    const chapter = this.chapters[chapterIndex];
    const analysis = this.bookAnalysis.chapterAnalyses[chapterIndex];
    const mapping = this.chapterMappings[chapter.id || chapter.title];
    
    console.log('   Chapter:', chapter.title);
    console.log('   Analysis:', analysis?.primaryMood);
    console.log('   Mapping:', mapping?.trackTitle);
    
    if (analysis && mapping) {
      console.log(`🎵 Chapter ${chapterIndex + 1}: ${analysis.primaryMood} mood detected`);
      console.log(`   Playing: ${mapping.trackTitle || 'Default track'}`);
      console.log(`   Energy: ${analysis.energy}/5 | Tags: ${analysis.musicTags.join(', ')}`);
      
      // Emit event that music panel can listen to
      console.log('📡 Emitting chapterMusicChanged event');
      console.log('   Event handlers:', this.eventHandlers);
      this.emit('chapterMusicChanged', {
        chapterIndex,
        analysis,
        recommendedTrack: mapping.trackId
      });
      console.log('✓ Event emitted');
    } else {
      console.log('⚠️ Missing analysis or mapping');
    }
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
    if (this.availableTracks.length === 0) {
      await this.loadTracksFromAPI();
    }
    return this.availableTracks;
  }

  async loadTracksFromAPI() {
    console.log('🎼 MusicManager: Starting track loading...');
    try {
      // Check if Freesound API key is configured
      const freesoundKey = localStorage.getItem('freesound_api_key');
      
      if (!freesoundKey) {
        console.warn('⚠️ No API key configured. Music features disabled.');
        console.log('🔑 Get a free API key from: https://freesound.org/apiv2/apply/');
        this.availableTracks = [];
        return;
      }
      
      console.log('✓ Using Freesound API');
      
      // Try to load tracks from API
      const moods = ['calm', 'epic', 'romantic', 'mysterious', 'adventure'];
      console.log('🎵 Fetching tracks for moods:', moods.join(', '));
      
      for (const mood of moods) {
        try {
          console.log(`   Fetching ${mood} tracks...`);
          const tracks = await this.musicAPI.getTracksForMood(mood, 2);
          console.log(`   ✓ Got ${tracks.length} ${mood} tracks`);
          this.availableTracks.push(...tracks);
        } catch (error) {
          console.warn(`   ❌ Could not fetch ${mood} tracks:`, error);
        }
      }
      
      console.log('📊 Total tracks loaded:', this.availableTracks.length);
      
      if (this.availableTracks.length === 0) {
        console.warn('⚠️ No tracks loaded from API.');
        console.log('💡 Tip: Try adjusting your search tags or check API status');
      } else {
        // Remove duplicates
        const seen = new Set();
        this.availableTracks = this.availableTracks.filter(track => {
          if (seen.has(track.id)) return false;
          seen.add(track.id);
          return true;
        });
        
        console.log(`✓ Loaded ${this.availableTracks.length} unique music tracks`);
        console.log('   Track IDs:', this.availableTracks.map(t => t.id).join(', '));
      }
    } catch (error) {
      console.error('Error loading tracks from API:', error);
      // Fallback to default tracks only
      this.availableTracks = [...this.defaultTracks];
    }
  }

  getChapterAnalysis(chapterIndex) {
    return this.bookAnalysis?.chapterAnalyses[chapterIndex];
  }

  getBookProfile() {
    return this.bookAnalysis?.bookProfile;
  }

  // Event emitter
  on(event, handler) {
    if (!this.eventHandlers) this.eventHandlers = {};
    if (!this.eventHandlers[event]) this.eventHandlers[event] = [];
    this.eventHandlers[event].push(handler);
  }

  emit(event, data) {
    if (this.eventHandlers?.[event]) {
      this.eventHandlers[event].forEach(handler => handler(data));
    }
  }
}
