import { AudioPlayer } from '../core/audio-player.js';

export class MusicPanelUI {
  constructor(db) {
    this.db = db;
    this.audioPlayer = new AudioPlayer();
    this.playlist = [];
    this.currentTrackIndex = 0;
  }

  initialize() {
    this.setupEventListeners();
    this.renderPlaylist();
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

    // Play audio
    await this.audioPlayer.play(track.url);
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
