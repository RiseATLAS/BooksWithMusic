export class AIProcessor {
  constructor() {
    // Enhanced keyword system: Scene/Environment takes priority over emotions
    this.sceneKeywords = {
      // Locations and settings (high priority for music selection)
      dark: ['dungeon', 'cave', 'underground', 'basement', 'crypt', 'tomb', 'cemetery', 'graveyard', 'ruins', 'abandoned', 'desolate', 'wasteland', 'swamp', 'marsh', 'fog', 'mist', 'storm', 'thunder', 'rain', 'night', 'midnight', 'darkness', 'shadow'],
      mysterious: ['library', 'archive', 'laboratory', 'chamber', 'corridor', 'hallway', 'passage', 'tunnel', 'maze', 'labyrinth', 'mansion', 'castle', 'tower', 'ancient', 'secret room', 'hidden door', 'vault', 'temple', 'shrine'],
      romantic: ['garden', 'rose', 'flower', 'meadow', 'sunset', 'starlight', 'moonlight', 'beach', 'candlelight', 'fireplace', 'balcony', 'terrace', 'vineyard', 'lakeside', 'riverside'],
      sad: ['grave', 'funeral', 'hospital', 'bedside', 'empty room', 'deserted', 'ruins', 'ashes', 'wreckage', 'ruins'],
      epic: ['battlefield', 'arena', 'throne room', 'war', 'army', 'legion', 'fortress', 'citadel', 'siege', 'mountain peak', 'chasm', 'volcano', 'cliffside'],
      peaceful: ['meadow', 'garden', 'brook', 'stream', 'clearing', 'glade', 'cottage', 'village', 'sunrise', 'dawn', 'morning', 'spring', 'blossom', 'birdsong'],
      tense: ['edge', 'cliff', 'precipice', 'narrow', 'tight space', 'chase', 'pursuit', 'alley', 'rooftop', 'ledge', 'bridge', 'crossing'],
      joyful: ['festival', 'celebration', 'marketplace', 'fair', 'tavern', 'inn', 'plaza', 'square', 'dancing', 'feast', 'banquet'],
      adventure: ['wilderness', 'frontier', 'jungle', 'desert', 'mountain', 'ocean', 'sea', 'ship', 'voyage', 'expedition', 'trail', 'path', 'forest', 'woods'],
      magical: ['enchanted', 'spellbound', 'crystal', 'portal', 'realm', 'dimension', 'ethereal plane', 'floating', 'glowing', 'shimmering', 'aurora', 'celestial']
    };
    
    this.moodKeywords = {
      dark: ['death', 'fear', 'terror', 'horror', 'nightmare', 'evil', 'sinister', 'grim', 'haunted', 'ominous', 'doom', 'dread', 'foreboding', 'menace', 'wicked', 'malevolent'],
      mysterious: ['mystery', 'secret', 'hidden', 'unknown', 'enigma', 'puzzle', 'strange', 'curious', 'cryptic', 'riddle', 'clue', 'investigate'],
      romantic: ['love', 'heart', 'kiss', 'romance', 'passion', 'desire', 'affection', 'tender', 'embrace', 'caress', 'intimate', 'adore', 'cherish', 'devoted', 'beloved', 'longing'],
      sad: ['sad', 'tear', 'cry', 'grief', 'sorrow', 'loss', 'melancholy', 'lonely', 'despair', 'mourn', 'weep', 'anguish', 'heartbreak', 'misery'],
      epic: ['battle', 'fight', 'hero', 'victory', 'triumph', 'glory', 'legend', 'conquest', 'valor', 'courage', 'brave', 'warrior', 'champion'],
      peaceful: ['peace', 'calm', 'quiet', 'gentle', 'soft', 'serene', 'tranquil', 'rest', 'still', 'soothing', 'harmonious', 'relaxed', 'content'],
      tense: ['danger', 'threat', 'tension', 'suspense', 'anxiety', 'worry', 'nervous', 'alert', 'urgent', 'panic', 'alarm', 'warning', 'crisis', 'peril'],
      joyful: ['happy', 'joy', 'laugh', 'smile', 'cheer', 'delight', 'merry', 'celebration', 'jubilant', 'ecstatic', 'gleeful', 'festive', 'thrilled'],
      adventure: ['journey', 'quest', 'explore', 'discover', 'travel', 'adventure', 'expedition', 'voyage', 'trek', 'wander', 'pioneer', 'seek'],
      magical: ['magic', 'spell', 'wizard', 'witch', 'enchant', 'mystical', 'supernatural', 'sorcery', 'conjure', 'incantation', 'potion', 'charm']
    };

    this.moodToMusicMapping = {
      dark: { tags: ['dark', 'atmospheric', 'tense', 'ominous'], energy: 4, tempo: 'slow' },
      mysterious: { tags: ['mysterious', 'ambient', 'ethereal', 'enigmatic'], energy: 3, tempo: 'moderate' },
      romantic: { tags: ['romantic', 'gentle', 'piano', 'strings'], energy: 2, tempo: 'slow' },
      sad: { tags: ['melancholy', 'piano', 'emotional', 'somber'], energy: 2, tempo: 'slow' },
      epic: { tags: ['epic', 'orchestral', 'dramatic', 'powerful'], energy: 5, tempo: 'upbeat' },
      peaceful: { tags: ['calm', 'peaceful', 'ambient', 'nature'], energy: 1, tempo: 'slow' },
      tense: { tags: ['suspenseful', 'intense', 'dramatic', 'tense'], energy: 4, tempo: 'moderate' },
      joyful: { tags: ['uplifting', 'cheerful', 'bright', 'happy'], energy: 4, tempo: 'upbeat' },
      adventure: { tags: ['adventurous', 'energetic', 'inspiring', 'cinematic'], energy: 4, tempo: 'upbeat' },
      magical: { tags: ['mystical', 'ethereal', 'ambient', 'fantasy'], energy: 3, tempo: 'moderate' }
    };
  }

  /**
   * Analyze entire book and generate mood profiles for all chapters
   */
  async analyzeBook(book) {
    console.log(`🤖 AI analyzing "${book.title}" (${book.chapters.length} chapters)...`);
    
    const chapterAnalyses = book.chapters.map((chapter, index) => {
      return this.analyzeChapter(chapter, book);
    });

    const bookProfile = this._generateBookProfile(book, chapterAnalyses);
    
    console.log(`✓ Mood: ${bookProfile.dominantMood} | Energy: ${bookProfile.averageEnergy}/5`);
    
    return {
      bookProfile,
      chapterAnalyses,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Analyze a single chapter's content for mood and vibe
   * Prioritizes scene/environment over emotional keywords
   */
  analyzeChapter(chapter, book) {
    try {
      const text = `${chapter.title} ${chapter.content}`.toLowerCase();
      const sceneScores = {};
      const moodScores = {};

      // PRIORITY 1: Score scene/environment keywords (weighted 3x)
      for (const [mood, keywords] of Object.entries(this.sceneKeywords)) {
        let score = 0;
        for (const keyword of keywords) {
          const regex = new RegExp(`\\b${keyword}\\w*\\b`, 'gi');
          const matches = text.match(regex);
          score += matches ? matches.length * 3 : 0; // 3x weight for scene keywords
        }
        sceneScores[mood] = score;
      }

      // PRIORITY 2: Score emotional mood keywords (weighted 1x)
      for (const [mood, keywords] of Object.entries(this.moodKeywords)) {
        let score = 0;
        for (const keyword of keywords) {
          const regex = new RegExp(`\\b${keyword}\\w*\\b`, 'gi');
          const matches = text.match(regex);
          score += matches ? matches.length : 0;
        }
        moodScores[mood] = score;
      }

      // Combine scores: scene takes priority, mood adds nuance
      const combinedScores = {};
      for (const mood in sceneScores) {
        combinedScores[mood] = sceneScores[mood] + (moodScores[mood] || 0);
      }

      // Find primary and secondary moods based on combined scores
      const sortedMoods = Object.entries(combinedScores)
        .sort((a, b) => b[1] - a[1])
        .filter(([_, score]) => score > 0);

      const primaryMood = sortedMoods[0]?.[0] || 'peaceful';
      const secondaryMood = sortedMoods[1]?.[0];

      // Get music properties for primary mood
      const musicProps = this.moodToMusicMapping[primaryMood] || this.moodToMusicMapping.peaceful;

      // Combine tags from primary and secondary moods
      const tags = [...musicProps.tags];
      if (secondaryMood && this.moodToMusicMapping[secondaryMood]) {
        tags.push(...this.moodToMusicMapping[secondaryMood].tags.slice(0, 2));
      }

      return {
        chapterId: chapter.id || chapter.title,
        chapterTitle: chapter.title,
        primaryMood,
        secondaryMood,
        sceneScore: sceneScores[primaryMood] || 0,
        moodScore: moodScores[primaryMood] || 0,
        musicTags: [...new Set(tags)], // Remove duplicates
        energy: musicProps.energy,
        tempo: musicProps.tempo,
        recommendedGenres: this._getGenresForMood(primaryMood)
      };
    } catch (error) {
      console.error(`❌ Error analyzing chapter "${chapter.title}":`, error);
      console.error('Stack trace:', error.stack);
      // Return default peaceful mood on error
      return {
        chapterId: chapter.id || chapter.title,
        chapterTitle: chapter.title,
        primaryMood: 'peaceful',
        secondaryMood: null,
        sceneScore: 0,
        moodScore: 0,
        musicTags: ['calm', 'peaceful', 'ambient'],
        energy: 1,
        tempo: 'slow',
        recommendedGenres: ['ambient', 'calm']
      };
    }
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
   * Enhanced scoring based on scene/environment match
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

    // Score all tracks with enhanced algorithm
    const scoredTracks = availableTracks.map(track => {
      let score = 0;
      const trackTags = track.tags || [];
      const chapterTags = chapterAnalysis.musicTags || [];

      // PRIORITY 1: Tag matching (most important)
      chapterTags.forEach(chapterTag => {
        trackTags.forEach(trackTag => {
          const chapterTagLower = chapterTag.toLowerCase();
          const trackTagLower = trackTag.toLowerCase();
          
          // Exact match
          if (chapterTagLower === trackTagLower) {
            score += 5;
          }
          // Partial match (one contains the other)
          else if (chapterTagLower.includes(trackTagLower) || trackTagLower.includes(chapterTagLower)) {
            score += 3;
          }
        });
      });

      // PRIORITY 2: Energy level match (important for pacing)
      if (track.energy) {
        const energyDiff = Math.abs(track.energy - chapterAnalysis.energy);
        // Perfect match: +5, Close: +3, Off by 2: +1, Off by 3+: 0
        if (energyDiff === 0) {
          score += 5;
        } else if (energyDiff === 1) {
          score += 3;
        } else if (energyDiff === 2) {
          score += 1;
        }
      }

      // PRIORITY 3: Tempo match (helpful for atmosphere)
      if (track.tempo && track.tempo === chapterAnalysis.tempo) {
        score += 3;
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
    
    console.log(`📖 Analyzing ${totalPages} pages for mood shifts (${words.length} words, ~${wordsPerPage} words/page)`);
    
    const sections = [];
    const potentialShifts = []; // Collect all potential shifts first
    let currentSectionMood = chapterMood;

    // PASS 1: Analyze each page and collect potential shifts
    for (let page = 1; page <= totalPages; page++) {
      const startWord = (page - 1) * wordsPerPage;
      const endWord = Math.min(page * wordsPerPage, words.length);
      const pageText = words.slice(startWord, endWord).join(' ');

      if (pageText.length < 50) continue; // Skip very short pages

      const analysis = this.analyzePageMoodShift(pageText, currentSectionMood);

      // Collect potential shift points with their scores
      if (analysis.shouldShift && page > 1) {
        potentialShifts.push({
          page,
          fromMood: currentSectionMood,
          toMood: analysis.pageMood,
          confidence: analysis.confidence,
          shiftScore: analysis.shiftScore
        });
      }

      if (page % 10 === 0) {
        console.log(`📄 Page ${page}: Mood check (current: ${currentSectionMood}, page: ${analysis.pageMood}, shift score: ${analysis.shiftScore})`);
      }
    }

    // PASS 2: Select best-distributed shifts across the chapter
    const selectedShifts = [];
    if (potentialShifts.length > 0) {
      // Sort by shift score (highest first)
      potentialShifts.sort((a, b) => b.shiftScore - a.shiftScore);
      
      // Calculate minimum spacing between shifts
      const minSpacing = Math.floor(totalPages / (maxShifts + 1));
      
      console.log(`   Found ${potentialShifts.length} potential shifts, selecting ${maxShifts} best with min ${minSpacing} pages spacing`);
      
      for (const shift of potentialShifts) {
        if (selectedShifts.length >= maxShifts) break;
        
        // Check if this shift is far enough from already selected shifts
        const tooClose = selectedShifts.some(selected => 
          Math.abs(selected.page - shift.page) < minSpacing
        );
        
        if (!tooClose) {
          selectedShifts.push(shift);
          console.log(`🎵 Page ${shift.page}: Selected shift (${shift.fromMood} → ${shift.toMood}, score: ${shift.shiftScore})`);
        }
      }
      
      // Sort selected shifts by page number for easy lookup
      selectedShifts.sort((a, b) => a.page - b.page);
    }

    // PASS 3: Build sections with selected shifts
    currentSectionMood = chapterMood;
    for (let page = 1; page <= totalPages; page++) {
      const shift = selectedShifts.find(s => s.page === page);
      if (shift) {
        currentSectionMood = shift.toMood;
      }

      sections.push({
        page,
        mood: currentSectionMood,
        moodStrength: 1 // Could be calculated if needed
      });
    }
    
    console.log(`✓ Analysis complete: ${selectedShifts.length} shifts distributed across ${totalPages} pages`);
    if (selectedShifts.length > 0) {
      console.log(`   Shifts at pages: ${selectedShifts.map(sp => sp.page).join(', ')}`);
    }

    return {
      sections,
      shiftPoints: selectedShifts,
      totalShifts: selectedShifts.length
    };
  }
}
