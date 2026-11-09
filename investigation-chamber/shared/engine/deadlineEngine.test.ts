import { describe, it, expect } from 'vitest';
import {
  computeAppealDeadline,
  computeProsecutionReviewDeadline,
  computeInterceptionStatus,
} from './deadlineEngine';
import type { InterceptionRecord } from '../types';

describe('computeAppealDeadline — Art. 268 (3-day window)', () => {
  it('computes the due date exactly 3 days after notification', () => {
    const notification = new Date('2026-03-01T00:00:00Z');
    const now = new Date('2026-03-01T00:00:00Z');
    const deadline = computeAppealDeadline(notification, now);
    expect(deadline.dueDate.toISOString().slice(0, 10)).toBe('2026-03-04');
    expect(deadline.daysRemaining).toBe(3);
    expect(deadline.alertLevel).toBe('green');
  });

  it('flags overdue once the 3-day window has lapsed', () => {
    const notification = new Date('2026-03-01T00:00:00Z');
    const now = new Date('2026-03-06T00:00:00Z');
    const deadline = computeAppealDeadline(notification, now);
    expect(deadline.alertLevel).toBe('overdue');
    expect(deadline.daysRemaining).toBeLessThan(0);
  });

  it('turns red on the last day of the window', () => {
    const notification = new Date('2026-03-01T00:00:00Z');
    const now = new Date('2026-03-03T12:00:00Z');
    const deadline = computeAppealDeadline(notification, now);
    expect(deadline.alertLevel).toBe('red');
  });
});

describe('computeProsecutionReviewDeadline — Art. 258', () => {
  it('computes a 10-day review window', () => {
    const received = new Date('2026-01-01T00:00:00Z');
    const deadline = computeProsecutionReviewDeadline(received, new Date('2026-01-01T00:00:00Z'));
    expect(deadline.dueDate.toISOString().slice(0, 10)).toBe('2026-01-11');
    expect(deadline.articleReferences).toEqual(['258']);
  });
});

describe('computeInterceptionStatus — Arts. 114, 116', () => {
  const base: InterceptionRecord = {
    id: 'int-1',
    caseId: 'case-1',
    target: 'رقم هاتف مراقب',
    authorizedBy: 'judge-1',
    startDate: '2026-01-01T00:00:00Z',
    durationMonths: 4,
    articleReferences: ['114', '116'],
  };

  it('caps the authorized duration at 4 months even if a longer value is stored', () => {
    const record: InterceptionRecord = { ...base, durationMonths: 6 };
    const status = computeInterceptionStatus(record, new Date('2026-01-15T00:00:00Z'));
    expect(status.expirationDate.toISOString().slice(0, 10)).toBe('2026-05-01');
  });

  it('flags expiration once the 4-month window lapses', () => {
    const status = computeInterceptionStatus(base, new Date('2026-06-01T00:00:00Z'));
    expect(status.isExpired).toBe(true);
    expect(status.alertLevel).toBe('overdue');
  });
});
