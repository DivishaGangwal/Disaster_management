import { WAVE_PX_SAMPLE_RATE } from './transport';

export class WavePxAudioManager {
  readonly context = new AudioContext({ sampleRate: WAVE_PX_SAMPLE_RATE });
  private source?: AudioBufferSourceNode;

  async ready(): Promise<void> {
    if (this.context.state === 'suspended') await this.context.resume();
  }

  async play(waveform: Uint8Array): Promise<void> {
    await this.ready();
    const samples = new Float32Array(waveform.slice().buffer);
    const buffer = this.context.createBuffer(1, samples.length, WAVE_PX_SAMPLE_RATE);
    buffer.copyToChannel(samples, 0);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.context.destination);
    this.source = source;
    await new Promise<void>((resolve) => {
      source.onended = () => { this.source = undefined; resolve(); };
      source.start();
    });
  }

  stop(): void {
    try { this.source?.stop(); } catch { /* already ended */ }
    this.source = undefined;
  }

  async close(): Promise<void> {
    this.stop();
    await this.context.close();
  }
}
