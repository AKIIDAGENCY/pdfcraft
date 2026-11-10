namespace InvestigationRoom.Core.Legal;

/// <summary>
/// Every numeric/legal threshold the Detention &amp; Deadline Engine relies
/// on, collected in ONE place: Algerian Law No. 25-14 of 9 Safar 1447
/// corresponding to 3 August 2025 (قانون الإجراءات الجزائية), as published
/// in Journal Officiel No. 54 of 13 August 2025 (19 Safar 1447).
///
/// ============================== READ THIS ==============================
/// The values below were checked directly against the official Journal
/// Officiel text (a scanned copy of JORADP issue No. 54) rather than taken
/// on description alone — article numbers and the figures in parentheses
/// (مدة، عدد المرات...) are cited next to each constant. That is a real
/// improvement over "supplied by the client, unverified," but it is still
/// NOT a substitute for review by a qualified Algerian criminal-procedure
/// lawyer before this software supports a real detention decision:
/// 1) the transcription was done by reading a scanned page image, which
///    carries real risk of a misread digit or word on dense legal
///    Arabic text, especially in adjacent, textually similar paragraphs
///    (Arts. 204 and 205 in particular — see their notes below);
/// 2) the law may be amended after this copy was issued; and
/// 3) a few points (noted below) could not be resolved with confidence
///    from the text alone and need a lawyer's reading, not a guess.
/// Getting a detention deadline wrong is not a cosmetic bug — it can mean
/// an unlawfully extended detention or a wrongful release.
/// =========================================================================
/// </summary>
public static class LegalRules
{
    /// <summary>Base pre-trial detention term for a felony (Art. 204, para. 1): "أربعة (4) أشهر".</summary>
    public static readonly TimeSpan FelonyBaseDetentionTerm = TimeSpan.FromDays(4 * 30);

    /// <summary>Each renewal/extension step — judge or Chamber of Accusation — is this long (Art. 204: "لا يمكن أن يتجاوز أربعة (4) أشهر في كل مرة").</summary>
    public static readonly TimeSpan RenewalStepLength = TimeSpan.FromDays(4 * 30);

    /// <summary>
    /// Investigating-judge renewals for an ORDINARY felony (Art. 204,
    /// para. 1: "لمدتين (2) مرتين في كل مرة") — available for any felony,
    /// not gated by a severity flag; only the count below changes for
    /// aggravated charges.
    /// </summary>
    public const int MaxJudgeRenewalsOrdinary = 2;

    /// <summary>
    /// Investigating-judge renewals when the charge is punishable by 20+
    /// years' imprisonment, life imprisonment, or death (Art. 204, para.
    /// 2: "ثلاث (3) مرات") — this REPLACES, not adds to, the ordinary cap.
    /// </summary>
    public const int MaxJudgeRenewalsAggravated = 3;

    /// <summary>
    /// Further 4-month extensions the Chamber of Accusation (غرفة
    /// الاتهام) may grant for any felony, requested by the investigating
    /// judge (Art. 204: "تمديد الحبس المؤقت لمدة أربعة (4) أشهر قابلة
    /// للتجديد أربع (4) مرات"). Art. 205 appears to extend comparable
    /// Chamber-of-Accusation treatment to a specific list of serious
    /// crime types (drugs, transnational organized crime, ICT crimes,
    /// money laundering, terrorism, state-security, corruption, human/
    /// organ trafficking, migrant smuggling...) and to cases needing
    /// evidence-gathering abroad — its precise relationship to Art. 204's
    /// grant (additional vs. restating) was NOT fully resolved from the
    /// scanned text and needs a lawyer's confirmation. This engine
    /// currently applies the Art. 204 felony-wide grant (4 extensions)
    /// unconditionally once judge renewals are exhausted, which is the
    /// more conservative (not more permissive) reading.
    /// </summary>
    public const int MaxChamberOfAccusationExtensions = 4;

    /// <summary>Maximum possible total detention for an AGGRAVATED felony under the chain above (for display/sanity-check only).</summary>
    public static TimeSpan MaximumTotalDetention =>
        FelonyBaseDetentionTerm
        + TimeSpan.FromTicks(RenewalStepLength.Ticks * MaxJudgeRenewalsAggravated)
        + TimeSpan.FromTicks(RenewalStepLength.Ticks * MaxChamberOfAccusationExtensions);

    /// <summary>
    /// NOT currently enforced by DetentionEngine — a separate, additional
    /// safeguard found in Art. 294: once a detained defendant's case is
    /// referred to the Chamber of Accusation, it must rule within a
    /// maximum of 2 months (felonies under 20 years), 4 months (20+
    /// years/life/death), or 8 months (terrorism, sabotage, or other
    /// state-security crimes tied to cross-border organized crime) of
    /// referral, or release is automatic ("وجب الإفراج عن المتهم
    /// تلقائيا"). This is independent of the renewal counters above and
    /// is a documented gap: a future revision of DetentionEngine should
    /// track the Chamber-of-Accusation referral date and apply this
    /// backstop too.
    /// </summary>
    public static readonly (TimeSpan UnderTwentyYears, TimeSpan TwentyYearsOrWorse, TimeSpan TerrorismOrStateSecurity) ChamberDecisionDeadlineAfterReferral =
        (TimeSpan.FromDays(2 * 30), TimeSpan.FromDays(4 * 30), TimeSpan.FromDays(8 * 30));

