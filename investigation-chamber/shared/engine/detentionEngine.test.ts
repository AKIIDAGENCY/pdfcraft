import { describe, it, expect } from 'vitest';
import { computeDetentionStatus, evaluateRenewalEligibility } from './detentionEngine';
import type { DetentionEvent } from '../types';

const DEFENDANT = 'def-1';
const CASE = 'case-1';

function mkEvent(partial: Partial<DetentionEvent> & Pick<DetentionEvent, 'type' | 'startDate'>): DetentionEvent {
  return {
    id: `evt-${Math.random()}`,
    defendantId: DEFENDANT,
    caseId: CASE,
    orderedBy: 'judge-1',
    durationMonths: 4,
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

describe('computeDetentionStatus — Art. 204 base term', () => {
  it('reports green alert well before expiration', () => {
    const now = new Date('2026-01-15T00:00:00Z');
    const events = [mkEvent({ type: 'initial_order', startDate: '2026-01-01T00:00:00Z' })];
    const status = computeDetentionStatus(events, 'ordinary', {}, now);

    expect(status.isDetained).toBe(true);
    expect(status.cumulativeMonths).toBe(4);
    expect(status.alertLevel).toBe('green');
    expect(status.violations).toHaveLength(0);
    // 2026-01-01 + 4 months = 2026-05-01
    expect(status.currentExpirationDate?.toISOString().slice(0, 10)).toBe('2026-05-01');
  });

  it('turns orange within 30 days of expiration', () => {
    const now = new Date('2026-04-10T00:00:00Z'); // 21 days before 2026-05-01
    const events = [mkEvent({ type: 'initial_order', startDate: '2026-01-01T00:00:00Z' })];
    const status = computeDetentionStatus(events, 'ordinary', {}, now);
    expect(status.alertLevel).toBe('orange');
    expect(status.daysRemaining).toBe(21);
  });

  it('turns red within 7 days of expiration', () => {
    const now = new Date('2026-04-27T00:00:00Z'); // 4 days before 2026-05-01
    const events = [mkEvent({ type: 'initial_order', startDate: '2026-01-01T00:00:00Z' })];
    const status = computeDetentionStatus(events, 'ordinary', {}, now);
    expect(status.alertLevel).toBe('red');
  });

  it('flags overdue (arbitrary detention risk) once the term has lapsed with no renewal', () => {
    const now = new Date('2026-05-05T00:00:00Z'); // 4 days after expiration
    const events = [mkEvent({ type: 'initial_order', startDate: '2026-01-01T00:00:00Z' })];
    const status = computeDetentionStatus(events, 'ordinary', {}, now);
    expect(status.alertLevel).toBe('overdue');
    expect(status.daysRemaining).toBeLessThan(0);
  });
});

describe('computeDetentionStatus — Art. 204 judge renewals', () => {
  it('allows exactly 3 renewals (4 months each) for the aggravated tier (20y/life/death)', () => {
    const events: DetentionEvent[] = [
      mkEvent({ type: 'initial_order', startDate: '2026-01-01T00:00:00Z' }),
      mkEvent({ type: 'judge_renewal', startDate: '2026-05-01T00:00:00Z' }),
      mkEvent({ type: 'judge_renewal', startDate: '2026-09-01T00:00:00Z' }),
      mkEvent({ type: 'judge_renewal', startDate: '2027-01-01T00:00:00Z' }),
    ];
    const now = new Date('2027-02-01T00:00:00Z');
    const status = computeDetentionStatus(events, 'aggravated', {}, now);

    expect(status.judgeRenewalsUsed).toBe(3);
    expect(status.judgeRenewalsRemaining).toBe(0);
    expect(status.violations).toHaveLength(0);
    // 16 months cumulative at judge level
    expect(status.cumulativeMonths).toBe(16);
  });

  it('flags a violation if judge renewals exceed the aggravated-tier cap of 3', () => {
    const events: DetentionEvent[] = [
      mkEvent({ type: 'initial_order', startDate: '2026-01-01T00:00:00Z' }),
      mkEvent({ type: 'judge_renewal', startDate: '2026-05-01T00:00:00Z' }),
      mkEvent({ type: 'judge_renewal', startDate: '2026-09-01T00:00:00Z' }),
      mkEvent({ type: 'judge_renewal', startDate: '2027-01-01T00:00:00Z' }),
      mkEvent({ type: 'judge_renewal', startDate: '2027-05-01T00:00:00Z' }), // 4th — illegal
    ];
    const status = computeDetentionStatus(events, 'aggravated', {}, new Date('2027-06-01T00:00:00Z'));
    expect(status.violations.some((v) => v.includes('204'))).toBe(true);
  });

  it('caps ordinary-tier felonies at a single judge renewal', () => {
    const events: DetentionEvent[] = [
      mkEvent({ type: 'initial_order', startDate: '2026-01-01T00:00:00Z' }),
      mkEvent({ type: 'judge_renewal', startDate: '2026-05-01T00:00:00Z' }),
    ];
    const status = computeDetentionStatus(
      events,
      'ordinary',
      { chamberExtensionEligible: false },
      new Date('2026-06-01T00:00:00Z'),
    );
    expect(status.judgeRenewalsRemaining).toBe(0);

    const eligibility = evaluateRenewalEligibility(status);
    expect(eligibility.eligible).toBe(false);
    expect(eligibility.reason).toContain('الإفراج');
  });
});

describe('computeDetentionStatus — Arts. 204/205 Chamber of Accusation extensions', () => {
  it('routes to the Chamber of Accusation once judge renewals are exhausted', () => {
    const events: DetentionEvent[] = [
      mkEvent({ type: 'initial_order', startDate: '2026-01-01T00:00:00Z' }),
      mkEvent({ type: 'judge_renewal', startDate: '2026-05-01T00:00:00Z' }),
      mkEvent({ type: 'judge_renewal', startDate: '2026-09-01T00:00:00Z' }),
      mkEvent({ type: 'judge_renewal', startDate: '2027-01-01T00:00:00Z' }),
    ];
    const status = computeDetentionStatus(events, 'aggravated', {}, new Date('2027-04-01T00:00:00Z'));
    const eligibility = evaluateRenewalEligibility(status);
    expect(eligibility.nextEventType).toBe('chamber_extension');
  });

  it('allows up to 4 Chamber of Accusation extensions (transnational/terrorism) before requiring release', () => {
    const events: DetentionEvent[] = [
      mkEvent({ type: 'initial_order', startDate: '2026-01-01T00:00:00Z' }),
      mkEvent({ type: 'judge_renewal', startDate: '2026-05-01T00:00:00Z' }),
      mkEvent({ type: 'judge_renewal', startDate: '2026-09-01T00:00:00Z' }),
      mkEvent({ type: 'judge_renewal', startDate: '2027-01-01T00:00:00Z' }),
      mkEvent({ type: 'chamber_extension', startDate: '2027-05-01T00:00:00Z' }),
      mkEvent({ type: 'chamber_extension', startDate: '2027-09-01T00:00:00Z' }),
      mkEvent({ type: 'chamber_extension', startDate: '2028-01-01T00:00:00Z' }),
      mkEvent({ type: 'chamber_extension', startDate: '2028-05-01T00:00:00Z' }),
    ];
    const status = computeDetentionStatus(events, 'aggravated', {}, new Date('2028-06-01T00:00:00Z'));

    expect(status.chamberExtensionsUsed).toBe(4);
    expect(status.chamberExtensionsRemaining).toBe(0);
    expect(status.isAtMaximum).toBe(true);
    expect(status.violations).toHaveLength(0);
    // Full statutory ceiling: 16 (judge) + 16 (chamber) = 32 months
    expect(status.cumulativeMonths).toBe(32);

    const eligibility = evaluateRenewalEligibility(status);
    expect(eligibility.eligible).toBe(false);
    expect(eligibility.reason).toContain('الإفراج الفوري');
  });

  it('flags a violation if chamber extensions exceed the cap of 4', () => {
    const events: DetentionEvent[] = [
      mkEvent({ type: 'initial_order', startDate: '2026-01-01T00:00:00Z' }),
      mkEvent({ type: 'judge_renewal', startDate: '2026-05-01T00:00:00Z' }),
      mkEvent({ type: 'judge_renewal', startDate: '2026-09-01T00:00:00Z' }),
      mkEvent({ type: 'judge_renewal', startDate: '2027-01-01T00:00:00Z' }),
      mkEvent({ type: 'chamber_extension', startDate: '2027-05-01T00:00:00Z' }),
      mkEvent({ type: 'chamber_extension', startDate: '2027-09-01T00:00:00Z' }),
      mkEvent({ type: 'chamber_extension', startDate: '2028-01-01T00:00:00Z' }),
      mkEvent({ type: 'chamber_extension', startDate: '2028-05-01T00:00:00Z' }),
      mkEvent({ type: 'chamber_extension', startDate: '2028-09-01T00:00:00Z' }), // 5th — illegal
    ];
    const status = computeDetentionStatus(events, 'aggravated', {}, new Date('2028-10-01T00:00:00Z'));
    expect(status.violations.some((v) => v.includes('205'))).toBe(true);
  });
});

describe('computeDetentionStatus — release handling', () => {
  it('marks the defendant as not detained once a release event follows the last segment', () => {
    const events: DetentionEvent[] = [
      mkEvent({ type: 'initial_order', startDate: '2026-01-01T00:00:00Z' }),
      mkEvent({ type: 'release', startDate: '2026-03-01T00:00:00Z', durationMonths: 0 }),
    ];
    const status = computeDetentionStatus(events, 'ordinary', {}, new Date('2026-04-01T00:00:00Z'));
    expect(status.isDetained).toBe(false);
    expect(status.alertLevel).toBe('inactive');
    expect(status.currentSegment).toBeNull();
  });
});

describe('computeDetentionStatus — integrity checks', () => {
  it('flags a gap between two detention segments as a violation', () => {
    const events: DetentionEvent[] = [
      mkEvent({ type: 'initial_order', startDate: '2026-01-01T00:00:00Z' }),
      // renewal starts 10 days after the base term actually expired (2026-05-01)
      mkEvent({ type: 'judge_renewal', startDate: '2026-05-11T00:00:00Z' }),
    ];
    const status = computeDetentionStatus(events, 'aggravated', {}, new Date('2026-06-01T00:00:00Z'));
    expect(status.violations.length).toBeGreaterThan(0);
    expect(status.violations[0]).toContain('فجوة');
  });

  it('flags a timeline that does not start with an initial order', () => {
    const events: DetentionEvent[] = [
      mkEvent({ type: 'judge_renewal', startDate: '2026-01-01T00:00:00Z' }),
    ];
    const status = computeDetentionStatus(events, 'ordinary', {}, new Date('2026-02-01T00:00:00Z'));
    expect(status.violations.some((v) => v.includes('204'))).toBe(true);
  });
});

describe('evaluateRenewalEligibility', () => {
  it('returns not-eligible with no active segment', () => {
    const status = computeDetentionStatus([], 'ordinary', {}, new Date());
    const eligibility = evaluateRenewalEligibility(status);
    expect(eligibility.eligible).toBe(false);
    expect(eligibility.nextEventType).toBeNull();
  });
});
