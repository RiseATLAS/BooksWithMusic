export class SettingsUI {
  constructor() {
    this.settings = {
      theme: 'light',
      fontSize: 16,
      lineHeight: 1.6,
      musicEnabled: true,
      autoPlay: true
    };
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
  }

  applyTheme() {
    document.body.setAttribute('data-theme', this.settings.theme);
  }

  applyFontSize() {
    const readerContent = document.getElementById('reader-content');
    if (readerContent) {
      readerContent.style.fontSize = `${this.settings.fontSize}px`;
    }
  }

  applyLineHeight() {
    const readerContent = document.getElementById('reader-content');
    if (readerContent) {
      readerContent.style.lineHeight = this.settings.lineHeight;
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
