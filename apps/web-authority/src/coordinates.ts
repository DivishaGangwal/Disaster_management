const E7 = 1e7;

export function e7ToFloat(value: number): number {
  return value / E7;
}

export function floatToE7(value: number): number {
  return Math.round(value * E7);
}
