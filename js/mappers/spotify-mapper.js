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

    // IMPORTANT: Only use VALID Spotify genre seeds!
    // Valid genres from Spotify API (as of 2024):
    // acoustic, afrobeat, alt-rock, alternative, ambient, anime, black-metal, bluegrass, blues, bossanova, brazil,
    // breakbeat, british, cantopop, chicago-house, children, chill, classical, club, comedy, country, dance,
    // dancehall, death-metal, deep-house, detroit-techno, disco, disney, drum-and-bass, dub, dubstep, edm,
    // electro, electronic, emo, folk, forro, french, funk, garage, german, gospel, goth, grindcore, groove,
    // grunge, guitar, happy, hard-rock, hardcore, hardstyle, heavy-metal, hip-hop, holidays, honky-tonk, house,
    // idm, indian, indie, indie-pop, industrial, iranian, j-dance, j-idol, j-pop, j-rock, jazz, k-pop, kids,
    // latin, latino, malay, mandopop, metal, metal-misc, metalcore, minimal-techno, movies, mpb, new-age,
    // new-release, opera, pagode, party, philippines-opm, piano, pop, pop-film, post-dubstep, power-pop,
    // progressive-house, psych-rock, punk, punk-rock, r-n-b, rainy-day, reggae, reggaeton, road-trip, rock,
    // rock-n-roll, rockabilly, romance, sad, salsa, samba, sertanejo, show-tunes, singer-songwriter, ska,
    // sleep, songwriter, soul, soundtracks, spanish, study, summer, swedish, synth-pop, tango, techno, trance,
    // trip-hop, turkish, work-out, world-music
    
    // Map cultural/historical themes to VALID Spotify genres
    this.themeToGenres = {
      // Cultural/Geographic
      'viking': ['folk', 'metal', 'ambient'],
      'celtic': ['folk', 'world-music', 'acoustic'],
      'eastern': ['world-music', 'ambient', 'indian'],
      'middle-eastern': ['world-music', 'ambient', 'iranian'],
      'pirate': ['folk', 'acoustic', 'world-music'],
      'western': ['country', 'folk', 'acoustic'],
      'african': ['world-music', 'afrobeat', 'ambient'],
      'latin': ['latin', 'latino', 'world-music'],
      'native-american': ['world-music', 'folk', 'ambient'],
      'indian': ['world-music', 'indian', 'ambient'],
      'russian': ['classical', 'folk', 'world-music'],
      'greek': ['classical', 'world-music', 'ambient'],
      'aztec-mayan': ['world-music', 'ambient', 'latin'],
      'polynesian': ['world-music', 'ambient', 'summer'],
      'australian': ['world-music', 'folk', 'ambient'],
      'arctic': ['ambient', 'new-age', 'world-music'],
      
      // Musical Eras
      'baroque': ['classical', 'opera'],
      'classical': ['classical', 'piano', 'opera'],
      'romantic': ['classical', 'piano', 'romance'],
      'jazz': ['jazz', 'blues', 'soul'],
      'renaissance': ['classical', 'opera', 'ambient'],
      'rock': ['rock', 'alt-rock', 'indie'],
      'soul': ['soul', 'r-n-b', 'funk'],
      'country': ['country', 'bluegrass', 'folk'],
      
      // Time Periods
      'ancient': ['ambient', 'world-music', 'classical'],
      'medieval': ['folk', 'ambient', 'classical'],
      'victorian': ['classical', 'piano', 'opera'],
      'noir': ['jazz', 'blues', 'soul'],
      'steampunk': ['industrial', 'alternative', 'electronic'],
      '1920s': ['jazz', 'blues', 'soul'],
      '1930s': ['jazz', 'blues', 'soul'],
      '1940s': ['jazz', 'blues', 'soul'],
      '1950s': ['jazz', 'blues', 'rock-n-roll'],
      '1960s': ['rock', 'soul', 'psychedelic', 'psych-rock'],
      '1970s': ['rock', 'funk', 'disco'],
      '1980s': ['synth-pop', 'new-wave', 'pop'],
      '1990s': ['grunge', 'alternative', 'electronic'],
      '2000s': ['indie', 'electronic', 'alternative'],
      'future': ['electronic', 'synth-pop', 'ambient'],
      'cyberpunk': ['synth-pop', 'industrial', 'electronic'],
      
      // Music Styles
      'orchestral': ['classical', 'soundtracks', 'opera'],
      'cinematic': ['soundtracks', 'ambient', 'classical'],
      'ambient': ['ambient', 'new-age', 'chill'],
      'folk': ['folk', 'acoustic', 'indie-folk'],
      'choral': ['classical', 'gospel', 'opera'],
      'electronic': ['electronic', 'ambient', 'edm'],
      'tribal': ['world-music', 'afrobeat', 'ambient'],
      
      // Genres
      'fantasy': ['soundtracks', 'classical', 'ambient'],
      'sci-fi': ['electronic', 'ambient', 'synth-pop'],
      'mystery': ['jazz', 'ambient', 'minimal-techno'],
      'romance': ['classical', 'piano', 'acoustic', 'indie'],
      'thriller': ['ambient', 'electronic', 'minimal-techno'],
      'horror': ['ambient', 'industrial', 'goth'],
      'adventure': ['soundtracks', 'classical', 'world-music'],
      'war': ['soundtracks', 'classical', 'metal'],
      'espionage': ['jazz', 'electronic', 'minimal-techno']
    };

    // Map moods to VALID Spotify genres
    this.moodToGenres = {
      dark: ['ambient', 'goth', 'industrial', 'post-dubstep'],
      mysterious: ['ambient', 'minimal-techno', 'electronic', 'trip-hop'],
      romantic: ['classical', 'piano', 'acoustic', 'indie', 'romance'],
      sad: ['piano', 'classical', 'acoustic', 'sad', 'rainy-day'],
      epic: ['soundtracks', 'classical', 'metal'],
      peaceful: ['ambient', 'new-age', 'chill', 'acoustic', 'sleep'],
      tense: ['ambient', 'electronic', 'minimal-techno', 'industrial'],
      joyful: ['happy', 'indie', 'folk', 'indie-pop', 'pop'],
      adventure: ['soundtracks', 'world-music', 'classical'],
      magical: ['ambient', 'new-age', 'soundtracks']
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
