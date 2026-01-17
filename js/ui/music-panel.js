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
    this.isToggling = false; // Prevent multiple simultaneous toggles
  }

  initialize() {
    console.log('🎵 Initializing music panel...');
    console.log('   Music manager:', !!this.musicManager);
    this.setupEventListeners();
    this.setupMusicManagerListeners();
    this.setupMediaSessionHandlers();
    this.renderPlaylist();
    console.log('✓ Music panel initialized');
  }

  /**
   * Setup Media Session API handlers for hardware controls
   */
  setupMediaSessionHandlers() {
    if ('mediaSession' in navigator) {
      this.audioPlayer.setMediaSessionHandlers({
        play: () => {
          console.log('🎮 Hardware play pressed');
          if (!this.audioPlayer.isPlaying()) {
            this.togglePlayPause();
          }
        },
        pause: () => {
          console.log('🎮 Hardware pause pressed');
          if (this.audioPlayer.isPlaying()) {
            this.togglePlayPause();
          }
        },
        nextTrack: () => {
          console.log('🎮 Hardware next pressed');
          this.nextTrack();
        },
        prevTrack: () => {
          console.log('🎮 Hardware previous pressed');
          this.previousTrack();
        }
      });
      console.log('✓ Hardware media controls enabled');
    }
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
      
      // Auto-play disabled by default - show message to user
      if (!autoPlay) {
        // Show friendly notice on first load
        if (data.chapterIndex === 0) {
          setTimeout(() => {
            this.showToast('🎵 Click the play button to start music! (Requires Freesound API key - see Settings)', 'info');
          }, 1000);
        }
      } else if (autoPlay && this.playlist.length > 0) {
        // Auto-play the first track of the new playlist
        // (We just loaded a new playlist for this chapter, so start it regardless of previous playing state)
        setTimeout(async () => {
          await this.playTrack(0);
        }, 500);
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

    // Load settings once
    const settings = JSON.parse(localStorage.getItem('booksWithMusic-settings') || '{}');
    
    // Load background music filter setting on startup
    if (instrumentalOnlyCheckbox && settings.instrumentalOnly !== undefined) {
      instrumentalOnlyCheckbox.checked = settings.instrumentalOnly;
    }

    // Auto-play music checkbox
    const autoPlayCheckbox = document.getElementById('auto-play-panel');
    autoPlayCheckbox?.addEventListener('change', (e) => {
      const settings = JSON.parse(localStorage.getItem('booksWithMusic-settings') || '{}');
      settings.autoPlay = e.target.checked;
      localStorage.setItem('booksWithMusic-settings', JSON.stringify(settings));
      this.showToast(`Auto-play ${e.target.checked ? 'enabled' : 'disabled'}`, 'success');
    });

    // Load auto-play setting on startup
    if (autoPlayCheckbox) {
      const isAutoPlay = settings.autoPlay === true;
      autoPlayCheckbox.checked = isAutoPlay;
    }

    // Music enabled checkbox
    const musicEnabledCheckbox = document.getElementById('music-enabled-panel');
    musicEnabledCheckbox?.addEventListener('change', (e) => {
      const settings = JSON.parse(localStorage.getItem('booksWithMusic-settings') || '{}');
      settings.musicEnabled = e.target.checked;
      localStorage.setItem('booksWithMusic-settings', JSON.stringify(settings));
      console.log('🎵 Background music:', e.target.checked ? 'ENABLED' : 'DISABLED');
      
      if (!e.target.checked) {
        // Stop and clear playlist when disabled
        if (this.audioPlayer.isPlaying()) {
          this.audioPlayer.stop();
          this.updatePlayPauseButton(false);
        }
        this.showToast('Music disabled - will not load for new chapters', 'info');
      } else {
        this.showToast('Music enabled - reload page to load tracks', 'success');
      }
    });

    // Load music enabled setting on startup
    if (musicEnabledCheckbox && settings.musicEnabled !== undefined) {
      musicEnabledCheckbox.checked = settings.musicEnabled;
    }

    // Page-based music switch checkbox
    const pageBasedMusicCheckbox = document.getElementById('page-based-music-switch');
    pageBasedMusicCheckbox?.addEventListener('change', (e) => {
      const settings = JSON.parse(localStorage.getItem('booksWithMusic-settings') || '{}');
      settings.pageBasedMusicSwitch = e.target.checked;
      localStorage.setItem('booksWithMusic-settings', JSON.stringify(settings));
      console.log('🎵 Page-based music switching:', e.target.checked ? 'ON' : 'OFF');
    });

    // Load page-based music switch setting on startup
    if (pageBasedMusicCheckbox && settings.pageBasedMusicSwitch !== undefined) {
      pageBasedMusicCheckbox.checked = settings.pageBasedMusicSwitch;
    }

    // Freesound API key (music panel)
    const freesoundKeyInput = document.getElementById('freesound-key-panel');
    const saveFreesoundBtn = document.getElementById('save-freesound-key-panel');
    
    if (freesoundKeyInput) {
      const savedKey = localStorage.getItem('freesound_api_key');
      if (savedKey) {
        freesoundKeyInput.value = savedKey;
      }
    }

    saveFreesoundBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      const key = freesoundKeyInput?.value.trim();
      if (key) {
        localStorage.setItem('freesound_api_key', key);
        this.showToast('Freesound API key saved! Reload page to fetch music.', 'success');
      } else {
        this.showToast('Please enter a valid API key', 'error');
      }
    });

    // Crossfade duration (music panel)
    const crossfadeInput = document.getElementById('crossfade-duration-panel');
    const crossfadeValue = document.getElementById('crossfade-value-panel');
    
    crossfadeInput?.addEventListener('input', (e) => {
      const duration = parseInt(e.target.value);
      if (crossfadeValue) {
        crossfadeValue.textContent = `${duration}s`;
      }
      
      // Save to settings
      const settings = JSON.parse(localStorage.getItem('booksWithMusic-settings') || '{}');
      settings.crossfadeDuration = duration;
      localStorage.setItem('booksWithMusic-settings', JSON.stringify(settings));
      
      // Update audio player crossfade
      if (this.audioPlayer) {
        this.audioPlayer.crossfadeDuration = duration;
      }
    });
    
    // Load crossfade setting on startup
    if (crossfadeInput && settings.crossfadeDuration !== undefined) {
      crossfadeInput.value = settings.crossfadeDuration;
      if (crossfadeValue) {
        crossfadeValue.textContent = `${settings.crossfadeDuration}s`;
      }
      if (this.audioPlayer) {
        this.audioPlayer.crossfadeDuration = settings.crossfadeDuration;
      }
    }

    // Max energy level (music panel)
    const maxEnergyInput = document.getElementById('max-energy-level');
    const maxEnergyValue = document.getElementById('max-energy-value');
    
    maxEnergyInput?.addEventListener('input', (e) => {
      const level = parseInt(e.target.value);
      if (maxEnergyValue) {
        const labels = ['1 (Very Calm)', '2 (Calm)', '3 (Moderate)', '4 (Energetic)', '5 (All)'];
        maxEnergyValue.textContent = labels[level - 1] || `${level}`;
      }
      
      // Save to settings
      const settings = JSON.parse(localStorage.getItem('booksWithMusic-settings') || '{}');
      settings.maxEnergyLevel = level;
      localStorage.setItem('booksWithMusic-settings', JSON.stringify(settings));
      
      console.log('🎚️ Max energy level:', level);
      this.showToast(`Energy limit: ${level}/5 - Reloading music...`, 'info');
      
      // Reload music with new energy filter
      this.reloadMusicWithFilter();
    });
    
    // Load max energy setting on startup
    if (maxEnergyInput && settings.maxEnergyLevel !== undefined) {
      maxEnergyInput.value = settings.maxEnergyLevel;
      if (maxEnergyValue) {
        const labels = ['1 (Very Calm)', '2 (Calm)', '3 (Moderate)', '4 (Energetic)', '5 (All)'];
        maxEnergyValue.textContent = labels[settings.maxEnergyLevel - 1] || `${settings.maxEnergyLevel}`;
      }
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
  
  async handleBackwardNavigation(newPage, oldPage) {
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
        await this.previousTrack();
      }
    }
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

    // Get shift points to mark which tracks play at mood changes
    const shiftPoints = this.currentShiftPoints || [];
    
    playlistEl.innerHTML = this.playlist.map((track, index) => {
      const isShiftTrack = index < shiftPoints.length && shiftPoints[index]?.page;
      
      // Concise shift info
      let shiftInfo = '';
      if (isShiftTrack) {
        const sp = shiftPoints[index];
        shiftInfo = `Page ${sp.page}: ${sp.fromMood} → ${sp.toMood}`;
      } else if (index === 0) {
        shiftInfo = 'Chapter start';
      }
      
      return `
        <div class="playlist-item ${index === this.currentTrackIndex ? 'active' : ''} ${isShiftTrack ? 'shift-point' : ''}" 
             data-track-index="${index}"
             title="${track.title} by ${track.artist || 'Unknown'}${shiftInfo ? ' • ' + shiftInfo : ''}">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;">
            <div style="flex: 1; min-width: 0;">
              <div class="track-title" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500;">
                ${this.escapeHtml(track.title)}
              </div>
              <div class="track-artist" style="font-size: 0.7rem; opacity: 0.65; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 0.1rem;">
                ${this.escapeHtml(track.artist || 'Unknown')}
              </div>
            </div>
            <div class="track-duration" style="font-size: 0.7rem; opacity: 0.6; white-space: nowrap; flex-shrink: 0;">
              ${this.formatDuration(track.duration)}
            </div>
          </div>
          ${shiftInfo ? `<div class="track-play-info">${shiftInfo}</div>` : ''}
        </div>
      `;
    }).join('');

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

  async togglePlayPause() {
    if (!this.audioPlayer) {
      console.warn('Audio player not initialized');
      return;
    }
    
    // Prevent multiple simultaneous toggles
    if (this.isToggling) {
      console.log('⏸️ Already toggling, ignoring click');
      return;
    }
    
    this.isToggling = true;
    
    try {
      const isPlaying = this.audioPlayer.isPlaying();
      const audioContextState = this.audioPlayer.audioContext.state;
      const hasCurrentTrack = this.audioPlayer.state.currentTrack;
      
      console.log('🎵 Toggle play/pause - State:', {
        isPlaying,
        audioContextState,
        hasCurrentTrack,
        playlistLength: this.playlist.length,
        currentTrackIndex: this.currentTrackIndex
      });
      
      if (isPlaying) {
        // Currently playing - pause it
        console.log('⏸️ Pausing...');
        this.audioPlayer.pause();
        this.updatePlayPauseButton(false);
      } else {
        // Not playing - start or resume
        console.log('▶️ Starting/Resuming...');
        
        if (!this.playlist || this.playlist.length === 0) {
          console.warn('⚠️ No playlist available');
          this.showToast('No tracks in playlist. Music requires a Freesound API key.', 'info');
          return;
        }
        
        // Check if we need to resume or start fresh
        if (audioContextState === 'suspended' && hasCurrentTrack) {
          // Resume paused track
          console.log('▶️ Resuming paused track...');
          await this.audioPlayer.resume();
          this.updatePlayPauseButton(true);
        } else {
          // Start playing from current track index
          console.log('▶️ Starting new track...');
          await this.playTrack(this.currentTrackIndex);
          // Note: playTrack will update the button via the 'playing' event
        }
      }
    } catch (error) {
      console.error('❌ Error toggling play/pause:', error);
      this.updatePlayPauseButton(false);
    } finally {
      // Release the lock after a short delay
      setTimeout(() => {
        this.isToggling = false;
      }, 300);
    }
  }

  updatePlayPauseButton(isPlaying) {
    const btn = document.getElementById('play-pause');
    if (btn) {
      const iconSpan = btn.querySelector('.icon');
      if (iconSpan) {
        iconSpan.textContent = isPlaying ? '⏸' : '▶';
      }
      btn.title = isPlaying ? 'Pause' : 'Play';
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

  /**
   * Update the display showing when the next music shift will occur
   */
  updateNextShiftDisplay(currentPage) {
    const nextShiftInfo = document.getElementById('next-shift-info');
    if (!nextShiftInfo) return;
    
    if (!this.currentShiftPoints || this.currentShiftPoints.length === 0) {
      nextShiftInfo.style.display = 'none';
      return;
    }
    
    // Find the next shift point after current page
    const nextShift = this.currentShiftPoints.find(sp => sp.page > currentPage);
    
    if (nextShift) {
      const pagesUntil = nextShift.page - currentPage;
      nextShiftInfo.innerHTML = `
        <div class="shift-indicator">
          <span class="shift-icon">🎵</span>
          <div class="shift-text">
            <strong>Next music shift in ${pagesUntil} page${pagesUntil > 1 ? 's' : ''}</strong>
            <small>${nextShift.fromMood} → ${nextShift.toMood}</small>
          </div>
        </div>
      `;
      nextShiftInfo.style.display = 'block';
    } else {
      nextShiftInfo.style.display = 'none';
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
