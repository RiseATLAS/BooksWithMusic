import { AudioPlayer } from '../core/audio-player.js';

export class MusicPanelUI {
  constructor(db, musicManager) {
    this.db = db;
    this.musicManager = musicManager;
    this.audioPlayer = new AudioPlayer();
    this.playlist = [];
    this.currentTrackIndex = 0;
  }

  initialize() {
    console.log('🎵 Initializing music panel...');
    console.log('   Music manager:', !!this.musicManager);
    this.setupEventListeners();
    this.setupMusicManagerListeners();
    this.renderPlaylist();
    console.log('✓ Music panel initialized');
  }

  setupMusicManagerListeners() {
    console.log('🎧 Setting up music manager listeners...');
    if (!this.musicManager) {
      console.warn('⚠️ No music manager available');
      return;
    }
    
    console.log('✓ Music manager available, registering listener');
    
    // Listen for chapter music changes
    this.musicManager.on('chapterMusicChanged', async (data) => {
      console.log('🎵 Chapter music changed event received:', data);
      
      // Load playlist with recommended track
      await this.loadPlaylistForChapter(data.chapterIndex, data.recommendedTrack);
      
      // Check if auto-play enabled (default FALSE - requires API key)
      const settings = JSON.parse(localStorage.getItem('booksWithMusic-settings') || '{}');
      const autoPlay = settings.autoPlay === true; // Must explicitly enable
      
      console.log('Auto-play enabled:', autoPlay);
      console.log('Playlist length:', this.playlist.length);
      console.log('Currently playing:', this.audioPlayer.state.playing);
      
      // Auto-play disabled by default - show message to user
      if (!autoPlay) {
        console.log('⏸️ Auto-play disabled. Click play button to start music.');
        // Show friendly notice on first load
        if (data.chapterIndex === 0) {
          setTimeout(() => {
            this.showToast('🎵 Click the play button to start music! (Requires Freesound API key - see Settings)', 'info');
          }, 1000);
        }
      } else if (autoPlay && this.playlist.length > 0) {
        console.log('▶️ Auto-playing recommended track...');
        setTimeout(async () => {
          await this.playTrack(0);
        }, 500);
      } else {
        console.log('⚠️ No tracks in playlist');
      }
    });
  }

  async loadPlaylistForChapter(chapterIndex, recommendedTrackId) {
    try {
      console.log('🎼 Loading playlist for chapter:', chapterIndex);
      console.log('   Recommended track ID:', recommendedTrackId);
      
      // Get available tracks from music manager
      console.log('   Fetching tracks from music manager...');
      const allTracks = await this.musicManager.getAllAvailableTracks();
      
      console.log('✓ Available tracks:', allTracks.length);
      if (allTracks.length > 0) {
        console.log('   Track titles:', allTracks.map(t => t.title).slice(0, 5).join(', ') + '...');
      }
      
      if (allTracks.length === 0) {
        console.warn('No tracks available');
        return;
      }
      
      // Find recommended track and put it first
      const recommendedTrack = allTracks.find(t => t.id === recommendedTrackId);
      
      if (recommendedTrack) {
        console.log('Found recommended track:', recommendedTrack.title);
        // Put recommended track first, then others
        this.playlist = [recommendedTrack, ...allTracks.filter(t => t.id !== recommendedTrackId)];
      } else {
        console.log('Recommended track not found, using all tracks');
        // No specific recommendation, use all tracks
        this.playlist = allTracks;
      }
      
      this.currentTrackIndex = 0;
      this.renderPlaylist();
      console.log('Playlist loaded with', this.playlist.length, 'tracks');
    } catch (error) {
      console.error('Error loading playlist:', error);
    }
  }

