/**
 * SpotifyMapper - Convert app's mood data to Spotify API parameters
 * 
 * RESPONSIBILITIES:
 * - Map mood keywords → Spotify genre seeds
 * - Map energy levels (1-5) → Spotify energy (0.0-1.0)
 * - Map tempo (slow/medium/fast) → BPM ranges
 * - Map moods → valence values (happiness/sadness 0.0-1.0)
 * - Map themes (viking, celtic, etc.) → appropriate genre seeds
 * - Build Spotify recommendations API query parameters
 * - Handle instrumentalness filtering
 * 
 * MAPPING TABLES (from mood analysis to Spotify parameters):
 * 
 * ENERGY LEVELS (1-5 → 0.0-1.0):
 * - Level 1 → 0.2 (Very calm)
 * - Level 2 → 0.4 (Calm)
 * - Level 3 → 0.6 (Moderate)
 * - Level 4 → 0.8 (Energetic)
 * - Level 5 → 1.0 (Very energetic)
 * 
 * TEMPO MAPPING:
 * - slow: 60-90 BPM
 * - medium: 90-120 BPM
 * - fast: 120-180 BPM
 * 
 * VALENCE (Happiness/Positivity 0.0-1.0):
 * - dark: 0.1-0.3 (Very negative/dark)
 * - sad: 0.2-0.4 (Melancholic)
 * - mysterious: 0.3-0.5 (Neutral/enigmatic)
 * - tense: 0.4-0.6 (Anxious)
 * - peaceful: 0.5-0.7 (Calm/content)
 * - romantic: 0.6-0.8 (Warm/positive)
 * - joyful: 0.7-0.9 (Happy)
 * - epic: 0.5-0.7 (Triumphant)
 * 
 * GENRE MAPPING (Cultural/Era/Period):
 * - Cultural: viking→"nordic folk,epic", celtic→"celtic,irish folk", eastern→"asian,world"
 * - Era: baroque→"baroque,classical", jazz→"jazz,swing,blues", romantic→"romantic classical,piano"
 * - Period: ancient→"epic,world,ancient", medieval→"medieval,folk", victorian→"classical,chamber"
 * 
 * INTEGRATION NOTES:
 * - Used by spotify-api.js to convert MoodProcessor output
 * - Valence: 0.0 = very sad/dark, 1.0 = very happy/positive
 * - Energy: 0.0 = very calm, 1.0 = very energetic
 * - Instrumentalness: 0.0 = vocal, 1.0 = instrumental
 * 
 * REFERENCES:
 * - Spotify Audio Features: https://developer.spotify.com/documentation/web-api/reference/get-audio-features
 * - Recommendations API: https://developer.spotify.com/documentation/web-api/reference/get-recommendations
 */

