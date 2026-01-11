export class SettingsUI {
  initialize() {
    this.setupSettingsPanel();
    this.loadSettings();
  }

  private setupSettingsPanel() {
    document.getElementById('settings-toggle')?.addEventListener('click', () => {
      document.getElementById('settings-panel')?.classList.add('active');
    });

    document.getElementById('close-settings')?.addEventListener('click', () => {
      document.getElementById('settings-panel')?.classList.remove('active');
    });

    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const theme = (e.target as HTMLElement).dataset.theme;
        if (theme) this.setTheme(theme);
      });
    });

    document.getElementById('font-family')?.addEventListener('change', (e) => {
      this.setFontFamily((e.target as HTMLSelectElement).value);
    });

    document.getElementById('font-size')?.addEventListener('input', (e) => {
      const size = (e.target as HTMLInputElement).value;
      this.setFontSize(parseInt(size));
    });

    document.getElementById('line-height')?.addEventListener('input', (e) => {
      const height = (e.target as HTMLInputElement).value;
      this.setLineHeight(parseFloat(height));
    });

    document.getElementById('content-width')?.addEventListener('input', (e) => {
      const width = (e.target as HTMLInputElement).value;
      this.setContentWidth(parseInt(width));
    });
  }

  private loadSettings() {
    const theme = localStorage.getItem('theme') || 'light';
    const fontSize = localStorage.getItem('fontSize') || '18';
    const lineHeight = localStorage.getItem('lineHeight') || '1.6';
    const contentWidth = localStorage.getItem('contentWidth') || '700';
    const fontFamily = localStorage.getItem('fontFamily') || 'serif';

    this.setTheme(theme);
    this.setFontSize(parseInt(fontSize));
    this.setLineHeight(parseFloat(lineHeight));
    this.setContentWidth(parseInt(contentWidth));
    this.setFontFamily(fontFamily);
  }

  private setTheme(theme: string) {
    document.body.dataset.theme = theme;
    localStorage.setItem('theme', theme);

    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.classList.toggle('active', (btn as HTMLElement).dataset.theme === theme);
    });
  }

  private setFontFamily(family: string) {
    document.documentElement.style.setProperty('--reader-font-family', family);
    localStorage.setItem('fontFamily', family);
    (document.getElementById('font-family') as HTMLSelectElement).value = family;
  }

  private setFontSize(size: number) {
    document.documentElement.style.setProperty('--reader-font-size', `${size}px`);
    localStorage.setItem('fontSize', size.toString());
    (document.getElementById('font-size') as HTMLInputElement).value = size.toString();
    (document.getElementById('font-size-val') as HTMLElement).textContent = `${size}px`;
  }

  private setLineHeight(height: number) {
    document.documentElement.style.setProperty('--reader-line-height', height.toString());
    localStorage.setItem('lineHeight', height.toString());
    (document.getElementById('line-height') as HTMLInputElement).value = height.toString();
    (document.getElementById('line-height-val') as HTMLElement).textContent = height.toString();
  }

  private setContentWidth(width: number) {
    document.documentElement.style.setProperty('--reader-width', `${width}px`);
    localStorage.setItem('contentWidth', width.toString());
    (document.getElementById('content-width') as HTMLInputElement).value = width.toString();
    (document.getElementById('content-width-val') as HTMLElement).textContent = `${width}px`;
  }
}
