import {
  DETENTION,
  DETENTION_ALERT_THRESHOLDS_DAYS,
} from '../legal/articles';
import { normalizeZero } from './mathUtils';
import type { CrimeSeverityTier, DetentionAlertLevel, DetentionEvent } from '../types';

export interface DetentionTimelineSegment {
  event: DetentionEvent;
  /** Inclusive start of this segment. */
  startDate: Date;
  /** Exclusive end (expiration instant) of this segment. */
  endDate: Date;
  order: number; // 0 = initial order, 1..3 = judge renewals, 4..7 = chamber extensions
}

export interface DetentionStatus {
  defendantId: string;
  /** Whether the defendant is currently under an active detention term. */
  isDetained: boolean;
  timeline: DetentionTimelineSegment[];
  /** The currently active (or most recent) segment. */
  currentSegment: DetentionTimelineSegment | null;
  /** Cumulative months elapsed across all segments. */
  cumulativeMonths: number;
  /** Days remaining until the current segment's expiration (negative if overdue). */
  daysRemaining: number | null;
  currentExpirationDate: Date | null;
  alertLevel: DetentionAlertLevel;
  /** How many judge-level renewals have been used (excludes the initial order). */
  judgeRenewalsUsed: number;
  /** How many Chamber of Accusation extensions have been used. */
  chamberExtensionsUsed: number;
  /** Further judge renewals still legally available. */
  judgeRenewalsRemaining: number;
  /** Further Chamber of Accusation extensions still legally available. */
  chamberExtensionsRemaining: number;
  /** True if a requested renewal/extension would exceed the statutory cap. */
  isAtMaximum: boolean;
  /** Populated when the timeline itself violates Arts. 204/205 (should never happen with a compliant UI, but the engine must never silently accept it). */
  violations: string[];
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const targetMonth = result.getMonth() + months;
  result.setMonth(targetMonth);
  return result;
}

function maxJudgeRenewals(tier: CrimeSeverityTier): number {
  return tier === 'aggravated'
    ? DETENTION.MAX_JUDGE_RENEWALS_AGGRAVATED
    : DETENTION.MAX_JUDGE_RENEWALS_ORDINARY;
}

export interface DetentionStatusOptions {
  /**
   * Whether the case qualifies the Chamber of Accusation to grant further
   * extensions at all — reserved by Art. 205 for transnational-crime /
   * terrorism files that require forensic examination or cross-border
   * inquiries. Defaults to true, since this system exclusively serves the
   * specialized pole's own jurisdiction (Arts. 343-348); pass false for a
   * joined ordinary-felony defendant whose charge does not itself qualify.
   */
  chamberExtensionEligible?: boolean;
}

/**
 * Builds the chronological detention timeline for one defendant from their
 * raw detention events, and computes the legal status (Arts. 204, 205, 294).
 *
 * Rules encoded:
 *  - Art. 204: base term is 4 months, ordered by the investigating judge.
 *  - Art. 204: the investigating judge may renew up to 3 times (4 months
 *    each) only for crimes punishable by 20+ years, life imprisonment, or
 *    death ("aggravated" tier); otherwise a single renewal.
 *  - Arts. 204/205: once judge-level renewals are exhausted, the Chamber of
 *    Accusation may grant up to 4 further 4-month extensions, but only for
 *    transnational/terrorism files requiring forensic examination or
 *    cross-border inquiries (`chamberExtensionEligible`).
 *  - A gap between segments, or a segment that starts before the previous
 *    one expires, or exceeding either cap, is recorded as a `violation` so
 *    the UI can surface it instead of silently miscalculating a deadline —
 *    an incorrect "still legal" reading here risks arbitrary detention.
 */