export class SpotifyMapper {
  constructor() {
    // Map app moods to Spotify valence (happiness/positivity)
    this.moodToValence = {
      dark: 0.2,         // Very negative/dark
      sad: 0.3,          // Melancholic
      mysterious: 0.4,   // Neutral/enigmatic
      tense: 0.5,        // Anxious (neutral valence)
      peaceful: 0.6,     // Calm/content
      romantic: 0.7,     // Warm/positive
      joyful: 0.8,       // Happy
      epic: 0.6,         // Triumphant (varies, moderate-positive)
      adventure: 0.6,    // Exciting (moderate-positive)
      magical: 0.5       // Ethereal (neutral)
    };

    // Map cultural/historical themes to Spotify genres
    this.themeToGenres = {
      // Cultural/Geographic
      'viking': ['nordic', 'epic', 'cinematic', 'folk'],
      'celtic': ['celtic', 'irish-folk', 'scottish', 'folk'],
      'eastern': ['world-music', 'asian', 'ambient'],
      'middle-eastern': ['world-music', 'middle-eastern', 'ambient'],
      'pirate': ['folk', 'sea-shanty', 'adventure', 'acoustic'],
      'western': ['americana', 'country', 'folk'],
      'african': ['world-music', 'afrobeat', 'ambient'],
      'latin': ['latin', 'spanish', 'world-music'],
      'native-american': ['world-music', 'folk', 'ambient'],
      'indian': ['world-music', 'indian', 'ambient'],
      'russian': ['classical', 'folk', 'world-music'],
      'greek': ['classical', 'world-music', 'ambient'],
      'aztec-mayan': ['world-music', 'ambient', 'ethnic'],
      'polynesian': ['world-music', 'tropical', 'ambient'],
      'australian': ['world-music', 'folk', 'ambient'],
      'arctic': ['ambient', 'atmospheric', 'world-music'],
      
      // Musical Eras
      'baroque': ['baroque', 'classical', 'early-music'],
      'classical': ['classical', 'orchestral', 'chamber-music'],
      'romantic': ['classical', 'piano', 'romantic-era'],
      'jazz': ['jazz', 'swing', 'blues'],
      'renaissance': ['renaissance', 'early-music', 'medieval'],
      'rock': ['rock', 'alternative', 'indie'],
      'soul': ['soul', 'r-n-b', 'funk'],
      'country': ['country', 'bluegrass', 'americana'],
      
      // Time Periods
      'ancient': ['epic', 'world-music', 'atmospheric'],
      'medieval': ['medieval', 'folk', 'renaissance'],
      'victorian': ['classical', 'chamber-music', 'piano'],
      'noir': ['jazz', 'blues', 'film-noir'],
      'steampunk': ['industrial', 'alternative', 'cinematic'],
      '1920s': ['jazz', 'swing', 'vintage'],
      '1930s': ['jazz', 'big-band', 'swing'],
      '1940s': ['jazz', 'swing', 'blues'],
      '1950s': ['jazz', 'blues', 'rock-n-roll'],
      '1960s': ['rock', 'soul', 'psychedelic'],
      '1970s': ['rock', 'funk', 'disco'],
      '1980s': ['synthwave', 'new-wave', 'pop'],
      '1990s': ['grunge', 'alternative', 'electronic'],
      '2000s': ['indie', 'electronic', 'alternative'],
      'future': ['electronic', 'synthwave', 'ambient'],
      'cyberpunk': ['synthwave', 'industrial', 'electronic'],
      
      // Music Styles
      'orchestral': ['orchestral', 'classical', 'cinematic'],
      'cinematic': ['cinematic', 'soundtrack', 'epic'],
      'ambient': ['ambient', 'atmospheric', 'meditation'],
      'folk': ['folk', 'acoustic', 'indie-folk'],
      'choral': ['choral', 'classical', 'vocal'],
      'electronic': ['electronic', 'ambient', 'downtempo'],
      'tribal': ['world-music', 'ethnic', 'tribal'],
      
      // Genres
      'fantasy': ['epic', 'orchestral', 'cinematic', 'fantasy'],
      'sci-fi': ['electronic', 'ambient', 'synthwave', 'cinematic'],
      'mystery': ['jazz', 'ambient', 'cinematic', 'minimal'],
      'romance': ['classical', 'piano', 'acoustic', 'indie'],
      'thriller': ['cinematic', 'electronic', 'suspense'],
      'horror': ['dark-ambient', 'cinematic', 'horror'],
      'adventure': ['orchestral', 'cinematic', 'epic', 'world-music'],
      'war': ['epic', 'orchestral', 'cinematic', 'military'],
      'espionage': ['jazz', 'electronic', 'minimal', 'cinematic']
    };

    // Map moods to Spotify genres
    this.moodToGenres = {
      dark: ['dark-ambient', 'cinematic', 'atmospheric', 'post-rock'],
      mysterious: ['ambient', 'minimal', 'cinematic', 'downtempo'],
      romantic: ['classical', 'piano', 'acoustic', 'indie'],
      sad: ['piano', 'classical', 'acoustic', 'melancholic'],
      epic: ['epic', 'orchestral', 'cinematic', 'soundtrack'],
      peaceful: ['ambient', 'meditation', 'chill', 'acoustic'],
      tense: ['cinematic', 'electronic', 'minimal', 'suspense'],
      joyful: ['happy', 'indie', 'folk', 'uplifting'],
      adventure: ['orchestral', 'cinematic', 'world-music', 'epic'],
      magical: ['ambient', 'ethereal', 'fantasy', 'orchestral']
    };

    // Map tempo descriptors to BPM ranges
    this.tempoToBPM = {
      slow: { min: 60, max: 90, target: 75 },
      medium: { min: 90, max: 120, target: 105 },
      fast: { min: 120, max: 180, target: 140 }
    };
  }

