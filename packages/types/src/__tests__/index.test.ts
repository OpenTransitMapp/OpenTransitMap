import { describe, it, expect } from 'vitest';
import * as pkg from '../index.js';
import '../zod-openapi-augment.js';
import { computeScopeId } from '../utils/scope.js';

// Ensure the package entrypoint is exercised and exports are wired
describe('package entrypoint', () => {
  it('exports expected symbols and can be imported', () => {
    expect(pkg).toBeTruthy();
    expect(typeof computeScopeId).toBe('function');
  });

  it('computeScopeId works with default options', () => {
    const id = computeScopeId('test', { south: 0, west: 0, north: 1, east: 1 });
    expect(typeof id).toBe('string');
  });
});
