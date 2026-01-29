import { auth } from '../config/firebase-config.js';
import { saveUserSettings } from '../storage/firestore-storage.js';

export class SettingsUI {
  constructor() {
    this.STORAGE_KEY = 'booksWithMusic-settings'; // Consistent key with music panel
    
    // Default to sepia theme with cream pages for a warm reading experience
    this.settings = {
      theme: 'sepia',
      fontSize: 18,
      lineHeight: 1.6,
      fontFamily: 'serif',
      textAlign: 'left',
      pageWidth: 650,
      pageDensity: 5000, // Characters per page
      brightness: 100,
      pageColor: 'cream',
      pageWarmth: 10,
      showBookPageCount: false,  // Disabled by default
      showBookProgress: false,   // Disabled by default
      showChapterPageCount: true,
      showChapterCount: true,
      musicEnabled: true,
      autoPlay: false,
      crossfadeDuration: 3,
      pageBasedMusicSwitch: true,  // Intelligent content-based music switching
      instrumentalOnly: true,  // Filter to background/instrumental/ambient music only
      maxEnergyLevel: 3  // Default to moderate energy level (3 out of 5)
    };

    this._layoutChangeTimer = null;
    this._saveDebounceTimer = null;
  }

  initialize() {
    this.loadSettings();
    this.setupEventListeners();
    this.applySettings();
    this.syncUIWithSettings(); // Sync UI elements with loaded settings
    this.showIOSTipIfNeeded(); // Show iOS fullscreen tip on iOS devices
  }