  /**
   * Convert app energy level (1-5) to Spotify energy (0.0-1.0)
   */
  mapEnergy(appEnergy) {
    // Linear mapping: 1 → 0.2, 2 → 0.4, 3 → 0.6, 4 → 0.8, 5 → 1.0
    return Math.min(1.0, Math.max(0.0, appEnergy * 0.2));
  }

  /**
   * Get valence (happiness/positivity) for a mood
   */
  getValence(mood) {
    return this.moodToValence[mood] || 0.5; // Default to neutral
  }

  /**
   * Convert tempo descriptor to BPM values
   */
  getTempoBPM(tempo) {
    return this.tempoToBPM[tempo] || this.tempoToBPM.medium;
  }

  /**
   * Map keywords (themes + mood) to Spotify genre seeds
   * Returns up to 5 genre seeds (Spotify API limit)
   */
  mapKeywordsToGenres(keywords, mood) {
    const genreSet = new Set();

    // Add genres from mood first (highest priority)
    if (mood && this.moodToGenres[mood]) {
      this.moodToGenres[mood].slice(0, 2).forEach(g => genreSet.add(g));
    }

    // Add genres from keywords (themes, eras, etc.)
    keywords.forEach(keyword => {
      const keywordLower = keyword.toLowerCase();
      if (this.themeToGenres[keywordLower]) {
        this.themeToGenres[keywordLower].slice(0, 2).forEach(g => genreSet.add(g));
      }
    });

    // Convert to array and limit to 5 (Spotify's max for seed_genres)
    const genres = Array.from(genreSet).slice(0, 5);

    // If no genres found, use mood-based fallbacks
    if (genres.length === 0 && mood) {
      return this.moodToGenres[mood]?.slice(0, 5) || ['ambient', 'instrumental'];
    }

    // If still no genres, use generic instrumental genres
    if (genres.length === 0) {
      return ['ambient', 'instrumental', 'cinematic'];
    }

    return genres;
  }

  /**
   * Build complete Spotify recommendations query from chapter analysis
   * Returns object with seed_genres and target audio features
   */
  buildRecommendationsQuery(chapterAnalysis, bookProfile = null, instrumentalOnly = true) {
    const mood = chapterAnalysis.primaryMood || 'peaceful';
    const keywords = chapterAnalysis.musicTags || [];
    const energy = chapterAnalysis.energy || 3;
    const tempo = chapterAnalysis.tempo || 'medium';

    // Get book-level vibe keywords if available
    const bookKeywords = bookProfile?.bookVibeKeywords || [];
    const allKeywords = [...bookKeywords, ...keywords];

    // Map to Spotify parameters
    const genres = this.mapKeywordsToGenres(allKeywords, mood);
    const spotifyEnergy = this.mapEnergy(energy);
    const valence = this.getValence(mood);
    const tempoBPM = this.getTempoBPM(tempo);

    // Build query object
    const query = {
      seed_genres: genres.join(','),
      target_energy: spotifyEnergy,
      target_valence: valence,
      target_tempo: tempoBPM.target,
      min_tempo: tempoBPM.min,
      max_tempo: tempoBPM.max,
      min_duration_ms: 180000,  // Min 3 minutes
      max_duration_ms: 360000,  // Max 6 minutes
      limit: 20  // Get more options for better selection
    };

    // Add instrumentalness if filtering for background music
    if (instrumentalOnly) {
      query.target_instrumentalness = 0.85;
      query.min_instrumentalness = 0.5;
    }

    // Adjust parameters based on mood for better results
    if (mood === 'dark') {
      query.target_mode = 0;  // Minor key
      query.target_acousticness = 0.3;  // More electronic/atmospheric
    } else if (mood === 'romantic') {
      query.target_acousticness = 0.7;  // More acoustic
    } else if (mood === 'epic') {
      query.target_loudness = -5;  // Louder/more powerful
    } else if (mood === 'peaceful') {
      query.target_acousticness = 0.8;
      query.target_loudness = -15;  // Quieter
    }

    return query;
  }

  /**
   * Format query for Spotify API URL
   */
  formatQueryForURL(query) {
    return Object.entries(query)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
  }
}
