import { describe, it, expect } from 'vitest';
import { quantizeBBox } from '../utils/scope.js';

describe('quantizeBBox error conditions', () => {
  it('throws when north < south after quantization (or input invalid)', () => {
    expect(() => quantizeBBox({ south: 1, west: 0, north: 0, east: 1 }, 1e-6)).toThrow(/north < south/);
  });

  it('throws when east < west after quantization (or input invalid)', () => {
    expect(() => quantizeBBox({ south: 0, west: 1, north: 1, east: 0 }, 1e-6)).toThrow(/east < west/);
  });
});