  showIOSTipIfNeeded() {
    // Check if iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    if (isIOS) {
      const iosTip = document.getElementById('ios-fullscreen-tip');
      if (iosTip) {
        iosTip.style.display = 'block';
      }
    }
  }

  setupEventListeners() {
    // Toggle settings panel
    document.getElementById('settings-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const panel = document.getElementById('settings-panel');
      if (panel?.classList.contains('show')) {
        this.hideSettings();
      } else {
        this.showSettings();
      }
    });

    // Click outside to close settings panel
    document.addEventListener('click', (e) => {
      const panel = document.getElementById('settings-panel');
      const settingsBtn = document.getElementById('settings-btn');
      
      if (panel && panel.classList.contains('show')) {
        // Check if click is outside the panel and not on the settings button
        if (!panel.contains(e.target) && !settingsBtn?.contains(e.target)) {
          this.hideSettings();
        }
      }
    });

    // Theme selection
    document.getElementById('theme-select')?.addEventListener('change', (e) => {
      this.settings.theme = e.target.value;
      this.applyTheme();
      this.saveSettings();
    });

    // Font size
    const fontSizeInput = document.getElementById('font-size');
    const fontSizeValue = document.getElementById('font-size-value');
    fontSizeInput?.addEventListener('input', (e) => {
      this.settings.fontSize = parseInt(e.target.value);
      if (fontSizeValue) {
        fontSizeValue.textContent = `${this.settings.fontSize}px`;
      }
      this.applyFontSize();
      this.saveSettings();
    });

    // Line height
    const lineHeightInput = document.getElementById('line-height');
    const lineHeightValue = document.getElementById('line-height-value');
    lineHeightInput?.addEventListener('input', (e) => {
      this.settings.lineHeight = parseFloat(e.target.value);
      if (lineHeightValue) {
        lineHeightValue.textContent = this.settings.lineHeight.toFixed(1);
      }
      this.applyLineHeight();
      this.saveSettings();
      this._emitLayoutChanged('lineHeight');
    });

    // Font family
    document.getElementById('font-family')?.addEventListener('change', (e) => {
      this.settings.fontFamily = e.target.value;
      this.applyFontFamily();
      this.saveSettings();
      this._emitLayoutChanged('fontFamily');
    });

    // Text alignment
    document.getElementById('text-align')?.addEventListener('change', (e) => {
      this.settings.textAlign = e.target.value;
      this.applyTextAlign();
      this.saveSettings();
      this._emitLayoutChanged('textAlign');
    });

    // Page width
    const pageWidthInput = document.getElementById('page-width');
    const pageWidthValue = document.getElementById('page-width-value');
    pageWidthInput?.addEventListener('input', (e) => {
      this.settings.pageWidth = parseInt(e.target.value);
      if (pageWidthValue) {
        pageWidthValue.textContent = `${this.settings.pageWidth}px`;
      }
      this.applyPageWidth();
      this.saveSettings();
      this._emitLayoutChanged('pageWidth');
    });

    // Page density (characters per page)
    const pageDensityInput = document.getElementById('page-density');
    const pageDensityValue = document.getElementById('page-density-value');
    pageDensityInput?.addEventListener('input', (e) => {
      this.settings.pageDensity = parseInt(e.target.value);
      if (pageDensityValue) {
        pageDensityValue.textContent = `${this.settings.pageDensity} chars`;
      }
      this.applyPageDensity();
      this.saveSettings();
      this._emitLayoutChanged('pageDensity');
    });

    // Auto-calibrate page density button
    document.getElementById('calibrate-pages')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.calibratePageDensity();
    });

    // Brightness
    const brightnessInput = document.getElementById('brightness');
    const brightnessValue = document.getElementById('brightness-value');
    brightnessInput?.addEventListener('input', (e) => {
      this.settings.brightness = parseInt(e.target.value);
      if (brightnessValue) {
        brightnessValue.textContent = `${this.settings.brightness}%`;
      }
      this.applyBrightness();
      this.saveSettings();
    });

    // Page color
    document.getElementById('page-color')?.addEventListener('change', (e) => {
      this.settings.pageColor = e.target.value;
      this.applyPageColor();
      this.saveSettings();
    });

    // Page warmth
    const pageWarmthInput = document.getElementById('page-warmth');
    const pageWarmthValue = document.getElementById('page-warmth-value');
    pageWarmthInput?.addEventListener('input', (e) => {
      this.settings.pageWarmth = parseInt(e.target.value);
      if (pageWarmthValue) {
        pageWarmthValue.textContent = `${this.settings.pageWarmth}%`;
      }
      this.applyPageWarmth();
      this.saveSettings();
    });

    const updatePageIndicator = () => {
      window.dispatchEvent(new CustomEvent('settings:pageIndicatorChanged'));
    };

    // Book-level page count and progress percentage features are now ENABLED
    document.getElementById('show-book-page-count')?.addEventListener('change', (e) => {
      this.settings.showBookPageCount = e.target.checked;
      this.saveSettings();
      updatePageIndicator();
    });

    document.getElementById('show-book-progress')?.addEventListener('change', (e) => {
      this.settings.showBookProgress = e.target.checked;
      this.saveSettings();
      updatePageIndicator();
    });

    document.getElementById('show-chapter-page-count')?.addEventListener('change', (e) => {
      this.settings.showChapterPageCount = e.target.checked;
      this.saveSettings();
      updatePageIndicator();
    });

    document.getElementById('show-chapter-count')?.addEventListener('change', (e) => {
      this.settings.showChapterCount = e.target.checked;
      this.saveSettings();
      updatePageIndicator();
    });

    // Crossfade duration
    const crossfadeInput = document.getElementById('crossfade-duration');
    const crossfadeValue = document.getElementById('crossfade-value');
    crossfadeInput?.addEventListener('input', (e) => {
      this.settings.crossfadeDuration = parseInt(e.target.value);
      if (crossfadeValue) {
        crossfadeValue.textContent = `${this.settings.crossfadeDuration}s`;
      }
      this.saveSettings();
    });

    // Music enabled
    document.getElementById('music-enabled')?.addEventListener('change', (e) => {
      this.settings.musicEnabled = e.target.checked;
      this.saveSettings();
    });

    // Note: Auto-play is handled by music-panel.js (uses auto-play-panel checkbox)

    // Freesound API key
    const freesoundKeyInput = document.getElementById('freesound-key');
    const saveFreesoundBtn = document.getElementById('save-freesound-key');
    
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
        this.showToast('Freesound API key saved! Reload to fetch music.', 'success');
      } else {
        this.showToast('Please enter a valid API key', 'error');
      }
    });

    // === Spotify Integration Event Listeners ===
    // Handle music source selection and Spotify authentication
    
    // Music source selection: Switch between Freesound and Spotify
    const musicSourceSelect = document.getElementById('music-source-select');
    musicSourceSelect?.addEventListener('change', async (e) => {
      const selectedSource = e.target.value; // 'freesound' or 'spotify'
      await this.handleMusicSourceChange(selectedSource);
    });

    // Spotify Connect: Initiate OAuth 2.0 authorization flow
    const spotifyConnectBtn = document.getElementById('spotify-connect-btn');
    spotifyConnectBtn?.addEventListener('click', async (e) => {
      e.preventDefault();
      await this.handleSpotifyConnect();
    });

    // Spotify Disconnect: Clear tokens and switch back to Freesound
    const spotifyDisconnectBtn = document.getElementById('spotify-disconnect-btn');
    spotifyDisconnectBtn?.addEventListener('click', async (e) => {
      e.preventDefault();
      await this.handleSpotifyDisconnect();
    });

    // Initialize Spotify UI state on page load (show correct buttons based on auth status)
    this.updateSpotifyAuthUI();
  }

  showSettings() {
    const panel = document.getElementById('settings-panel');
    if (panel) {
      document.getElementById('music-panel')?.classList.remove('show');
      document.getElementById('music-settings-panel')?.classList.remove('show');
      panel.classList.add('show');
    }
  }

  hideSettings() {
    const panel = document.getElementById('settings-panel');
    if (panel) {
      panel.classList.remove('show');
    }
  }

  loadSettings() {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved) {
      const savedSettings = JSON.parse(saved);
      // Merge saved settings with current defaults (in case new settings were added)
      this.settings = { ...this.settings, ...savedSettings };
    }
    if (
      this.settings.showBookPageNumbers === false &&
      this.settings.showBookPageCount === undefined &&
      this.settings.showChapterPageCount === undefined
    ) {
      this.settings.showBookPageCount = false;
      this.settings.showChapterPageCount = true;
    }
  }

  async syncToFirestore() {
    if (auth.currentUser) {
      try {
        const settingsPayload = {
          ...this.settings,
          userEmail: auth.currentUser.email || null
        };
        await saveUserSettings(auth.currentUser.uid, settingsPayload);
      } catch (error) {
        console.error('Failed to sync settings to Firestore:', error);
      }
    }
  }

  saveSettings() {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.settings));
    // Sync to Firestore if user is signed in
    this.syncToFirestore();
  }
    
  applySettings() {
    this.applyTheme();
    this.applyFontSize();
    this.applyLineHeight();
    this.applyFontFamily();
    this.applyTextAlign();
    this.applyPageWidth();
    this.applyPageDensity();
    this.applyBrightness();
    this.applyPageColor();
    this.applyPageWarmth();
    this.syncPageIndicatorSettings();
    window.dispatchEvent(new CustomEvent('settings:pageIndicatorChanged'));

    // Ensure pagination updates after initial settings apply
    this._emitLayoutChanged('init');
  }

  syncPageIndicatorSettings() {
    // Book-level page count and progress are now ENABLED features
    const showBookPageCount = document.getElementById('show-book-page-count');
    if (showBookPageCount) {
      showBookPageCount.checked = this.settings.showBookPageCount !== false;
    }

    const showBookProgress = document.getElementById('show-book-progress');
    if (showBookProgress) {
      showBookProgress.checked = this.settings.showBookProgress !== false;
    }

    const showChapterPageCount = document.getElementById('show-chapter-page-count');
    if (showChapterPageCount) {
      showChapterPageCount.checked = this.settings.showChapterPageCount !== false;
    }

    const showChapterCount = document.getElementById('show-chapter-count');
    if (showChapterCount) {
      showChapterCount.checked = this.settings.showChapterCount !== false;
    }
  }

  applyTheme() {
    document.body.setAttribute('data-theme', this.settings.theme);
  }

  applyFontSize() {
    const fontSizePx = `${this.settings.fontSize}px`;
    document.documentElement.style.setProperty('--reader-font-size', fontSizePx);
    document.querySelectorAll('.chapter-text').forEach((el) => (el.style.fontSize = fontSizePx));
  }

  applyLineHeight() {
    const lh = String(this.settings.lineHeight);
    document.documentElement.style.setProperty('--reader-line-height', lh);
    document.querySelectorAll('.chapter-text').forEach((el) => (el.style.lineHeight = lh));
  }

  applyFontFamily() {
    const fontMap = {
      'serif': 'Georgia, "Times New Roman", serif',
      'sans-serif': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      'monospace': '"Courier New", Courier, monospace',
      'open-dyslexic': 'OpenDyslexic, sans-serif'
    };
    const font = fontMap[this.settings.fontFamily] || fontMap['serif'];
    document.documentElement.style.setProperty('--reader-font-family', font);
    document.querySelectorAll('.chapter-text').forEach((el) => (el.style.fontFamily = font));
  }

  applyTextAlign() {
    const align = this.settings.textAlign || 'justify';
    document.documentElement.style.setProperty('--reader-text-align', align);
    document.querySelectorAll('.chapter-text').forEach((el) => el.style.setProperty('--reader-text-align', align));
  }

  applyPageWidth() {
    document.documentElement.style.setProperty('--page-width', `${this.settings.pageWidth}px`);
    document.querySelectorAll('.page-viewport').forEach((el) => {
      el.style.setProperty('--page-width', `${this.settings.pageWidth}px`);
    });
  }

  applyPageDensity() {
    // Notify reader to update page density (chars per page)
    window.dispatchEvent(new CustomEvent('pageDensityChanged', { 
      detail: { charsPerPage: this.settings.pageDensity } 
    }));
  }

  /**
   * Auto-calibrate page density based on current viewport and font settings
   * Calculates how many characters fit comfortably on one page
   * Also calibrates optimal page width based on viewport
   */
  calibratePageDensity() {
    console.log('=== CALIBRATION START ===');
    
    // Check if in fullscreen and ensure page indicator stays hidden
    const isFullscreen = document.fullscreenElement || 
                        document.webkitFullscreenElement || 
                        document.mozFullScreenElement || 
                        document.msFullscreenElement;
    
    const pageIndicator = document.querySelector('.page-indicator');
    
    if (isFullscreen && pageIndicator) {
      console.log('📍 In fullscreen - ensuring page indicator remains hidden during calibration');
      pageIndicator.style.display = 'none';
    }
    
    // Get the actual page container (where pages are rendered)
    const pageContainer = document.querySelector('.page-container');
    const chapterText = document.querySelector('.chapter-text');
    
    console.log('Elements found:', { 
      pageContainer: !!pageContainer, 
      chapterText: !!chapterText 
    });
    
    if (!pageContainer) {
      console.error('No page container found!');
      this.showToast('Please open a book first to calibrate page size.', 'error');
      return;
    }

    // Use current user settings for font size and line height
    const fontSize = this.settings.fontSize || 18;
    const lineHeightMultiplier = this.settings.lineHeight || 1.6;
    const lineHeight = fontSize * lineHeightMultiplier;
    
    console.log('Font settings:', { fontSize, lineHeightMultiplier, lineHeight });
    
    // Validate values
    if (isNaN(fontSize) || fontSize <= 0) {
      console.error('Invalid fontSize:', fontSize);
      this.showToast('Unable to calibrate - invalid font size', 'error');
      return;
    }
    if (isNaN(lineHeight) || lineHeight <= 0) {
      console.error('Invalid lineHeight:', lineHeight);
      this.showToast('Unable to calibrate - invalid line height', 'error');
      return;
    }
    
    // Get actual page container dimensions (this is the available area for text)
    const containerHeight = pageContainer.clientHeight;
    const containerWidth = pageContainer.clientWidth;
    
    console.log('Container dimensions:', { containerWidth, containerHeight });
    
    if (containerHeight <= 100) {
      console.error('Container too small:', containerHeight);
      this.showToast('Page container is too small to calibrate', 'error');
      return;
    }
    
    // Calculate available text height
    // The page-container is the viewport, chapter-text is where content actually renders
    let textHeight;
    if (chapterText) {
      // In fullscreen, calculate the maximum available height from viewport
      if (isFullscreen) {
        // Fullscreen: 100vh - viewport padding (20+20) - chapter-text padding (16+32) = 100vh - 88
        const viewportHeight = window.innerHeight;
        textHeight = viewportHeight - 88; // 88 = 20+20 (viewport) + 16+32 (chapter-text)
        console.log('Using fullscreen calculated height:', textHeight, 'from viewport:', viewportHeight);
      } else {
        // Normal mode: use actual client height
        textHeight = chapterText.clientHeight;
        console.log('Using chapterText.clientHeight:', textHeight);
      }
    } else {
      // Fallback: Use page-container with conservative padding estimate
      textHeight = containerHeight - 144;
      console.log('Using fallback textHeight:', textHeight);
    }
    
    const textWidth = containerWidth - 96; // 48px * 2 horizontal padding
    
    console.log('Text dimensions:', { textWidth, textHeight });
    
    // Validate dimensions
    if (textHeight <= 0 || textWidth <= 0) {
      console.error('Invalid text dimensions:', { textWidth, textHeight });
      this.showToast('Unable to calibrate - invalid text area dimensions', 'error');
      return;
    }
    
    // Calculate lines based on available container height, not current overflowing content
    const actualContentHeight = chapterText ? chapterText.scrollHeight : textHeight;
    const availableHeight = textHeight; // Use container height, not overflow
    
    // If content is overflowing, we need to calculate based on what SHOULD fit
    const isOverflowing = actualContentHeight > availableHeight;
    
    // Calculate raw lines that fit in the available space
    const rawLines = availableHeight / lineHeight;
    
    // Apply 10% safety margin for paragraph spacing
    const linesPerPage = Math.floor(rawLines * 0.9);
    
    console.log('Lines calculation:', { 
      actualContentHeight,
      availableHeight,
      isOverflowing,
      overflow: isOverflowing ? `${actualContentHeight - availableHeight}px` : 'none',
      lineHeight,
      rawLines: rawLines.toFixed(2),
      linesPerPage,
      note: isOverflowing ? 'Current page is overflowing - calculating based on available space' : 'Based on container height'
    });
    
    // Measure actual rendered content with text wrapping
    if (chapterText && chapterText.textContent.trim()) {
      // Get actual content from the page
      const actualContent = chapterText.textContent.trim();
      const hasContent = actualContent.length > 100;
      
      console.log('Content measurement:', {
        hasContent,
        contentLength: actualContent.length
      });
      
      if (!hasContent) {
        console.warn('⚠️ Insufficient content for calibration. Please open a book chapter first.');
        this.showToast('Please open a book chapter to calibrate page density', 'error');
        return;
      }
      
      // Get computed styles
      const computedStyle = window.getComputedStyle(chapterText);
      const computedFontSize = parseFloat(computedStyle.fontSize);
      const computedLineHeight = parseFloat(computedStyle.lineHeight);
      const computedPaddingTop = parseFloat(computedStyle.paddingTop);
      const computedPaddingBottom = parseFloat(computedStyle.paddingBottom);
      
      // Save original content
      const originalHTML = chapterText.innerHTML;
      const originalScrollHeight = chapterText.scrollHeight;
      const originalClientHeight = chapterText.clientHeight;
      
      console.log('📊 ORIGINAL PAGE STATE:', {
        scrollHeight: originalScrollHeight,
        clientHeight: originalClientHeight,
        isOverflowing: originalScrollHeight > originalClientHeight,
        contentLength: actualContent.length,
        computedFontSize,
        computedLineHeight,
        paddingTop: computedPaddingTop,
        paddingBottom: computedPaddingBottom
      });
      
      // The key insight: pagination uses CHARACTER COUNT, not line count!
      // We need to find out how many characters actually fit on one visible page
      
      // Count characters in the current (possibly truncated) content
      const originalTextContent = chapterText.textContent || '';
      const originalCharCount = originalTextContent.length;
      
      // Count paragraph breaks to detect sparse content
      const paragraphCount = (originalHTML.match(/<p>/g) || []).length;
      const avgCharsPerParagraph = paragraphCount > 0 ? originalCharCount / paragraphCount : originalCharCount;
      
      console.log('🔤 CHARACTER MEASUREMENT:', {
        originalCharCount,
        originalScrollHeight,
        originalClientHeight,
        charsPerPixel: (originalCharCount / originalScrollHeight).toFixed(2),
        paragraphCount,
        avgCharsPerParagraph: avgCharsPerParagraph.toFixed(0)
      });
      
      // Strategy: Always force overflow to get accurate measurement
      // This handles edge cases like sparse pages with many line breaks
      let charsPerVisiblePage;
      
      if (originalScrollHeight <= originalClientHeight * 1.1) {
        // Content barely fills the page - might be sparse (poetry, dialog, etc.)
        // Add more content to force overflow and measure accurately
        console.log('⚠️ SPARSE PAGE DETECTED - Adding content to measure overflow');
        
        // Duplicate content multiple times to ensure overflow
        chapterText.innerHTML = originalHTML + originalHTML + originalHTML;
        chapterText.offsetHeight; // Force reflow
        
        const tripleScrollHeight = chapterText.scrollHeight;
        const tripleCharCount = originalCharCount * 3;
        
        // Calculate ratio based on overflow
        const visibleRatio = originalClientHeight / tripleScrollHeight;
        charsPerVisiblePage = Math.floor(tripleCharCount * visibleRatio);
        
        // Restore original content
        chapterText.innerHTML = originalHTML;
        chapterText.offsetHeight;
        
        console.log('📏 OVERFLOW-BASED MEASUREMENT:', {
          tripleScrollHeight,
          tripleCharCount,
          visibleRatio: visibleRatio.toFixed(2),
          measuredChars: charsPerVisiblePage,
          note: 'Measured with forced overflow for accuracy'
        });
      } else {
        // Content already overflows - calculate what portion would fit
        const visibleRatio = originalClientHeight / originalScrollHeight;
        charsPerVisiblePage = Math.floor(originalCharCount * visibleRatio);
        
        console.log('✅ CONTENT OVERFLOWS - RATIO CALCULATION:', {
          visibleRatio: visibleRatio.toFixed(2),
          totalChars: originalCharCount,
          visibleChars: charsPerVisiblePage,
          calculation: `floor(${originalCharCount} × ${visibleRatio.toFixed(2)}) = ${charsPerVisiblePage}`
        });
      }
      
      // Apply 6% safety margin for paragraph breaks, spacing, and edge cases
      const calibratedChars = Math.floor(charsPerVisiblePage * 0.94);
      
      console.log('✅ FINAL CALIBRATION:', {
        measuredChars: charsPerVisiblePage,
        safetyMargin: '6%',
        calibratedChars,
        note: 'Character-based pagination with safety margin for line breaks'
      });
      
      var calibratedDensity = Math.max(1000, Math.min(10000, calibratedChars));
      
      // Store for later logging
      var wasOverflowing = originalScrollHeight > originalClientHeight * 1.1;
      var calibrationMethod = wasOverflowing ? 'direct-ratio' : 'overflow-forced';
    } else {
      // Fallback if no chapterText available
      var calibratedLines = linesPerPage;
      var maxLines = Math.floor(linesPerPage * 1.5);
      var clampedMax = Math.max(10, Math.min(100, maxLines));
      var calibratedDensity = Math.max(10, Math.min(clampedMax, calibratedLines));
      var calibrationMethod = 'fallback';
    }
    
    // Calculate average characters per line
    // Use a more conservative character width estimation
    const charWidthFactor = this.settings.fontFamily === 'monospace' ? 0.65 : 0.6;
    const avgCharsPerLine = Math.floor(textWidth / (fontSize * charWidthFactor));
    
    console.log('Chars per line calculation:', { 
      charWidthFactor, 
      avgCharsPerLine,
      fontFamily: this.settings.fontFamily
    });
    
    // Validate calculations
    if (isNaN(calibratedDensity) || calibratedDensity <= 0 || isNaN(avgCharsPerLine) || avgCharsPerLine <= 0) {
      console.error('Invalid calculations:', { calibratedDensity, avgCharsPerLine });
      this.showToast('Unable to calibrate - calculation error', 'error');
      return;
    }
    
    console.log('Final calibrated density:', calibratedDensity);
    
    console.log('📋 CALIBRATION SUMMARY:', {
      charsPerPage: calibratedDensity,
      viewport: `${containerWidth}×${containerHeight}px`,
      fontSize: fontSize,
      lineHeight: lineHeight.toFixed(2),
      method: calibrationMethod || 'unknown'
    });
    
    // Apply the calculated density (vertical text only - no page width changes)
    this.settings.pageDensity = calibratedDensity;
    
    // Update page density UI
    const pageDensityInput = document.getElementById('page-density');
    const pageDensityValue = document.getElementById('page-density-value');
    if (pageDensityInput) {
      pageDensityInput.value = calibratedDensity;
    }
    if (pageDensityValue) {
      pageDensityValue.textContent = `${calibratedDensity} chars`;
    }
    
    // Save final settings
    this.saveSettings();
    this.applyPageDensity();
    
    this._emitLayoutChanged('calibration');
    
    // VERIFICATION: After applying and re-pagination, check results
    setTimeout(() => {
      const verifyChapterText = document.querySelector('.chapter-text');
      if (!verifyChapterText) {
        console.log('🔍 POST-CALIBRATION: Page reloaded, verification skipped');
        return;
      }
      
      const verifyScrollHeight = verifyChapterText.scrollHeight;
      const verifyClientHeight = verifyChapterText.clientHeight;
      const verifyCharCount = (verifyChapterText.textContent || '').length;
      const stillOverflowing = verifyScrollHeight > verifyClientHeight;
      
      console.log('🔍 POST-CALIBRATION VERIFICATION:', {
        scrollHeight: verifyScrollHeight,
        clientHeight: verifyClientHeight,
        charCount: verifyCharCount,
        isOverflowing: stillOverflowing,
        overflowAmount: stillOverflowing ? verifyScrollHeight - verifyClientHeight : 0,
        status: stillOverflowing ? '⚠️ Still overflowing (will be paginated)' : '✅ Fits perfectly',
        expectedCharsPerPage: calibratedDensity,
        actualVsExpected: verifyCharCount <= calibratedDensity ? '✅ Within limit' : '⚠️ Over limit',
        note: 'Shows current page after re-pagination with new density'
      });
    }, 500);
  }

  async checkAndAdjustForOverflow() {
    // Prevent recursive calls
    if (this._isCheckingOverflow) {
      console.log('🔍 OVERFLOW CHECK: Already in progress, skipping');
      return;
    }
    
    // Simple check: don't run if we just adjusted in the last 2 seconds
    const now = Date.now();
    if (this._lastOverflowAdjustment && (now - this._lastOverflowAdjustment) < 2000) {
      console.log('🔍 OVERFLOW CHECK: Skipping - just adjusted within last 2 seconds');
      return;
    }
    
    this._isCheckingOverflow = true;
    
    try {
      const chapterText = document.querySelector('.chapter-text');
      const pageContainer = document.querySelector('.page-container');
      
      console.log('🔍 OVERFLOW CHECK: Starting...', { 
        hasChapterText: !!chapterText, 
        hasPageContainer: !!pageContainer 
      });
      
      if (!chapterText || !pageContainer) {
        console.log('⚠️ OVERFLOW CHECK: Missing elements, skipping');
        return;
      }

      // Get the bounding rectangles
      const containerRect = chapterText.getBoundingClientRect();
      const containerBottom = containerRect.bottom;
      const containerTop = containerRect.top;
      
      console.log('📦 Container bounds:', {
        top: Math.round(containerTop),
        bottom: Math.round(containerBottom),
        height: Math.round(containerRect.height)
      });
      
      // Get all text content elements (paragraphs, divs, etc.)
      const contentElements = chapterText.querySelectorAll('p, div:not(.chapter-text), h1, h2, h3, h4, h5, h6, span, li');
      
      if (contentElements.length === 0) {
        console.log('⚠️ OVERFLOW CHECK: No content elements found');
        return;
      }
      
      console.log(`📄 Found ${contentElements.length} content elements`);
      
      // Check the last few elements to see if they're cut off
      const lastElements = Array.from(contentElements).slice(-5); // Check last 5 elements
      let isOverflowing = false;
      let overflowAmount = 0;
      
      console.log('🔍 Checking last elements:');
      lastElements.forEach((element, index) => {
        const elementRect = element.getBoundingClientRect();
        const overflow = elementRect.bottom - containerBottom;
        const isVisible = elementRect.bottom <= containerBottom + 5; // 5px tolerance
        
        console.log(`  Element ${index + 1}/${lastElements.length}:`, {
          tagName: element.tagName,
          text: element.textContent.substring(0, 50) + '...',
          bottom: Math.round(elementRect.bottom),
          containerBottom: Math.round(containerBottom),
          overflow: Math.round(overflow),
          isVisible
        });
        
        if (elementRect.bottom > containerBottom + 5) { // 5px tolerance
          isOverflowing = true;
          overflowAmount = Math.max(overflowAmount, overflow);
        }
      });
      
      console.log('🔍 OVERFLOW CHECK: Final result', {
        isOverflowing,
        overflowAmount: Math.round(overflowAmount) + 'px',
        containerHeight: Math.round(containerRect.height) + 'px'
      });
      
      if (!isOverflowing) {
        console.log('✅ OVERFLOW CHECK: No overflow detected, all content visible');
        return;
      }
      
      console.log(`⚠️ OVERFLOW DETECTED: Content extends ${Math.round(overflowAmount)}px beyond container`);
      
      // Calculate reduction based on visible vs total height
      const visibleRatio = (containerRect.height - overflowAmount) / containerRect.height;
      const currentDensity = this.settings.pageDensity;
      const safetyMargin = 0.88; // 12% margin
      const adjustedDensity = Math.floor(currentDensity * visibleRatio * safetyMargin);
      const newDensity = Math.max(100, adjustedDensity);
      
      if (newDensity >= currentDensity) {
        console.log('⚠️ Cannot reduce density further');
        return;
      }
      
      console.log(`📉 Auto-adjusting density: ${currentDensity} → ${newDensity} chars/page (reduction: ${Math.round((1 - newDensity/currentDensity) * 100)}%)`);
      
      this.settings.pageDensity = newDensity;
      
      // Update UI
      const pageDensityInput = document.getElementById('page-density');
      const pageDensityValue = document.getElementById('page-density-value');
      if (pageDensityInput) pageDensityInput.value = newDensity;
      if (pageDensityValue) pageDensityValue.textContent = `${newDensity} chars`;
      
      this.saveSettings();
      
      console.log(`✅ OVERFLOW CHECK: Triggering re-pagination with new density`);
      this.showToast(`Auto-adjusting page density to ${newDensity} chars`, 'info');
      
      // Mark that we just did an adjustment
      this._lastOverflowAdjustment = Date.now();
      
      // Trigger re-pagination by emitting layout change event with 'pageDensity' reason
      // This ensures the reader's layout change listener will reload the chapter
      setTimeout(() => {
        this._emitLayoutChanged('pageDensity');
      }, 100);
      
    } finally {
      this._isCheckingOverflow = false;
    }
  }

  applyBrightness() {
    const readerView = document.getElementById('reader-view');
    if (readerView) {
      readerView.style.filter = `brightness(${this.settings.brightness}%)`;
    }
  }

  applyPageColor() {
    const readerView = document.getElementById('reader-view');
    const readerContent = document.getElementById('reader-content');
    
    const colorMap = {
      'white': { bg: '#ffffff', text: '#1c1e21' },
      'cream': { bg: '#f9f6ed', text: '#3c3022' },
      'gray': { bg: '#e8e8e8', text: '#1c1e21' },
      'black': { bg: '#1a1a1a', text: '#e4e6eb' }
    };

    const base = colorMap[this.settings.pageColor] || colorMap['white'];
    document.documentElement.style.setProperty('--page-paper-base-bg', base.bg);
    document.documentElement.style.setProperty('--page-paper-text', base.text);

    // Always rely on CSS variables for page paper so warmth tint can layer correctly.
    if (readerView) readerView.style.backgroundColor = '';
    if (readerContent) {
      readerContent.style.backgroundColor = '';
      readerContent.style.color = '';
    }

    // Update library view if it exists (on home page)
    this.updateLibraryPageColor(base);

    // Re-apply warmth on top of any page color changes
    this.applyPageWarmth();
  }

  updateLibraryPageColor(colors) {
    // Apply to body and library view
    const libraryView = document.getElementById('library-view');
    if (libraryView && libraryView.classList.contains('active')) {
      document.body.style.backgroundColor = colors.bg;
      document.body.style.color = colors.text;
      
      libraryView.style.backgroundColor = colors.bg;
      libraryView.style.color = colors.text;
      
      // Apply to library container (center section)
      const libraryContainer = document.querySelector('.library-container');
      if (libraryContainer) {
        libraryContainer.style.backgroundColor = colors.bg;
        libraryContainer.style.color = colors.text;
      }
      
      // Apply to book cards
      document.querySelectorAll('.book-card').forEach(card => {
        card.style.backgroundColor = colors.bg;
        card.style.color = colors.text;
      });
      
      // Update CSS variables for consistency
      document.documentElement.style.setProperty('--reader-bg', colors.bg);
      document.documentElement.style.setProperty('--reader-text', colors.text);
      document.documentElement.style.setProperty('--bg-secondary', colors.bg);
      document.documentElement.style.setProperty('--text-primary', colors.text);
    }
  }

  applyPageWarmth() {
    const warmth = Math.max(0, Math.min(100, this.settings.pageWarmth ?? 0)) / 100;
    const baseBg = getComputedStyle(document.documentElement).getPropertyValue('--page-paper-base-bg').trim() || '#ffffff';
    const warmTint = '#f2e3b2';
    const blended = this._blendColors(baseBg, warmTint, warmth);
    document.documentElement.style.setProperty('--page-paper-bg', blended);
  }

  _blendColors(baseColor, tintColor, ratio) {
    const base = this._colorToRgb(baseColor);
    const tint = this._colorToRgb(tintColor);
    if (!base || !tint) return baseColor;
    const mix = (a, b) => Math.round(a + (b - a) * ratio);
    const r = mix(base.r, tint.r);
    const g = mix(base.g, tint.g);
    const b = mix(base.b, tint.b);
    return `rgb(${r}, ${g}, ${b})`;
  }

  _colorToRgb(color) {
    const c = (color || '').trim();
    // #RRGGBB (# is optional)
    const hex = c.match(/^#?([0-9a-f]{6})$/i);
    if (hex) {
      const n = parseInt(hex[1], 16);
      return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }
    // rgb(...) or rgba(...)
    const rgb = c.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(\d*(?:\.\d+)?)\s*)?\)$/i);
    if (rgb) {
      return { r: Math.min(255, parseInt(rgb[1], 10)), g: Math.min(255, parseInt(rgb[2], 10)), b: Math.min(255, parseInt(rgb[3], 10)) };
    }
    return null;
  }

  _emitLayoutChanged(reason) {
    // Debounce to avoid reflow storms while dragging sliders.
    window.clearTimeout(this._layoutChangeTimer);
    this._layoutChangeTimer = window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('reader:layoutChanged', { detail: { reason, settings: this.settings } }));
    }, 50);
  }

  getSettings() {
    return { ...this.settings };
  }

  showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  syncUIWithSettings() {
    // Sync all UI inputs with current settings values
    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) themeSelect.value = this.settings.theme;

    const fontSizeInput = document.getElementById('font-size');
    const fontSizeValue = document.getElementById('font-size-value');
    if (fontSizeInput) fontSizeInput.value = this.settings.fontSize;
    if (fontSizeValue) fontSizeValue.textContent = `${this.settings.fontSize}px`;

    const lineHeightInput = document.getElementById('line-height');
    const lineHeightValue = document.getElementById('line-height-value');
    if (lineHeightInput) lineHeightInput.value = this.settings.lineHeight;
    if (lineHeightValue) lineHeightValue.textContent = this.settings.lineHeight.toFixed(1);

    const fontFamilySelect = document.getElementById('font-family');
    if (fontFamilySelect) fontFamilySelect.value = this.settings.fontFamily;

    const textAlignSelect = document.getElementById('text-align');
    if (textAlignSelect) textAlignSelect.value = this.settings.textAlign;

    const pageWidthInput = document.getElementById('page-width');
    const pageWidthValue = document.getElementById('page-width-value');
    if (pageWidthInput) pageWidthInput.value = this.settings.pageWidth;
    if (pageWidthValue) pageWidthValue.textContent = `${this.settings.pageWidth}px`;

    const pageDensityInput = document.getElementById('page-density');
    const pageDensityValue = document.getElementById('page-density-value');
    if (pageDensityInput) pageDensityInput.value = this.settings.pageDensity;
    if (pageDensityValue) pageDensityValue.textContent = `${this.settings.pageDensity} chars`;

    const brightnessInput = document.getElementById('brightness');
    const brightnessValue = document.getElementById('brightness-value');
    if (brightnessInput) brightnessInput.value = this.settings.brightness;
    if (brightnessValue) brightnessValue.textContent = `${this.settings.brightness}%`;

    const pageColorSelect = document.getElementById('page-color');
    if (pageColorSelect) pageColorSelect.value = this.settings.pageColor;

    const pageWarmthInput = document.getElementById('page-warmth');
    const pageWarmthValue = document.getElementById('page-warmth-value');
    if (pageWarmthInput) pageWarmthInput.value = this.settings.pageWarmth;
    if (pageWarmthValue) pageWarmthValue.textContent = `${this.settings.pageWarmth}%`;

    const crossfadeInput = document.getElementById('crossfade-duration');
    const crossfadeValue = document.getElementById('crossfade-value');
    if (crossfadeInput) crossfadeInput.value = this.settings.crossfadeDuration;
    if (crossfadeValue) crossfadeValue.textContent = `${this.settings.crossfadeDuration}s`;

    const musicEnabledCheckbox = document.getElementById('music-enabled');
    if (musicEnabledCheckbox) musicEnabledCheckbox.checked = this.settings.musicEnabled;

    const autoPlayCheckbox = document.getElementById('auto-play-panel');
    if (autoPlayCheckbox) autoPlayCheckbox.checked = this.settings.autoPlay;

    this.syncPageIndicatorSettings();
  }

  // Spotify integration methods
  /**
   * Handle music source change between Freesound and Spotify
   * @param {string} source - 'freesound' or 'spotify'
   */
  async handleMusicSourceChange(source) {
    try {
      // Show/hide Spotify authentication section based on selected source
      const spotifyAuthSection = document.getElementById('spotify-auth-section');
      if (spotifyAuthSection) {
        spotifyAuthSection.style.display = source === 'spotify' ? 'block' : 'none';
      }

      // Switch the music source in the music manager (stops current playback and updates API)
      if (window.musicManager) {
        await window.musicManager.switchMusicSource(source);
        const sourceName = source === 'spotify' ? 'Spotify' : 'Freesound';
        this.showToast(`Switched to ${sourceName}`, 'success');
      } else {
        console.warn('MusicManager not available on window object');
      }

      // Persist user's music source preference
      localStorage.setItem('music_source', source);
    } catch (error) {
      console.error('Error switching music source:', error);
      this.showToast(`Failed to switch music source: ${error.message}`, 'error');
    }
  }

  /**
   * Initiate Spotify OAuth connection flow
   * Checks for required credentials before starting authorization
   */
  async handleSpotifyConnect() {
    try {
      // Dynamically import SpotifyAuth module (lazy-loaded to reduce initial bundle size)
      const { SpotifyAuth } = await import('../auth/spotify-auth.js');
      const spotifyAuth = new SpotifyAuth();

      // Verify Spotify app credentials are configured (required for OAuth)
      const clientId = localStorage.getItem('spotify_client_id');
      const clientSecret = localStorage.getItem('spotify_client_secret');

      if (!clientId || !clientSecret) {
        this.showToast('Please configure Spotify credentials in Settings first', 'error');
        console.warn('Spotify credentials not found in localStorage. Need: spotify_client_id, spotify_client_secret');
        return;
      }

      // Start OAuth 2.0 authorization flow (redirects user to Spotify login)
      spotifyAuth.authorize();
      this.showToast('Redirecting to Spotify authorization...', 'info');
    } catch (error) {
      console.error('Error connecting to Spotify:', error);
      this.showToast(`Failed to connect: ${error.message}`, 'error');
    }
  }

  /**
   * Disconnect from Spotify and clear authentication tokens
   * Automatically switches back to Freesound if Spotify was active
   */
  async handleSpotifyDisconnect() {
    try {
      // Dynamically import SpotifyAuth module
      const { SpotifyAuth } = await import('../auth/spotify-auth.js');
      const spotifyAuth = new SpotifyAuth();

      // Clear all Spotify authentication tokens from localStorage
      spotifyAuth.clearTokens();

      // Update UI to reflect disconnected state
      this.updateSpotifyAuthUI();
      this.showToast('Disconnected from Spotify', 'success');

      // If user was actively using Spotify, switch back to Freesound
      const musicSourceSelect = document.getElementById('music-source-select');
      const isUsingSpotify = musicSourceSelect && musicSourceSelect.value === 'spotify';
      
      if (isUsingSpotify) {
        musicSourceSelect.value = 'freesound';
        await this.handleMusicSourceChange('freesound');
      }
    } catch (error) {
      console.error('Error disconnecting from Spotify:', error);
      this.showToast(`Failed to disconnect: ${error.message}`, 'error');
    }
  }

  /**
   * Update Spotify authentication UI elements based on current auth state
   * Checks localStorage for access token and updates buttons/status accordingly
   * Called on initialization and after connect/disconnect actions
   */
  updateSpotifyAuthUI() {
    // Check authentication state by presence of access token in localStorage
    const accessToken = localStorage.getItem('spotify_access_token');
    const isAuthenticated = !!accessToken;

    // Get UI elements for Spotify authentication section
    const connectBtn = document.getElementById('spotify-connect-btn');
    const disconnectBtn = document.getElementById('spotify-disconnect-btn');
    const statusText = document.getElementById('spotify-status-text');

    // Show appropriate button based on authentication state
    // (Only one button visible at a time: connect OR disconnect)
    if (connectBtn) {
      connectBtn.style.display = isAuthenticated ? 'none' : 'inline-block';
    }
    if (disconnectBtn) {
      disconnectBtn.style.display = isAuthenticated ? 'inline-block' : 'none';
    }
    
    // Update status text with visual indicator
    if (statusText) {
      statusText.textContent = isAuthenticated ? '✅ Connected' : 'Not connected';
      statusText.style.color = isAuthenticated ? '#4CAF50' : '#666';
    }

    // Restore user's previously selected music source from localStorage
    const musicSourceSelect = document.getElementById('music-source-select');
    const savedSource = localStorage.getItem('music_source') || 'freesound'; // Default to Freesound
    
    if (musicSourceSelect) {
      musicSourceSelect.value = savedSource;
    }

    // Show/hide Spotify authentication section based on selected source
    // (Only visible when Spotify is selected as the music source)
    const spotifyAuthSection = document.getElementById('spotify-auth-section');
    if (spotifyAuthSection) {
      const shouldShowSpotifyAuth = savedSource === 'spotify';
      spotifyAuthSection.style.display = shouldShowSpotifyAuth ? 'block' : 'none';
    }
  }
}
