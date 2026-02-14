/**
 * SpotifyMapper - Convert app mood/themes into Spotify search-friendly genres
 * 
 * RESPONSIBILITIES:
 * - Map mood keywords → Spotify genre seeds
 * - Map themes (viking, celtic, etc.) → appropriate genre seeds
 * 
 * GENRE MAPPING (Cultural/Era/Period):
 * - Cultural: viking→"nordic folk,epic", celtic→"celtic,irish folk", eastern→"asian,world"
 * - Era: baroque→"baroque,classical", jazz→"jazz,swing,blues", romantic→"romantic classical,piano"
 * - Period: ancient→"epic,world,ancient", medieval→"medieval,folk", victorian→"classical,chamber"
 * 
 * INTEGRATION NOTES:
 * - Used by spotify-api.js to convert MoodProcessor output
 * - Search-first approach (no recommendation/audio-feature dependency)
 * 
 * REFERENCES:
 * - Spotify Search API: https://developer.spotify.com/documentation/web-api/reference/search
 */

export class SpotifyMapper {
  constructor() {
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
    // sleep, songwriter, soul, soundtrack, spanish, study, summer, swedish, synth-pop, tango, techno, trance,
    // trip-hop, turkish, work-out, world
    
    // Map cultural/historical themes to VALID Spotify genres
    this.themeToGenres = {
      // Cultural/Geographic
      'viking': ['folk', 'metal', 'ambient'],
      'celtic': ['folk', 'world', 'acoustic'],
      'eastern': ['world', 'ambient', 'indian'],
      'middle-eastern': ['world', 'ambient', 'iranian'],
      'pirate': ['folk', 'acoustic', 'world'],
      'western': ['country', 'folk', 'acoustic'],
      'african': ['world', 'afrobeat', 'ambient'],
      'latin': ['latin', 'latino', 'world'],
      'native-american': ['world', 'folk', 'ambient'],
      'indian': ['world', 'indian', 'ambient'],
      'russian': ['classical', 'folk', 'world'],
      'greek': ['classical', 'world', 'ambient'],
      'aztec-mayan': ['world', 'ambient', 'latin'],
      'polynesian': ['world', 'ambient', 'summer'],
      'australian': ['world', 'folk', 'ambient'],
      'arctic': ['ambient', 'new-age', 'world'],
      
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
      'ancient': ['ambient', 'world', 'classical'],
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
      'orchestral': ['classical', 'soundtrack', 'opera'],
      'cinematic': ['soundtrack', 'ambient', 'classical'],
      'ambient': ['ambient', 'new-age', 'chill'],
      'folk': ['folk', 'acoustic', 'indie-folk'],
      'choral': ['classical', 'gospel', 'opera'],
      'electronic': ['electronic', 'ambient', 'edm'],
      'tribal': ['world', 'afrobeat', 'ambient'],
      
      // Genres
      'fantasy': ['soundtrack', 'classical', 'ambient'],
      'sci-fi': ['electronic', 'ambient', 'synth-pop'],
      'mystery': ['jazz', 'ambient', 'minimal-techno'],
      'romance': ['classical', 'piano', 'acoustic', 'indie'],
      'thriller': ['ambient', 'electronic', 'minimal-techno'],
      'horror': ['ambient', 'industrial', 'goth'],
      'adventure': ['soundtrack', 'classical', 'world'],
      'war': ['soundtrack', 'classical', 'metal'],
      'espionage': ['jazz', 'electronic', 'minimal-techno']
    };

    // Map moods to VALID Spotify genres
    this.moodToGenres = {
      dark: ['ambient', 'goth', 'industrial', 'post-dubstep'],
      mysterious: ['ambient', 'minimal-techno', 'electronic', 'trip-hop'],
      romantic: ['classical', 'piano', 'acoustic', 'indie', 'romance'],
      sad: ['piano', 'classical', 'acoustic', 'sad', 'rainy-day'],
      epic: ['soundtrack', 'classical', 'metal'],
      peaceful: ['ambient', 'new-age', 'chill', 'acoustic', 'sleep'],
      tense: ['ambient', 'electronic', 'minimal-techno', 'industrial'],
      joyful: ['happy', 'indie', 'folk', 'indie-pop', 'pop'],
      adventure: ['soundtrack', 'world', 'classical'],
      magical: ['ambient', 'new-age', 'soundtrack']
    };
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
}
