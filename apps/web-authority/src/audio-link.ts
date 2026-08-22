/*
 * Browser audio lifecycle adapted from WavePX (MIT):
 * https://github.com/0xNtive/wavepx/tree/81c7c30cc9c2f2a42bc04a43087b6fa9b43e237d
 * We use ggwave directly so the frozen Tier 2 frame bytes remain untouched.
 */

import { WavePxAudioManager } from './vendor/wavepx/audio-manager';
import { WAVE_PX_SAMPLE_RATE as SAMPLE_RATE, WavePxTransport, type WavePxProfile } from './vendor/wavepx/transport';

const BUFFER_SIZE = 1_024;
const FRAME_GAP_MS = 180;

export type AudioProfile = WavePxProfile;

interface AudioLinkOptions {
  readonly onFrame?: (frame: Uint8Array) => void;
  readonly onLevel?: (level: number) => void;
  readonly onState?: (state: 'idle' | 'initializing' | 'listening' | 'transmitting') => void;
}

export class Tier2AudioLink {
  private readonly transport = new WavePxTransport();
  private audio?: WavePxAudioManager;
  private stream?: MediaStream;
  private source?: MediaStreamAudioSourceNode;
  private processor?: ScriptProcessorNode;

  constructor(private readonly options: AudioLinkOptions = {}) {}

  async init(): Promise<void> {
    if (this.audio) return;
    this.options.onState?.('initializing');
    await this.transport.init();
    this.audio = new WavePxAudioManager();
    await this.audio.ready();
    this.options.onState?.('idle');
  }

  async listen(): Promise<void> {
    await this.init();
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone access requires HTTPS or localhost');
    this.stopListening();
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: false, autoGainControl: false, noiseSuppression: false },
    });
    this.source = this.audio!.context.createMediaStreamSource(this.stream);
    this.processor = this.audio!.context.createScriptProcessor(BUFFER_SIZE, 1, 1);
    this.processor.onaudioprocess = (event) => {
      const samples = new Float32Array(event.inputBuffer.getChannelData(0));
      let level = 0;
      for (const sample of samples) level += Math.abs(sample);
      this.options.onLevel?.(level / samples.length);
      const decoded = this.transport.decode(samples);
      if (decoded) this.options.onFrame?.(decoded);
    };
    this.source.connect(this.processor);
    this.processor.connect(this.audio!.context.destination);
    this.options.onState?.('listening');
  }

  async transmit(frames: readonly Uint8Array[], profile: AudioProfile, onProgress?: (sent: number, total: number) => void): Promise<void> {
    await this.init();
    this.stopListening();
    this.options.onState?.('transmitting');
    try {
      for (let index = 0; index < frames.length; index += 1) {
        await this.audio!.play(this.transport.encode(frames[index]!, profile));
        onProgress?.(index + 1, frames.length);
        if (index < frames.length - 1) await delay(FRAME_GAP_MS);
      }
    } finally {
      this.options.onState?.('idle');
    }
  }

  async decodeAudioFile(file: File, onProgress?: (processed: number, total: number) => void): Promise<readonly Uint8Array[]> {
    await this.init();
    this.stopListening();
    this.options.onState?.('listening');
    const audio = await this.audio!.context.decodeAudioData(await file.arrayBuffer());
    const samples = audio.getChannelData(0);
    const recovered: Uint8Array[] = [];
    try {
      for (let offset = 0; offset < samples.length; offset += BUFFER_SIZE) {
        const block = new Float32Array(BUFFER_SIZE);
        block.set(samples.subarray(offset, Math.min(samples.length, offset + BUFFER_SIZE)));
        const decoded = this.transport.decode(block);
        if (decoded) {
          recovered.push(decoded);
          this.options.onFrame?.(decoded);
        }
        if (offset % (BUFFER_SIZE * 120) === 0) {
          onProgress?.(Math.min(offset + BUFFER_SIZE, samples.length), samples.length);
          await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
        }
      }
      onProgress?.(samples.length, samples.length);
      return recovered;
    } finally {
      this.options.onState?.('idle');
    }
  }

  createWav(frames: readonly Uint8Array[], profile: AudioProfile): Blob {
    const waveforms = frames.map((frame) => this.transport.encode(frame, profile));
    const gapSamples = Math.floor(SAMPLE_RATE * FRAME_GAP_MS / 1_000);
    const totalSamples = waveforms.reduce((total, waveform) => total + Math.floor(waveform.length / 4), 0)
      + Math.max(0, waveforms.length - 1) * gapSamples;
    const pcm = new Int16Array(totalSamples);
    let offset = 0;
    waveforms.forEach((waveform, waveformIndex) => {
      const aligned = waveform.slice().buffer;
      for (const sample of new Float32Array(aligned)) {
        const bounded = Math.max(-1, Math.min(1, sample));
        pcm[offset++] = bounded < 0 ? bounded * 0x8000 : bounded * 0x7fff;
      }
      if (waveformIndex < waveforms.length - 1) offset += gapSamples;
    });
    return wavBlob(pcm);
  }

  stopListening(): void {
    this.processor?.disconnect();
    if (this.processor) this.processor.onaudioprocess = null;
    this.source?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());
    this.processor = undefined;
    this.source = undefined;
    this.stream = undefined;
    this.options.onState?.('idle');
  }

  stopTransmission(): void {
    this.audio?.stop();
  }

  destroy(): void {
    this.stopListening();
    this.stopTransmission();
    this.transport.destroy();
    void this.audio?.close();
    this.audio = undefined;
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function wavBlob(pcm: Int16Array): Blob {
  const buffer = new ArrayBuffer(44 + pcm.byteLength);
  const view = new DataView(buffer);
  write(view, 0, 'RIFF');
  view.setUint32(4, 36 + pcm.byteLength, true);
  write(view, 8, 'WAVE');
  write(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(view, 36, 'data');
  view.setUint32(40, pcm.byteLength, true);
  new Uint8Array(buffer).set(new Uint8Array(pcm.buffer), 44);
  return new Blob([buffer], { type: 'audio/wav' });
}

function write(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
}
