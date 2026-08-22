import createGgWave from 'ggwave';

export const WAVE_PX_SAMPLE_RATE = 48_000;

export type WavePxProfile = 'audible-fast' | 'audible-normal' | 'ultrasound-normal';

/** Low-level WavePX-compatible transport kept separate from our frozen Tier 2 framing. */
export class WavePxTransport {
  private module: any;
  private instance: any;

  async init(): Promise<void> {
    if (this.instance != null) return;
    this.module = await createGgWave();
    const parameters = this.module.getDefaultParameters();
    parameters.sampleRateInp = WAVE_PX_SAMPLE_RATE;
    parameters.sampleRateOut = WAVE_PX_SAMPLE_RATE;
    this.instance = this.module.init(parameters);
    if (this.instance == null) throw new Error('WavePX acoustic transport could not initialize');
  }

  encode(payload: Uint8Array, profile: WavePxProfile): Uint8Array {
    if (payload.length > 140) throw new Error(`Tier 2 frame exceeds WavePX/ggwave's 140-byte limit (${payload.length})`);
    const protocolName = {
      'audible-normal': 'GGWAVE_PROTOCOL_AUDIBLE_NORMAL',
      'audible-fast': 'GGWAVE_PROTOCOL_AUDIBLE_FAST',
      'ultrasound-normal': 'GGWAVE_PROTOCOL_ULTRASOUND_NORMAL',
    }[profile];
    const protocol = this.module.ProtocolId?.[protocolName] ?? 0;
    return new Uint8Array(this.module.encode(this.instance, payload, protocol, 55));
  }

  decode(samples: Float32Array): Uint8Array | undefined {
    const bytes = new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength);
    const decoded = this.module.decode(this.instance, bytes);
    return decoded?.length ? new Uint8Array(decoded) : undefined;
  }

  destroy(): void {
    if (this.instance != null && this.module) this.module.free(this.instance);
    this.instance = undefined;
  }
}
