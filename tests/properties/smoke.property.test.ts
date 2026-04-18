import { describe, expect } from 'vitest';
import { test } from '@fast-check/vitest';
import fc from 'fast-check';
import {
  validEmailArb,
  displayNameArb,
  validPasswordArb,
  invalidPasswordArb,
  usStateCodeArb,
  coordinatesArb,
  trainingStyleArb,
  skillLevelArb,
  beltRankArb,
  US_STATE_CODES,
} from '../helpers/arbitraries';

describe('Smoke property tests', () => {
  test.prop([fc.integer()])('integers add commutatively', (n) => {
    expect(n + 1).toBe(1 + n);
  });

  test.prop([validEmailArb])('valid emails contain @', (email) => {
    expect(email).toContain('@');
    expect(email.indexOf('@')).toBeGreaterThan(0);
  });

  test.prop([displayNameArb])('display names are non-empty', (name) => {
    expect(name.trim().length).toBeGreaterThan(0);
  });

  test.prop([validPasswordArb])('valid passwords have >= 8 chars', (pw) => {
    expect(pw.length).toBeGreaterThanOrEqual(8);
  });

  test.prop([invalidPasswordArb])('invalid passwords have < 8 chars', (pw) => {
    expect(pw.length).toBeLessThan(8);
  });

  test.prop([usStateCodeArb])('US state codes are in the valid set', (state) => {
    expect((US_STATE_CODES as readonly string[]).includes(state)).toBe(true);
  });

  test.prop([coordinatesArb])('coordinates are within valid ranges', ([lat, lng]) => {
    expect(lat).toBeGreaterThanOrEqual(-90);
    expect(lat).toBeLessThanOrEqual(90);
    expect(lng).toBeGreaterThanOrEqual(-180);
    expect(lng).toBeLessThanOrEqual(180);
  });

  test.prop([trainingStyleArb])('training styles are valid', (style) => {
    expect(['gi', 'no-gi', 'both', 'wrestling', 'judo']).toContain(style);
  });

  test.prop([skillLevelArb])('skill levels are valid', (level) => {
    expect(['beginner', 'intermediate', 'advanced', 'all-levels']).toContain(level);
  });

  test.prop([beltRankArb])('belt ranks are valid', (rank) => {
    expect(['white', 'blue', 'purple', 'brown', 'black']).toContain(rank);
  });
});
