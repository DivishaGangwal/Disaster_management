/** LEB128 unsigned varints. Small numbers cost one byte -- the sizing rule. */

export class ByteWriter {
  private buf: Uint8Array;
  private len = 0;

  constructor(initial = 128) {
    this.buf = new Uint8Array(initial);
  }

  private ensure(extra: number): void {
    if (this.len + extra <= this.buf.length) return;
    let next = this.buf.length * 2;
    while (next < this.len + extra) next *= 2;
    const grown = new Uint8Array(next);
    grown.set(this.buf.subarray(0, this.len));
    this.buf = grown;
  }

  u8(value: number): void {
    this.ensure(1);
    this.buf[this.len++] = value & 0xff;
  }

  bytes(value: Uint8Array): void {
    this.ensure(value.length);
    this.buf.set(value, this.len);
    this.len += value.length;
  }

  uvarint(value: number): void {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`uvarint requires a non-negative integer, got ${value}`);
    }
    let v = value;
    while (v >= 0x80) {
      this.u8((v & 0x7f) | 0x80);
      v = Math.floor(v / 128);
    }
    this.u8(v);
  }

  get length(): number {
    return this.len;
  }

  toUint8Array(): Uint8Array {
    return this.buf.slice(0, this.len);
  }
}

export class ByteReader {
  private pos = 0;

  constructor(private readonly buf: Uint8Array) {}

  get offset(): number {
    return this.pos;
  }

  get remaining(): number {
    return this.buf.length - this.pos;
  }

  get exhausted(): boolean {
    return this.pos >= this.buf.length;
  }

  u8(): number {
    if (this.pos >= this.buf.length) throw new RangeError('read past end of buffer');
    return this.buf[this.pos++]!;
  }

  /** Bounded read: `limit` is checked BEFORE allocation (INT-001). */
  bytes(length: number, limit: number): Uint8Array {
    if (length < 0 || length > limit) throw new RangeError(`declared length ${length} exceeds limit ${limit}`);
    if (this.pos + length > this.buf.length) throw new RangeError('read past end of buffer');
    const out = this.buf.slice(this.pos, this.pos + length);
    this.pos += length;
    return out;
  }

  uvarint(): number {
    let result = 0;
    let shift = 1;
    for (let i = 0; i < 8; i += 1) {
      const byte = this.u8();
      result += (byte & 0x7f) * shift;
      if ((byte & 0x80) === 0) return result;
      shift *= 128;
    }
    throw new RangeError('uvarint too long');
  }
}