  setupEventListeners() {
    // Open/close music panel
    document.getElementById('music-toggle')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.togglePanel();
    });

    document.getElementById('close-music-panel')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.hidePanel();
    });

    // Playback controls
    document.getElementById('play-pause')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.togglePlayPause();
    });

    document.getElementById('prev-track')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.previousTrack();
    });

    document.getElementById('next-track')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.nextTrack();
    });

    // Volume control
    const volumeSlider = document.getElementById('volume-slider');
    const volumeValue = document.getElementById('volume-value');
    
    volumeSlider?.addEventListener('input', (e) => {
      const volume = parseInt(e.target.value);
      this.audioPlayer.setVolume(volume / 100);
      if (volumeValue) {
        volumeValue.textContent = `${volume}%`;
      }
    });

    // Audio player events
    this.audioPlayer.on('trackEnded', () => {
      this.nextTrack();
    });

    this.audioPlayer.on('playing', () => {
      this.updatePlayPauseButton(true);
    });

    this.audioPlayer.on('paused', () => {
      this.updatePlayPauseButton(false);
    });
  }

  togglePanel() {
    const panel = document.getElementById('music-panel');
    if (panel) {
      panel.classList.toggle('show');
    }
  }

  hidePanel() {
    const panel = document.getElementById('music-panel');
    if (panel) {
      panel.classList.remove('show');
    }
  }

  renderPlaylist() {
    const playlistEl = document.getElementById('playlist-tracks');
    if (!playlistEl) return;

    if (this.playlist.length === 0) {
      playlistEl.innerHTML = '<p class="empty-playlist">No tracks available</p>';
      return;
    }

    playlistEl.innerHTML = this.playlist.map((track, index) => `
      <div class="playlist-item ${index === this.currentTrackIndex ? 'active' : ''}" 
           data-track-index="${index}">
        <span class="track-number">${index + 1}</span>
        <div class="track-info">
          <div class="track-title">${this.escapeHtml(track.title)}</div>
          <div class="track-artist">${this.escapeHtml(track.artist || 'Unknown')}</div>
        </div>
        <span class="track-duration">${this.formatDuration(track.duration)}</span>
      </div>
    `).join('');

    // Add click listeners
    playlistEl.querySelectorAll('.playlist-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const trackIndex = parseInt(e.currentTarget.dataset.trackIndex);
        this.playTrack(trackIndex);
      });
    });
  }

  async playTrack(index) {
    if (index < 0 || index >= this.playlist.length) return;

    this.currentTrackIndex = index;
    const track = this.playlist[index];

    // Update UI
    this.updateCurrentTrackInfo(track);
    this.updatePlaylistSelection();

    // Play audio with AudioPlayer.playTrack()
    try {
      await this.audioPlayer.playTrack(track);
      console.log('▶️ Now playing:', track.title);
    } catch (error) {
      console.error('❌ Error playing track:', error);
      console.log('⏭️ Skipping to next track...');
      
      // Try next track if available
      if (index + 1 < this.playlist.length) {
        setTimeout(() => this.playTrack(index + 1), 1000);
      } else {
        console.warn('⚠️ No more tracks to play');
        // Only show error message if we've tried all tracks
        const freesoundKey = localStorage.getItem('freesound_api_key');
        if (!freesoundKey) {
          this.showToast('🔑 Music playback requires a free Freesound API key. Get one at freesound.org/apiv2/apply and add it in Settings.', 'error');
        } else {
          this.showToast('❌ Unable to load music tracks. Please check your API key in Settings.', 'error');
        }
      }
    }
  }

  showToast(message, type = 'info') {
    // Simple toast notification
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--bg-secondary);color:var(--text-primary);padding:12px 24px;border-radius:8px;z-index:10000;box-shadow:0 4px 12px rgba(0,0,0,0.3);max-width:90%;text-align:center;';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
  }

  updateCurrentTrackInfo(track) {
    const trackInfoEl = document.getElementById('current-track');
    if (trackInfoEl) {
      trackInfoEl.innerHTML = `
        <div class="track-title">${this.escapeHtml(track.title)}</div>
        <div class="track-artist">${this.escapeHtml(track.artist || 'Unknown')}</div>
      `;
    }
  }

  updatePlaylistSelection() {
    document.querySelectorAll('.playlist-item').forEach((item, index) => {
      item.classList.toggle('active', index === this.currentTrackIndex);
    });
  }

  togglePlayPause() {
    if (this.audioPlayer.isPlaying()) {
      this.audioPlayer.pause();
    } else {
      if (this.playlist.length > 0) {
        this.playTrack(this.currentTrackIndex);
      }
    }
  }

  updatePlayPauseButton(isPlaying) {
    const btn = document.getElementById('play-pause');
    if (btn) {
      btn.textContent = isPlaying ? '⏸' : '▶️';
    }
  }

  previousTrack() {
    const newIndex = this.currentTrackIndex - 1;
    if (newIndex >= 0) {
      this.playTrack(newIndex);
    }
  }

  nextTrack() {
    const newIndex = this.currentTrackIndex + 1;
    if (newIndex < this.playlist.length) {
      this.playTrack(newIndex);
    } else {
      // Loop to beginning
      this.playTrack(0);
    }
  }

  formatDuration(seconds) {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
