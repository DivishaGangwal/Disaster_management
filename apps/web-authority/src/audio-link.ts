/*
 * Disaster SOS Mesh integration for WavePX (MIT), pinned from:
 * https://github.com/0xNtive/wavepx/tree/81c7c30cc9c2f2a42bc04a43087b6fa9b43e237d
 *
 * WavePX owns audio orchestration. Its bundled ggwave transport remains the
 * physical modem. Canonical Tier 2 bytes use WavePX's raw-frame seam.
 */

import { SonicPixel } from './vendor/wavepx/wavepx';
import { SonicProtocol } from './vendor/wavepx/types';

const BUFFER_SIZE = 1_024;
const SAMPLE_RATE = 48_000;

export type AudioProfile = 'audible-fast' | 'audible-normal' | 'ultrasound-normal';

interface AudioLinkOptions {
  readonly onFrame?: (frame: Uint8Array) => void;
  readonly onLevel?: (level: number) => void;
  readonly onState?: (state: 'idle' | 'initializing' | 'listening' | 'transmitting') => void;
  readonly onError?: (error: Error) => void;
}

export class Tier2AudioLink {
  private sonic?: SonicPixel;
  private profile?: AudioProfile;
  private decoding = false;
  private transmissionToken = 0;

  constructor(private readonly options: AudioLinkOptions = {}) {}

  async init(profile: AudioProfile = 'audible-fast'): Promise<void> {
    if (this.sonic && this.profile === profile) return;
    this.destroy();
    this.options.onState?.('initializing');
    const sonic = new SonicPixel({
      protocol: protocolFor(profile),
      volume: 55,
      onAudioLevel: this.options.onLevel,
      onRawReceive: this.options.onFrame,
      onStateChange: (state) => {
        if (this.decoding) return;
        this.options.onState?.(state === 'listening' ? 'listening' : state === 'sending' ? 'transmitting' : 'idle');
      },
      onError: this.options.onError,
    });
    try {
      await sonic.init();
      this.sonic = sonic;
      this.profile = profile;
    } catch (reason) {
      sonic.destroy();
      throw reason;
    } finally {
      this.options.onState?.('idle');
    }
  }

  async listen(): Promise<void> {
    await this.init();
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone access requires HTTPS or localhost');
    await this.sonic!.startListening();
  }

  async transmit(frames: readonly Uint8Array[], profile: AudioProfile, onProgress?: (sent: number, total: number) => void): Promise<boolean> {
    await this.init(profile);
    const token = ++this.transmissionToken;
    this.options.onState?.('transmitting');
    try {
      for (let index = 0; index < frames.length; index += 1) {
        if (token !== this.transmissionToken) return false;
        await this.sonic!.sendRaw(frames[index]!);
        if (token !== this.transmissionToken) return false;
        onProgress?.(index + 1, frames.length);
      }
      return true;
    } finally {
      this.options.onState?.('idle');
    }
  }

  async decodeAudioFile(file: File, onProgress?: (processed: number, total: number) => void): Promise<readonly Uint8Array[]> {
    await this.init();
    this.sonic!.stopListening();
    this.decoding = true;
    this.options.onState?.('listening');
    const context = new AudioContext({ sampleRate: SAMPLE_RATE });
    const recovered: Uint8Array[] = [];
    const seen = new Set<string>();
    try {
      const audio = await context.decodeAudioData(await file.arrayBuffer());
      const samples = audio.getChannelData(0);
      for (let offset = 0; offset < samples.length; offset += BUFFER_SIZE) {
        const block = new Float32Array(BUFFER_SIZE);
        block.set(samples.subarray(offset, Math.min(samples.length, offset + BUFFER_SIZE)));
        const decoded = this.sonic!.decodeSamples(block);
        if (decoded) {
          const key = encodeBase64(decoded);
          if (!seen.has(key)) { seen.add(key); recovered.push(decoded); }
        }
        if (offset % (BUFFER_SIZE * 120) === 0) {
          onProgress?.(Math.min(offset + BUFFER_SIZE, samples.length), samples.length);
          await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
        }
      }
      onProgress?.(samples.length, samples.length);
      return recovered;
    } finally {
      this.decoding = false;
      this.options.onState?.('idle');
      await context.close();
    }
  }

  createWav(frames: readonly Uint8Array[], profile: AudioProfile): Blob {
    if (!this.sonic || this.profile !== profile) throw new Error('Initialize the selected WavePX profile before exporting WAV');
    return this.sonic.generateWav([...frames]);
  }

  stopListening(): void {
    this.sonic?.stopListening();
    this.options.onState?.('idle');
  }

  stopTransmission(): void {
    this.transmissionToken += 1;
    this.sonic?.abortSend();
    this.options.onState?.('idle');
  }

  destroy(): void {
    this.sonic?.destroy();
    this.sonic = undefined;
    this.profile = undefined;
  }
}

export function decodeBase64(value: string): Uint8Array {
  const binary = window.atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function encodeBase64(value: Uint8Array): string {
  let binary = '';
  for (const byte of value) binary += String.fromCharCode(byte);
  return window.btoa(binary);
}

function protocolFor(profile: AudioProfile): SonicProtocol {
  if (profile === 'audible-normal') return SonicProtocol.AudibleNormal;
  if (profile === 'ultrasound-normal') return SonicProtocol.UltrasoundNormal;
  return SonicProtocol.AudibleFast;
}
