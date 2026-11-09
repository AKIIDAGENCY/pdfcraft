/**
 * Statutory reference constants — Algerian Code of Criminal Procedure,
 * Law No. 25-14 of 9 Safar 1447 (3 August 2025), "يتضمن قانون الإجراءات
 * الجزائية" (Official Gazette No. 54).
 *
 * Every figure below is transcribed directly from that text (not from the
 * earlier Ordinance 66-155, and not from assumption) — see the
 * "Notes on scope and judgment calls" section of the README for what still
 * needs a qualified lawyer's confirmation before real use.
 *
 * Centralizing the raw figures here means the engine and the UI both cite
 * the same numbers, and a legal-text amendment only has to change one file.
 */

export const LAW_REFERENCE = 'القانون رقم 25-14 المتضمن قانون الإجراءات الجزائية';

/** Art. 204 — pre-trial detention (الحبس المؤقت) in felony matters. */
export const DETENTION = {
  /** Base term ordered by the investigating judge, in months. */
  BASE_TERM_MONTHS: 4,
  /** Length of each renewal/extension increment, in months. */
  INCREMENT_MONTHS: 4,
  /**
   * Max renewals the investigating judge alone may order (Art. 204 para 2),
   * reserved for felonies punishable by 20+ years, life imprisonment, or death.
   */
  MAX_JUDGE_RENEWALS_AGGRAVATED: 3,
  /**
   * Max renewals the investigating judge may order for other felonies
   * (Art. 204 para 1: "يجوز لقاضي التحقيق... أن يصدر أمرا مسببا بتمديد
   * الحبس المؤقت للمتهم مرتين (2)").
   */
  MAX_JUDGE_RENEWALS_ORDINARY: 2,
  /**
   * Max further extensions grantable by the Chamber of Accusation (غرفة
   * الاتهام), 4 months each: "يجوز لغرفة الاتهام تمديد الحبس المؤقت لمدة
   * أربعة (4) أشهر قابلة للتجديد أربع (4) مرات". Art. 204 grants this to
   * ANY felony-matter case once judge-level renewals are exhausted and the
   * max period is about to lapse — it is not limited to transnational or
   * terrorism files. Art. 205 is a separate, additional avenue for a listed
   * set of complex-crime categories (drugs, cross-border organized crime,
   * ICT crimes, money laundering, terrorism, state security, corruption,
   * smuggling, human/organ trafficking, kidnapping) specifically when
   * expert examination or extraterritorial evidence-gathering is needed —
   * it does not narrow Art. 204's own general grant.
   */
  MAX_CHAMBER_EXTENSIONS: 4,
  articles: ['204', '205', '294'] as const,
} as const;

/** Alert thresholds for the detention countdown (Arts. 83, 197, 204). */
export const DETENTION_ALERT_THRESHOLDS_DAYS = {
  /** > this many days remaining → green. */
  GREEN_MIN: 30,
  /** > this many days remaining (and <= GREEN_MIN) → orange. Below → red. */
  ORANGE_MIN: 7,
} as const;

/** Art. 268 — appeal window for the defendant / civil party, in days. */
export const APPEAL_WINDOW_DAYS = 3;

/**
 * Art. 258 — once the investigating judge considers the investigation
 * closed and sends the file to the prosecutor, the prosecutor must submit
 * final requests within this many days ("وعلى وكيل الجمهورية تقديم طلباته
 * إليه خلال عشرة (10) أيام، على الأكثر"). Art. 143 is a different,
 * unrelated provision (a 5-day judge-response window for an investigative
 * act the prosecutor requests mid-investigation) and was wrongly cited
 * alongside this figure before.
 */
export const PROSECUTION_REVIEW_WINDOW_DAYS = 10;

/** Arts. 114, 116 — wiretap/interception authorization, in months. */
export const INTERCEPTION = {
  MAX_DURATION_MONTHS: 4,
  articles: ['114', '116'] as const,
};

/** Art. 198 — the ten statutory judicial-control measures (الرقابة القضائية). */
export const JUDICIAL_CONTROL_MEASURES = [
  { code: 'JC01', labelAr: 'عدم مغادرة الحدود الإقليمية المحددة' },
  { code: 'JC02', labelAr: 'عدم الابتعاد عن مكان الإقامة إلا بالشروط التي يحددها القاضي' },
  { code: 'JC03', labelAr: 'عدم التردد على أماكن معينة يحددها القاضي' },
  { code: 'JC04', labelAr: 'التقديم الدوري أمام مصالح أو سلطات معينة' },
  { code: 'JC05', labelAr: 'تسليم جميع الوثائق الثبوتية وبصفة خاصة جواز السفر' },
  { code: 'JC06', labelAr: 'المنع من قيادة جميع المركبات أو بعضها' },
  { code: 'JC07', labelAr: 'الخضوع لتدبير المراقبة الإلكترونية (السوار الإلكتروني)' },
  { code: 'JC08', labelAr: 'الإقامة في مكان محدد (الإقامة تحت الحراسة)' },
  { code: 'JC09', labelAr: 'عدم ممارسة نشاط مهني أو اجتماعي له صلة بالجريمة' },
  { code: 'JC10', labelAr: 'إيداع كفالة مالية يحدد مبلغها وكيفيات دفعها القاضي' },
] as const;

/** Art. 141 — case-file indexing requirement (ترقيم وترتيب أوراق الملف). */
export const CASE_FILE_INDEXING_ARTICLE = '141';

/** Art. 145 — multi-judge chamber coordination (قاضي تحقيق ملحق). */
export const MULTI_JUDGE_ARTICLE = '145';

/** Art. 193 — arrest warrant for a defendant in hiding / wanted (أمر بالقبض). */
export const ARREST_WARRANT_ARTICLE = '193';

/** Art. 183 — summary interrogation (استجواب إجمالي) for mass-defendant files. */
export const SUMMARY_INTERROGATION_ARTICLE = '183';

/** Art. 264 — notification tracking for detention renewal orders. */
export const RENEWAL_NOTIFICATION_ARTICLE = '264';

/** Arts. 120-126 — infiltration (التسرب) authorizations and extensions. */
export const INFILTRATION_ARTICLES = ['120', '121', '122', '123', '124', '125', '126'] as const;

/** Arts. 50-52, 71 — seizure and freezing of proceeds/assets. */
export const SEIZURE_ARTICLES = ['50', '51', '52', '71'] as const;

/** Arts. 128-138 — witness & informant protection. */
export const WITNESS_PROTECTION_ARTICLES = ['128', '132', '133', '138'] as const;

/**
 * Arts. 343-348 — jurisdiction of the National Specialized Criminal Pole
 * for Counter-Terrorism/Transnational Organized Crime, one specific
 * investigating-judge institution among others (seated only at the Algiers
 * judicial council), not this app's assumed default. Referenced only where
 * a case is actually flagged transnational (Case.isTransnational).
 */
export const JURISDICTION_ARTICLES = ['343', '345', '346', '348'] as const;

/** Art. 100 — legal-entity / shell-company criminal liability. */
export const LEGAL_ENTITY_ARTICLE = '100';