export function computeDetentionStatus(
  events: DetentionEvent[],
  severityTier: CrimeSeverityTier,
  options: DetentionStatusOptions = {},
  now: Date = new Date(),
): DetentionStatus {
  const chamberExtensionEligible = options.chamberExtensionEligible ?? true;
  const defendantId = events[0]?.defendantId ?? '';
  const violations: string[] = [];

  const ordered = [...events]
    .filter((e) => e.type !== 'release')
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  const releaseEvent = events.find((e) => e.type === 'release');

  const timeline: DetentionTimelineSegment[] = [];
  let judgeRenewalsUsed = 0;
  let chamberExtensionsUsed = 0;

  ordered.forEach((event, index) => {
    const startDate = new Date(event.startDate);
    const endDate = addMonths(startDate, event.durationMonths);

    if (index === 0 && event.type !== 'initial_order') {
      violations.push('السجل الزمني للحبس المؤقت لا يبدأ بأمر إيداع أولي (مخالفة للمادة 204).');
    }
    if (index > 0) {
      const previous = timeline[index - 1];
      if (startDate.getTime() > previous.endDate.getTime()) {
        violations.push(
          `فجوة زمنية غير مبررة بين انتهاء المدة السابقة (${previous.endDate.toISOString().slice(0, 10)}) وبداية المدة الجديدة (${startDate.toISOString().slice(0, 10)}) — يجب صدور أمر بالإفراج أو استمرار الحبس دون انقطاع.`,
        );
      }
      if (startDate.getTime() < previous.startDate.getTime()) {
        violations.push('ترتيب زمني غير صحيح لأوامر التمديد.');
      }
    }

    if (event.type === 'judge_renewal') {
      judgeRenewalsUsed += 1;
    } else if (event.type === 'chamber_extension') {
      chamberExtensionsUsed += 1;
    }

    timeline.push({ event, startDate, endDate, order: index });
  });

  const maxJudge = maxJudgeRenewals(severityTier);
  const maxChamber = chamberExtensionEligible ? DETENTION.MAX_CHAMBER_EXTENSIONS : 0;

  if (judgeRenewalsUsed > maxJudge) {
    violations.push(
      `عدد تمديدات قاضي التحقيق (${judgeRenewalsUsed}) يتجاوز الحد الأقصى القانوني (${maxJudge}) وفق المادة 204.`,
    );
  }
  if (chamberExtensionsUsed > maxChamber) {
    violations.push(
      `عدد تمديدات غرفة الاتهام (${chamberExtensionsUsed}) يتجاوز الحد الأقصى القانوني (${maxChamber}) وفق المادتين 204 و205.`,
    );
  }

  const cumulativeMonths = timeline.reduce((sum, s) => sum + s.event.durationMonths, 0);

  const lastSegment = timeline.length > 0 ? timeline[timeline.length - 1] : null;

  const isReleased =
    releaseEvent !== undefined &&
    lastSegment !== null &&
    new Date(releaseEvent.startDate).getTime() >= lastSegment.startDate.getTime();

  const isDetained = lastSegment !== null && !isReleased && now.getTime() < lastSegment.endDate.getTime();

  const currentSegment = isReleased ? null : lastSegment;

  const currentExpirationDate = currentSegment ? currentSegment.endDate : null;

  const daysRemaining = currentExpirationDate
    ? normalizeZero(Math.ceil((currentExpirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  const judgeRenewalsRemaining = Math.max(0, maxJudge - judgeRenewalsUsed);
  const chamberExtensionsRemaining = Math.max(0, maxChamber - chamberExtensionsUsed);
  const isAtMaximum = judgeRenewalsRemaining === 0 && chamberExtensionsRemaining === 0;

  let alertLevel: DetentionAlertLevel = 'inactive';
  if (isReleased || currentSegment === null) {
    alertLevel = 'inactive';
  } else if (daysRemaining !== null && daysRemaining < 0) {
    alertLevel = 'overdue';
  } else if (daysRemaining !== null && daysRemaining <= DETENTION_ALERT_THRESHOLDS_DAYS.ORANGE_MIN) {
    alertLevel = 'red';
  } else if (daysRemaining !== null && daysRemaining <= DETENTION_ALERT_THRESHOLDS_DAYS.GREEN_MIN) {
    alertLevel = 'orange';
  } else {
    alertLevel = 'green';
  }

  return {
    defendantId,
    isDetained,
    timeline,
    currentSegment,
    cumulativeMonths,
    daysRemaining,
    currentExpirationDate,
    alertLevel,
    judgeRenewalsUsed,
    chamberExtensionsUsed,
    judgeRenewalsRemaining,
    chamberExtensionsRemaining,
    isAtMaximum,
    violations,
  };
}

export interface RenewalEligibility {
  eligible: boolean;
  nextEventType: 'judge_renewal' | 'chamber_extension' | null;
  reason: string;
}

/**
 * Determines whether a new renewal/extension may be requested right now,
 * and which body has jurisdiction over it (investigating judge vs.
 * Chamber of Accusation) per Arts. 204/205.
 */
export function evaluateRenewalEligibility(status: DetentionStatus): RenewalEligibility {
  if (!status.currentSegment) {
    return { eligible: false, nextEventType: null, reason: 'لا يوجد أمر حبس ساري المفعول لهذا المتهم.' };
  }
  if (status.judgeRenewalsRemaining > 0) {
    return {
      eligible: true,
      nextEventType: 'judge_renewal',
      reason: `يجوز لقاضي التحقيق تمديد الحبس المؤقت (${status.judgeRenewalsRemaining} تمديد/تمديدات متبقية).`,
    };
  }
  if (status.chamberExtensionsRemaining > 0) {
    return {
      eligible: true,
      nextEventType: 'chamber_extension',
      reason: `استنفدت تمديدات قاضي التحقيق؛ يجب رفع طلب التمديد إلى غرفة الاتهام (${status.chamberExtensionsRemaining} تمديد/تمديدات متبقية).`,
    };
  }
  return {
    eligible: false,
    nextEventType: null,
    reason: 'استنفدت جميع تمديدات الحبس المؤقت القانونية؛ يجب الإفراج الفوري عن المتهم تفاديا للحبس التعسفي (المواد 83، 197، 204).',
  };
}
