/**
 * MoodProcessor - Intelligent mood and scene analysis for matching music to narrative content
 * 
 * RESPONSIBILITIES:
 * - Analyze book/chapter content for mood, themes, and atmosphere
 * - Detect 65+ themes: cultural, musical eras, time periods, genres
 * - Generate music-relevant keywords for API queries (both Freesound and Spotify)
 * - Map moods to energy levels (1-5) and tempo (slow/medium/fast)
 * - Calculate shift points where mood changes within chapters
 * - Provide chapter-level and book-level analysis
 * 
 * INTEGRATION NOTES:
 * - API-agnostic: Works with both Freesound and Spotify
 * - Energy levels (1-5) map to Spotify energy (0.0-1.0)
 * - Tempo maps to Spotify BPM ranges
 * - Keywords map to Spotify genres via spotify-mapper.js
 * 
 * AUTO-DETECTS KEYWORDS FROM:
 * - Musical Eras: baroque, classical, romantic, renaissance, jazz
 * - Cultural Themes: viking, celtic, eastern, middle-eastern, pirate, western, african, latin
 * - Time Periods: ancient, medieval, victorian, noir, future
 * - Music Styles: orchestral, cinematic, ambient, folk, choral, electronic, tribal
 * - Genres: fantasy, sci-fi, mystery, romance, thriller, horror, adventure, war, espionage
 * 
 * EXAMPLES:
 * - "The Last Viking" → viking, epic, orchestral
 * - "Victorian Mystery" → victorian, mystery, noir
 * - "Samurai of Kyoto" → eastern, adventure, orchestral
 * - "Caribbean Pirates" → pirate, adventure, folk
 */
