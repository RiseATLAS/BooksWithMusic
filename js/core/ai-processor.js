export class AIProcessor {
  constructor() {
    this.moodKeywords = {
      dark: ['dark', 'shadow', 'night', 'death', 'fear', 'terror', 'horror', 'nightmare', 'evil', 'sinister'],
      mysterious: ['mystery', 'secret', 'hidden', 'unknown', 'enigma', 'puzzle', 'strange', 'curious'],
      romantic: ['love', 'heart', 'kiss', 'romance', 'passion', 'desire', 'affection', 'tender'],
      sad: ['sad', 'tear', 'cry', 'grief', 'sorrow', 'loss', 'melancholy', 'lonely', 'despair'],
      epic: ['battle', 'war', 'fight', 'hero', 'victory', 'triumph', 'glory', 'legend'],
      peaceful: ['peace', 'calm', 'quiet', 'gentle', 'soft', 'serene', 'tranquil', 'rest'],
      tense: ['danger', 'threat', 'tension', 'suspense', 'anxiety', 'worry', 'nervous'],
      joyful: ['happy', 'joy', 'laugh', 'smile', 'cheer', 'delight', 'merry', 'celebration'],
      adventure: ['journey', 'quest', 'explore', 'discover', 'travel', 'adventure', 'expedition'],
      magical: ['magic', 'spell', 'wizard', 'witch', 'enchant', 'mystical', 'supernatural']
    };

    this.moodToMusicMapping = {
      dark: { tags: ['dark', 'atmospheric', 'tense'], energy: 4, tempo: 'slow' },
      mysterious: { tags: ['mysterious', 'ambient', 'ethereal'], energy: 3, tempo: 'moderate' },
      romantic: { tags: ['romantic', 'gentle', 'classical'], energy: 2, tempo: 'slow' },
      sad: { tags: ['melancholy', 'piano', 'emotional'], energy: 2, tempo: 'slow' },
      epic: { tags: ['epic', 'orchestral', 'dramatic'], energy: 5, tempo: 'upbeat' },
      peaceful: { tags: ['calm', 'peaceful', 'nature'], energy: 1, tempo: 'slow' },
      tense: { tags: ['suspenseful', 'intense', 'dramatic'], energy: 4, tempo: 'moderate' },
      joyful: { tags: ['uplifting', 'cheerful', 'bright'], energy: 4, tempo: 'upbeat' },
      adventure: { tags: ['adventurous', 'energetic', 'inspiring'], energy: 4, tempo: 'upbeat' },
      magical: { tags: ['mystical', 'ethereal', 'ambient'], energy: 3, tempo: 'moderate' }
    };
  }

  /**
   * Analyze entire book and generate mood profiles for all chapters
   */
  async analyzeBook(book) {
    console.log(`AI Processor: Analyzing book "${book.title}" with ${book.chapters.length} chapters...`);
    
    const chapterAnalyses = book.chapters.map((chapter, index) => {
      const analysis = this.analyzeChapter(chapter, book);
      console.log(`Chapter ${index + 1} (${chapter.title}): ${analysis.primaryMood} - Energy: ${analysis.energy}/5`);
      return analysis;
    });

    const bookProfile = this._generateBookProfile(book, chapterAnalyses);
    
    return {
      bookProfile,
      chapterAnalyses,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Analyze a single chapter's content for mood and vibe
   */
  analyzeChapter(chapter, book) {
    const text = `${chapter.title} ${chapter.content}`.toLowerCase();
    const moodScores = {};

    // Score each mood based on keyword frequency
    for (const [mood, keywords] of Object.entries(this.moodKeywords)) {
      let score = 0;
      for (const keyword of keywords) {
        const regex = new RegExp(`\\b${keyword}\\w*\\b`, 'gi');
        const matches = text.match(regex);
        score += matches ? matches.length : 0;
      }
      moodScores[mood] = score;
    }

    // Find primary and secondary moods
    const sortedMoods = Object.entries(moodScores)
      .sort((a, b) => b[1] - a[1])
      .filter(([_, score]) => score > 0);

    const primaryMood = sortedMoods[0]?.[0] || 'peaceful';
    const secondaryMood = sortedMoods[1]?.[0];

    // Get music properties for primary mood
    const musicProps = this.moodToMusicMapping[primaryMood] || this.moodToMusicMapping.peaceful;

    // Combine tags from primary and secondary moods
    const tags = [...musicProps.tags];
    if (secondaryMood && this.moodToMusicMapping[secondaryMood]) {
      tags.push(...this.moodToMusicMapping[secondaryMood].tags.slice(0, 1));
    }

    return {
      chapterId: chapter.id || chapter.title,
      chapterTitle: chapter.title,
      primaryMood,
      secondaryMood,
      moodScores,
      musicTags: [...new Set(tags)], // Remove duplicates
      energy: musicProps.energy,
      tempo: musicProps.tempo,
      recommendedGenres: this._getGenresForMood(primaryMood)
    };
  }

  /**
   * Generate overall book profile from chapter analyses
   */
  _generateBookProfile(book, chapterAnalyses) {
    const title = book.title.toLowerCase();
    const moodCounts = {};
    let totalEnergy = 0;

    chapterAnalyses.forEach(analysis => {
      moodCounts[analysis.primaryMood] = (moodCounts[analysis.primaryMood] || 0) + 1;
      totalEnergy += analysis.energy;
    });

    const dominantMood = Object.entries(moodCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'peaceful';

    const avgEnergy = Math.round(totalEnergy / chapterAnalyses.length);

    // Enhance with title analysis
    let titleMood = null;
    for (const [mood, keywords] of Object.entries(this.moodKeywords)) {
      if (keywords.some(keyword => title.includes(keyword))) {
        titleMood = mood;
        break;
      }
    }

    return {
      title: book.title,
      dominantMood,
      titleMood: titleMood || dominantMood,
      averageEnergy: avgEnergy,
      moodDistribution: moodCounts,
      recommendedTags: this.moodToMusicMapping[dominantMood]?.tags || ['ambient', 'calm'],
      tempo: avgEnergy > 3 ? 'upbeat' : avgEnergy > 2 ? 'moderate' : 'slow'
    };
  }

  /**
   * Get appropriate music genres for a mood
   */
  _getGenresForMood(mood) {
    const genreMap = {
      dark: ['dark ambient', 'atmospheric', 'drone'],
      mysterious: ['ambient', 'electronic', 'minimal'],
      romantic: ['classical', 'piano', 'strings'],
      sad: ['piano', 'classical', 'acoustic'],
      epic: ['orchestral', 'cinematic', 'epic'],
      peaceful: ['ambient', 'nature sounds', 'meditation'],
      tense: ['suspense', 'electronic', 'minimal'],
      joyful: ['uplifting', 'indie', 'folk'],
      adventure: ['orchestral', 'world music', 'energetic'],
      magical: ['fantasy', 'ambient', 'ethereal']
    };

    return genreMap[mood] || ['instrumental', 'ambient'];
  }

  /**
   * Select best matching track from available tracks based on chapter analysis
   */
  selectTrackForChapter(chapterAnalysis, availableTracks) {
    if (!availableTracks || availableTracks.length === 0) {
      return null;
    }

    // Score each track based on tag matching
    const scoredTracks = availableTracks.map(track => {
      let score = 0;
      const trackTags = track.tags || [];
      const chapterTags = chapterAnalysis.musicTags || [];

      // Check tag overlap
      chapterTags.forEach(tag => {
        if (trackTags.some(trackTag => trackTag.includes(tag) || tag.includes(trackTag))) {
          score += 3;
        }
      });

      // Match energy level (track.energy should be similar to chapter.energy)
      if (track.energy) {
        const energyDiff = Math.abs(track.energy - chapterAnalysis.energy);
        score += (5 - energyDiff);
      }

      // Match tempo if available
      if (track.tempo && track.tempo === chapterAnalysis.tempo) {
        score += 2;
      }

      return { track, score };
    });

    // Sort by score and return best match
    scoredTracks.sort((a, b) => b.score - a.score);
    return scoredTracks[0]?.track || availableTracks[0];
  }

  /**
   * Generate chapter-to-track mappings for entire book
   */
  generateChapterMappings(book, chapterAnalyses, availableTracks) {
    return chapterAnalyses.map(analysis => {
      const recommendedTrack = this.selectTrackForChapter(analysis, availableTracks);
      
      return {
        bookId: book.id,
        chapterId: analysis.chapterId,
        chapterTitle: analysis.chapterTitle,
        primaryMood: analysis.primaryMood,
        trackId: recommendedTrack?.id,
        trackTitle: recommendedTrack?.title,
        reasoning: `${analysis.primaryMood} mood detected, energy: ${analysis.energy}/5`
      };
    });
  }
}
