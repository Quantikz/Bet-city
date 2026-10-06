import { describe, expect, it } from 'vitest';
import { DEFAULT_OPTIONS, sanitize } from './options';

describe('game options', () => {
  it('uses defaults for invalid input', () => {
    expect(sanitize(null)).toEqual(DEFAULT_OPTIONS);
    expect(sanitize({ cameraView: 'invalid', cameraZoom: 99 }).cameraView).toBe('normal');
    expect(sanitize({ cameraView: 'invalid', cameraZoom: 99 }).cameraZoom).toBe(1.6);
  });

  it('clamps camera zoom', () => {
    expect(sanitize({ cameraZoom: 0 }).cameraZoom).toBe(0.65);
    expect(sanitize({ cameraZoom: 2 }).cameraZoom).toBe(1.6);
  });
});
