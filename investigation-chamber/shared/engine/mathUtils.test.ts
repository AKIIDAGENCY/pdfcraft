import { describe, it, expect } from 'vitest';
import { addMonths, normalizeZero } from './mathUtils';

describe('normalizeZero', () => {
  it('turns -0 into 0', () => {
    expect(Object.is(normalizeZero(Math.ceil(-0.3)), -0)).toBe(false);
    expect(normalizeZero(Math.ceil(-0.3))).toBe(0);
  });

  it('leaves other values untouched', () => {
    expect(normalizeZero(5)).toBe(5);
    expect(normalizeZero(-5)).toBe(-5);
  });
});

describe('addMonths', () => {
  it('adds a simple month with no clamping needed', () => {
    const result = addMonths(new Date('2026-01-15T00:00:00Z'), 1);
    expect(result.toISOString().slice(0, 10)).toBe('2026-02-15');
  });

  it('clamps Jan 31 + 1 month to Feb 28 (non-leap year)', () => {
    const result = addMonths(new Date('2027-01-31T00:00:00Z'), 1);
    expect(result.toISOString().slice(0, 10)).toBe('2027-02-28');
  });

  it('clamps Jan 31 + 1 month to Feb 29 in a leap year', () => {
    const result = addMonths(new Date('2028-01-31T00:00:00Z'), 1);
    expect(result.toISOString().slice(0, 10)).toBe('2028-02-29');
  });

  it('clamps May 31 + 4 months to Sep 30', () => {
    const result = addMonths(new Date('2026-05-31T00:00:00Z'), 4);
    expect(result.toISOString().slice(0, 10)).toBe('2026-09-30');
  });

  it('handles negative months (going backwards) with clamping', () => {
    const result = addMonths(new Date('2026-03-31T00:00:00Z'), -1);
    expect(result.toISOString().slice(0, 10)).toBe('2026-02-28');
  });

  it('does not mutate the input date', () => {
    const input = new Date('2026-01-31T00:00:00Z');
    addMonths(input, 1);
    expect(input.toISOString().slice(0, 10)).toBe('2026-01-31');
  });
});
