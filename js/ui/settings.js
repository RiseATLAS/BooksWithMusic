export class SettingsUI {
  constructor() {
    // Detect system dark mode preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    this.settings = {
      theme: prefersDark ? 'dark' : 'light',
      fontSize: 16,
      lineHeight: 1.6,
      fontFamily: 'serif',
      textAlign: 'left',
      pageWidth: 650,
      brightness: 100,
      pageColor: prefersDark ? 'black' : 'white',
      pageWarmth: 0,
      showProgress: true,
      showChapterTitle: true,
      musicEnabled: true,
      autoPlay: false,
      crossfadeDuration: 3
    };

    this._layoutChangeTimer = null;
  }

  initialize() {
    this.loadSettings();
    this.setupEventListeners();
    this.applySettings();
  }

  setupEventListeners() {
    // Open/close settings panel
    document.getElementById('settings-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.showSettings();
    });

    document.getElementById('close-settings')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.hideSettings();
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

    // Page warmth / yellowness
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

    // Show progress
    document.getElementById('show-progress')?.addEventListener('change', (e) => {
      this.settings.showProgress = e.target.checked;
      this.applyShowProgress();
      this.saveSettings();
    });

    // Show chapter title
    document.getElementById('show-chapter-title')?.addEventListener('change', (e) => {
      this.settings.showChapterTitle = e.target.checked;
      this.applyShowChapterTitle();
      this.saveSettings();
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

    // Auto-play
    document.getElementById('auto-play')?.addEventListener('change', (e) => {
      this.settings.autoPlay = e.target.checked;
      this.saveSettings();
    });

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
  }

  showSettings() {
    const panel = document.getElementById('settings-panel');
    if (panel) {
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
    const stored = localStorage.getItem('booksWithMusic-settings');
    if (stored) {
      try {
        this.settings = { ...this.settings, ...JSON.parse(stored) };
        
        let needsSave = false;
        
        // Force autoPlay to false by default (override old saved settings)
        if (this.settings.autoPlay === undefined || this.settings.autoPlay === true) {
          this.settings.autoPlay = false;
          needsSave = true;
        }
        
        // Fix pageColor to match theme if there's a mismatch
        if (this.settings.theme === 'dark' && this.settings.pageColor === 'white') {
          this.settings.pageColor = 'black';
          needsSave = true;
        } else if (this.settings.theme === 'light' && this.settings.pageColor === 'black') {
          this.settings.pageColor = 'white';
          needsSave = true;
        } else if (this.settings.theme === 'sepia' && (this.settings.pageColor === 'white' || this.settings.pageColor === 'black')) {
          this.settings.pageColor = 'cream';
          needsSave = true;
        }
        
        if (needsSave) {
          this.saveSettings();
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    }

    // Update UI elements
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

    const brightnessInput = document.getElementById('brightness');
    const brightnessValue = document.getElementById('brightness-value');
    if (brightnessInput) brightnessInput.value = this.settings.brightness;
    if (brightnessValue) brightnessValue.textContent = `${this.settings.brightness}%`;

    const pageColorSelect = document.getElementById('page-color');
    if (pageColorSelect) pageColorSelect.value = this.settings.pageColor;

    const pageWarmthInput = document.getElementById('page-warmth');
    const pageWarmthValue = document.getElementById('page-warmth-value');
    if (pageWarmthInput) pageWarmthInput.value = this.settings.pageWarmth ?? 0;
    if (pageWarmthValue) pageWarmthValue.textContent = `${this.settings.pageWarmth ?? 0}%`;

    const showProgress = document.getElementById('show-progress');
    if (showProgress) showProgress.checked = this.settings.showProgress;

    const showChapterTitle = document.getElementById('show-chapter-title');
    if (showChapterTitle) showChapterTitle.checked = this.settings.showChapterTitle;

    const crossfadeInput = document.getElementById('crossfade-duration');
    const crossfadeValue = document.getElementById('crossfade-value');
    if (crossfadeInput) crossfadeInput.value = this.settings.crossfadeDuration;
    if (crossfadeValue) crossfadeValue.textContent = `${this.settings.crossfadeDuration}s`;

    const musicEnabled = document.getElementById('music-enabled');
    if (musicEnabled) musicEnabled.checked = this.settings.musicEnabled;

    const autoPlay = document.getElementById('auto-play');
    if (autoPlay) autoPlay.checked = this.settings.autoPlay;
  }

  saveSettings() {
    localStorage.setItem('booksWithMusic-settings', JSON.stringify(this.settings));
  }

  applySettings() {
    this.applyTheme();
    this.applyFontSize();
    this.applyLineHeight();
    this.applyFontFamily();
    this.applyTextAlign();
    this.applyPageWidth();
    this.applyBrightness();
    this.applyPageColor();
    this.applyPageWarmth();
    this.applyShowProgress();
    this.applyShowChapterTitle();

    // Ensure pagination updates after initial settings apply
    this._emitLayoutChanged('init');
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
    // Drive the pagination/layout through CSS vars so ReaderUI can measure real column widths.
    const pageWidthPx = `${this.settings.pageWidth}px`;
    document.documentElement.style.setProperty('--page-width', pageWidthPx);
    document.querySelectorAll('.chapter-text').forEach((el) => el.style.setProperty('--page-width', pageWidthPx));
    document.querySelectorAll('.page-viewport').forEach((el) => el.style.setProperty('--page-width', pageWidthPx));
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

    // Re-apply warmth on top of any page color changes
    this.applyPageWarmth();
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
    // #RRGGBB
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

  applyShowProgress() {
    const progressBar = document.querySelector('.reading-progress');
    if (progressBar) {
      progressBar.style.display = this.settings.showProgress ? 'block' : 'none';
    }
  }

  applyShowChapterTitle() {
    const chapterTitle = document.getElementById('chapter-title');
    if (chapterTitle) {
      chapterTitle.style.display = this.settings.showChapterTitle ? 'block' : 'none';
    }
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
}