export class MoodProcessor {
  constructor() {
    // LOGGING CONTROL: Set to false for clean reading mode (only essential info)
    this.verboseLogging = true; // Default: show all detailed logs
    
    // Track usage history to prevent repetition
    this.recentlyPlayedTracks = new Map(); // trackId -> { lastPlayed: timestamp, playCount: number, lastChapterIndex: number }
    
    // CHAPTER-BASED TRACKING: Counter to track which chapter we're processing
    this.currentChapterIndex = 0;
    
    // ADAPTIVE COOLDOWN: Adjust based on track pool size
    // Freesound has limited CC0 music, so we need to be more lenient
    this.trackCooldownPeriod = 8; // Default: Don't repeat track for 8 chapters
    this.minCooldownPeriod = 3; // Minimum: 3 chapters (for small pools)
    this.maxCooldownPeriod = 12; // Maximum: 12 chapters (for large pools like Spotify)
    this.repetitionPenaltyStrength = 0.80; // Default: 80% penalty (adaptive based on pool size)
    
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
      dark: { 
        tags: ['dark', 'atmospheric', 'suspense', 'ominous', 'cinematic'], 
        energy: 4, 
        tempo: 'slow',
        genres: ['dark ambient', 'cinematic', 'soundtrack', 'horror']
      },
      mysterious: { 
        tags: ['mysterious', 'ambient', 'ethereal', 'enigmatic', 'atmospheric'], 
        energy: 3, 
        tempo: 'moderate',
        genres: ['ambient', 'electronic', 'soundtrack', 'minimal']
      },
      romantic: { 
        tags: ['romantic', 'gentle', 'piano', 'strings', 'emotional'], 
        energy: 2, 
        tempo: 'slow',
        genres: ['classical', 'piano', 'strings', 'orchestral']
      },
      sad: { 
        tags: ['melancholy', 'piano', 'emotional', 'somber', 'gentle'], 
        energy: 2, 
        tempo: 'slow',
        genres: ['piano', 'classical', 'acoustic', 'emotional']
      },
      epic: { 
        tags: ['epic', 'orchestral', 'cinematic', 'powerful', 'heroic'], 
        energy: 5, 
        tempo: 'upbeat',
        genres: ['orchestral', 'cinematic', 'epic', 'soundtrack']
      },
      peaceful: { 
        tags: ['calm', 'peaceful', 'ambient', 'gentle', 'serene'], 
        energy: 1, 
        tempo: 'slow',
        genres: ['ambient', 'meditation', 'calm', 'nature']
      },
      tense: { 
        tags: ['suspenseful', 'intense', 'dramatic', 'tense', 'strings'], 
        energy: 4, 
        tempo: 'moderate',
        genres: ['suspense', 'cinematic', 'thriller', 'soundtrack']
      },
      joyful: { 
        tags: ['uplifting', 'cheerful', 'bright', 'happy', 'upbeat'], 
        energy: 4, 
        tempo: 'upbeat',
        genres: ['uplifting', 'indie', 'folk', 'acoustic']
      },
      adventure: { 
        tags: ['adventurous', 'energetic', 'inspiring', 'cinematic', 'orchestral'], 
        energy: 4, 
        tempo: 'upbeat',
        genres: ['orchestral', 'cinematic', 'adventure', 'world music']
      },
      magical: { 
        tags: ['mystical', 'ethereal', 'ambient', 'fantasy', 'enchanting'], 
        energy: 3, 
        tempo: 'moderate',
        genres: ['fantasy', 'ambient', 'ethereal', 'orchestral']
      }
    };
  }

  /**
   * Set logging verbosity
   * @param {boolean} verbose - If true, shows detailed book/track analysis. If false, shows minimal info.
   */
  setVerboseLogging(verbose) {
    this.verboseLogging = verbose;

  }

  /**
   * Analyze entire book and generate mood profiles for all chapters
   */
  async analyzeBook(book) {
    if (this.verboseLogging) {
      console.log(`📖 Analyzing "${book.title}" (${book.chapters.length} chapters)...`);
    }
    
    const chapterAnalyses = book.chapters.map((chapter, index) => {
      return this.analyzeChapter(chapter, book);
    });

    const bookProfile = this._generateBookProfile(book, chapterAnalyses);
    
    if (this.verboseLogging) {
      console.log(` Mood: ${bookProfile.dominantMood} | Energy: ${bookProfile.averageEnergy}/5`);
    }
    
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
      
      // ENHANCEMENT: Calculate mood intensity (1-5 scale)
      // Higher scores = more intense mood = higher energy adjustment
      const primaryMoodScore = sortedMoods[0]?.[1] || 0;
      const moodIntensity = this._calculateMoodIntensity(primaryMoodScore, text.length);
      
      // ENHANCEMENT: Detect action/conflict level
      const actionLevel = this._detectActionLevel(text);
      
      // ENHANCEMENT: Detect time of day for atmospheric tuning
      const timeOfDay = this._detectTimeOfDay(text);

      // Get music properties for primary mood
      const musicProps = this.moodToMusicMapping[primaryMood] || this.moodToMusicMapping.peaceful;
      
      // ENHANCEMENT: Adjust energy based on intensity and action level
      let adjustedEnergy = musicProps.energy;
      
      // Intensity adjustment: high intensity can increase energy by 1
      if (moodIntensity >= 4 && adjustedEnergy < 5) {
        adjustedEnergy = Math.min(5, adjustedEnergy + 1);
      } else if (moodIntensity <= 2 && adjustedEnergy > 1) {
        adjustedEnergy = Math.max(1, adjustedEnergy - 1);
      }
      
      // Action level adjustment: high action increases energy
      if (actionLevel === 'high' && adjustedEnergy < 5) {
        adjustedEnergy = Math.min(5, adjustedEnergy + 1);
      } else if (actionLevel === 'low' && adjustedEnergy > 1) {
        adjustedEnergy = Math.max(1, adjustedEnergy - 1);
      }

      // Combine tags from primary and secondary moods + add genre tags
      const tags = [...musicProps.tags];
      if (secondaryMood && this.moodToMusicMapping[secondaryMood]) {
        // Add top 2 tags from secondary mood for nuance
        tags.push(...this.moodToMusicMapping[secondaryMood].tags.slice(0, 2));
      }
      
      // Add genre tags for better music search results
      if (musicProps.genres) {
        tags.push(...musicProps.genres.slice(0, 2));
      }
      
      // Add time-of-day atmospheric tag
      if (timeOfDay !== 'unknown') {
        tags.push(timeOfDay);
      }
      
      // Detect and add contextual themes (era, culture, setting)
      const contextualThemes = this._detectContextualThemes(text);
      if (contextualThemes.length > 0) {
        tags.push(...contextualThemes);
      }

      const normalizedKeywords = [
        primaryMood,
        secondaryMood,
        ...tags,
        ...contextualThemes,
        ...(musicProps.genres || [])
      ]
        .map((keyword) => String(keyword || '').toLowerCase().trim())
        .filter(Boolean)
        .filter((keyword, index, array) => array.indexOf(keyword) === index)
        .slice(0, 14);

      // Calculate estimated pages for this chapter
      const { estimatedPages, wordCount } = this.calculateChapterPages(chapter);

      return {
        chapterId: chapter.id || chapter.title,
        chapterTitle: chapter.title,
        primaryMood,
        secondaryMood,
        moodIntensity, // NEW: 1-5 scale
        actionLevel, // NEW: 'low', 'medium', 'high'
        timeOfDay, // NEW: 'morning', 'afternoon', 'evening', 'night', 'unknown'
        sceneScore: sceneScores[primaryMood] || 0,
        moodScore: moodScores[primaryMood] || 0,
        musicTags: [...new Set(tags)], // Remove duplicates
        keywords: normalizedKeywords,
        energy: adjustedEnergy, // NOW: Dynamically adjusted
        tempo: musicProps.tempo,
        recommendedGenres: musicProps.genres || this._getGenresForMood(primaryMood),
        estimatedPages,
        wordCount
      };
    } catch (error) {
      console.error(` Error analyzing chapter "${chapter.title}":`, error);
      console.error('Stack trace:', error.stack);
      // Return default peaceful mood on error
      const { estimatedPages, wordCount } = this.calculateChapterPages(chapter);
      return {
        chapterId: chapter.id || chapter.title,
        chapterTitle: chapter.title,
        primaryMood: 'peaceful',
        secondaryMood: null,
        sceneScore: 0,
        moodScore: 0,
        musicTags: ['calm', 'peaceful', 'ambient'],
        keywords: ['peaceful', 'calm', 'ambient', 'instrumental'],
        energy: 1,
        tempo: 'slow',
        recommendedGenres: ['ambient', 'calm'],
        estimatedPages,
        wordCount
      };
    }
  }

  /**
   * Generate overall book profile from chapter analyses
   */
  _generateBookProfile(book, chapterAnalyses) {
    const title = book.title.toLowerCase();
    const moodCounts = {};
    const chapterKeywordFrequency = new Map();
    let totalEnergy = 0;

    chapterAnalyses.forEach(analysis => {
      moodCounts[analysis.primaryMood] = (moodCounts[analysis.primaryMood] || 0) + 1;
      totalEnergy += analysis.energy;

      const chapterKeywords = Array.isArray(analysis?.keywords) && analysis.keywords.length > 0
        ? analysis.keywords
        : (analysis?.musicTags || []);
      chapterKeywords.forEach((keyword) => {
        const normalized = String(keyword || '').toLowerCase().trim();
        if (!normalized || normalized.length < 2) return;
        chapterKeywordFrequency.set(normalized, (chapterKeywordFrequency.get(normalized) || 0) + 1);
      });
    });

    const dominantMood = Object.entries(moodCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'peaceful';

    const avgEnergy = Math.round(totalEnergy / chapterAnalyses.length);
    const chapterKeywordPool = [...chapterKeywordFrequency.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([keyword]) => keyword);

    // Enhance with title analysis
    let titleMood = null;
    for (const [mood, keywords] of Object.entries(this.moodKeywords)) {
      if (keywords.some(keyword => title.includes(keyword))) {
        titleMood = mood;
        break;
      }
    }

    // Get user-defined book vibe keywords from settings
    const settings = JSON.parse(localStorage.getItem('booksWithMusic-settings') || '{}');
    const userBookVibeKeywords = settings.bookVibeKeywords || '';
    
    // Extract book vibe keywords from title and content (automatic detection)
    const autoDetectedKeywords = this._extractBookVibeKeywords(book, dominantMood);
    
    // Combine auto-detected with user-defined keywords
    const bookVibeKeywords = userBookVibeKeywords.trim() 
      ? userBookVibeKeywords.split(',').map(k => k.trim()).filter(k => k)
      : autoDetectedKeywords;
    
    // Log if user keywords are overriding auto-detected ones
    if (this.verboseLogging) {
      if (userBookVibeKeywords.trim()) {
        console.warn(`⚠️ USER-DEFINED keywords: [${bookVibeKeywords.join(', ')}] (auto was: [${autoDetectedKeywords.join(', ')}])`);
        console.log('   💡 Tip: Clear manual keywords in settings to use auto-detection');
      } else {
        console.log(`✅ Using AUTO-DETECTED keywords: [${bookVibeKeywords.join(', ')}]`);
      }
    }

    return {
      title: book.title,
      dominantMood,
      titleMood: titleMood || dominantMood,
      averageEnergy: avgEnergy,
      moodDistribution: moodCounts,
      recommendedTags: this.moodToMusicMapping[dominantMood]?.tags || ['ambient', 'calm'],
      chapterKeywordPool,
      tempo: avgEnergy > 3 ? 'upbeat' : avgEnergy > 2 ? 'moderate' : 'slow',
      bookVibeKeywords, // User-editable keywords to influence entire book
      autoDetectedKeywords, // Auto-detected for reference
      isUserDefinedVibe: !!userBookVibeKeywords.trim() // Track if user manually set keywords
    };
  }

  /**
   * Extract book vibe keywords from book title and overall theme
   * These keywords influence music selection for the entire book
   * Now uses enhanced contextual detection with scoring
   */
  _extractBookVibeKeywords(book, dominantMood) {
    const keywords = [];
    const title = book.title.toLowerCase();
    const content = this._getSampleContent(book);
    const combinedText = `${title} ${content}`;
    
    if (this.verboseLogging) {
      console.log('\n🔍 Book Vibe Analysis', { title: book.title, contentLength: content.length, dominantMood });
    }
    
    // Add dominant mood as keyword (always first)
    keywords.push(dominantMood);
    
    // Use the enhanced contextual theme detection
    if (this.verboseLogging) {
      console.log('   🔎 Detecting themes...');
    }
    const contextualThemes = this._detectContextualThemesWithScores(combinedText);
    
    // Filter out weak themes (need at least 3 matches to be significant)
    const MIN_THEME_MATCHES = 3;
    const significantThemes = contextualThemes.filter(t => t.score >= MIN_THEME_MATCHES);
    
    // Log themes with matched words for debugging
    if (this.verboseLogging) {
      if (significantThemes.length > 0) {
        significantThemes.forEach(({ theme, score, matches }) => {
          const matchPreview = matches.slice(0, 5).join(',');
          const more = matches.length > 5 ? ` +${matches.length - 5}` : '';
          console.log(`      ✅ ${theme} (${score}): ${matchPreview}${more}`);
        });
      } else if (contextualThemes.length > 0) {
        const weak = contextualThemes.map(t => `${t.theme}(${t.score})`).join(', ');
        console.log(`      ℹ️ Weak themes (< ${MIN_THEME_MATCHES}): ${weak}`);
      } else {
        console.log('      ℹ️ No themes detected');
      }
    }
    
    // Add only significant themes to keywords
    keywords.push(...significantThemes.map(t => t.theme));
    
    // Add music-relevant descriptors based on dominant mood (max 2)
    const moodDescriptors = this.moodToMusicMapping[dominantMood]?.tags.slice(0, 2) || [];
    if (this.verboseLogging) {
      console.log(`   🎵 Mood descriptors: [${moodDescriptors.join(', ')}]`);
    }
    keywords.push(...moodDescriptors);
    
    // Remove duplicates and empty values, limit to top 5 most relevant
    const uniqueKeywords = [...new Set(keywords.filter(k => k))];
    const finalKeywords = uniqueKeywords.slice(0, 5);
    
    if (this.verboseLogging) {
      console.log(`   🎯 Final keywords: [${finalKeywords.join(', ')}]`);
    }
    
    return finalKeywords;
  }
  
  /**
   * Get sample content from book for analysis (first few chapters)
   */
  _getSampleContent(book) {
    if (!book.chapters || book.chapters.length === 0) return '';
    
    // Get first 3 chapters or first 5000 characters
    const sampleChapters = book.chapters.slice(0, 3);
    const combinedContent = sampleChapters
      .map(ch => ch.content || '')
      .join(' ')
      .toLowerCase()
      .slice(0, 5000);
    
    return combinedContent;
  }
  
  /**
   * Detect contextual themes from text (eras, cultures, locations, music styles)
   * Includes situation-based keywords for better detection
   * Returns array with scores for logging purposes
   */
  _detectContextualThemesWithScores(text) {
    const themes = [];
    
    // Enhanced detection patterns with situations, actions, and contextual keywords
    const themePatterns = {
      // ====== CULTURAL/GEOGRAPHIC ======
      'viking': /\b(viking|norse|valhalla|odin|thor|ragnarok|norsemen|scandinavia|nordic|berserker|longship|raid|fjord|mead hall|shield wall|valkyrie|rune|skald|jarl|drakkars?|axes?|horned helm)\b/i,
      
      'celtic': /\b(celtic|irish|scottish|gaelic|druid|highlands|bagpipe|bard|kilt|clan|loch|moor|heather|cairn|stone circle|shamrock|leprechaun|tuatha|sidhe|harp)\b/i,
      
      'eastern': /\b(eastern|oriental|asia|japan|china|samurai|ninja|zen|temple|geisha|shogun|dojo|katana|kimono|pagoda|bonsai|meditation|martial arts?|emperor|dynasty|silk road|tea ceremony|cherry blossom|bamboo|honor|bushido)\b/i,
      
      'middle-eastern': /\b(arabian|persian|desert|sultan|bazaar|oasis|arabic|bedouin|minaret|mosque|camel|caravan|sand dune|scimitar|turban|harem|carpet|genie|djinn|caliph|kebab|hookah|spice market)\b/i,
      
      'african': /\b(african|tribal|savanna|safari|drums?|ancient africa|jungle|lion|elephant|tribe|chief|warrior|mask|ceremony|village|acacia|baobab|griot|shaman|ancestor)\b/i,
      
      'latin': /\b(latin|spanish|flamenco|tango|mariachi|conquistador|hacienda|fiesta|siesta|sombrero|guitar|castanets|matador|bullfight|paso doble|salsa|rumba)\b/i,
      
      'pirate': /\b(pirate|buccaneer|caribbean|sailing|treasure|captain|ship|cutlass|plunder|crew|jolly roger|parrot|rum|anchor|mast|deck|cannon|mutiny|island|chest|gold doubloon|sea dog|privateer|boarding|keelhaul)\b/i,
      
      'western': /\b(western|cowboy|frontier|saloon|gunslinger|outlaw|sheriff|ranch|duel|horse|wagon|gold rush|desert|cactus|tumbleweeds?|spurs|lasso|rodeo|cattle|homestead|pioneer|six-shooter|bandits?)\b/i,
      
      'native-american': /\b(native american|tribal|totem|teepee|wigwam|peace pipe|war paint|feather|buffalo|spirit animal|shaman|medicine man|pow wow|tomahawk|moccasin|brave)\b/i,
      
      'indian': /\b(india|indian|hindu|bollywood|sitar|tabla|raga|maharaja|maharani|temple|ganges|delhi|mumbai|taj mahal|curry|sari|namaste|guru|yoga|karma|mantra|vedic)\b/i,
      
      'russian': /\b(russia|russian|moscow|kremlin|tsar|tsarina|cossack|troika|balalaika|vodka|borscht|soviet|red square|siberia|st petersburg|ballet|bolshoi)\b/i,
      
      'greek': /\b(greek|greece|athens|sparta|olympus|zeus|apollo|athena|oracle|parthenon|acropolis|hoplite|philosopher|agora|olympic|mediterranean|aegean)\b/i,
      
      'aztec-mayan': /\b(aztec|mayan|inca|pyramid|sacrifice|temple|jaguar|serpent|quetzalcoatl|calendar|conquistador|gold|ritual|shaman|maize)\b/i,
      
      'polynesian': /\b(polynesian|hawaiian|pacific|island|tiki|luau|hula|ukulele|lei|volcano|surf|canoe|tribal|tatau|mana|aloha)\b/i,
      
      'australian': /\b(australia|outback|aboriginal|didgeridoo|kangaroo|bush|boomerang|dreamtime|uluru|billabong|dingo)\b/i,
      
      'arctic': /\b(arctic|inuit|eskimo|igloo|tundra|ice|snow|polar bear|aurora|northern lights|sled|husky|kayak|walrus|seal)\b/i,
      
      // ====== MUSICAL ERAS ======
      'baroque': /\b(baroque|bach|vivaldi|handel|harpsichord|fugue|counterpoint|concerto grosso|oratorio|cantata|toccata|passacaglia)\b/i,
      
      'classical': /\b(classical|mozart|haydn|symphony|sonata|chamber music|string quartet|piano forte|minuet|rondo|allegro)\b/i,
      
      'romantic': /\b(romantic|chopin|beethoven|brahms|liszt|waltz|nocturne|prelude|etude|virtuoso|passionate|expressive|grand piano)\b/i,
      
      'jazz': /\b(jazz|swing|blues|bebop|saxophone|trumpet|improvisation|syncopation|big band|dixie|ragtime|speakeasy|nightclub)\b/i,
      
      'renaissance': /\b(renaissance|lute|madrigal|troubadour|minstrel|court music|pavane|galliard|viol|recorder)\b/i,
      
      'rock': /\b(rock|guitar|electric|drums|band|concert|stage|riff|solo|metal|punk|grunge|alternative)\b/i,
      
      'soul': /\b(soul|motown|rhythm and blues|r&b|gospel|spiritual|church|praise|choir|powerful voice)\b/i,
      
      'country': /\b(country|hillbilly|bluegrass|nashville|honky tonk|steel guitar|fiddle|twang)\b/i,
      
      // ====== TIME PERIODS ======
      'ancient': /\b(ancient|rome|greece|egypt|pharaoh|gladiator|caesar|sparta|colosseum|forum|chariot|legionnaire|centurion|pyramid|sphinx|hieroglyph|toga|amphitheatre|pantheon|olympic|oracle|trojan)\b/i,
      
      'medieval': /\b(medieval|knight|castle|crusade|feudal|middle ages|chivalry|tournament|joust|armor|sword|drawbridge|moat|siege|lord|lady|peasant|monastery|tapestry|coat of arms|holy grail)\b/i,
      
      'victorian': /\b(victorian|gaslight|industrial|steampunk|chimney|coal|gentleman|lady|corset|top hat|carriage|locomotive|factory|workhouse|manor|parlor|tea time|empire)\b/i,
      
      'renaissance': /\b(renaissance|elizabethan|florence|venice|patron|medici|da vinci|michelangelo|gallery|palazzo|gondola|masquerade|doublet|ruff collar)\b/i,
      
      'jazz-age': /\b(jazz age|1920s|roaring twenties|speakeasy|prohibition|gatsby|flapper|charleston|art deco|bootlegger|gangster)\b/i,
      
      'noir': /\b(noir|detective|gumshoe|1940s|private eye|femme fatale|trench coat|fedora|cigarette|rain|shadows|alley|investigation|dame)\b/i,
      
      'future': /\b(future|cyberpunk|dystopian|utopian|post-apocalyptic|cyber|neon|hacker|android|cyborg|virtual reality|hologram|laser|space station)\b/i,
      
      'prehistoric': /\b(prehistoric|dinosaur|caveman|stone age|mammoth|saber tooth|neanderthal|fossil|ice age|cave painting|primitive|bronze age|iron age)\b/i,
      
      'colonial': /\b(colonial|colony|settler|plantation|revolution|independence|minuteman|redcoat|founding father|declaration)\b/i,
      
      'civil-war': /\b(civil war|confederate|union|yankee|rebel|slavery|emancipation|battlefield|musket|gettysburg)\b/i,
      
      'world-war': /\b(world war|wwi|ww1|wwii|ww2|nazi|hitler|d-day|normandy|trenches|blitz|holocaust|atomic|hiroshima)\b/i,
      
      'cold-war': /\b(cold war|soviet|kgb|cia|berlin wall|iron curtain|nuclear|missile|espionage|defector)\b/i,
      
      '1950s': /\b(1950s|fifties|rockabilly|diner|jukebox|sock hop|poodle skirt|greaser|elvis)\b/i,
      
      '1960s': /\b(1960s|sixties|hippie|woodstock|peace|love|psychedelic|beatles|vietnam|protest)\b/i,
      
      '1970s': /\b(1970s|seventies|disco|funk|afro|bell bottom|platform|groovy|watergate)\b/i,
      
      '1980s': /\b(1980s|eighties|synth pop|new wave|arcade|cassette|walkman|neon|big hair|cold war)\b/i,
      
      '1990s': /\b(1990s|nineties|grunge|hip hop|rave|internet|dial up|beeper|mtv)\b/i,
      
      // ====== MUSIC STYLES & SETTINGS ======
      'orchestral': /\b(orchestra|symphony|philharmonic|ensemble|conductor|string section|brass|woodwind|percussion|concert hall|opus|maestro|baton)\b/i,
      
      'choral': /\b(choir|choral|chorus|hymn|cathedral|church|monastery|abbey|basilica|chapel|organ|psalms?|mass|requiem|vespers|gregorian|sacred music)\b/i,
      
      'folk': /\b(folk|acoustic|traditional|village|tavern|minstrel|ballad|campfire|storyteller|fiddle|banjo|accordion|harmonica|country fair|dance hall)\b/i,
      
      'tribal': /\b(tribal|drums?|primitive|ritual|ceremonial|shaman|bonfire|dance|chant|trance|totem|mask|ancestor|spirit|beat)\b/i,
      
      'ambient': /\b(ambient|atmospheric|ethereal|dreamy|floating|meditation|spa|relaxation|soundscape|drone|minimalist|zen)\b/i,
      
      // More specific electronic music terms - removed broad words like "beat", "pulse", "machine"
      'electronic': /\b(electronic music|synth|synthesizer|digital music|techno|cyber|edm|electronica|rave|club music|dj|mixer|trance music)\b/i,
      
      'piano': /\b(piano|pianist|keys|ivory|grand piano|baby grand|concert piano|chopin|nocturne|sonata)\b/i,
      
      'strings': /\b(violin|viola|cello|string quartet|bow|concertmaster|virtuoso)\b/i,
      
      'guitar': /\b(guitar|guitarist|acoustic guitar|classical guitar|strings|fingerpicking|chord|melody)\b/i,
      
      'opera': /\b(opera|soprano|tenor|aria|libretto|diva|opera house|overture|la scala)\b/i,
      
      'musical-theater': /\b(musical|broadway|theater|west end|showstopper|ensemble|curtain call|opening night)\b/i,
      
      // ====== SPECIAL SITUATIONS & EVENTS ======
      'battle': /\b(battle|combat|fight|war|clash|conflict|skirmish|assault|charge|rally|troops|formation|strategy|victory|defeat)\b/i,
      
      'royal': /\b(royal|king|queen|prince|princess|throne|crown|coronation|court|palace|banquet|ball|nobility|majesty|decree)\b/i,
      
      'mystical': /\b(mystical|magic|spell|wizard|witch|sorcerer|enchant|potion|crystal|prophecy|divination|arcane|ritual|incantation)\b/i,
      
      'nautical': /\b(nautical|sea|ocean|ship|sail|voyage|port|harbor|lighthouse|storm|waves?|tide|fleet|admiral|navy)\b/i,
      
      'wilderness': /\b(wilderness|forest|jungle|mountain|valley|river|lake|campsite|hunting|tracking|survival|expedition|explorer)\b/i,
      
      'heist': /\b(heist|robbery|bank|vault|steal|thief|burglar|safe|loot|getaway|mastermind|crew)\b/i,
      
      'chase': /\b(chase|pursuit|running|escape|flee|manhunt|fugitive|on the run|getaway)\b/i,
      
      'romance': /\b(romance|love|kiss|embrace|passion|wedding|honeymoon|proposal|engagement|valentine|soulmate)\b/i,
      
      'tragedy': /\b(tragedy|death|funeral|grief|mourning|loss|farewell|goodbye|tears|heartbreak)\b/i,
      
      'celebration': /\b(celebration|party|festival|carnival|parade|fireworks|cheers|toast|wedding|birthday|anniversary)\b/i,
      
      'religious': /\b(religious|prayer|worship|divine|sacred|holy|blessing|miracle|faith|devotion|pilgrimage|saint)\b/i,
      
      'courtroom': /\b(courtroom|trial|judge|jury|lawyer|attorney|witness|testimony|verdict|guilty|innocent|gavel)\b/i,
      
      // Removed "patient" and "medicine" as they're too ambiguous (patient can be adjective, medicine overlaps with medieval)
      'medical': /\b(hospital|doctor|surgeon|surgery|operation|emergency room|diagnosis|cure|medical|nurse|ambulance|clinic|physician)\b/i,
      
      'apocalyptic': /\b(apocalypse|doomsday|armageddon|extinction|survivors|wasteland|ruins|collapse|fallout|radiation)\b/i,
      
      'haunted': /\b(haunted|ghost|spirit|phantom|specter|apparition|poltergeist|supernatural|curse|possessed|exorcism)\b/i,
      
      'cosmic': /\b(cosmic|space|universe|galaxy|stars|nebula|black hole|astronaut|spaceship|alien|extraterrestrial|cosmos)\b/i,
      
      'urban': /\b(urban|city|metropolis|skyscraper|street|subway|traffic|downtown|nightlife|concrete jungle)\b/i,
      
      'rural': /\b(rural|farm|countryside|barn|harvest|wheat|plow|tractor|pastoral|meadow|valley)\b/i
    };
    
    // Score each theme based on keyword frequency
    const themeScores = {};
    const themeMatches = {}; // Store actual matched words for debugging
    
    for (const [theme, pattern] of Object.entries(themePatterns)) {
      const matches = text.match(pattern);
      if (matches) {
        // Count matches and store matched words (unique)
        themeScores[theme] = matches.length;
        themeMatches[theme] = [...new Set(matches)]; // Remove duplicates for cleaner logging
      }
    }
    
    // Sort by score and take top 3 themes, return with scores and matches
    const sortedThemes = Object.entries(themeScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([theme, score]) => ({ 
        theme, 
        score, 
        matches: themeMatches[theme] || [] 
      }));
    
    return sortedThemes;
  }
  
  /**
   * Detect contextual themes from text (legacy version without scores)
   * Kept for backward compatibility
   */
  _detectContextualThemes(text) {
    const themesWithScores = this._detectContextualThemesWithScores(text);
    return themesWithScores.map(t => t.theme);
  }

  /**
   * Calculate estimated page count for a chapter based on word count
   * Uses same calculation as track selection (300 words per page)
   */
  calculateChapterPages(chapter) {
    const wordCount = chapter.content?.split(/\s+/).length || 1000;
    const estimatedPages = Math.max(1, Math.ceil(wordCount / 300));
    return { estimatedPages, wordCount };
  }

  /**
   * Calculate total estimated pages for entire book
   */
  calculateTotalBookPages(book) {
    return book.chapters.reduce((total, chapter) => {
      const { estimatedPages } = this.calculateChapterPages(chapter);
      return total + estimatedPages;
    }, 0);
  }

  /**
   * Get appropriate music genres for a mood
   * Used as fallback if mood mapping doesn't have genres
   */
  _getGenresForMood(mood) {
    const genreMap = {
      dark: ['dark ambient', 'cinematic', 'soundtrack', 'horror'],
      mysterious: ['ambient', 'electronic', 'minimal', 'soundtrack'],
      romantic: ['classical', 'piano', 'strings', 'orchestral'],
      sad: ['piano', 'classical', 'acoustic', 'emotional'],
      epic: ['orchestral', 'cinematic', 'epic', 'soundtrack'],
      peaceful: ['ambient', 'meditation', 'calm', 'nature'],
      tense: ['suspense', 'cinematic', 'thriller', 'soundtrack'],
      joyful: ['uplifting', 'indie', 'folk', 'acoustic'],
      adventure: ['orchestral', 'cinematic', 'adventure', 'world music'],
      magical: ['fantasy', 'ambient', 'ethereal', 'orchestral']
    };

    return genreMap[mood] || ['instrumental', 'ambient', 'soundtrack'];
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
  /**
   * Select multiple tracks for a chapter based on mood, energy, and settings
   * Now includes book-level vibe keywords for overall atmosphere
   */
  selectTracksForChapter(chapterAnalysis, availableTracks, chapter, bookProfile = null) {
    if (!availableTracks || availableTracks.length === 0) {
      return [];
    }

    // Increment chapter counter for penalty decay tracking
    this.currentChapterIndex++;

    // Periodic cleanup: Remove tracks from history that are beyond max cooldown
    // This prevents the map from growing indefinitely
    const MAX_HISTORY_AGE = 60 * 60 * 1000; // 1 hour in milliseconds
    const now = Date.now();
    for (const [trackId, info] of this.recentlyPlayedTracks.entries()) {
      if (now - info.lastPlayed > MAX_HISTORY_AGE) {
        this.recentlyPlayedTracks.delete(trackId);
      }
    }

    // Get settings from localStorage
    const settings = JSON.parse(localStorage.getItem('booksWithMusic-settings') || '{}');
    const songsPerChapter = Math.max(1, Math.min(20, Math.floor(Number(settings.songsPerChapter) || 5)));
    const minSongsPerPages = Math.max(1, Math.min(10, Math.floor(Number(settings.minSongsPerPages) || 1)));

    // Estimate chapter length in pages (rough estimate: 300 words per page)
    const wordCount = chapter.content?.split(/\s+/).length || 1000;
    const estimatedPages = Math.max(1, Math.ceil(wordCount / 300));
    
    // Calculate track count based on settings (capped to UI-supported max).
    // Use the max of: songsPerChapter setting OR minimum based on page count.
    const minTracksForPages = Math.ceil(estimatedPages / minSongsPerPages);
    const trackCount = Math.min(20, Math.max(songsPerChapter, minTracksForPages));

    // Get book vibe keywords if available
    const bookVibeKeywords = bookProfile?.bookVibeKeywords || [];
    
    // Compact logging - chapter identification and book vibe context with enhancements
    const chapterInfo = [
      `📖 "${chapter.title || chapter.id}"`,
      `${estimatedPages}p`,
      `${chapterAnalysis.primaryMood}`,
      `E${chapterAnalysis.energy}`
    ];
    
    // Show mood intensity if notable
    if (chapterAnalysis.moodIntensity >= 4) {
      chapterInfo.push(`Intensity:${chapterAnalysis.moodIntensity}/5`);
    }
    
    // Show action level if significant
    if (chapterAnalysis.actionLevel !== 'low') {
      chapterInfo.push(`Action:${chapterAnalysis.actionLevel}`);
    }
    
    // Show time of day if detected
    if (chapterAnalysis.timeOfDay !== 'unknown') {
      chapterInfo.push(`Time:${chapterAnalysis.timeOfDay}`);
    }
    
    if (this.verboseLogging) {
      if (bookVibeKeywords.length > 0) {
        const vibeSource = bookProfile?.isUserDefinedVibe ? 'USER' : 'AUTO';
        chapterInfo.push(`BookVibe:[${bookVibeKeywords.join(',')}](${vibeSource})`);
      }
      chapterInfo.push(`Tags:[${(chapterAnalysis.musicTags || []).slice(0, 5).join(',')}${(chapterAnalysis.musicTags || []).length > 5 ? '...' : ''}]`);
    }
    // Disabled: console.log('\n' + chapterInfo.join(' | '));
    
    // Log available track pool info
    if (this.verboseLogging) {
      console.log(`   🎵 Track pool: ${availableTracks.length} total tracks available`);
    }

    // Score all tracks with enhanced algorithm
    const scoredTracks = availableTracks.map(track => {
      let score = 0;
      const scoreBreakdown = {
        bookVibe: 0,
        tagMatch: 0,
        energyMatch: 0,
        tempoMatch: 0
      };
      
      const trackTags = (track.tags || []).map(t => t.toLowerCase());
      const chapterTags = (chapterAnalysis.musicTags || []).map(t => t.toLowerCase());

      // PRIORITY 0: Book vibe keywords (adaptive weighting based on user intent)
      // EXPANDED semantic matching: comprehensive cultural/temporal/style mappings
      if (bookVibeKeywords.length > 0) {
        // SMART WEIGHTING: Strong influence if user-defined, moderate if auto-detected
        // User override: 8 pts per match (dominant influence, user explicitly wants this)
        // Auto-detected: 3 pts per match (suggestion, allows more variety)
        const bookVibeWeight = bookProfile?.isUserDefinedVibe ? 8 : 3;
        
        // EXPANDED Semantic associations: book theme → relevant music tags
        const semanticMap = {
          // Cultural themes
          'medieval': ['medieval', 'historical', 'knight', 'castle', 'battle', 'orchestral', 'epic', 'cinematic', 'traditional', 'folk', 'celtic', 'ancient'],
          'viking': ['viking', 'norse', 'epic', 'battle', 'war', 'drums', 'orchestral', 'cinematic', 'folk', 'nordic', 'tribal', 'warrior'],
          'celtic': ['celtic', 'irish', 'scottish', 'folk', 'traditional', 'fiddle', 'bagpipe', 'harp', 'pastoral', 'mystical'],
          'eastern': ['eastern', 'asian', 'oriental', 'chinese', 'japanese', 'shamisen', 'koto', 'erhu', 'zen', 'meditative', 'traditional'],
          'middle-eastern': ['middle-eastern', 'arabic', 'persian', 'oud', 'desert', 'exotic', 'traditional', 'mysterious'],
          'pirate': ['pirate', 'sea', 'nautical', 'ocean', 'adventure', 'cinematic', 'orchestral', 'folk', 'shanty'],
          'western': ['western', 'cowboy', 'frontier', 'guitar', 'harmonica', 'folk', 'americana', 'desert'],
          'african': ['african', 'tribal', 'drums', 'percussion', 'rhythmic', 'traditional', 'world'],
          'latin': ['latin', 'spanish', 'guitar', 'flamenco', 'passionate', 'rhythmic', 'traditional'],
          'native-american': ['native-american', 'tribal', 'flute', 'drums', 'spiritual', 'nature', 'traditional'],
          'aztec-mayan': ['ancient', 'tribal', 'ceremonial', 'drums', 'mystical', 'pre-columbian'],
          
          // Time periods
          'ancient': ['ancient', 'historical', 'classical', 'epic', 'orchestral', 'traditional', 'timeless'],
          'victorian': ['victorian', 'classical', 'orchestral', 'elegant', 'piano', 'strings', 'historical', 'refined'],
          'noir': ['noir', 'jazz', 'saxophone', 'mysterious', 'dark', 'urban', 'suspenseful', '1940s'],
          'renaissance': ['renaissance', 'classical', 'baroque', 'orchestral', 'elegant', 'historical', 'refined'],
          'baroque': ['baroque', 'classical', 'orchestral', 'harpsichord', 'strings', 'elegant'],
          'classical': ['classical', 'orchestral', 'piano', 'strings', 'elegant', 'refined', 'sophisticated'],
          'jazz-age': ['jazz', 'swing', 'big band', '1920s', 'saxophone', 'piano', 'upbeat'],
          'future': ['futuristic', 'electronic', 'synth', 'sci-fi', 'ambient', 'modern', 'digital'],
          
          // Music styles
          'orchestral': ['orchestral', 'symphony', 'classical', 'cinematic', 'strings', 'brass', 'epic'],
          'epic': ['epic', 'orchestral', 'cinematic', 'powerful', 'heroic', 'dramatic', 'battle', 'triumphant'],
          'cinematic': ['cinematic', 'orchestral', 'epic', 'dramatic', 'film score', 'soundtrack', 'powerful'],
          'ambient': ['ambient', 'atmospheric', 'ethereal', 'calm', 'meditative', 'peaceful', 'spacious'],
          'folk': ['folk', 'acoustic', 'traditional', 'pastoral', 'guitar', 'fiddle', 'rustic'],
          'choral': ['choral', 'choir', 'sacred', 'religious', 'cathedral', 'vocal', 'spiritual'],
          'piano': ['piano', 'classical', 'emotional', 'gentle', 'elegant', 'solo'],
          'strings': ['strings', 'violin', 'cello', 'orchestral', 'classical', 'emotional'],
          'electronic': ['electronic', 'synth', 'digital', 'modern', 'ambient', 'futuristic'],
          
          // Genres & atmospheres
          'fantasy': ['fantasy', 'magical', 'mystical', 'epic', 'orchestral', 'cinematic', 'adventure', 'ethereal'],
          'royal': ['royal', 'noble', 'regal', 'classical', 'orchestral', 'elegant', 'grand', 'majestic', 'cinematic', 'palace'],
          'village': ['folk', 'pastoral', 'acoustic', 'traditional', 'rural', 'countryside', 'calm', 'peaceful'],
          'noble': ['classical', 'orchestral', 'elegant', 'regal', 'sophisticated', 'cinematic'],
          'mystical': ['mystical', 'magical', 'ethereal', 'ambient', 'spiritual', 'mysterious'],
          'dark': ['dark', 'atmospheric', 'ominous', 'suspenseful', 'dramatic', 'intense'],
          'peaceful': ['peaceful', 'calm', 'serene', 'ambient', 'gentle', 'relaxing', 'tranquil'],
          'romantic': ['romantic', 'gentle', 'emotional', 'piano', 'strings', 'tender'],
          'adventure': ['adventure', 'epic', 'orchestral', 'cinematic', 'energetic', 'exciting'],
          'mysterious': ['mysterious', 'ambient', 'ethereal', 'enigmatic', 'atmospheric', 'suspenseful']
        };
        
        bookVibeKeywords.forEach(vibeKeyword => {
          const vibeKeywordLower = vibeKeyword.toLowerCase();
          const relatedTags = semanticMap[vibeKeywordLower] || [vibeKeywordLower];
          
          trackTags.forEach(trackTag => {
            const trackTagLower = trackTag.toLowerCase();
            
            // Check for exact or semantic match
            if (relatedTags.some(relatedTag => {
              // Exact match
              if (relatedTag === trackTagLower) return true;
              // Partial match (min 4 chars)
              if (relatedTag.length >= 4 && trackTagLower.length >= 4) {
                return relatedTag.includes(trackTagLower) || trackTagLower.includes(relatedTag);
              }
              return false;
            })) {
              // Apply adaptive weighting based on user intent
              score += bookVibeWeight;
              scoreBreakdown.bookVibe += bookVibeWeight;
            }
          });
        });
      }

      // PRIORITY 1: Tag matching (most important)
      chapterTags.forEach(chapterTag => {
        trackTags.forEach(trackTag => {
          // Exact match
          if (chapterTag === trackTag) {
            score += 5;
            scoreBreakdown.tagMatch += 5;
          }
          // Partial match (one contains the other)
          else if (chapterTag.includes(trackTag) || trackTag.includes(chapterTag)) {
            score += 3;
            scoreBreakdown.tagMatch += 3;
          }
        });
      });

      // PRIORITY 2: Energy level match (important for pacing)
      if (track.energy) {
        const energyDiff = Math.abs(track.energy - chapterAnalysis.energy);
        // Perfect match: +5, Close: +3, Off by 2: +1, Off by 3+: 0
        if (energyDiff === 0) {
          score += 5;
          scoreBreakdown.energyMatch += 5;
        } else if (energyDiff === 1) {
          score += 3;
          scoreBreakdown.energyMatch += 3;
        } else if (energyDiff === 2) {
          score += 1;
          scoreBreakdown.energyMatch += 1;
        }
      }

      // PRIORITY 3: Tempo match (helpful for atmosphere)
      if (track.tempo && track.tempo === chapterAnalysis.tempo) {
        score += 3;
        scoreBreakdown.tempoMatch += 3;
      }

      return { track, score, scoreBreakdown };
    });

    // Sort by score (best matches first)
    scoredTracks.sort((a, b) => b.score - a.score);
    
    // ADAPTIVE COOLDOWN: Adjust based on track pool size
    // Small pools (like Freesound) need more lenient penalties
    const poolSize = availableTracks.length;
    let adaptiveCooldown = this.trackCooldownPeriod;
    let adaptivePenalty = this.repetitionPenaltyStrength;
    
    if (poolSize < 100) {
      // SMALL POOL (Freesound): Very lenient
      adaptiveCooldown = this.minCooldownPeriod; // 3 chapters
      adaptivePenalty = 0.50; // 50% penalty (gentle)
      if (poolSize < 50) {
        adaptivePenalty = 0.30; // 30% penalty (very gentle for tiny pools)
      }
    } else if (poolSize < 200) {
      // MEDIUM POOL: Moderate
      adaptiveCooldown = 6; // 6 chapters
      adaptivePenalty = 0.65; // 65% penalty
    } else {
      // LARGE POOL (Spotify): Strict
      adaptiveCooldown = this.maxCooldownPeriod; // 12 chapters
      adaptivePenalty = 0.85; // 85% penalty
    }
    
    // ENHANCEMENT: Apply smart anti-repetition penalty with decay
    // Uses percentage-based reduction that gradually decreases over time
    scoredTracks.forEach(scored => {
      const trackId = scored.track.id || scored.track.title;
      if (this.recentlyPlayedTracks.has(trackId)) {
        const info = this.recentlyPlayedTracks.get(trackId);
        const usageCount = info.count || 1;
        
        // Calculate chapters since last played (chapter-based, not time-based)
        const chaptersSinceLastPlayed = this.currentChapterIndex - (info.lastChapterIndex || 0);
        
        // PENALTY DECAY SYSTEM:
        // - Tracks become "fresh" again after enough chapters
        // - Heavily-used tracks need longer cooldown
        const baseCooldown = adaptiveCooldown;
        const usageCooldown = baseCooldown + Math.min(usageCount * 2, 10); // Max +10 chapters for heavy use
        
        if (chaptersSinceLastPlayed < usageCooldown) {
          // DECAY FORMULA: Penalty decreases linearly from max to 0 over the cooldown period
          const decayRatio = 1 - (chaptersSinceLastPlayed / usageCooldown); // 1.0 = just played, 0.0 = cooldown complete
          const penaltyPercent = adaptivePenalty * decayRatio; // Full penalty when just played, 0% at cooldown end
          
          const originalScore = scored.score;
          scored.score = Math.floor(scored.score * (1 - penaltyPercent));
          scored.scoreBreakdown.repetitionPenalty = scored.score - originalScore;
          
          // Mark as recently played only if penalty is significant (>10%)
          if (penaltyPercent > 0.10) {
            scored.recentlyPlayed = true;
            scored.penaltyInfo = `${Math.round(penaltyPercent * 100)}% (used ${usageCount}x, ${chaptersSinceLastPlayed}/${usageCooldown} ch ago)`;
          }
        }
        // If chaptersSinceLastPlayed >= usageCooldown, track is fully "fresh" again
      }
    });
    
    // Re-sort after applying penalties
    scoredTracks.sort((a, b) => b.score - a.score);
    
    // Log penalty statistics with adaptive info
    if (this.verboseLogging) {
      const penalizedCount = scoredTracks.filter(s => s.recentlyPlayed).length;
      if (penalizedCount > 0) {
        const poolType = poolSize < 100 ? '🔵 SMALL POOL' : poolSize < 200 ? '🟡 MEDIUM POOL' : '🟢 LARGE POOL';
        console.log(`   ${poolType}: ${penalizedCount}/${scoredTracks.length} tracks penalized (${adaptiveCooldown}ch base cooldown, ${Math.round(adaptivePenalty * 100)}% max penalty with decay)`);
        
        // Show sample of penalty info for debugging
        const sampledPenalties = scoredTracks
          .filter(s => s.penaltyInfo)
          .slice(0, 3)
          .map(s => `"${s.track.title}": ${s.penaltyInfo}`)
          .join('; ');
        if (sampledPenalties) {
          console.log(`   📉 Penalty decay samples: ${sampledPenalties}`);
        }
      } else {
        const poolType = poolSize < 100 ? '🔵 SMALL POOL' : poolSize < 200 ? '🟡 MEDIUM POOL' : '🟢 LARGE POOL';
        console.log(`   ${poolType}: 0/${scoredTracks.length} tracks penalized - all tracks are fresh! 🎉`);
      }
    }
    
    // CRITICAL: Adaptive filtering to prevent repetition
    // Thresholds adjust based on pool size
    const freshTracks = scoredTracks.filter(scored => !scored.recentlyPlayed);
    const MIN_FRESH_TRACKS = poolSize < 100 ? 5 : poolSize < 200 ? 10 : 15; // Smaller pools need lower thresholds
    
    let tracksToUse;
    let filterStrategy = '';
    if (freshTracks.length >= MIN_FRESH_TRACKS) {
      // Use only fresh tracks
      tracksToUse = freshTracks;
      filterStrategy = `✅ FRESH ONLY: ${freshTracks.length} tracks (excluded ${scoredTracks.length - freshTracks.length} recently played)`;
    } else {
      // Not enough fresh tracks, use score-based filtering instead
      const MIN_ACCEPTABLE_SCORE = poolSize < 100 ? 3 : 8; // Lower threshold for small pools
      const viableTracks = scoredTracks.filter(scored => scored.score >= MIN_ACCEPTABLE_SCORE);
      
      const minViableTracks = poolSize < 100 ? 5 : 10;
      if (viableTracks.length >= minViableTracks) {
        tracksToUse = viableTracks;
        filterStrategy = `⚠️ SCORE FILTER: ${viableTracks.length} tracks with score ≥ ${MIN_ACCEPTABLE_SCORE} (only ${freshTracks.length} fresh)`;
      } else {
        // Last resort: use all tracks but warn
        tracksToUse = scoredTracks;
        filterStrategy = `🚨 NO FILTER: Using all ${scoredTracks.length} tracks (${freshTracks.length} fresh, ${viableTracks.length} viable) - POOL EXHAUSTED`;
        
        // Show actionable advice
        if (freshTracks.length === 0 && poolSize < 100) {
          console.warn(`   💡 Small track pool (${poolSize}) with all tracks recently played. This is normal for Freesound - variety is limited.`);
        } else if (freshTracks.length === 0) {
          console.warn(`   💡 All ${scoredTracks.length} tracks recently played - variety severely limited. Consider increasing track pool size.`);
        }
      }
    }
    if (this.verboseLogging) {
      console.log(`   ${filterStrategy}`);
    }
    
    // Log score distribution
    if (this.verboseLogging) {
      const scoreRanges = {
        high: tracksToUse.filter(s => s.score >= 40).length,
        medium: tracksToUse.filter(s => s.score >= 20 && s.score < 40).length,
        low: tracksToUse.filter(s => s.score >= 10 && s.score < 20).length,
        minimal: tracksToUse.filter(s => s.score < 10).length
      };
      console.log(`   📊 Score distribution: High(≥40):${scoreRanges.high} | Med(20-39):${scoreRanges.medium} | Low(10-19):${scoreRanges.low} | Min(<10):${scoreRanges.minimal}`);
    
      // Log top scoring tracks to see what's being matched
      console.log('   🎯 Top 5 candidates:');
      tracksToUse.slice(0, 5).forEach((scored, idx) => {
        const { track, score, scoreBreakdown } = scored;
        const parts = [];
        if (scoreBreakdown.bookVibe > 0) parts.push(`B${scoreBreakdown.bookVibe}`);
        if (scoreBreakdown.tagMatch > 0) parts.push(`T${scoreBreakdown.tagMatch}`);
        if (scoreBreakdown.energyMatch > 0) parts.push(`E${scoreBreakdown.energyMatch}`);
        if (scoreBreakdown.tempoMatch > 0) parts.push(`Tm${scoreBreakdown.tempoMatch}`);
        if (scoreBreakdown.repetitionPenalty) parts.push(`R${scoreBreakdown.repetitionPenalty}`);
        const tags = track.tags?.slice(0, 3).join(',') || '';
        console.log(`      ${idx + 1}. "${track.title}" | Score:${score} (${parts.join('+')}) | E${track.energy || '?'} | [${tags}]`);
      });
    }
    
    // Select top tracks with diversity-aware weighted randomization
    const selectedTracks = [];
    const actualCount = Math.min(trackCount, tracksToUse.length);
    
    // Safety check: ensure we have tracks to select from
    if (tracksToUse.length === 0) {
      console.warn(`⚠️ No viable tracks available for "${chapter.title || chapter.id}"`);
      return [];
    }
    
    // Diversity injection: group tracks by primary characteristic to avoid similar tracks
    const diversityGroups = new Map();
    tracksToUse.forEach(scored => {
      // Group by: first tag + energy level
      const primaryTag = scored.track.tags?.[0] || 'unknown';
      const energyLevel = scored.track.energy || 3;
      const groupKey = `${primaryTag}_E${energyLevel}`;
      
      if (!diversityGroups.has(groupKey)) {
        diversityGroups.set(groupKey, []);
      }
      diversityGroups.get(groupKey).push(scored);
    });
    
    // Selection strategy: Pick from different groups when possible
    const usedGroups = new Set();
    const availableIndices = new Set([...Array(tracksToUse.length).keys()]);
    
    for (let i = 0; i < actualCount && availableIndices.size > 0; i++) {
      let selectedIndex;
      
      // Weighted selection with diversity consideration
      const rand = Math.random();
      
      if (rand < 0.75) {
        // 75% chance: pick from top 5 tracks (best match, prefer unused groups)
        const topPoolSize = Math.min(5, availableIndices.size);
        const topIndices = Array.from(availableIndices).slice(0, topPoolSize);
        
        // Try to find a track from an unused group
        let diverseIndex = null;
        for (const idx of topIndices) {
          const scored = tracksToUse[idx];
          const primaryTag = scored.track.tags?.[0] || 'unknown';
          const energyLevel = scored.track.energy || 3;
          const groupKey = `${primaryTag}_E${energyLevel}`;
          
          if (!usedGroups.has(groupKey)) {
            diverseIndex = idx;
            break;
          }
        }
        
        selectedIndex = diverseIndex !== null ? diverseIndex : topIndices[Math.floor(Math.random() * topIndices.length)];
      } else {
        // 25% chance: pick from wider pool for variety (positions 5-20)
        const varietyStart = Math.min(5, availableIndices.size);
        const varietyEnd = Math.min(20, availableIndices.size);
        const varietyIndices = Array.from(availableIndices).slice(varietyStart, varietyEnd);
        
        if (varietyIndices.length > 0) {
          // Prefer tracks from unused groups
          let diverseIndex = null;
          for (const idx of varietyIndices) {
            const scored = tracksToUse[idx];
            const primaryTag = scored.track.tags?.[0] || 'unknown';
            const energyLevel = scored.track.energy || 3;
            const groupKey = `${primaryTag}_E${energyLevel}`;
            
            if (!usedGroups.has(groupKey)) {
              diverseIndex = idx;
              break;
            }
          }
          
          selectedIndex = diverseIndex !== null ? diverseIndex : varietyIndices[Math.floor(Math.random() * varietyIndices.length)];
        } else {
          // Fallback to top pool
          const topPoolSize = Math.min(5, availableIndices.size);
          const topIndices = Array.from(availableIndices).slice(0, topPoolSize);
          selectedIndex = topIndices[Math.floor(Math.random() * topIndices.length)];
        }
      }
      
      // Add selected track
      if (tracksToUse[selectedIndex] && tracksToUse[selectedIndex].track) {
        const selected = tracksToUse[selectedIndex];
        selectedTracks.push(selected.track);
        
        // Mark group as used
        const primaryTag = selected.track.tags?.[0] || 'unknown';
        const energyLevel = selected.track.energy || 3;
        const groupKey = `${primaryTag}_E${energyLevel}`;
        usedGroups.add(groupKey);
        
        // Update track history to prevent repetition
        const trackId = selected.track.id || selected.track.title;
        const existingInfo = this.recentlyPlayedTracks.get(trackId);
        this.recentlyPlayedTracks.set(trackId, {
          lastPlayed: Date.now(),
          lastChapterIndex: this.currentChapterIndex,
          count: (existingInfo?.count || 0) + 1,
          playCount: (existingInfo?.playCount || 0) + 1
        });
        
        // Remove from available pool
        availableIndices.delete(selectedIndex);
      }
    }
    
    if (this.verboseLogging) {
      console.log(`   ✅ Selected ${selectedTracks.length} tracks (${usedGroups.size} unique tag+energy groups):`);
      selectedTracks.forEach((track, idx) => {
        const tags = track.tags?.slice(0, 3).join(',') || '';
        const primaryTag = track.tags?.[0] || 'unknown';
        const groupKey = `${primaryTag}_E${track.energy || '?'}`;
        console.log(`      ${idx + 1}. "${track.title}" | ${groupKey} | [${tags}]`);
      });
    }
    // Disabled in clean mode
    // else {
    //   console.log(`   🎵 ${selectedTracks.length} tracks selected`);
    // }
    
    return selectedTracks;
  }

  /**
   * Generate chapter-to-track mappings for entire book
   * Now returns multiple tracks per chapter (1-5 based on length)
   */
  generateChapterMappings(book, chapterAnalyses, availableTracks, bookProfile) {
    // Reset chapter counter for new book
    this.currentChapterIndex = 0;
    
    return chapterAnalyses.map((analysis, index) => {
      const chapter = book.chapters[index];
      const selectedTracks = this.selectTracksForChapter(analysis, availableTracks, chapter, bookProfile);
      
      // Safety check: ensure we have valid tracks
      if (!selectedTracks || selectedTracks.length === 0) {
        console.warn(`⚠️ No tracks selected for chapter "${analysis.chapterTitle}"`);
      }
      
      return {
        bookId: book.id,
        chapterId: analysis.chapterId,
        chapterTitle: analysis.chapterTitle,
        primaryMood: analysis.primaryMood,
        tracks: (selectedTracks || []).filter(track => track).map(track => ({
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
    // More nuanced scoring to avoid everything being 100
    let shiftScore = 0;
    
    if (pageMood !== currentMood && moodStrength > 0) {
      // Base score increases with mood strength (logarithmic curve)
      const baseScore = Math.min(60, 20 + (moodStrength * 8));
      
      // Bonus for very strong signals (diminishing returns)
      const strengthBonus = Math.min(30, Math.sqrt(moodStrength) * 10);
      
      // Penalty for weak signals
      const weaknessPenalty = moodStrength < 3 ? 20 : 0;
      
      shiftScore = Math.max(0, Math.min(100, baseScore + strengthBonus - weaknessPenalty));
    } else if (pageMood === currentMood) {
      // Same mood, no shift needed
      shiftScore = 0;
    }

    // Keep chapter music responsive: require a meaningful change, but avoid an
    // overly strict threshold that produces zero shifts in long chapters.
    const SHIFT_SCORE_THRESHOLD = 35;

    return {
      pageMood,
      currentMood,
      shiftScore,
      moodStrength,
      shouldShift: shiftScore >= SHIFT_SCORE_THRESHOLD,
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
    const potentialShifts = []; // Collect all potential shifts first
    let currentSectionMood = chapterMood;
    const MIN_WEAK_SHIFT_SCORE = 22;

    // PASS 1: Analyze each page and collect potential shifts.
    // We keep both strong (threshold-passing) and weaker candidates so
    // long chapters can still produce enough shift points when the user
    // asks for a higher song density.
    for (let page = 1; page <= totalPages; page++) {
      const startWord = (page - 1) * wordsPerPage;
      const endWord = Math.min(page * wordsPerPage, words.length);
      const pageText = words.slice(startWord, endWord).join(' ');

      if (pageText.length < 50) continue; // Skip very short pages

      const analysis = this.analyzePageMoodShift(pageText, currentSectionMood);

      // Collect potential shift points with their scores.
      // Strong candidates always qualify; weaker ones need a floor to avoid
      // noisy rapid-fire shifting.
      const isStrongCandidate = analysis.shouldShift;
      const isWeakCandidate = !isStrongCandidate && analysis.shiftScore >= MIN_WEAK_SHIFT_SCORE;
      if (page > 1 && analysis.pageMood !== currentSectionMood && (isStrongCandidate || isWeakCandidate)) {
        potentialShifts.push({
          page,
          fromMood: currentSectionMood,
          toMood: analysis.pageMood,
          confidence: analysis.confidence,
          shiftScore: analysis.shiftScore,
          isStrong: isStrongCandidate
        });
      }
    }

    // PASS 2: Select best-distributed shifts across the chapter
    const selectedShifts = [];
    if (potentialShifts.length > 0) {
      // Prefer strong candidates first, then by score.
      potentialShifts.sort((a, b) => {
        if (Boolean(a.isStrong) !== Boolean(b.isStrong)) {
          return a.isStrong ? -1 : 1;
        }
        return b.shiftScore - a.shiftScore;
      });
      
      // Calculate minimum spacing between shifts
      const baseSpacing = Math.max(1, Math.floor(totalPages / (maxShifts + 1)));
      const relaxedSpacing = Math.max(1, Math.floor(baseSpacing / 2));
      const selectedPages = new Set();

      const trySelectWithSpacing = (minSpacingPx) => {
        for (const shift of potentialShifts) {
          if (selectedShifts.length >= maxShifts) break;
          if (selectedPages.has(shift.page)) continue;
          
          const tooClose = selectedShifts.some(selected =>
            Math.abs(selected.page - shift.page) < minSpacingPx
          );
          
          if (!tooClose) {
            selectedShifts.push(shift);
            selectedPages.add(shift.page);
          }
        }
      };
      
      // First pass: preserve broad spacing.
      trySelectWithSpacing(baseSpacing);
      // Second pass: relax spacing if we still need more shifts.
      if (selectedShifts.length < maxShifts) {
        trySelectWithSpacing(relaxedSpacing);
      }
      // Final fill: allow remaining top candidates if we still have room.
      if (selectedShifts.length < maxShifts) {
        for (const shift of potentialShifts) {
          if (selectedShifts.length >= maxShifts) break;
          if (selectedPages.has(shift.page)) continue;
          selectedShifts.push(shift);
          selectedPages.add(shift.page);
        }
      }
      
      // Sort selected shifts by page number for easy lookup
      selectedShifts.sort((a, b) => a.page - b.page);

      // Rebuild from/to mood chain in page order so labels stay coherent
      // (e.g. epic -> romantic -> mysterious, not epic -> romantic then epic -> mysterious).
      // Drop no-op transitions where mood doesn't actually change.
      let chainMood = chapterMood;
      const chainedShifts = [];
      selectedShifts.forEach((shift) => {
        const nextMood = shift.toMood || chainMood;
        if (nextMood === chainMood) {
          return;
        }
        chainedShifts.push({
          ...shift,
          fromMood: chainMood,
          toMood: nextMood
        });
        chainMood = nextMood;
      });

      selectedShifts.length = 0;
      selectedShifts.push(...chainedShifts);
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
    
    if (this.verboseLogging && selectedShifts.length > 0) {

    }

    return {
      sections,
      shiftPoints: selectedShifts,
      totalShifts: selectedShifts.length
    };
  }

  /**
   * Build weighted keywords for Cyanite keyword search.
   * This converts chapter/shift analysis into a compact semantic profile:
   * mood anchors, energy cues, contextual keywords, and anti-vocal bias.
   *
   * @param {Object} profileContext
   * @param {Object|null} bookProfile
   * @returns {Array<{keyword:string, weight:number}>}
   */
  buildCyaniteKeywordProfile(profileContext = {}, bookProfile = null) {
    const mood = String(profileContext.mood || 'peaceful').toLowerCase().trim();
    const fromMood = String(profileContext.fromMood || '').toLowerCase().trim();
    const energy = Math.max(1, Math.min(5, Math.round(Number(profileContext.energy) || 3)));
    const baseKeywords = Array.isArray(profileContext.keywords) ? profileContext.keywords : [];
    const bookVibeKeywords = Array.isArray(bookProfile?.bookVibeKeywords)
      ? bookProfile.bookVibeKeywords
      : [];
    const chapterKeywordPool = Array.isArray(bookProfile?.chapterKeywordPool)
      ? bookProfile.chapterKeywordPool
      : [];
    const recommendedTags = Array.isArray(bookProfile?.recommendedTags)
      ? bookProfile.recommendedTags
      : [];

    const settings = JSON.parse(localStorage.getItem('booksWithMusic-settings') || '{}');
    const instrumentalOnly = settings.instrumentalOnly !== false;
    const preferCinematicScores = settings.preferCinematicScores === true;

    const weighted = new Map();
    const addKeyword = (term, weight) => {
      const normalized = String(term || '').toLowerCase().trim().replace(/\s+/g, ' ');
      const numericWeight = Number(weight);
      if (!normalized || !Number.isFinite(numericWeight)) return;
      const clamped = Math.max(-1, Math.min(1, numericWeight));
      const existing = weighted.get(normalized);
      // Keep strongest directional signal for each term.
      if (existing === undefined || Math.abs(clamped) > Math.abs(existing)) {
        weighted.set(normalized, clamped);
      }
    };

    const moodAnchors = {
      dark: ['dark ambient', 'brooding', 'ominous', 'shadowy'],
      mysterious: ['mysterious', 'enigmatic', 'noir', 'suspense'],
      romantic: ['romantic', 'warm', 'tender', 'intimate'],
      sad: ['melancholic', 'emotional', 'somber', 'piano'],
      epic: ['epic', 'heroic', 'cinematic', 'orchestral'],
      peaceful: ['peaceful', 'calm', 'serene', 'gentle'],
      tense: ['tense', 'pulse', 'thriller', 'suspense'],
      joyful: ['joyful', 'uplifting', 'cheerful', 'bright'],
      adventure: ['adventure', 'exploration', 'journey', 'heroic'],
      magical: ['magical', 'ethereal', 'dreamy', 'fantasy']
    };

    const energyAnchors = {
      1: ['calm', 'slow', 'ambient'],
      2: ['gentle', 'soft', 'warm'],
      3: ['atmospheric', 'balanced', 'flowing'],
      4: ['intense', 'driving', 'dynamic'],
      5: ['powerful', 'high energy', 'dramatic']
    };

    // Core mood emphasis
    addKeyword(mood, 1.0);
    (moodAnchors[mood] || []).forEach((term) => addKeyword(term, 0.82));
    if (fromMood && fromMood !== mood) {
      // Keep transition continuity without diluting the target mood.
      addKeyword(fromMood, 0.34);
    }

    // Chapter/shift keywords from analysis
    baseKeywords
      .slice(0, 8)
      .forEach((term, index) => addKeyword(term, Math.max(0.35, 0.7 - (index * 0.06))));

    // Book-level mood context to preserve overall atmosphere
    bookVibeKeywords
      .slice(0, 5)
      .forEach((term, index) => addKeyword(term, Math.max(0.28, 0.52 - (index * 0.05))));
    chapterKeywordPool
      .slice(0, 6)
      .forEach((term, index) => addKeyword(term, Math.max(0.24, 0.44 - (index * 0.04))));
    recommendedTags
      .slice(0, 4)
      .forEach((term, index) => addKeyword(term, Math.max(0.22, 0.38 - (index * 0.04))));

    // Energy shaping
    (energyAnchors[energy] || []).forEach((term) => addKeyword(term, 0.42));

    // Instrumental/low-vocal preference
    if (instrumentalOnly) {
      ['instrumental', 'no vocals', 'ambient', 'cinematic score', 'orchestral'].forEach((term) => {
        addKeyword(term, 0.9);
      });
      ['vocal', 'lyrics', 'singer-songwriter', 'podcast', 'spoken word', 'a cappella'].forEach((term) => {
        addKeyword(term, -0.92);
      });
    }

    // Reduce game-heavy bias when cinematic mode is not explicitly requested.
    if (!preferCinematicScores) {
      ['video game', 'game music', 'bgm', 'ost', 'chiptune', '8-bit'].forEach((term) => {
        addKeyword(term, -0.78);
      });
    }

    return Array.from(weighted.entries())
      .map(([keyword, weight]) => ({ keyword, weight }))
      .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
      .slice(0, 12);
  }

  /**
   * Calculate mood intensity based on keyword frequency
   * Returns 1-5 scale: 1=subtle, 3=moderate, 5=overwhelming
   */
  _calculateMoodIntensity(moodScore, textLength) {
    // Normalize score by text length (keywords per 1000 words)
    const normalizedScore = (moodScore / textLength) * 1000;
    
    // Map to 1-5 scale
    if (normalizedScore >= 15) return 5; // Very intense
    if (normalizedScore >= 10) return 4; // Intense
    if (normalizedScore >= 5) return 3;  // Moderate
    if (normalizedScore >= 2) return 2;  // Subtle
    return 1; // Very subtle
  }

  /**
   * Detect action/conflict level in text
   * Returns 'low', 'medium', or 'high'
   */
  _detectActionLevel(text) {
    const actionKeywords = [
      'fight', 'battle', 'attack', 'charge', 'strike', 'slash', 'stab', 'shoot',
      'run', 'chase', 'pursuit', 'flee', 'escape', 'dash', 'sprint',
      'explode', 'crash', 'shatter', 'thunder', 'roar', 'scream', 'shout',
      'punch', 'kick', 'dodge', 'parry', 'block', 'defend',
      'kill', 'die', 'blood', 'wound', 'injured', 'pain',
      'rush', 'hurry', 'urgent', 'quick', 'fast', 'rapid',
      'sword', 'blade', 'weapon', 'gun', 'arrow', 'spear'
    ];
    
    let actionCount = 0;
    actionKeywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\w*\\b`, 'gi');
      const matches = text.match(regex);
      actionCount += matches ? matches.length : 0;
    });
    
    // Normalize by text length
    const normalizedAction = (actionCount / text.length) * 1000;
    
    if (normalizedAction >= 8) return 'high';
    if (normalizedAction >= 3) return 'medium';
    return 'low';
  }

  /**
   * Detect time of day for atmospheric music tuning
   * Returns 'morning', 'afternoon', 'evening', 'night', or 'unknown'
   */
  _detectTimeOfDay(text) {
    const timePatterns = {
      morning: /\b(morning|dawn|sunrise|daybreak|breakfast|early|awoke|awakened)\b/gi,
      afternoon: /\b(afternoon|midday|noon|lunch|tea time)\b/gi,
      evening: /\b(evening|dusk|sunset|twilight|dinner|supper)\b/gi,
      night: /\b(night|midnight|darkness|moonlight|starlight|nocturnal|slept|asleep)\b/gi
    };
    
    const timeCounts = {};
    for (const [time, pattern] of Object.entries(timePatterns)) {
      const matches = text.match(pattern);
      timeCounts[time] = matches ? matches.length : 0;
    }
    
    // Find most prominent time
    const sortedTimes = Object.entries(timeCounts)
      .sort((a, b) => b[1] - a[1]);
    
    // Must have at least 2 mentions to be significant
    if (sortedTimes[0][1] >= 2) {
      return sortedTimes[0][0];
    }
    
    return 'unknown';
  }
}
