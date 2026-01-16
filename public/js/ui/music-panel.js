import { AudioPlayer } from '../core/audio-player.js';

export class MusicPanelUI {
  constructor(db, musicManager) {
    this.db = db;
    this.musicManager = musicManager;
    this.audioPlayer = new AudioPlayer();
    this.playlist = [];
    this.currentTrackIndex = 0;
    this.currentShiftPoints = []; // Track mood shift points in current chapter
    this.pageTrackHistory = new Map(); // Track which track was playing at each page
    this.currentChapter = null;
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
      
      // Reset page history when chapter changes
      this.currentChapter = data.chapterIndex;
      this.pageTrackHistory.clear();
      this.pageTrackHistory.set(1, 0); // Start at first track on page 1
      console.log('🔄 Page-track history reset for new chapter');
      
      // Load playlist with recommended tracks (1-5 tracks in order)
      await this.loadPlaylistForChapter(data.chapterIndex, data.recommendedTracks);
      
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

  async loadPlaylistForChapter(chapterIndex, recommendedTracks) {
    try {
      console.log('🎼 Loading playlist for chapter:', chapterIndex);
      console.log('   Recommended tracks:', recommendedTracks?.length || 0);
      
      if (!this.musicManager) {
        console.warn('No music manager available');
        return;
      }
      
      // Get available tracks from music manager
      console.log('   Fetching tracks from music manager...');
      const allTracks = await this.musicManager.getAllAvailableTracks();
      
      console.log('✓ Available tracks:', allTracks.length);
      if (allTracks.length === 0) {
        console.warn('No tracks available');
        this.playlist = [];
        this.renderPlaylist();
        return;
      }
      
      // Build ordered playlist from recommended tracks
      if (recommendedTracks && recommendedTracks.length > 0) {
        console.log(`Found ${recommendedTracks.length} recommended tracks for this chapter`);
        
        // Find full track objects for recommended track IDs (in order)
        const orderedPlaylist = [];
        const usedIds = new Set();
        
        for (const recTrack of recommendedTracks) {
          if (!recTrack || !recTrack.trackId) continue;
          const fullTrack = allTracks.find(t => t.id === recTrack.trackId);
          if (fullTrack) {
            orderedPlaylist.push(fullTrack);
            usedIds.add(fullTrack.id);
            console.log(`   ${orderedPlaylist.length}. ${fullTrack.title}`);
          }
        }
        
        // Add remaining tracks as fallback
        const remainingTracks = allTracks.filter(t => !usedIds.has(t.id));
        this.playlist = [...orderedPlaylist, ...remainingTracks];
        
        console.log(`✓ Playlist: ${orderedPlaylist.length} chapter tracks + ${remainingTracks.length} fallback tracks`);
      } else {
        console.log('No specific recommendations, using all tracks');
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

    // Music tab switching - REMOVED (now using two-column layout)
    // const musicTabs = document.querySelectorAll('.music-tab');
    // musicTabs.forEach(tab => {
    //   tab.addEventListener('click', (e) => {
    //     e.preventDefault();
    //     const targetTab = tab.dataset.tab;
    //     this.switchMusicTab(targetTab);
    //   });
    // });

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

    // Background music filter
    const instrumentalOnlyCheckbox = document.getElementById('instrumental-only');
    instrumentalOnlyCheckbox?.addEventListener('change', async (e) => {
      const settings = JSON.parse(localStorage.getItem('booksWithMusic-settings') || '{}');
      settings.instrumentalOnly = e.target.checked;
      localStorage.setItem('booksWithMusic-settings', JSON.stringify(settings));
      
      console.log('🎼 Background music filter:', e.target.checked ? 'ON' : 'OFF');
      this.showToast(`${e.target.checked ? '🎹' : '🎤'} ${e.target.checked ? 'Background' : 'All'} music - Reloading tracks...`, 'info');
      
      // Reload music with new filter
      await this.reloadMusicWithFilter();
    });

    // Load background music filter setting on startup
    const settings = JSON.parse(localStorage.getItem('booksWithMusic-settings') || '{}');
    if (instrumentalOnlyCheckbox && settings.instrumentalOnly !== undefined) {
      instrumentalOnlyCheckbox.checked = settings.instrumentalOnly;
    }

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
    
    // Listen for page changes from reader
    window.addEventListener('reader:pageChanged', (e) => {
      this.handlePageChange(e.detail);
    });
  }

  handlePageChange(detail) {
    // Check if page-based music advancement is enabled
    const settings = JSON.parse(localStorage.getItem('booksWithMusic-settings') || '{}');
    const pageBasedMusicSwitch = settings.pageBasedMusicSwitch !== false; // Default true
    
    if (!pageBasedMusicSwitch || !this.audioPlayer.state.playing) {
      return; // Feature disabled or music not playing
    }
    
    const { newPage, oldPage, shiftInfo, allShiftPoints, chapterIndex } = detail;
    
    // Check if we changed chapters - reset history
    if (this.currentChapter !== chapterIndex) {
      console.log(`📖 Chapter changed to ${chapterIndex}, resetting page history`);
      this.currentChapter = chapterIndex;
      this.pageTrackHistory.clear();
      this.pageTrackHistory.set(1, 0); // Start at first track
    }
    
    // Store shift points for display
    this.currentShiftPoints = allShiftPoints;
    this.updateNextShiftDisplay(newPage);
    
    // Determine direction
    const isForward = newPage > oldPage;
    const isBackward = newPage < oldPage;
    
    if (isBackward) {
      // Going backward - restore previous track if we crossed a shift point
      this.handleBackwardNavigation(newPage, oldPage);
    } else if (isForward) {
      // Going forward - check if we should advance to next track
      this.handleForwardNavigation(newPage, oldPage, shiftInfo);
    }
  }
  
  handleForwardNavigation(newPage, oldPage, shiftInfo) {
    // Check if this page is a designated shift point (based on content analysis)
    if (shiftInfo && this.playlist && this.playlist.length > 1) {
      console.log(`🎵 Page ${newPage}: Mood shift detected (${shiftInfo.fromMood} → ${shiftInfo.toMood})`);
      console.log(`   Confidence: ${shiftInfo.confidence}%, Score: ${shiftInfo.shiftScore}`);
      
      // Record current page with track before advancing
      this.pageTrackHistory.set(oldPage, this.currentTrackIndex);
      
      // Advance to next track
      this.nextTrack();
      
      // Record new page with new track
      this.pageTrackHistory.set(newPage, this.currentTrackIndex);
    } else {
      // No shift, just record current page with current track
      this.pageTrackHistory.set(newPage, this.currentTrackIndex);
    }
  }
  
  handleBackwardNavigation(newPage, oldPage) {
    // Check if we have history for this page
    if (this.pageTrackHistory.has(newPage)) {
      const historicalTrackIndex = this.pageTrackHistory.get(newPage);
      
      // If different from current track, switch back
      if (historicalTrackIndex !== this.currentTrackIndex && this.playlist.length > 0) {
        console.log(`⏮️ Page ${newPage}: Restoring track ${historicalTrackIndex} (was: ${this.currentTrackIndex})`);
        this.playTrack(historicalTrackIndex);
      }
    } else {
      // No history - check if we crossed a shift point going backward
      const crossedShiftPoint = this.currentShiftPoints.find(sp => 
        sp.page > newPage && sp.page <= oldPage
      );
      
      if (crossedShiftPoint && this.currentTrackIndex > 0) {
        console.log(`⏮️ Page ${newPage}: Crossed shift point backward at page ${crossedShiftPoint.page}`);
        console.log(`   Reverting: ${crossedShiftPoint.toMood} → ${crossedShiftPoint.fromMood}`);
        this.previousTrack();
        this.pageTrackHistory.set(newPage, this.currentTrackIndex);
      }
    }
  }
  
  updateNextShiftDisplay(currentPage) {
    const displayEl = document.getElementById('next-shift-info');
    if (!displayEl || !this.currentShiftPoints) return;
    
    // Find next shift point after current page (for forward navigation)
    const nextShift = this.currentShiftPoints.find(sp => sp.page > currentPage);
    
    // Find previous shift point before current page (for backward navigation)
    const prevShift = [...this.currentShiftPoints].reverse().find(sp => sp.page < currentPage);
    
    let html = '';
    
    if (nextShift) {
      const pagesUntilShift = nextShift.page - currentPage;
      html = `
        <div class="shift-indicator">
          <span class="shift-icon">🎵</span>
          <span class="shift-text">
            Next change in ${pagesUntilShift} page${pagesUntilShift !== 1 ? 's' : ''}<br>
            <small>${nextShift.fromMood} → ${nextShift.toMood}</small>
          </span>
        </div>
      `;
    } else if (prevShift) {
      // No more forward shifts, but show previous shift info
      html = `
        <div class="shift-indicator">
          <span class="shift-icon">📖</span>
          <span class="shift-text">
            No more changes ahead<br>
            <small>Last shift at page ${prevShift.page}</small>
          </span>
        </div>
      `;
    } else {
      html = `
        <div class="shift-indicator">
          <span class="shift-icon">📖</span>
          <span class="shift-text">No music changes in this chapter</span>
        </div>
      `;
    }
    
    displayEl.innerHTML = html;
    displayEl.style.display = 'block';
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

  // switchMusicTab method - REMOVED (no longer needed with two-column layout)
  // switchMusicTab(tabName) {
  //   document.querySelectorAll('.music-tab').forEach(tab => {
  //     tab.classList.remove('active');
  //   });
  //   document.querySelectorAll('.tab-pane').forEach(pane => {
  //     pane.classList.remove('active');
  //   });
  //   const selectedTab = document.querySelector(`.music-tab[data-tab="${tabName}"]`);
  //   const selectedPane = document.getElementById(`tab-${tabName}`);
  //   if (selectedTab) selectedTab.classList.add('active');
  //   if (selectedPane) selectedPane.classList.add('active');
  // }

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
    if (!this.playlist || this.playlist.length === 0) {
      console.warn('No tracks in playlist');
      return;
    }
    
    if (index < 0 || index >= this.playlist.length) {
      console.warn('Invalid track index:', index);
      return;
    }

    this.currentTrackIndex = index;
    const track = this.playlist[index];
    
    if (!track || !track.url) {
      console.error('Invalid track at index:', index);
      return;
    }

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
    if (!track) return;
    
    const trackInfoEl = document.getElementById('current-track');
    if (trackInfoEl) {
      trackInfoEl.innerHTML = `
        <div class="track-title">${this.escapeHtml(track.title || 'Unknown Track')}</div>
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
    if (!this.audioPlayer) {
      console.warn('Audio player not initialized');
      return;
    }
    
    if (this.audioPlayer.isPlaying()) {
      this.audioPlayer.pause();
    } else {
      if (this.playlist && this.playlist.length > 0) {
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
    if (!this.playlist || this.playlist.length === 0) {
      return;
    }
    const newIndex = this.currentTrackIndex - 1;
    if (newIndex >= 0) {
      this.playTrack(newIndex);
    }
  }

  nextTrack() {
    if (!this.playlist || this.playlist.length === 0) {
      return;
    }
    const newIndex = this.currentTrackIndex + 1;
    if (newIndex < this.playlist.length) {
      this.playTrack(newIndex);
    }
  }

  /**
   * Reload music tracks with current filter settings
   * Clears cache and reinitializes music manager
   */
  async reloadMusicWithFilter() {
    try {
      if (!this.musicManager) {
        console.error('Music manager not available');
        return;
      }

      // Stop current playback
      this.audioPlayer.stop();
      
      // Clear music cache to force reload
      localStorage.removeItem('music_tracks_cache');
      console.log('🗑️ Cleared music cache');
      
      // Get current book and chapters
      const reader = window.app?.reader;
      if (!reader || !reader.currentBook || !reader.chapters) {
        console.warn('Reader not available for music reload');
        return;
      }

      // Reinitialize music manager with filter
      console.log('🔄 Reinitializing music manager...');
      await this.musicManager.initialize(reader.currentBook.id, reader.chapters);
      
      // Reload playlist for current chapter
      const chapterIndex = reader.currentChapterIndex || 0;
      const chapterAnalysis = this.musicManager.getChapterAnalysis(chapterIndex);
      const mapping = this.musicManager.chapterMappings[reader.chapters[chapterIndex]?.id || reader.chapters[chapterIndex]?.title];
      
      if (mapping && mapping.tracks) {
        await this.loadPlaylistForChapter(chapterIndex, mapping.tracks);
        this.showToast('✓ Music tracks reloaded!', 'success');
      }
      
      console.log('✓ Music reloaded with new filter');
    } catch (error) {
      console.error('Error reloading music:', error);
      this.showToast('❌ Failed to reload music', 'error');
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
