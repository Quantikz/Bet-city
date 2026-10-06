import { describe, expect, it } from 'vitest';
import { followDistance, lookLead, type FollowParams } from './followCam';

const params: FollowParams = {
  distance: 10,
  height: 4,
  lookHeight: 1.5,
  stiffness: 5,
  speedPull: 0.2,
  slideSwing: 0.25,
  maxSwing: 2,
  pitch: 0.3,
  zoom: 0.8,
};

describe('follow camera math', () => {
  it('never pulls closer than half the configured distance', () => {
    expect(followDistance(params, 100)).toBe(5);
  });

  it('keeps forward lead tied to stiffness', () => {
    expect(lookLead(params, 10, 0).forward).toBe(2);
  });

  it('caps lateral swing', () => {
    expect(Math.abs(lookLead(params, 0, 100).lateral)).toBeLessThanOrEqual(18);
  });
});
