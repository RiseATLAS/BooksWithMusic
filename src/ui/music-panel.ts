import { DatabaseManager } from '../storage/indexeddb';

export class MusicPanelUI {
  private db: DatabaseManager;

  constructor(db: DatabaseManager) {
    this.db = db;
    this.setupControls();
  }

  private setupControls() {
    document.getElementById('music-toggle')?.addEventListener('click', () => {
      document.getElementById('music-panel')?.classList.toggle('hidden');
    });
  }

  async loadBookMusic(bookId: string) {
    const panel = document.getElementById('music-panel');
    if (panel) {
      panel.classList.remove('hidden');
    }
  }
}
