export class AIProcessor {
  constructor() {
    this.moodKeywords = {
      dark: ['dark', 'shadow', 'night', 'death', 'fear', 'terror', 'horror', 'nightmare', 'evil', 'sinister', 'grim', 'haunted', 'ominous', 'doom', 'dread', 'foreboding', 'ghastly', 'macabre', 'menace', 'sinister', 'bleak', 'murky', 'obscure', 'dim', 'gloomy', 'dismal', 'black', 'twilight', 'abyss', 'void', 'cursed', 'wicked', 'malevolent', 'diabolical'],
      mysterious: ['mystery', 'secret', 'hidden', 'unknown', 'enigma', 'puzzle', 'strange', 'curious', 'cryptic', 'obscure', 'arcane', 'esoteric', 'riddle', 'cipher', 'veiled', 'shadowy', 'elusive', 'ambiguous', 'perplexing', 'baffling', 'mystifying', 'intrigue', 'conspiracy', 'covert', 'clandestine', 'whisper', 'clue', 'investigate', 'probe'],
      romantic: ['love', 'heart', 'kiss', 'romance', 'passion', 'desire', 'affection', 'tender', 'embrace', 'caress', 'intimate', 'adore', 'cherish', 'devoted', 'sweetheart', 'beloved', 'longing', 'yearning', 'amorous', 'enchanted', 'smitten', 'enamored', 'infatuated', 'crush', 'flutter', 'blush', 'gentle touch', 'gaze', 'whisper'],
      sad: ['sad', 'tear', 'cry', 'grief', 'sorrow', 'loss', 'melancholy', 'lonely', 'despair', 'mourn', 'weep', 'anguish', 'heartbreak', 'misery', 'woe', 'lament', 'regret', 'remorse', 'bitter', 'forlorn', 'desolate', 'empty', 'hopeless', 'depressed', 'downcast', 'crestfallen', 'dejected', 'somber', 'mournful', 'wistful'],
      epic: ['battle', 'war', 'fight', 'hero', 'victory', 'triumph', 'glory', 'legend', 'conquest', 'valor', 'courage', 'brave', 'warrior', 'champion', 'clash', 'siege', 'army', 'combat', 'duel', 'sword', 'shield', 'charge', 'assault', 'defend', 'fortress', 'kingdom', 'empire', 'destiny', 'fate', 'prophecy', 'epic', 'grand', 'mighty', 'powerful'],
      peaceful: ['peace', 'calm', 'quiet', 'gentle', 'soft', 'serene', 'tranquil', 'rest', 'still', 'placid', 'soothing', 'harmonious', 'relaxed', 'content', 'ease', 'comfort', 'silence', 'hush', 'meditation', 'contemplation', 'breeze', 'meadow', 'garden', 'stream', 'dawn', 'sunset', 'twilight', 'lullaby', 'whisper'],
      tense: ['danger', 'threat', 'tension', 'suspense', 'anxiety', 'worry', 'nervous', 'alert', 'urgent', 'panic', 'alarm', 'warning', 'crisis', 'peril', 'risk', 'hazard', 'jeopardy', 'precarious', 'uncertain', 'edge', 'brink', 'pressure', 'strain', 'stress', 'chase', 'pursue', 'flee', 'escape', 'trap', 'cornered'],
      joyful: ['happy', 'joy', 'laugh', 'smile', 'cheer', 'delight', 'merry', 'celebration', 'jubilant', 'ecstatic', 'elated', 'gleeful', 'festive', 'exuberant', 'radiant', 'blissful', 'thrilled', 'excited', 'euphoric', 'jovial', 'cheerful', 'bright', 'sunny', 'playful', 'grin', 'giggle', 'dance', 'sing', 'rejoice'],
      adventure: ['journey', 'quest', 'explore', 'discover', 'travel', 'adventure', 'expedition', 'voyage', 'trek', 'wander', 'roam', 'pioneer', 'frontier', 'horizon', 'path', 'trail', 'map', 'compass', 'uncharted', 'wild', 'wilderness', 'mountain', 'sea', 'forest', 'cave', 'treasure', 'seek', 'search', 'brave', 'bold'],
      magical: ['magic', 'spell', 'wizard', 'witch', 'enchant', 'mystical', 'supernatural', 'sorcery', 'conjure', 'incantation', 'potion', 'wand', 'charm', 'hex', 'rune', 'ritual', 'ethereal', 'otherworldly', 'fairy', 'dragon', 'phoenix', 'unicorn', 'mythical', 'legendary', 'arcane', 'divine', 'celestial', 'enchanted', 'bewitched', 'spellbound']
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
   * Select multiple tracks (1-5) for a chapter based on its length
   * Tracks are ordered sequentially for page progression
   */
  selectTracksForChapter(chapterAnalysis, availableTracks, chapter) {
    if (!availableTracks || availableTracks.length === 0) {
      return [];
    }

    // Estimate chapter length (rough word count)
    const wordCount = chapter.content?.split(/\s+/).length || 1000;
    
    // Determine number of tracks based on chapter length
    // Short: 1 track, Medium: 2-3 tracks, Long: 4-5 tracks
    let trackCount;
    if (wordCount < 2000) {
      trackCount = 1;
    } else if (wordCount < 5000) {
      trackCount = 2;
    } else if (wordCount < 8000) {
      trackCount = 3;
    } else if (wordCount < 12000) {
      trackCount = 4;
    } else {
      trackCount = 5;
    }

    console.log(`   Chapter "${chapter.title}": ${wordCount} words → ${trackCount} tracks`);

    // Score all tracks
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

      // Match energy level
      if (track.energy) {
        const energyDiff = Math.abs(track.energy - chapterAnalysis.energy);
        score += (5 - energyDiff);
      }

      // Match tempo
      if (track.tempo && track.tempo === chapterAnalysis.tempo) {
        score += 2;
      }

      return { track, score };
    });

    // Sort by score and take top N tracks
    scoredTracks.sort((a, b) => b.score - a.score);
    
    // Ensure we don't request more tracks than available
    const actualCount = Math.min(trackCount, scoredTracks.length);
    const selectedTracks = scoredTracks.slice(0, actualCount).map(st => st.track);
    
    return selectedTracks;
  }

