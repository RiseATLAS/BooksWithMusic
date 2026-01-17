import { AudioPlayer } from '../core/audio-player.js';

export class MusicPanelUI {
  constructor(db, musicManager, reader = null) {
    this.db = db;
    this.musicManager = musicManager;
    this.reader = reader; // Store reader reference for music reload
    this.audioPlayer = new AudioPlayer();
    this.playlist = [];
    this.currentTrackIndex = 0;
    this.currentShiftPoints = []; // Track mood shift points in current chapter
    this.pageTrackHistory = new Map(); // Track which track was playing at each page
    this.currentChapter = null;
    this.isToggling = false; // Prevent multiple simultaneous toggles
  }

  initialize() {
    this.setupEventListeners();
    this.setupMusicManagerListeners();
    this.setupMediaSessionHandlers();
    this.renderPlaylist();
    this.checkApiKeyOnLoad();
  }

  /**
   * Check if Freesound API key is configured on load
   */
  checkApiKeyOnLoad() {
    const freesoundKey = localStorage.getItem('freesound_api_key');
    if (!freesoundKey || freesoundKey.trim() === '') {
      // Show error message after a short delay to ensure UI is loaded
      setTimeout(() => {
        this.showApiKeyWarning();
      }, 1500);
    }
  }

  /**
   * Show warning about missing API key
   */
  showApiKeyWarning() {
    const existingWarning = document.getElementById('api-key-warning');
    if (existingWarning) {
      return; // Don't show duplicate warnings
    }

    const warning = document.createElement('div');
    warning.id = 'api-key-warning';
    warning.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(220, 38, 38, 0.95);
      color: white;
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      z-index: 10000;
      max-width: 500px;
      text-align: center;
      backdrop-filter: blur(10px);
    `;
    
    warning.innerHTML = `
      <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
      <h3 style="margin: 0 0 1rem 0; font-size: 1.5rem;">Music Feature Unavailable</h3>
      <p style="margin: 0 0 1.5rem 0; line-height: 1.6;">
        BooksWithMusic requires a <strong>free Freesound API key</strong> to function. 
        Without it, background music will not work.
      </p>
      <p style="margin: 0 0 1.5rem 0; line-height: 1.6; font-size: 0.9rem; opacity: 0.9;">
        Don't worry - it's completely free and takes less than 2 minutes to get!
      </p>
      <button id="open-music-settings-btn" style="
        background: white;
        color: #dc2626;
        border: none;
        padding: 0.75rem 1.5rem;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        font-size: 1rem;
        margin-right: 0.5rem;
      ">Open Music Settings</button>
      <button id="dismiss-warning-btn" style="
        background: rgba(255, 255, 255, 0.2);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.3);
        padding: 0.75rem 1.5rem;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        font-size: 1rem;
      ">Dismiss</button>
    `;
    
    document.body.appendChild(warning);
    
    // Open music panel when button clicked
    document.getElementById('open-music-settings-btn')?.addEventListener('click', () => {
      const panel = document.getElementById('music-panel');
      if (panel) {
        panel.classList.add('show');
      }
      warning.remove();
    });
    
    // Dismiss button
    document.getElementById('dismiss-warning-btn')?.addEventListener('click', () => {
      warning.remove();
    });
    
    // Auto-dismiss after 15 seconds
    setTimeout(() => {
      if (warning.parentNode) {
        warning.remove();
      }
    }, 15000);
  }

  /**
   * Setup Media Session API handlers for hardware controls
   */
  setupMediaSessionHandlers() {
    if ('mediaSession' in navigator) {
      this.audioPlayer.setMediaSessionHandlers({
        play: () => {
          if (!this.audioPlayer.isPlaying()) {
            this.togglePlayPause();
          }
        },
        pause: () => {
          if (this.audioPlayer.isPlaying()) {
            this.togglePlayPause();
          }
        },
        nextTrack: () => {
          this.nextTrack();
        },
        prevTrack: () => {
          this.previousTrack();
        }
      });
    }
  }

  setupMusicManagerListeners() {
    if (!this.musicManager) {
      console.warn(' No music manager available');
      return;
    }
    
    // Listen for chapter music changes
    this.musicManager.on('chapterMusicChanged', async (data) => {
      
      // Reset page history when chapter changes
      this.currentChapter = data.chapterIndex;
      this.pageTrackHistory.clear();
      this.pageTrackHistory.set(1, 0); // Start at first track on page 1
      
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
      
      if (!this.musicManager) {
        console.warn(' No music manager available');
        return;
      }
      
      // Get available tracks from music manager
      console.log(' Fetching tracks from music manager...');
      const allTracks = await this.musicManager.getAllAvailableTracks();
      
      console.log(` Available tracks: ${allTracks.length}`);
      if (allTracks.length === 0) {
        console.warn(' No tracks available - check if music is enabled and API key is set');
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
        
        console.log(` Playlist: ${orderedPlaylist.length} chapter tracks + ${remainingTracks.length} fallback tracks`);
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
      e.stopPropagation();
      this.togglePanel();
    });

    document.getElementById('close-music-panel')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.hidePanel();
    });

    // Click outside to close music panel
    document.addEventListener('click', (e) => {
      const panel = document.getElementById('music-panel');
      const musicToggle = document.getElementById('music-toggle');
      
      if (panel && panel.classList.contains('show')) {
        // Check if click is outside the panel and not on the music toggle button
        if (!panel.contains(e.target) && !musicToggle?.contains(e.target)) {
          this.hidePanel();
        }
      }
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
      
      console.log('� Background music filter:', e.target.checked ? 'ON' : 'OFF');
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
      
      // Also update the SettingsUI instance if it exists
      if (window.app?.settings) {
        window.app.settings.settings.autoPlay = e.target.checked;
        window.app.settings.syncToFirestore();
      }
      
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
      console.log(' Page-based music switching:', e.target.checked ? 'ON' : 'OFF');
    });

    // Load page-based music switch setting on startup
    if (pageBasedMusicCheckbox && settings.pageBasedMusicSwitch !== undefined) {
      pageBasedMusicCheckbox.checked = settings.pageBasedMusicSwitch;
    }

    // Freesound API key (music panel)
    const freesoundKeyInput = document.getElementById('freesound-key-panel');
    const saveFreesoundBtn = document.getElementById('save-freesound-key-panel');
    const freesoundKeyHelp = document.getElementById('freesound-key-help');
    
    // Show/hide help text based on whether key is saved
    const updateFreesoundHelp = () => {
      const savedKey = localStorage.getItem('freesound_api_key');
      if (freesoundKeyHelp) {
        if (savedKey) {
          freesoundKeyHelp.style.display = 'none';
        } else {
          freesoundKeyHelp.style.display = 'block';
        }
      }
    };
    
    if (freesoundKeyInput) {
      const savedKey = localStorage.getItem('freesound_api_key');
      if (savedKey) {
        freesoundKeyInput.value = savedKey;
      }
      updateFreesoundHelp();
    }

    saveFreesoundBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      const key = freesoundKeyInput?.value.trim();
      if (key) {
        localStorage.setItem('freesound_api_key', key);
        updateFreesoundHelp();
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
      console.log(`Chapter changed to ${chapterIndex}, resetting page history`);
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
      console.log(` Page ${newPage}: Mood shift detected (${shiftInfo.fromMood} → ${shiftInfo.toMood})`);
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
        console.log(`Page ${newPage}: Restoring track ${historicalTrackIndex} (was: ${this.currentTrackIndex})`);
        this.playTrack(historicalTrackIndex);
      }
    } else {
      // No history - check if we crossed a shift point going backward
      const crossedShiftPoint = this.currentShiftPoints.find(sp => 
        sp.page > newPage && sp.page <= oldPage
      );
      
      if (crossedShiftPoint && this.currentTrackIndex > 0) {
        console.log(`Page ${newPage}: Crossed shift point backward at page ${crossedShiftPoint.page}`);
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
    if (!playlistEl) {
      console.error('Playlist element not found!');
      return;
    }

    console.log('Rendering playlist with', this.playlist.length, 'tracks');

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
      
      // Build categorization info
      const energy = track.energy ? `Energy: ${track.energy}/5` : '';
      const tempo = track.tempo ? `Tempo: ${track.tempo}` : '';
      const tags = track.tags && track.tags.length > 0 
        ? `Tags: ${track.tags.slice(0, 5).join(', ')}${track.tags.length > 5 ? '...' : ''}` 
        : '';
      
      const categories = [energy, tempo, tags].filter(c => c).join(' • ');
      
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
              ${categories ? `
                <div class="track-categories" style="font-size: 0.65rem; opacity: 0.5; margin-top: 0.25rem; line-height: 1.3;">
                  ${this.escapeHtml(categories)}
                </div>
              ` : ''}
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
      console.log(' Now playing:', track.title);
    } catch (error) {
      console.error(' Error playing track:', error);
      console.log(' Skipping to next track...');
      
      // Try next track if available
      if (index + 1 < this.playlist.length) {
        setTimeout(() => this.playTrack(index + 1), 1000);
      } else {
        console.warn(' No more tracks to play');
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
      console.error('Audio player not initialized');
      return;
    } else {
      console.log('Toggling play/pause');
    }
    
    // Prevent multiple simultaneous toggles
    if (this.isToggling) {
      console.log('Already toggling, ignoring click');
      return;
    }
    
    this.isToggling = true;
    
    try {
      const isPlaying = this.audioPlayer.isPlaying();
      const audioContextState = this.audioPlayer.audioContext.state;
      const hasCurrentTrack = this.audioPlayer.state.currentTrack;
      
      console.log('Toggle play/pause - State:', {
        isPlaying,
        audioContextState,
        hasCurrentTrack,
        playlistLength: this.playlist.length,
        currentTrackIndex: this.currentTrackIndex
      });
      
      if (isPlaying) {
        // Currently playing - pause it
        console.log('Pausing...');
        this.audioPlayer.pause();
        this.updatePlayPauseButton(false);
      } else {
        // Not playing - start or resume
        console.log('Starting/Resuming...');
        
        if (!this.playlist || this.playlist.length === 0) {
          console.warn('No playlist available');
          this.showToast('No tracks in playlist. Music requires a Freesound API key.', 'info');
          return;
        } else {
          console.log('Playlist available with', this.playlist.length, 'tracks');
        }
        
        // Check if we need to resume or start fresh
        if (audioContextState === 'suspended' && hasCurrentTrack) {
          // Resume paused track
          console.log('Resuming paused track...');
          await this.audioPlayer.resume();
          this.updatePlayPauseButton(true);
        } else {
          // Start playing from current track index
          console.log('Starting new track...');
          await this.playTrack(this.currentTrackIndex);
          // Note: playTrack will update the button via the 'playing' event
        }
      }
    } catch (error) {
      console.error('Error toggling play/pause:', error);
      console.error('Stack trace:', error.stack);
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
      } else {
        console.log('Reloading music with new filter');
      }

      // Stop current playback
      this.audioPlayer.stop();
      
      // Clear music cache to force reload with new filter
      localStorage.removeItem('music_tracks_cache');
      
      // Get reader reference (try multiple ways)
      const reader = window.app?.reader || this.reader;
      if (!reader || !reader.currentBook || !reader.chapters) {
        console.error('Reader not available for music reload');
        this.showToast('Unable to reload - reader not found', 'error');
        return;
      } else {
        console.log('Reader available, proceeding with reload');
      }

      // Reinitialize music manager with new filter
      console.log('Reinitializing music manager with new energy filter...');
      await this.musicManager.initialize(reader.currentBook.id, reader.chapters);
      console.log('Music manager initialization complete');
      
      // Reload playlist for current chapter
      const chapterIndex = reader.currentChapterIndex || 0;
      const chapterKey = reader.chapters[chapterIndex]?.id || reader.chapters[chapterIndex]?.title;
      console.log('Looking for mapping for chapter:', chapterIndex, 'key:', chapterKey);
      console.log('Available mappings:', Object.keys(this.musicManager.chapterMappings));
      
      const mapping = this.musicManager.chapterMappings[chapterKey];
      
      console.log('Mapping found:', !!mapping);
      console.log('Mapping tracks:', mapping?.tracks?.length || 0);
      
      if (mapping && mapping.tracks && mapping.tracks.length > 0) {
        console.log('Loading playlist with', mapping.tracks.length, 'recommended tracks');
        await this.loadPlaylistForChapter(chapterIndex, mapping.tracks);
        // Force UI update
        this.renderPlaylist();
        console.log('Playlist UI updated with', this.playlist.length, 'tracks');
        this.showToast('✓ Music tracks reloaded!', 'success');
      } else {
        console.log('No tracks match filter, clearing playlist');
        this.playlist = [];
        this.renderPlaylist();
        this.showToast('⚠️ No tracks match your filter', 'warning');
      }
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
