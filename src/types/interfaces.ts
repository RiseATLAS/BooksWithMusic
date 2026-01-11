export interface Book {
  id: string;
  title: string;
  author: string;
  coverImage?: string;
  chapters: Chapter[];
  metadata: BookMetadata;
  vibeProfile?: VibeProfile;
  addedDate: string;
  lastOpened?: string;
  currentChapter: number;
  currentPage: number;
}

export interface Chapter {
  id: string;
  title: string;
  content: string;
  order: number;
  trackPool?: string[];
  userOverrides?: TrackOverride[];
}

export interface BookMetadata {
  language?: string;
  publisher?: string;
  publishDate?: string;
  description?: string;
}

export interface VibeProfile {
  moodTags: string[];
  energy: number; // 1-5
  genres: string[];
  instruments: string[];
  tempo: 'slow' | 'moderate' | 'upbeat';
  generatedAt: string;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  duration: number;
  url: string;
  source: string;
  license: LicenseInfo;
  tags?: string[];
  cached?: boolean;
}

export interface LicenseInfo {
  type: string;
  attributionRequired: boolean;
  sourceUrl: string;
  downloadAllowed: boolean;
}

export interface TrackOverride {
  trackId: string;
  pinned: boolean;
  order: number;
}

export interface ReaderSettings {
  theme: 'light' | 'sepia' | 'dark';
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  contentWidth: number;
  pageMusicSwitch: boolean;
  crossfadeDuration: number;
}

export interface ChapterMapping {
  bookId: string;
  chapterId: string;
  trackIds: string[];
  rationale?: string[];
}

export interface AudioState {
  playing: boolean;
  currentTrack?: Track;
  currentChapter?: string;
  trackIndex: number;
  volume: number;
}
