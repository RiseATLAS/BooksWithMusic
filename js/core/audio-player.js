import { CacheManager } from '../storage/cache-manager.js';

export class AudioPlayer {
  constructor() {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.currentSource = null;
    this.nextSource = null;
    this.currentGain = this.audioContext.createGain();
    this.nextGain = this.audioContext.createGain();
    this.nextGain.gain.value = 0;
    this.currentGain.connect(this.audioContext.destination);
    this.nextGain.connect(this.audioContext.destination);
    this.cacheManager = new CacheManager();
    this.eventHandlers = {};
    this.state = {
      playing: false,
      trackIndex: 0,
      volume: 0.7,
    };
    this.crossfadeDuration = 4;
    
    // Initialize Media Session API for hardware media controls
    this.initializeMediaSession();
  }

  /**
   * Initialize Media Session API to support hardware media controls
   * (play/pause/next/previous buttons on keyboard, headphones, etc.)
   */
  initializeMediaSession() {
    if ('mediaSession' in navigator) {
      console.log(' Media Session API available - hardware controls enabled');
      
      // Action handlers will be set when tracks are played
      // They need to be connected to the music panel's controls
      this.mediaSessionHandlers = {
        play: null,
        pause: null,
        previoustrack: null,
        nexttrack: null
      };
    } else {
      console.log(' Media Session API not available in this browser');
    }
  }

  /**
   * Update Media Session metadata and artwork
   */
  updateMediaSession(track) {
    if ('mediaSession' in navigator && track) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title || 'Unknown Track',
        artist: track.artist || 'Unknown Artist',
        album: 'BooksWithMusic',
        artwork: track.artwork || [
          { src: '/BooksWithMusic/favicon.svg', sizes: '512x512', type: 'image/svg+xml' }
        ]
      });
      console.log(' Media Session updated:', track.title);
    }
  }

  /**
   * Set Media Session action handlers (connected to music panel controls)
   */
  setMediaSessionHandlers(handlers) {
    if ('mediaSession' in navigator) {
      const { play, pause, nextTrack, prevTrack } = handlers;
      
      if (play) {
        navigator.mediaSession.setActionHandler('play', () => {
          console.log(' Hardware play button pressed');
          play();
        });
      }
      
      if (pause) {
        navigator.mediaSession.setActionHandler('pause', () => {
          console.log(' Hardware pause button pressed');
          pause();
        });
      }
      
      if (nextTrack) {
        navigator.mediaSession.setActionHandler('nexttrack', () => {
          console.log(' Hardware next button pressed');
          nextTrack();
        });
      }
      
      if (prevTrack) {
        navigator.mediaSession.setActionHandler('previoustrack', () => {
          console.log(' Hardware previous button pressed');
          prevTrack();
        });
      }
      
      console.log(' Media Session handlers configured');
    }
  }

  async playTrack(track) {
    try {
      // Resume audio context if suspended (browser autoplay policy)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      if (!track || !track.url) {
        throw new Error('Invalid track: missing URL');
      }
      
      const audioBuffer = await this._loadTrack(track);
      
      if (this.currentSource) {
        await this._crossfade(audioBuffer);
      } else {
        this.currentSource = this._createSource(audioBuffer, this.currentGain);
        this.currentSource.start();
      }

      this.state.playing = true;
      this.state.currentTrack = track;
      this.emit('playing', track);
      
      // Update Media Session metadata for OS controls
      this.updateMediaSession(track);
    } catch (error) {
      console.error('Error playing track:', error);
      this.state.playing = false;
      this.emit('error', error);
      throw error;
    }
  }

  async preloadTrack(track) {
    await this._loadTrack(track);
  }

  pause() {
    if (this.currentSource) {
      this.audioContext.suspend();
      this.state.playing = false;
      this.emit('paused');
      
      // Update Media Session playback state
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'paused';
      }
    }
  }

  resume() {
    this.audioContext.resume();
    this.state.playing = true;
    this.emit('playing');
    
    // Update Media Session playback state
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'playing';
    }
  }

  stop() {
    if (this.currentSource) {
      this.currentSource.stop();
      this.currentSource = null;
    }
    if (this.nextSource) {
      this.nextSource.stop();
      this.nextSource = null;
    }
    this.state.playing = false;
  }

  setVolume(volume) {
    this.state.volume = Math.max(0, Math.min(1, volume));
    this.currentGain.gain.value = this.state.volume;
  }

  setCrossfadeDuration(seconds) {
    this.crossfadeDuration = seconds;
  }

  getState() {
    return { ...this.state };
  }

  async _loadTrack(track) {
    try {
      const cached = await this.cacheManager.getCachedTrack(track.id);
      let audioData;

      if (cached) {
        audioData = await cached.arrayBuffer();
      } else {
        const response = await fetch(track.url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const blob = await response.blob();
        await this.cacheManager.cacheTrack(track.id, blob);
        audioData = await blob.arrayBuffer();
      }

      return await this.audioContext.decodeAudioData(audioData);
    } catch (error) {
      console.error(' Error loading audio track:', track.title || track.id);
      console.error('Track URL:', track.url);
      console.error('Error details:', error);
      console.error('Stack trace:', error.stack);
      throw new Error(`Failed to load track "${track.title}": ${error.message}`);
    }
  }

  _createSource(buffer, gainNode) {
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(gainNode);
    
    // Listen for track ended event
    source.onended = () => {
      // Only emit if this was the current playing source (not from crossfade cleanup)
      if (source === this.currentSource && this.state.playing) {
        console.log(' Track ended naturally');
        this.emit('trackEnded');
      }
    };
    
    return source;
  }

  async _crossfade(nextBuffer) {
    const now = this.audioContext.currentTime;
    const duration = this.crossfadeDuration;

    this.nextSource = this._createSource(nextBuffer, this.nextGain);
    this.nextGain.gain.value = 0;
    this.nextSource.start(now);

    this.currentGain.gain.linearRampToValueAtTime(0, now + duration);
    this.nextGain.gain.linearRampToValueAtTime(this.state.volume, now + duration);

    await new Promise(resolve => setTimeout(resolve, duration * 1000));

    if (this.currentSource) {
      this.currentSource.stop();
    }
    this.currentSource = this.nextSource;
    this.nextSource = null;

    const tempGain = this.currentGain;
    this.currentGain = this.nextGain;
    this.nextGain = tempGain;
    this.nextGain.gain.value = 0;
  }

  async play(url) {
    const track = { url, id: url };
    await this.playTrack(track);
    this.emit('playing');
  }

  isPlaying() {
    return this.state.playing && this.audioContext.state === 'running';
  }

  on(event, handler) {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    if (typeof handler === 'function') {
      this.eventHandlers[event].push(handler);
    }
  }

  emit(event, data) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in audio player event handler for ${event}:`, error);
        }
      });
    }
  }
}
