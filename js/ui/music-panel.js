import { AudioPlayer } from '../core/audio-player.js';
import { logTrackUsage } from '../storage/firestore-storage.js';
import { auth } from '../config/firebase-config.js';

export class MusicPanelUI {
  constructor(db, musicManager, reader = null) {
    this.db = db;
    this.musicManager = musicManager;
    this.reader = reader; // Store reader reference for music reload
    
    // Audio players (dual-source support)
    this.audioPlayer = new AudioPlayer(); // Freesound: Embedded Web Audio API player
    this.spotifyPlayer = null; // Spotify: Lazy-loaded Spotify Connect player
    
    // Current music source: 'freesound' (default) or 'spotify'
    this.currentMusicSource = localStorage.getItem('music_source') || 'freesound';
    
    // Playlist state
    this.playlist = [];
    this.currentTrackIndex = 0;
    this.currentShiftPoints = []; // Track mood shift points in current chapter
    this.pageTrackHistory = new Map(); // Track which track was playing at each page
    this.currentChapter = null;
    
    // Playback controls
    this.isToggling = false; // Prevent multiple simultaneous toggles
  }

  /**
   * Get API key with backup fallback
   * @private
   */
  _getApiKey() {
    const userKey = localStorage.getItem('freesound_api_key');
    if (userKey && userKey.trim() !== '') return userKey;
    
    // Backup key (obfuscated)
    const parts = ['zuEylS4I', 'QQIyJdHt', 'oySnXhXF', 'oDwMgGv8', 'qVgrxsad'];
    return parts.join('');
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
    const freesoundKey = this._getApiKey();
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
    
    // Open music settings panel when button clicked
    document.getElementById('open-music-settings-btn')?.addEventListener('click', () => {
      const panel = document.getElementById('music-settings-panel');
      if (panel) {
        document.getElementById('settings-panel')?.classList.remove('show');
        document.getElementById('music-panel')?.classList.remove('show');
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
    
    // Listen for music source changes (Freesound ↔ Spotify)
    this.musicManager.on('musicSourceChanged', async (data) => {
      console.log(`🔄 Music source changed to: ${data.source}`);
      this.currentMusicSource = data.source;
      
      // Stop current playback when switching sources
      if (this.audioPlayer?.isPlaying()) {
        this.audioPlayer.pause();
      }
      if (this.spotifyPlayer) {
        await this.spotifyPlayer.pause?.();
      }
      
      // Update UI
      this.updatePlayPauseButton(false);
      
      // Reload playlist with new tracks from the new source
      if (this.currentChapter !== null) {
        this.renderPlaylist();
      }
      
      this.showToast(`Switched to ${data.source === 'spotify' ? 'Spotify' : 'Freesound'} (${data.trackCount} tracks loaded)`, 'success');
    });
    
    // Listen for chapter music changes
    this.musicManager.on('chapterMusicChanged', async (data) => {
      
      // Reset page history when chapter changes
      this.currentChapter = data.chapterIndex;
      this.pageTrackHistory.clear();
      
      // Store shift points for this chapter
      this.currentShiftPoints = data.chapterShiftPoints?.shiftPoints || [];
      
      // Load playlist with recommended tracks (1-5 tracks in order)
      await this.loadPlaylistForChapter(data.chapterIndex, data.recommendedTracks, data.currentPageInChapter || 1);
      
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
        // Auto-play the appropriate track for the current page
        // (We just loaded a new playlist for this chapter, so start it regardless of previous playing state)
        const startTrackIndex = this.determineTrackIndexForPage(data.currentPageInChapter || 1);
        setTimeout(async () => {
          await this.playTrack(startTrackIndex);
        }, 500);
      }
    });
  }

  async loadPlaylistForChapter(chapterIndex, recommendedTracks, currentPageInChapter = 1) {
    try {
      
      if (!this.musicManager) {
        console.warn('⚠️ No music manager available');
        return;
      }
      
      // Update auto-detected keywords display whenever playlist loads
      this.updateAutoDetectedKeywordsDisplay();
      
      // Check music source
      const musicSource = localStorage.getItem('music_source') || 'freesound';
      let allTracks = [];
      
      if (musicSource === 'spotify') {
        // For Spotify, get tracks for this specific chapter (on-demand)
        if (this.musicManager.getTracksForChapter) {
          allTracks = await this.musicManager.getTracksForChapter(chapterIndex);
        }
      } else {
        // For Freesound, get all available tracks
        if (this.musicManager.getAllAvailableTracks) {
          allTracks = await this.musicManager.getAllAvailableTracks();
        }
      }
      
      if (allTracks.length === 0) {
        console.warn('⚠️ No tracks available - check if music is enabled and API key is set');
        this.playlist = [];
        this.renderPlaylist();
        return;
      }
      
      // Build ordered playlist from recommended tracks
      if (recommendedTracks && recommendedTracks.length > 0) {
        
        // Find full track objects for recommended track IDs (in order)
        const orderedPlaylist = [];
        const usedIds = new Set();
        
        for (const recTrack of recommendedTracks) {
          if (!recTrack || !recTrack.trackId) continue;
          const fullTrack = allTracks.find(t => t.id === recTrack.trackId);
          if (fullTrack) {
            orderedPlaylist.push(fullTrack);
            usedIds.add(fullTrack.id);
          }
        }
        
        // Add remaining tracks as fallback
        const remainingTracks = allTracks.filter(t => !usedIds.has(t.id));
        this.playlist = [...orderedPlaylist, ...remainingTracks];
        
      } else {
        this.playlist = allTracks;
      }
      
      // Determine starting track based on current page
      this.currentTrackIndex = this.determineTrackIndexForPage(currentPageInChapter);
      this.renderPlaylist();
    } catch (error) {
      console.error('Error loading playlist:', error);
    }
  }

  /**
   * Determine which track should be playing for a given page number
   * based on shift points in the chapter
   */
  determineTrackIndexForPage(pageNumber) {
    if (!this.currentShiftPoints || this.currentShiftPoints.length === 0 || !this.playlist || this.playlist.length === 0) {
      // No shift points or no playlist, start at first track
      this.pageTrackHistory.set(pageNumber, 0);
      return 0;
    }
    
    // Count how many shift points occur before this page
    const shiftsBeforePage = this.currentShiftPoints.filter(sp => sp.page < pageNumber).length;
    
    // Track index is the number of shifts that have occurred (clamped to playlist length)
    const trackIndex = Math.min(shiftsBeforePage, this.playlist.length - 1);
    
    // Store in history
    this.pageTrackHistory.set(pageNumber, trackIndex);
    
    console.log(`📍 Page ${pageNumber}: Starting at track ${trackIndex} (${shiftsBeforePage} shifts before this page)`);
    
    return trackIndex;
  }

  setupEventListeners() {    // Toggle music panel (playlist/player only)
    document.getElementById('music-toggle')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.togglePanel();
    });
    // Toggle music settings panel (separate settings panel)
    document.getElementById('music-settings-toggle')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleSettingsPanel();
    });

    // Click outside to close panels
    document.addEventListener('click', (e) => {
      const panel = document.getElementById('music-panel');
      const musicToggle = document.getElementById('music-toggle');
      const settingsPanel = document.getElementById('music-settings-panel');
      const musicSettingsToggle = document.getElementById('music-settings-toggle');
      
      if (panel && panel.classList.contains('show')) {
        // Check if click is outside the panel and not on the music toggle button
        if (!panel.contains(e.target) && !musicToggle?.contains(e.target)) {
          this.hidePanel();
        }
      }

      if (settingsPanel && settingsPanel.classList.contains('show')) {
        if (!settingsPanel.contains(e.target) && !musicSettingsToggle?.contains(e.target)) {
          settingsPanel.classList.remove('show');
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
    document.getElementById('play-pause')?.addEventListener('click', async (e) => {
      e.preventDefault();
      
      // Activate element for mobile autoplay support (iOS)
      // This must be called from a user interaction event
      if (this.currentMusicSource === 'spotify' && this.spotifyPlayer?.activateElement) {
        await this.spotifyPlayer.activateElement();
      }
      
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
      
      console.log('🎵 Background music filter:', e.target.checked ? 'ON' : 'OFF');
      this.showToast(`${e.target.checked ? '🎹' : '🎤'} ${e.target.checked ? 'Background' : 'All'} music - Reloading tracks...`, 'info');
      
      // Reload music with new filter
      await this.reloadMusicWithFilter();
    });

    // Verbose logging toggle
    const verboseLoggingCheckbox = document.getElementById('verbose-logging');
    verboseLoggingCheckbox?.addEventListener('change', (e) => {
      const settings = JSON.parse(localStorage.getItem('booksWithMusic-settings') || '{}');
      settings.verboseLogging = e.target.checked;
      localStorage.setItem('booksWithMusic-settings', JSON.stringify(settings));
      
      // Update MusicManager immediately
      if (this.musicManager) {
        this.musicManager.setVerboseLogging(e.target.checked);
      }
      
      this.showToast(`${e.target.checked ? '📊' : '🔇'} ${e.target.checked ? 'Detailed' : 'Minimal'} logging enabled`, 'info');
    });

    // Load settings once
    const settings = JSON.parse(localStorage.getItem('booksWithMusic-settings') || '{}');
    
    // Load background music filter setting on startup
    if (instrumentalOnlyCheckbox && settings.instrumentalOnly !== undefined) {
      instrumentalOnlyCheckbox.checked = settings.instrumentalOnly;
    }

    // Load verbose logging setting on startup
    if (verboseLoggingCheckbox) {
      verboseLoggingCheckbox.checked = settings.verboseLogging !== false; // Default true
    }
    
    // Apply verbose logging setting to MusicManager
    if (this.musicManager) {
      this.musicManager.setVerboseLogging(settings.verboseLogging !== false);
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
    const backupKeyStatus = document.getElementById('backup-key-status');
    
    // Show/hide help text and backup key status based on whether key is saved
    const updateFreesoundHelp = () => {
      const savedKey = localStorage.getItem('freesound_api_key');
      
      if (savedKey) {
        // User has their own key - hide both help and backup status
        if (freesoundKeyHelp) freesoundKeyHelp.style.display = 'none';
        if (backupKeyStatus) backupKeyStatus.style.display = 'none';
      } else {
        // No user key - show backup key status, hide help
        if (backupKeyStatus) backupKeyStatus.style.display = 'block';
        if (freesoundKeyHelp) freesoundKeyHelp.style.display = 'none';
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
      
      // Allow saving blank values (to clear/remove API key)
      if (key) {
        localStorage.setItem('freesound_api_key', key);
        updateFreesoundHelp();
        this.showToast('Freesound API key saved! Reload page to fetch music.', 'success');
      } else {
        // Save blank value to clear the key
        localStorage.removeItem('freesound_api_key');
        updateFreesoundHelp();
        this.showToast('Freesound API key cleared. You will need to add a key to use music.', 'info');
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
      
      // Also update the SettingsUI instance and sync to Firestore if it exists
      if (window.app?.settings) {
        window.app.settings.settings.crossfadeDuration = duration;
        window.app.settings.syncToFirestore();
      }
      
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
      
      // Save to localStorage
      const settings = JSON.parse(localStorage.getItem('booksWithMusic-settings') || '{}');
      settings.maxEnergyLevel = level;
      localStorage.setItem('booksWithMusic-settings', JSON.stringify(settings));
      
      // Also update the SettingsUI instance and sync to Firestore if it exists
      if (window.app?.settings) {
        window.app.settings.settings.maxEnergyLevel = level;
        window.app.settings.syncToFirestore();
      }
      
      this.showToast(`Energy limit: ${level}/5 - Reloading music...`, 'info');
      
      // Reload music with new energy filter
      this.reloadMusicWithFilter();
    });
    
    // Load max energy setting on startup
    if (maxEnergyInput) {
      // Use settings variable that was already loaded above, default to 3 (Moderate)
      const maxEnergy = settings.maxEnergyLevel !== undefined ? settings.maxEnergyLevel : 3;
      maxEnergyInput.value = maxEnergy;
      if (maxEnergyValue) {
        const labels = ['1 (Very Calm)', '2 (Calm)', '3 (Moderate)', '4 (Energetic)', '5 (All)'];
        maxEnergyValue.textContent = labels[maxEnergy - 1] || `${maxEnergy}`;
      }
    }

    // Songs per chapter setting
    const songsPerChapterInput = document.getElementById('songs-per-chapter');
    const songsPerChapterValue = document.getElementById('songs-per-chapter-value');
    
    songsPerChapterInput?.addEventListener('input', (e) => {
      const count = parseInt(e.target.value);
      if (songsPerChapterValue) {
        songsPerChapterValue.textContent = `${count} song${count !== 1 ? 's' : ''}`;
      }
      
      // Save to localStorage
      const settings = JSON.parse(localStorage.getItem('booksWithMusic-settings') || '{}');
      settings.songsPerChapter = count;
      localStorage.setItem('booksWithMusic-settings', JSON.stringify(settings));
      
      // Also update the SettingsUI instance and sync to Firestore if it exists
      if (window.app?.settings) {
        window.app.settings.settings.songsPerChapter = count;
        window.app.settings.syncToFirestore();
      }
      
      this.showToast(`Songs per chapter: ${count} - Reanalyzing...`, 'info');
      
      // Trigger reanalysis with new song count
      this.reanalyzeWithNewSettings();
    });
    
    // Load songs per chapter setting on startup
    if (songsPerChapterInput) {
      const songsPerChapter = settings.songsPerChapter !== undefined ? settings.songsPerChapter : 5;
      songsPerChapterInput.value = songsPerChapter;
      if (songsPerChapterValue) {
        songsPerChapterValue.textContent = `${songsPerChapter} song${songsPerChapter !== 1 ? 's' : ''}`;
      }
    }

    // Minimum songs per pages setting
    const minSongsPerPagesInput = document.getElementById('min-songs-per-pages');
    const minSongsPerPagesValue = document.getElementById('min-songs-per-pages-value');
    
    minSongsPerPagesInput?.addEventListener('input', (e) => {
      const ratio = parseInt(e.target.value);
      if (minSongsPerPagesValue) {
        minSongsPerPagesValue.textContent = `1 song per ${ratio} page${ratio !== 1 ? 's' : ''}`;
      }
      
      // Save to localStorage
      const settings = JSON.parse(localStorage.getItem('booksWithMusic-settings') || '{}');
      settings.minSongsPerPages = ratio;
      localStorage.setItem('booksWithMusic-settings', JSON.stringify(settings));
      
      // Also update the SettingsUI instance and sync to Firestore if it exists
      if (window.app?.settings) {
        window.app.settings.settings.minSongsPerPages = ratio;
        window.app.settings.syncToFirestore();
      }
      
      this.showToast(`Min songs: 1 per ${ratio} page${ratio !== 1 ? 's' : ''} - Reanalyzing...`, 'info');
      
      // Trigger reanalysis with new ratio
      this.reanalyzeWithNewSettings();
    });
    
    // Load minimum songs per pages setting on startup
    if (minSongsPerPagesInput) {
      const minSongsPerPages = settings.minSongsPerPages !== undefined ? settings.minSongsPerPages : 1;
      minSongsPerPagesInput.value = minSongsPerPages;
      if (minSongsPerPagesValue) {
        minSongsPerPagesValue.textContent = `1 song per ${minSongsPerPages} page${minSongsPerPages !== 1 ? 's' : ''}`;
      }
    }

    // Book vibe keywords setting
    const bookVibeKeywordsInput = document.getElementById('book-vibe-keywords');
    const applyBookVibeBtn = document.getElementById('apply-book-vibe');
    
    // Load book vibe keywords on startup
    if (bookVibeKeywordsInput) {
      const bookVibeKeywords = settings.bookVibeKeywords || '';
      bookVibeKeywordsInput.value = bookVibeKeywords;
      
      // Update auto-detected keywords display
      this.updateAutoDetectedKeywordsDisplay();
    }
    
    // Apply book vibe keywords button
    applyBookVibeBtn?.addEventListener('click', () => {
      const keywords = bookVibeKeywordsInput?.value.trim() || '';
      
      // Save to localStorage
      const settings = JSON.parse(localStorage.getItem('booksWithMusic-settings') || '{}');
      settings.bookVibeKeywords = keywords;
      localStorage.setItem('booksWithMusic-settings', JSON.stringify(settings));
      
      // Also update the SettingsUI instance and sync to Firestore if it exists
      if (window.app?.settings) {
        window.app.settings.settings.bookVibeKeywords = keywords;
        window.app.settings.syncToFirestore();
      }
      
      if (keywords) {
        this.showToast(`✅ Book vibe: "${keywords}" - Reanalyzing...`, 'info');
      } else {
        const autoKeywords = this.musicManager?.bookAnalysis?.bookProfile?.autoDetectedKeywords?.join(', ') || 'default';
        this.showToast(`✅ Using auto-detected: "${autoKeywords}" - Reanalyzing...`, 'info');
      }
      
      // Trigger full reanalysis with new book vibe
      this.reanalyzeWithNewSettings();
    });

    // Audio player events
    this.audioPlayer.on('trackEnded', () => {
      this.handleTrackEnded();
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
    
    if (!pageBasedMusicSwitch) {
      return; // Feature disabled
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
      console.log(`📄 Mood shift | Page ${newPage} | ${shiftInfo.fromMood} → ${shiftInfo.toMood} | Confidence: ${shiftInfo.confidence}% | Score: ${shiftInfo.shiftScore}`);
      
      // Record current page with track before advancing
      this.pageTrackHistory.set(oldPage, this.currentTrackIndex);
      
      // Advance to next track (will switch track or just update UI if not playing)
      const wasPlaying = this.audioPlayer.state.playing;
      this.nextTrack(wasPlaying);
      
      // Record new page with new track
      this.pageTrackHistory.set(newPage, this.currentTrackIndex);
    } else {
      // No shift, just record current page with current track
      this.pageTrackHistory.set(newPage, this.currentTrackIndex);
      // Update UI to highlight current track
      this.renderPlaylist();
    }
  }
  
  async handleBackwardNavigation(newPage, oldPage) {
    // Check if we have history for this page
    if (this.pageTrackHistory.has(newPage)) {
      const historicalTrackIndex = this.pageTrackHistory.get(newPage);
      
      // If different from current track, switch back (update UI and play if music was playing)
      if (historicalTrackIndex !== this.currentTrackIndex && this.playlist.length > 0) {
        console.log(`⏮️ Restore | Page ${newPage} | Track ${this.currentTrackIndex} → ${historicalTrackIndex}`);
        const wasPlaying = this.audioPlayer.state.playing;
        
        // Update track index and UI
        this.currentTrackIndex = historicalTrackIndex;
        this.renderPlaylist();
        
        // If music was playing, switch to the track
        if (wasPlaying) {
          await this.playTrack(historicalTrackIndex);
        }
      }
    } else {
      // No history - check if we crossed a shift point going backward
      const crossedShiftPoint = this.currentShiftPoints.find(sp => 
        sp.page > newPage && sp.page <= oldPage
      );
      
      if (crossedShiftPoint && this.currentTrackIndex > 0) {
        console.log(`⏮️ Backward shift | Page ${newPage} | Shift at ${crossedShiftPoint.page} | ${crossedShiftPoint.toMood} → ${crossedShiftPoint.fromMood}`);
        const wasPlaying = this.audioPlayer.state.playing;
        await this.previousTrack(wasPlaying);
      }
    }
  }

  /**
   * Handle when a track finishes playing naturally.
   * Instead of blindly advancing to the next track in the playlist,
   * we select another track based on the user's CURRENT reading position.
   */
  async handleTrackEnded() {
    console.log('🎵 Track ended naturally');
    
    // Get reader reference to check current page
    const reader = window.app?.reader || this.reader;
    if (!reader || typeof reader.currentPage !== 'number') {
      console.warn('Cannot determine current page - falling back to simple next track');
      this.nextTrack();
      return;
    }
    
    const currentPage = reader.currentPage;
    
    // Find which track INDEX should be playing for this page
    // (based on shift points - each track corresponds to a mood shift range)
    const targetTrackIndex = this.determineTrackIndexForPage(currentPage);
    
    if (targetTrackIndex === null || targetTrackIndex === undefined) {
      console.warn('Cannot determine track index for current page - no action taken');
      return;
    }
    
    // If we're still in the same mood/shift range, play another track from that same range
    // If we've moved to a different range (user turned pages while song was playing), switch to that range
    if (targetTrackIndex === this.currentTrackIndex) {
      // User is still in the same mood range - select another variety track for this mood
      console.log(`   🔁 Replaying (Page ${currentPage}, Track ${targetTrackIndex})`);
      
      // For now, replay the same track (or we could implement variety selection here)
      // TODO: Consider selecting a different track with similar mood from the music manager
      await this.playTrack(this.currentTrackIndex);
    } else {
      // User has moved to a different page range while the song was playing
      console.log(`   ⏭️ Switching (Page ${currentPage}, Track ${this.currentTrackIndex} → ${targetTrackIndex})`);
      await this.playTrack(targetTrackIndex);
    }
  }

  togglePanel() {
    const panel = document.getElementById('music-panel');
    if (panel) {
      const shouldShow = !panel.classList.contains('show');
      if (shouldShow) {
        // Close other panels when opening music panel
        document.getElementById('settings-panel')?.classList.remove('show');
        document.getElementById('music-settings-panel')?.classList.remove('show');
      }
      panel.classList.toggle('show');
    }
  }

  toggleSettingsPanel() {
    const panel = document.getElementById('music-settings-panel');
    if (panel) {
      const shouldShow = !panel.classList.contains('show');
      if (shouldShow) {
        // Close other panels when opening music settings
        document.getElementById('settings-panel')?.classList.remove('show');
        document.getElementById('music-panel')?.classList.remove('show');
        
        // Update auto-detected keywords display when panel opens
        this.updateAutoDetectedKeywordsDisplay();
      }
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

    if (this.playlist.length === 0) {
      playlistEl.innerHTML = '<p class="empty-playlist">No tracks available</p>';
      return;
    }

    // Get shift points to mark which tracks play at mood changes
    const shiftPoints = this.currentShiftPoints || [];
    
    // Check if track info display is enabled
    const settings = JSON.parse(localStorage.getItem('booksWithMusic-settings') || '{}');
    const showTrackInfo = settings.showTrackInfo || false;
    
    const isPlaying = this.isCurrentlyPlaying();
    playlistEl.innerHTML = this.playlist.map((track, index) => {
      const isShiftTrack = index < shiftPoints.length && shiftPoints[index]?.page;
      const isCurrent = index === this.currentTrackIndex;
      const playState = isCurrent ? (isPlaying ? 'playing' : 'paused') : 'queued';
      const playIcon = isCurrent ? (isPlaying ? '▶' : '⏸') : '•';
      
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
      
      // Build detailed track info (only shown if setting is enabled)
      let detailedInfo = '';
      if (showTrackInfo) {
        const infoItems = [];
        
        // Genre/Tags
        if (track.tags && track.tags.length > 0) {
          infoItems.push(`🎵 Genre: ${track.tags.slice(0, 3).join(', ')}`);
        }
        
        // Energy level
        if (track.energy) {
          const energyLevel = track.energy >= 4 ? 'High' : track.energy >= 3 ? 'Medium' : 'Low';
          infoItems.push(`⚡ Energy: ${energyLevel} (${track.energy}/5)`);
        }
        
        // Valence (mood positivity)
        if (track.valence !== undefined) {
          const moodType = track.valence >= 0.6 ? 'Uplifting' : track.valence >= 0.4 ? 'Neutral' : 'Melancholic';
          infoItems.push(`😊 Mood: ${moodType}`);
        }
        
        // Tempo
        if (track.tempo) {
          const tempoType = track.tempo >= 140 ? 'Fast' : track.tempo >= 90 ? 'Moderate' : 'Slow';
          infoItems.push(`🎼 Tempo: ${tempoType} (${Math.round(track.tempo)} BPM)`);
        }
        
        // Instrumentalness
        if (track.instrumentalness !== undefined && track.instrumentalness >= 0.5) {
          infoItems.push(`🎹 Instrumental`);
        }
        
        // Why it was chosen (reasoning)
        if (track.reasoning) {
          infoItems.push(`💡 ${track.reasoning}`);
        } else if (shiftInfo) {
          infoItems.push(`💡 Selected for: ${shiftInfo}`);
        } else if (index === 0) {
          infoItems.push(`💡 Chapter opening track`);
        }
        
        // Source
        const sourceIcon = track.source === 'spotify' ? '🎶' : '🆓';
        const sourceName = track.source === 'spotify' ? 'Spotify' : 'Freesound';
        infoItems.push(`${sourceIcon} Source: ${sourceName}`);
        
        if (infoItems.length > 0) {
          detailedInfo = `
            <div class="track-detailed-info" style="font-size: 0.7rem; opacity: 0.7; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.1); line-height: 1.5;">
              ${infoItems.map(item => `<div>${this.escapeHtml(item)}</div>`).join('')}
            </div>
          `;
        }
      }
      
      return `
        <div class="playlist-item ${isCurrent ? 'active' : ''} ${isShiftTrack ? 'shift-point' : ''} ${isCurrent ? 'is-current' : ''} ${isPlaying && isCurrent ? 'is-playing' : ''}" 
             data-track-index="${index}"
             title="${track.title} by ${track.artist || 'Unknown'}${shiftInfo ? ' • ' + shiftInfo : ''}">
          <div class="playlist-status" aria-hidden="true">
            <span class="playlist-status-icon">${playIcon}</span>
            <span class="playlist-status-text">${playState}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;">
            <div style="flex: 1; min-width: 0;">
              <div class="track-title" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500;">
                ${this.escapeHtml(track.title)}
              </div>
              <div class="track-artist" style="font-size: 0.7rem; opacity: 0.65; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 0.1rem;">
                ${this.escapeHtml(track.artist || 'Unknown')}
              </div>
              ${!showTrackInfo && categories ? `
                <div class="track-categories" style="font-size: 0.65rem; opacity: 0.5; margin-top: 0.25rem; line-height: 1.3;">
                  ${this.escapeHtml(categories)}
                </div>
              ` : ''}
              ${detailedInfo}
            </div>
            <div class="track-duration" style="font-size: 0.7rem; opacity: 0.6; white-space: nowrap; flex-shrink: 0;">
              ${this.formatDuration(track.duration)}
            </div>
          </div>
          ${!showTrackInfo && shiftInfo ? `<div class="track-play-info">${shiftInfo}</div>` : ''}
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
    this.updatePlaylistSelection();

    // Play audio with appropriate player based on music source
    try {
      await this.playTrackWithCurrentSource(track);
    } catch (error) {
      console.error('❌ Error playing track:', error);
      console.log('⏭️ Skipping to next track...');
      
      // Try next track if available
      if (index + 1 < this.playlist.length) {
        setTimeout(() => this.playTrack(index + 1), 1000);
      } else {
        console.warn('⚠️ No more tracks to play');
        // Show appropriate error message based on source
        if (this.currentMusicSource === 'spotify') {
          this.showToast('❌ Unable to play Spotify track. Ensure Spotify is connected and a device is active.', 'error');
        } else {
          const freesoundKey = this._getApiKey();
          if (!freesoundKey) {
            this.showToast('🔑 Music playback requires a free Freesound API key. Get one at freesound.org/apiv2/apply and add it in Settings.', 'error');
          } else {
            this.showToast('❌ Unable to load music tracks. Please check your API key in Settings.', 'error');
          }
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

  updatePlaylistSelection() {
    this.renderPlaylist();
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
      const isPlaying = this.isCurrentlyPlaying();
      
      // Check if current source has an active/loaded track
      // (For Spotify: has active track in player, For Freesound: has loaded audio in AudioPlayer)
      const hasCurrentTrack = this.currentMusicSource === 'spotify' 
        ? this.spotifyPlayer?.currentTrack
        : this.audioPlayer.state.currentTrack;
      
      console.log(`⏯️ Toggle play/pause | Playing:${isPlaying} | Source:${this.currentMusicSource} | Track:${hasCurrentTrack} | Playlist:${this.playlist.length} | Index:${this.currentTrackIndex}`);
      
      if (isPlaying) {
        // Currently playing - pause it
        console.log('Pausing current track...');
        await this.pauseCurrentSource();
        this.updatePlayPauseButton(false);
      } else {
        // Not playing - need to start or resume
        console.log('Starting/Resuming playback...');
        
        // Validate playlist exists before attempting playback
        if (!this.playlist || this.playlist.length === 0) {
          console.warn('Cannot play: Playlist is empty');
          const sourceMsg = this.currentMusicSource === 'spotify' 
            ? 'No tracks in playlist. Spotify must be connected.'
            : 'No tracks in playlist. Music requires a Freesound API key.';
          this.showToast(sourceMsg, 'info');
          return;
        }
        
        // Decide whether to resume paused track or start new track
        if (hasCurrentTrack) {
          // Resume previously paused track
          console.log('Resuming paused track...');
          await this.resumeCurrentSource();
          this.updatePlayPauseButton(true);
        } else {
          // Start playing from current track index (fresh playback)
          console.log(`Starting track ${this.currentTrackIndex + 1} of ${this.playlist.length}...`);
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
    this.renderPlaylist();
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

  nextTrack(shouldPlay = true) {
    if (!this.playlist || this.playlist.length === 0) {
      return;
    }
    const newIndex = this.currentTrackIndex + 1;
    if (newIndex < this.playlist.length) {
      if (shouldPlay) {
        this.playTrack(newIndex);
      } else {
        // Just update the index and UI, don't play
        this.currentTrackIndex = newIndex;
        this.renderPlaylist();
      }
    }
  }

  previousTrack(shouldPlay = true) {
    if (!this.playlist || this.playlist.length === 0) {
      return;
    }
    const newIndex = this.currentTrackIndex - 1;
    if (newIndex >= 0) {
      if (shouldPlay) {
        this.playTrack(newIndex);
      } else {
        // Just update the index and UI, don't play
        this.currentTrackIndex = newIndex;
        this.renderPlaylist();
      }
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
      
      if (mapping && mapping.tracks && mapping.tracks.length > 0) {
        await this.loadPlaylistForChapter(chapterIndex, mapping.tracks);
        // Force UI update
        this.renderPlaylist();
        this.showToast('✓ Music tracks reloaded!', 'success');
      } else {
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
   * Reanalyze music with new settings (songs per chapter, min songs per pages)
   * This clears the analysis cache and re-fetches music with the new constraints
   */
  async reanalyzeWithNewSettings() {
    try {
      if (!this.musicManager) {
        console.error('Music manager not available');
        return;
      }

      // Stop current playback
      this.audioPlayer.stop();
      
      // Clear both music and analysis caches to force complete reanalysis
      // This ensures book vibe keywords trigger new API queries
      localStorage.removeItem('music_tracks_cache');
      localStorage.removeItem('chapter_music_mappings');
      
      // Clear track cache in music manager to force re-fetch with book vibe keywords
      if (this.musicManager) {
        this.musicManager.availableTracks = [];
      }
      
      // Get reader reference
      const reader = window.app?.reader || this.reader;
      if (!reader || !reader.currentBook || !reader.chapters) {
        console.error('Reader not available for reanalysis');
        this.showToast('Unable to reanalyze - reader not found', 'error');
        return;
      }

      // Get current settings (including book vibe keywords)
      const settings = JSON.parse(localStorage.getItem('booksWithMusic-settings') || '{}');
      const songsPerChapter = settings.songsPerChapter || 5;
      const minSongsPerPages = settings.minSongsPerPages || 1;
      const bookVibeKeywords = settings.bookVibeKeywords || '';
      
      console.log(`Reanalyzing with settings: ${songsPerChapter} songs/chapter, 1 song per ${minSongsPerPages} pages`);
      if (bookVibeKeywords) {

      }

      // Reinitialize music manager with new settings
      // The music manager will:
      // 1. Analyze book to get vibe keywords
      // 2. Fetch tracks from API using those keywords
      // 3. Score tracks with vibe keywords getting highest priority
      await this.musicManager.initialize(reader.currentBook.id, reader.chapters);
      
      // Reload playlist for current chapter with new song count
      const chapterIndex = reader.currentChapterIndex || 0;
      const chapterKey = reader.chapters[chapterIndex]?.id || reader.chapters[chapterIndex]?.title;
      const mapping = this.musicManager.chapterMappings[chapterKey];
      
      if (mapping && mapping.tracks && mapping.tracks.length > 0) {
        await this.loadPlaylistForChapter(chapterIndex, mapping.tracks);
        this.renderPlaylist();
        this.showToast(`✓ Reanalyzed! ${this.playlist.length} songs loaded`, 'success');
      } else {
        this.playlist = [];
        this.renderPlaylist();
        this.showToast('⚠️ No tracks found for this chapter', 'warning');
      }
    } catch (error) {
      console.error('Error reanalyzing music:', error);
      this.showToast('❌ Failed to reanalyze', 'error');
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

  /**
   * Update the auto-detected keywords display in the music settings panel
   */
  updateAutoDetectedKeywordsDisplay() {
    const autoDetectedKeywordsDiv = document.getElementById('auto-detected-keywords');
    const autoDetectedKeywordsList = document.getElementById('auto-detected-keywords-list');
    const bookVibeKeywordsInput = document.getElementById('book-vibe-keywords');
    
    if (!autoDetectedKeywordsList || !autoDetectedKeywordsDiv) {

      return;
    }
    
    const autoKeywords = this.musicManager?.bookAnalysis?.bookProfile?.autoDetectedKeywords;

    
    if (autoKeywords) {
      
      if (autoKeywords.length > 0) {
        // Show auto-detected keywords as tags
        autoDetectedKeywordsList.innerHTML = autoKeywords
          .map(kw => `<span class="keyword-tag">${this.escapeHtml(kw)}</span>`)
          .join('');
        autoDetectedKeywordsDiv.classList.remove('hidden');
        
        // Update placeholder if input is empty
        if (bookVibeKeywordsInput && !bookVibeKeywordsInput.value.trim()) {
          bookVibeKeywordsInput.placeholder = `Using: ${autoKeywords.join(', ')}`;
        }
      } else {

        autoDetectedKeywordsDiv.classList.add('hidden');
      }
    } else {

      autoDetectedKeywordsDiv.classList.add('hidden');
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // === Spotify Integration Methods ===
  // These methods handle dual-source music playback (Freesound or Spotify)
  
  /**
   * Lazy-initialize the Spotify player
   * Uses Web Playback SDK for embedded streaming (music plays in browser)
   * Only loads SpotifySDKPlayer module when needed to reduce initial bundle size
   * Returns cached instance if already initialized
   * @returns {Promise<SpotifySDKPlayer>} The initialized Spotify SDK player instance
   */
  async initializeSpotifyPlayer() {
    if (this.spotifyPlayer) {
      return this.spotifyPlayer; // Return cached instance
    }

    try {
      // Dynamically import SpotifySDKPlayer module (embedded playback)
      const { SpotifySDKPlayer } = await import('../core/spotify-sdk-player.js');
      this.spotifyPlayer = new SpotifySDKPlayer();
      await this.spotifyPlayer.initialize();
      console.log('✅ Spotify Web Playback SDK initialized - music will stream in browser');
      return this.spotifyPlayer;
    } catch (error) {
      console.error('❌ Failed to initialize Spotify SDK player:', error);
      throw error;
    }
  }

  /**
   * Switch between Freesound and Spotify music sources
   * Stops any currently playing track before switching
   * @param {string} source - 'freesound' or 'spotify'
   */
  async switchMusicSource(source) {
    this.currentMusicSource = source;
    localStorage.setItem('music_source', source);

    // Stop any currently playing music before switching sources
    if (this.audioPlayer.isPlaying()) {
      this.audioPlayer.pause();
    }
    // If switching away from Spotify, stop Spotify playback
    if (this.spotifyPlayer && source === 'freesound') {
      await this.spotifyPlayer.pause();
    }

    // Update UI to show paused state
    this.updatePlayPauseButton(false);
    console.log(`🔄 Switched music source to: ${source}`);
  }

  /**
   * Route track playback to the appropriate music source (Freesound or Spotify)
   * @param {Object} track - Track object with metadata and URL/URI
   * @returns {Promise<void>}
   */
  async playTrackWithCurrentSource(track) {
    if (this.currentMusicSource === 'spotify') {
      return await this.playSpotifyTrack(track);
    } else {
      return await this.playFreesoundTrack(track);
    }
  }

  /**
   * Play a track using Freesound (embedded audio player)
   * Logs track usage to Firebase for CC0 license compliance
   * @param {Object} track - Freesound track with URL, title, freesoundId, license
   */
  async playFreesoundTrack(track) {
    try {
      await this.audioPlayer.playTrack(track);
      console.log('🎵 Now playing (Freesound):', track.title);

      // Log track usage to Firebase for CC0 compliance documentation
      if (auth.currentUser && track.freesoundId && track.license) {
        await logTrackUsage(auth.currentUser.uid, track);
      }
    } catch (error) {
      console.error('❌ Error playing Freesound track:', error);
      throw error;
    }
  }

  /**
   * Play a track using Spotify (external Spotify app via Spotify Connect API)
   * Requires Spotify Premium and an active device (desktop/mobile/web player)
   * @param {Object} track - Spotify track with spotifyUri or uri, title
   */
  async playSpotifyTrack(track) {
    try {
      // Ensure Spotify player is initialized (lazy-load if needed)
      if (!this.spotifyPlayer) {
        await this.initializeSpotifyPlayer();
      }

      // Play the track using Spotify Connect API
      const trackUri = track.spotifyUri || track.uri;
      await this.spotifyPlayer.play(trackUri);
      console.log('🎵 Now playing (Spotify):', track.title);

      // Spotify tracks don't need Firestore logging (commercial service, no license requirements)
      // Optional: Log for analytics only if user wants
      // Note: Skipping logging to avoid Firestore permission errors
    } catch (error) {
      console.error('❌ Error playing Spotify track:', error);
      throw error;
    }
  }

  /**
   * Check if music is currently playing from any source
   * @returns {boolean} True if playing from either Freesound or Spotify
   */
  isCurrentlyPlaying() {
    if (this.currentMusicSource === 'spotify') {
      return this.spotifyPlayer?.isPlaying() || false;
    } else {
      return this.audioPlayer?.isPlaying() || false;
    }
  }

  /**
   * Pause playback from the current source
   * @returns {Promise<void>}
   */
  async pauseCurrentSource() {
    if (this.currentMusicSource === 'spotify' && this.spotifyPlayer) {
      await this.spotifyPlayer.pause();
    } else {
      this.audioPlayer.pause();
    }
  }

  /**
   * Resume playback from the current source
   * @returns {Promise<void>}
   */
  async resumeCurrentSource() {
    if (this.currentMusicSource === 'spotify' && this.spotifyPlayer) {
      await this.spotifyPlayer.resume();
    } else {
      await this.audioPlayer.resume();
    }
  }
}
