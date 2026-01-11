import { Book, VibeProfile, ChapterMapping } from '../types/interfaces';

export class AIProcessor {
  private apiKey?: string;

  constructor() {
    this.apiKey = import.meta.env.VITE_AI_API_KEY;
  }

  async analyzeBook(book: Book): Promise<VibeProfile> {
    if (this.apiKey) {
      return await this.analyzeWithAI(book);
    }
    return this.analyzeLocally(book);
  }

  private async analyzeWithAI(book: Book): Promise<VibeProfile> {
    return this.analyzeLocally(book);
  }

  private analyzeLocally(book: Book): VibeProfile {
    const title = book.title.toLowerCase();
    const moodTags: string[] = [];
    let energy = 3;
    const genres: string[] = ['instrumental'];
    const instruments: string[] = ['piano'];

    if (title.includes('dark') || title.includes('mystery')) {
      moodTags.push('mysterious', 'tense', 'atmospheric');
      energy = 4;
      genres.push('ambient');
    } else if (title.includes('love') || title.includes('romance')) {
      moodTags.push('romantic', 'gentle', 'warm');
      energy = 2;
      genres.push('classical');
      instruments.push('strings');
    } else if (title.includes('war') || title.includes('battle')) {
      moodTags.push('epic', 'dramatic', 'intense');
      energy = 5;
      genres.push('orchestral');
      instruments.push('brass', 'percussion');
    } else {
      moodTags.push('calm', 'peaceful', 'contemplative');
      energy = 2;
    }

    return {
      moodTags,
      energy,
      genres,
      instruments,
      tempo: energy > 3 ? 'upbeat' : energy > 2 ? 'moderate' : 'slow',
      generatedAt: new Date().toISOString(),
    };
  }

  async generateChapterMappings(book: Book): Promise<ChapterMapping[]> {
    return book.chapters.map(chapter => ({
      bookId: book.id,
      chapterId: chapter.id,
      trackIds: ['ambient-1', 'classical-1', 'nature-1'],
    }));
  }
}
