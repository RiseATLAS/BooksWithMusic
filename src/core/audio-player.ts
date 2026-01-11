import { Track, AudioState } from '../types/interfaces';
import { CacheManager } from '../storage/cache-manager';

export class AudioPlayer {
  private audioContext: AudioContext;
  private currentSource?: AudioBufferSourceNode;
  private nextSource?: AudioBufferSourceNode;
  private currentGain: GainNode;
  private nextGain: GainNode;
  private cacheManager: CacheManager;
  private state: AudioState;
  private crossfadeDuration: number = 4;

  constructor() {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.currentGain = this.audioContext.createGain();
    this.nextGain = this.audioContext.createGain();
    this.nextGain.gain.value = 0;
    this.currentGain.connect(this.audioContext.destination);
    this.nextGain.connect(this.audioContext.destination);
    this.cacheManager = new CacheManager();
    this.state = {
      playing: false,
      trackIndex: 0,
      volume: 0.7,
    };
  }

  async playTrack(track: Track): Promise<void> {
    const audioBuffer = await this.loadTrack(track);
    
    if (this.currentSource) {
      // Crossfade to new track
      await this.crossfade(audioBuffer);
    } else {
      // First track - just play
      this.currentSource = this.createSource(audioBuffer, this.currentGain);
      this.currentSource.start();
    }

    this.state.playing = true;
    this.state.currentTrack = track;
  }

  async preloadTrack(track: Track): Promise<void> {
    // Preload into cache
    await this.loadTrack(track);
  }

  pause(): void {
    if (this.currentSource) {
      this.audioContext.suspend();
      this.state.playing = false;
    }
  }

  resume(): void {
    this.audioContext.resume();
    this.state.playing = true;
  }

  stop(): void {
    if (this.currentSource) {
      this.currentSource.stop();
      this.currentSource = undefined;
    }
    if (this.nextSource) {
      this.nextSource.stop();
      this.nextSource = undefined;
    }
    this.state.playing = false;
  }

  setVolume(volume: number): void {
    this.state.volume = Math.max(0, Math.min(1, volume));
    this.currentGain.gain.value = this.state.volume;
  }

  setCrossfadeDuration(seconds: number): void {
    this.crossfadeDuration = seconds;
  }

  getState(): AudioState {
    return { ...this.state };
  }

  private async loadTrack(track: Track): Promise<AudioBuffer> {
    // Try cache first
    const cached = await this.cacheManager.getCachedTrack(track.id);
    let audioData: ArrayBuffer;

    if (cached) {
      audioData = await cached.arrayBuffer();
    } else {
      // Fetch from URL
      const response = await fetch(track.url);
      const blob = await response.blob();
      
      // Cache it
      await this.cacheManager.cacheTrack(track.id, blob);
      audioData = await blob.arrayBuffer();
    }

    return await this.audioContext.decodeAudioData(audioData);
  }

  private createSource(buffer: AudioBuffer, gainNode: GainNode): AudioBufferSourceNode {
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(gainNode);
    return source;
  }

  private async crossfade(nextBuffer: AudioBuffer): Promise<void> {
    const now = this.audioContext.currentTime;
    const duration = this.crossfadeDuration;

    // Prepare next track
    this.nextSource = this.createSource(nextBuffer, this.nextGain);
    this.nextGain.gain.value = 0;

    // Start next track
    this.nextSource.start(now);

    // Crossfade
    this.currentGain.gain.linearRampToValueAtTime(0, now + duration);
    this.nextGain.gain.linearRampToValueAtTime(this.state.volume, now + duration);

    // Wait for crossfade
    await new Promise(resolve => setTimeout(resolve, duration * 1000));

    // Swap sources
    if (this.currentSource) {
      this.currentSource.stop();
    }
    this.currentSource = this.nextSource;
    this.nextSource = undefined;

    // Swap gains
    const tempGain = this.currentGain;
    this.currentGain = this.nextGain;
    this.nextGain = tempGain;
    this.nextGain.gain.value = 0;
  }
}