  /**
   * Generate chapter-to-track mappings for entire book
   * Now returns multiple tracks per chapter (1-5 based on length)
   */
  generateChapterMappings(book, chapterAnalyses, availableTracks) {
    return chapterAnalyses.map((analysis, index) => {
      const chapter = book.chapters[index];
      const selectedTracks = this.selectTracksForChapter(analysis, availableTracks, chapter);
      
      return {
        bookId: book.id,
        chapterId: analysis.chapterId,
        chapterTitle: analysis.chapterTitle,
        primaryMood: analysis.primaryMood,
        tracks: selectedTracks.map(track => ({
          trackId: track.id,
          trackTitle: track.title,
          trackUrl: track.url,
          trackArtist: track.artist,
          trackDuration: track.duration
        })),
        trackCount: selectedTracks.length,
        reasoning: `${analysis.primaryMood} mood detected, energy: ${analysis.energy}/5, ${selectedTracks.length} tracks selected`
      };
    });
  }

  /**
   * Analyze page content to determine if music should change
   * Returns a score indicating how different this page is from current mood
   */
  analyzePageMoodShift(pageText, currentMood) {
    const text = pageText.toLowerCase();
    const moodScores = {};

    // Score each mood based on keyword frequency in this page
    for (const [mood, keywords] of Object.entries(this.moodKeywords)) {
      let score = 0;
      for (const keyword of keywords) {
        const regex = new RegExp(`\\b${keyword}\\w*\\b`, 'gi');
        const matches = text.match(regex);
        score += matches ? matches.length : 0;
      }
      moodScores[mood] = score;
    }

    // Find dominant mood on this page
    const sortedMoods = Object.entries(moodScores)
      .sort((a, b) => b[1] - a[1])
      .filter(([_, score]) => score > 0);

    const pageMood = sortedMoods[0]?.[0] || currentMood;
    const moodStrength = sortedMoods[0]?.[1] || 0;

    // Calculate mood shift score (0-100)
    // Higher score = more significant mood change
    let shiftScore = 0;
    
    if (pageMood !== currentMood && moodStrength > 2) {
      // Strong mood shift detected
      shiftScore = 75 + Math.min(25, moodStrength * 5);
    } else if (pageMood === currentMood) {
      // Same mood, no shift needed
      shiftScore = 0;
    } else {
      // Weak mood shift
      shiftScore = 30 + (moodStrength * 10);
    }

    return {
      pageMood,
      currentMood,
      shiftScore,
      moodStrength,
      shouldShift: shiftScore >= 50, // Threshold for music change
      confidence: Math.min(100, moodStrength * 10)
    };
  }

  /**
   * Analyze entire chapter and divide into mood sections
   * Returns optimal page numbers where music should change
   */
  analyzeChapterSections(chapterContent, chapterMood, totalPages, maxShifts = 5) {
    // Split content into roughly equal sections based on page count
    const words = chapterContent.split(/\s+/);
    const wordsPerPage = Math.ceil(words.length / totalPages);
    
    const sections = [];
    const shiftPoints = [];
    let currentSectionMood = chapterMood;
    let shiftsUsed = 0;

    // Analyze each page
    for (let page = 1; page <= totalPages; page++) {
      const startWord = (page - 1) * wordsPerPage;
      const endWord = Math.min(page * wordsPerPage, words.length);
      const pageText = words.slice(startWord, endWord).join(' ');

      if (pageText.length < 50) continue; // Skip very short pages

      const analysis = this.analyzePageMoodShift(pageText, currentSectionMood);

      // Check if we should shift music at this page
      if (analysis.shouldShift && shiftsUsed < maxShifts && page > 1) {
        shiftPoints.push({
          page,
          fromMood: currentSectionMood,
          toMood: analysis.pageMood,
          confidence: analysis.confidence,
          shiftScore: analysis.shiftScore
        });
        currentSectionMood = analysis.pageMood;
        shiftsUsed++;
      }

      sections.push({
        page,
        mood: currentSectionMood,
        moodStrength: analysis.moodStrength
      });
    }

    return {
      sections,
      shiftPoints,
      totalShifts: shiftsUsed
    };
  }
}
