import {
  APPEAL_WINDOW_DAYS,
  PROSECUTION_REVIEW_WINDOW_DAYS,
  INTERCEPTION,
} from '../legal/articles';
import { addMonths, normalizeZero } from './mathUtils';
import type { DetentionAlertLevel, InterceptionRecord } from '../types';

function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + days);
  return result;
}

export interface StatutoryDeadline {
  label: string;
  articleReferences: string[];
  dueDate: Date;
  daysRemaining: number;
  alertLevel: DetentionAlertLevel;
}

function alertFromDays(daysRemaining: number): DetentionAlertLevel {
  if (daysRemaining < 0) return 'overdue';
  if (daysRemaining <= 1) return 'red';
  if (daysRemaining <= 2) return 'orange';
  return 'green';
}

/** Art. 268 — 3-day appeal window for the defendant / civil party, from the notification date. */
export function computeAppealDeadline(notificationDate: Date, now: Date = new Date()): StatutoryDeadline {
  const dueDate = addDays(notificationDate, APPEAL_WINDOW_DAYS);
  const daysRemaining = normalizeZero(Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  return {
    label: 'أجل الاستئناف',
    articleReferences: ['268'],
    dueDate,
    daysRemaining,
    alertLevel: alertFromDays(daysRemaining),
  };
}

/** Art. 258 — prosecution file-review window once the investigation is closed. */
export function computeProsecutionReviewDeadline(
  fileReceivedDate: Date,
  now: Date = new Date(),
): StatutoryDeadline {
  const dueDate = addDays(fileReceivedDate, PROSECUTION_REVIEW_WINDOW_DAYS);
  const daysRemaining = normalizeZero(Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  return {
    label: 'أجل مراجعة النيابة العامة',
    articleReferences: ['258'],
    dueDate,
    daysRemaining,
    alertLevel: alertFromDays(daysRemaining),
  };
}

export interface InterceptionStatus {
  record: InterceptionRecord;
  expirationDate: Date;
  daysRemaining: number;
  alertLevel: DetentionAlertLevel;
  isExpired: boolean;
}

/** Arts. 114, 116 — wiretap/interception authorization, max 4 months, renewable. */
export function computeInterceptionStatus(
  record: InterceptionRecord,
  now: Date = new Date(),
): InterceptionStatus {
  const cappedDuration = Math.min(record.durationMonths, INTERCEPTION.MAX_DURATION_MONTHS);
  const expirationDate = addMonths(new Date(record.startDate), cappedDuration);
  const daysRemaining = normalizeZero(Math.ceil((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  return {
    record,
    expirationDate,
    daysRemaining,
    alertLevel: alertFromDays(daysRemaining),
    isExpired: daysRemaining < 0,
  };
}
