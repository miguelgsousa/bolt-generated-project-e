export class AudioManager {
  private audioContext: AudioContext;
  private audioTracks: AudioSegment[][] = [];
  private currentTrackIndex: number = 0;
  private segments: AudioSegment[] = [];
  private currentSegmentIndex: number = 0;
  private isProcessing: boolean = false;
  private currentSource: AudioBufferSourceNode | null = null;
  private isPlaying: boolean = false;
  private segmentDuration: number = 0.3;
  private lastPlayStartTime: number = 0;
  private gainNode: GainNode;
  private destinationNode: MediaStreamAudioDestinationNode | null = null;
  private readonly MAX_TRACKS = 10;

  constructor(destinationNode?: MediaStreamAudioDestinationNode) {
    this.audioContext = destinationNode?.context || new (window.AudioContext || window.webkitAudioContext)();
    this.gainNode = this.audioContext.createGain();
    this.destinationNode = destinationNode || null;
    
    this.gainNode.connect(this.audioContext.destination);
    if (this.destinationNode) {
      this.gainNode.connect(this.destinationNode);
    }
  }

  public setSegmentDuration(duration: number) {
    if (duration > 0) {
      this.segmentDuration = duration;
      // Re-process all tracks with new segment duration
      this.reprocessTracks();
    }
  }

  private async reprocessTracks() {
    const oldTracks = [...this.audioTracks];
    this.audioTracks = [];
    this.segments = [];
    
    for (const track of oldTracks) {
      if (track.length > 0) {
        // Reconstruct original audio buffer
        const firstSegment = track[0];
        const sampleRate = firstSegment.buffer.sampleRate;
        const totalLength = track.reduce((acc, segment) => acc + segment.buffer.length, 0);
        const channels = firstSegment.buffer.numberOfChannels;
        
        const fullBuffer = this.audioContext.createBuffer(
          channels,
          totalLength,
          sampleRate
        );
        
        let offset = 0;
        for (const segment of track) {
          for (let channel = 0; channel < channels; channel++) {
            const channelData = fullBuffer.getChannelData(channel);
            channelData.set(segment.buffer.getChannelData(channel), offset);
          }
          offset += segment.buffer.length;
        }
        
        // Split into new segments with new duration
        const newSegments = await this.splitAudioIntoSegments(fullBuffer);
        this.audioTracks.push(newSegments);
        
        if (this.audioTracks.length === 1) {
          this.segments = newSegments;
        }
      }
    }
  }

  private isValidAudioFormat(file: File): boolean {
    const validTypes = ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/ogg'];
    return validTypes.includes(file.type);
  }

  private async splitAudioIntoSegments(audioBuffer: AudioBuffer): Promise<AudioSegment[]> {
    const sampleRate = audioBuffer.sampleRate;
    const samplesPerSegment = this.segmentDuration * sampleRate;
    const segments: AudioSegment[] = [];

    for (let i = 0; i < audioBuffer.length; i += samplesPerSegment) {
      const segmentLength = Math.min(samplesPerSegment, audioBuffer.length - i);
      const segmentBuffer = this.audioContext.createBuffer(
        audioBuffer.numberOfChannels,
        segmentLength,
        sampleRate
      );

      for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        const channelData = audioBuffer.getChannelData(channel);
        const segmentData = segmentBuffer.getChannelData(channel);
        segmentData.set(channelData.slice(i, i + segmentLength));
      }

      segments.push({
        buffer: segmentBuffer,
        startTime: i / sampleRate,
        duration: this.segmentDuration
      });
    }

    return segments;
  }

  public async processAudioFile(file: File): Promise<void> {
    if (!this.isValidAudioFormat(file)) {
      throw new Error('Invalid audio format. Please upload MP3, WAV, or OGG files.');
    }

    if (this.audioTracks.length >= this.MAX_TRACKS) {
      throw new Error(`Maximum number of tracks (${this.MAX_TRACKS}) reached. Remove some tracks before adding more.`);
    }

    try {
      this.isProcessing = true;
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      const newSegments = await this.splitAudioIntoSegments(audioBuffer);
      this.audioTracks.push(newSegments);
      
      // If this is the first track, set it as active
      if (this.audioTracks.length === 1) {
        this.segments = newSegments;
      }
      
      this.isProcessing = false;

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
    } catch (error) {
      this.isProcessing = false;
      throw new Error(`Failed to process audio file: ${error.message}`);
    }
  }

  public selectRandomTrack(): void {
    if (this.audioTracks.length === 0) return;
    
    const randomIndex = Math.floor(Math.random() * this.audioTracks.length);
    this.currentTrackIndex = randomIndex;
    this.segments = this.audioTracks[randomIndex];
    this.currentSegmentIndex = 0;
    this.lastPlayStartTime = 0;
    
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch (e) {
        // Ignore errors if source is already stopped
      }
      this.currentSource = null;
    }
  }

  public removeTrack(index: number): void {
    if (index < 0 || index >= this.audioTracks.length) return;
    
    this.audioTracks.splice(index, 1);
    
    // If we removed the current track, select a new one
    if (this.currentTrackIndex === index) {
      if (this.audioTracks.length > 0) {
        this.selectRandomTrack();
      } else {
        this.segments = [];
        this.currentTrackIndex = 0;
        this.currentSegmentIndex = 0;
      }
    } else if (this.currentTrackIndex > index) {
      // Adjust current track index if we removed a track before it
      this.currentTrackIndex--;
    }
  }

  public async playNextSegment(): Promise<void> {
    if (this.segments.length === 0 || this.isProcessing) return;

    const currentTime = this.audioContext.currentTime;
    const timeSinceLastPlay = currentTime - this.lastPlayStartTime;

    if (timeSinceLastPlay < this.segmentDuration * 0.9) {
      return;
    }

    try {
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      if (this.currentSource) {
        try {
          this.currentSource.stop();
        } catch (e) {
          // Ignore errors if source is already stopped
        }
      }

      const segment = this.segments[this.currentSegmentIndex];
      const source = this.audioContext.createBufferSource();
      
      source.buffer = segment.buffer;
      source.connect(this.gainNode);

      source.start(0);
      this.lastPlayStartTime = currentTime;
      this.currentSource = source;
      this.isPlaying = true;

      source.onended = () => {
        this.isPlaying = false;
        this.currentSegmentIndex = (this.currentSegmentIndex + 1) % this.segments.length;
      };
    } catch (error) {
      console.error('Playback error:', error);
      this.isPlaying = false;
    }
  }

  public clearSegments(): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch (e) {
        // Ignore errors if source is already stopped
      }
      this.currentSource = null;
    }
    
    this.audioTracks = [];
    this.segments = [];
    this.currentTrackIndex = 0;
    this.currentSegmentIndex = 0;
    this.isPlaying = false;
    this.lastPlayStartTime = 0;
  }

  public reset(): void {
    this.selectRandomTrack();
  }

  public getTracksCount(): number {
    return this.audioTracks.length;
  }

  public getMaxTracks(): number {
    return this.MAX_TRACKS;
  }

  public isProcessingAudio(): boolean {
    return this.isProcessing;
  }

  public getAudioStream(): MediaStream | null {
    return this.destinationNode?.stream || null;
  }
}
