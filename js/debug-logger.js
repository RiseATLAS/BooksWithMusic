/**
 * Debug logger that writes to a file I can read
 * In development mode, logs are sent to server and written to debug.log
 */
class DebugLogger {
  constructor() {
    this.isDevelopmentMode = window.location.hostname === 'localhost' || 
                            window.location.hostname === '127.0.0.1';
    this.logs = [];
  }

  log(...args) {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    
    // Always log to console
    console.log(...args);
    
    // In dev mode, also save to file
    if (this.isDevelopmentMode) {
      this.logs.push(`[${new Date().toISOString()}] ${message}`);
      this.writeToFile();
    }
  }

  error(...args) {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    
    console.error(...args);
    
    if (this.isDevelopmentMode) {
      this.logs.push(`[${new Date().toISOString()}] ERROR: ${message}`);
      this.writeToFile();
    }
  }

  warn(...args) {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    
    console.warn(...args);
    
    if (this.isDevelopmentMode) {
      this.logs.push(`[${new Date().toISOString()}] WARN: ${message}`);
      this.writeToFile();
    }
  }

  writeToFile() {
    // Create a downloadable log file
    const blob = new Blob([this.logs.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    // Store in localStorage so we can retrieve it
    try {
      localStorage.setItem('debug-logs', this.logs.join('\n'));
    } catch (e) {
      // Ignore if storage is full
    }
  }

  downloadLogs() {
    const blob = new Blob([this.logs.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'debug-log.txt';
    a.click();
    URL.revokeObjectURL(url);
  }
}

// Export as global
window.debugLogger = new DebugLogger();
export { DebugLogger };