    /// <summary>
    /// Fraction of the current detention period's remaining time at which
    /// the alert switches from green to orange, i.e. "renewal needs to be
    /// requested soon" (Arts. 83, 197, 204 — avoiding arbitrary detention
    /// through an expired, unrenewed order). This fraction itself is a
    /// UX choice by this application, not a figure drawn from the law.
    /// </summary>
    public const double OrangeAlertRemainingFraction = 0.25;

    /// <summary>Days before expiry at which the alert switches to red regardless of the fraction above (a UX choice, not a legal figure).</summary>
    public const int RedAlertRemainingDays = 7;

    /// <summary>
    /// Appeal window for the defendant or civil party against the listed
    /// orders — including judicial control (198), its lifting (199), a
    /// detention order (201), its misdemeanor variant (203), a Chamber
    /// extension (205), and a release ruling (208) — per Art. 268: "في
    /// ظرف ثلاثة (3) أيام من تاريخ تبليغ الأمر".
    /// </summary>
    public static readonly TimeSpan AppealWindow = TimeSpan.FromDays(3);

    /// <summary>Notification window for judicial orders to defense counsel, victim and civil party (Art. 264): "أربع وعشرين (24) ساعة".</summary>
    public static readonly TimeSpan OrderNotificationWindow = TimeSpan.FromHours(24);

    /// <summary>Maximum authorization/renewal period for wiretaps and correspondence interception (Art. 116): "أربعة (4) أشهر قابلة للتجديد".</summary>
    public static readonly TimeSpan InterceptionMaxPeriod = TimeSpan.FromDays(4 * 30);

    /// <summary>Maximum authorization period for an infiltration (تسرب) operation (Art. 124): "أربعة (4) أشهر" — also renewable.</summary>
    public static readonly TimeSpan InfiltrationMaxPeriod = TimeSpan.FromDays(4 * 30);

    /// <summary>
    /// The ten statutory judicial-control obligations of Art. 198,
    /// transcribed from the official text in their original order. An
    /// electronic-monitoring bracelet is NOT itself one of the ten —
    /// Art. 198 separately allows it as a means of VERIFYING compliance
    /// with measures 1, 2, 6, 9 and 10 specifically, which is why it is
    /// not listed as an eleventh entry here.
    /// </summary>
    public static readonly IReadOnlyList<(string Code, string ArabicLabel)> JudicialControlMeasures = new[]
    {
        ("no_leaving_territorial_limits", "عدم مغادرة الحدود الإقليمية التي حددها قاضي التحقيق إلا بإذن هذا الأخير"),
        ("no_specified_places",           "عدم الذهاب إلى بعض الأماكن المحددة من طرف قاضي التحقيق"),
        ("periodic_checkin",              "المثول دوريا أمام المصالح أو السلطات المعينة من طرف قاضي التحقيق"),
        ("surrender_travel_or_license_docs", "تسليم كافة الوثائق التي تسمح بمغادرة التراب الوطني أو ممارسة نشاط أو مهنة يخضع لترخيص"),
        ("professional_activity_ban",     "عدم القيام ببعض النشاطات المهنية التي ارتكبت الجريمة بمناسبتها"),
        ("no_contact_persons",            "الامتناع عن الاتصال بالأشخاص الذين يعينهم قاضي التحقيق أو بعضهم"),
        ("medical_treatment",             "الخضوع إلى بعض إجراءات الفحص العلاجي حتى وإن كان بالمستشفى، لا سيما بغرض إزالة التسمم"),
        ("deposit_cheque_forms",          "إيداع نماذج الصكوك لدى أمانة الضبط وعدم استعمالها إلا بترخيص من قاضي التحقيق"),
        ("protected_residence",           "المكوث في إقامة محمية يعينها قاضي التحقيق وعدم مغادرتها إلا بإذن هذا الأخير"),
        ("residence_curfew",              "عدم مغادرة مكان الإقامة إلا بشروط وفي مواعيد محددة"),
    };

    /// <summary>
    /// The statutory document templates the registry/drafting module
    /// should be able to generate. Article citations for the order types
    /// are confirmed (Art. 193 arrest warrant, Art. 198 judicial control,
    /// Art. 201 detention order); the exact wording of each generated
    /// form must still be reviewed by a legal professional.
    /// </summary>
    public static readonly IReadOnlyList<(string Code, string ArabicLabel)> StatutoryForms = new[]
    {
        ("deposit_order",            "أمر بالإيداع (المادة 191)"),
        ("appearance_order",         "أمر بالإحضار (المادة 184)"),
        ("arrest_warrant",           "أمر بالقبض (المادة 193)"),
        ("judicial_control_order",   "أمر بالوضع تحت الرقابة القضائية (المادة 198)"),
        ("discharge_order",          "أمر بالتخلي"),
        ("chamber_extension_request","طلب تمديد الحبس المؤقت أمام غرفة الاتهام (المادتان 204 و205)"),
    };
}
