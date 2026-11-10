namespace InvestigationRoom.Core.Legal;

/// <summary>
/// Every numeric/legal threshold the Detention &amp; Deadline Engine relies
/// on, collected in ONE place, sourced from the user's own description of
/// Algerian Law No. 25-14 (Code of Criminal Procedure).
///
/// ============================== READ THIS ==============================
/// These values were supplied by the person who commissioned this
/// software, not independently verified against the Official Gazette
/// text of Law No. 25-14 by the engineer who wrote this code. Before this
/// application is used to make or support a real pre-trial detention
/// decision, a qualified legal professional MUST review every value below
/// against the current official text (the law may also have been amended
/// since). Getting a detention deadline wrong is not a cosmetic bug — it
/// can mean an unlawfully extended detention or a wrongful release.
/// Treat everything here as "as specified by the client, pending legal
/// sign-off", never as a verified legal authority in itself.
/// =========================================================================
/// </summary>
public static class LegalRules
{
    /// <summary>Base pre-trial detention term for a felony (Art. 204): 4 months.</summary>
    public static readonly TimeSpan FelonyBaseDetentionTerm = TimeSpan.FromDays(4 * 30);

    /// <summary>
    /// Number of times the investigating judge alone may renew detention,
    /// each renewal being another <see cref="FelonyBaseDetentionTerm"/>,
    /// for crimes punishable by 20+ years, life imprisonment, or death
    /// (Art. 204).
    /// </summary>
    public const int MaxJudgeRenewals = 3;

    /// <summary>
    /// Number of further 4-month extensions the Chamber of Accusation
    /// (غرفة الاتهام) may grant once the judge's own renewals are
    /// exhausted, for transnational-crime/terrorism cases that still
    /// require forensic examination or cross-border inquiries
    /// (Arts. 204, 205).
    /// </summary>
    public const int MaxChamberOfAccusationExtensions = 4;

    /// <summary>Each renewal/extension step is this long.</summary>
    public static readonly TimeSpan RenewalStepLength = TimeSpan.FromDays(4 * 30);

    /// <summary>Maximum possible total detention under the chain above (for display/sanity-check only).</summary>
    public static TimeSpan MaximumTotalDetention =>
        FelonyBaseDetentionTerm
        + TimeSpan.FromTicks(RenewalStepLength.Ticks * MaxJudgeRenewals)
        + TimeSpan.FromTicks(RenewalStepLength.Ticks * MaxChamberOfAccusationExtensions);

    /// <summary>
    /// Fraction of the current detention period's remaining time at which
    /// the alert switches from green to orange, i.e. "renewal needs to be
    /// requested soon" (Arts. 83, 197, 204 — avoiding arbitrary detention
    /// through an expired, unrenewed order).
    /// </summary>
    public const double OrangeAlertRemainingFraction = 0.25;

    /// <summary>Days before expiry at which the alert switches to red regardless of the fraction above.</summary>
    public const int RedAlertRemainingDays = 7;

    /// <summary>Appeal window for the defendant or the civil party against an order (Art. 268): 3 days.</summary>
    public static readonly TimeSpan AppealWindow = TimeSpan.FromDays(3);

    /// <summary>Maximum authorization/renewal period for wiretaps and correspondence interception (Arts. 114, 116): 4 months.</summary>
    public static readonly TimeSpan InterceptionMaxPeriod = TimeSpan.FromDays(4 * 30);

    /// <summary>
    /// The ten statutory judicial-control measures of Art. 198, as fixed
    /// (code, Arabic label) pairs — tracked individually per defendant.
    /// The exact wording/ordering should be checked against Art. 198's
    /// official text; these are a working set based on the commissioning
    /// description, not a verbatim legal quotation.
    /// </summary>
    public static readonly IReadOnlyList<(string Code, string ArabicLabel)> JudicialControlMeasures = new[]
    {
        ("travel_ban",            "منع من مغادرة التراب الوطني"),
        ("surrender_documents",   "تسليم جواز السفر أو أي وثيقة تثبت الهوية"),
        ("protected_residence",   "عدم مغادرة حدود إقليمية معينة / الإقامة في مكان محدد"),
        ("no_contact_zone",       "عدم الذهاب إلى أماكن محددة"),
        ("periodic_checkin",      "الحضور الدوري إلى مصلحة أو سلطة معينة"),
        ("electronic_monitoring", "الخضوع للمراقبة الإلكترونية (السوار الإلكتروني)"),
        ("no_contact_persons",    "عدم الاتصال ببعض الأشخاص (الضحايا، الشهود، الشركاء)"),
        ("professional_ban",      "عدم ممارسة نشاط معين له صلة بالجريمة"),
        ("financial_guarantee",   "إيداع كفالة مالية"),
        ("no_weapons",            "تسليم كل الأسلحة التي يحوزها"),
    };

    /// <summary>
    /// The statutory document templates the registry/drafting module
    /// should be able to generate. Content/wording of each form must be
    /// reviewed by a legal professional; this is only the catalog of
    /// which forms the software offers to draft.
    /// </summary>
    public static readonly IReadOnlyList<(string Code, string ArabicLabel)> StatutoryForms = new[]
    {
        ("deposit_order",            "أمر بالإيداع"),
        ("appearance_order",         "أمر بالإحضار"),
        ("arrest_warrant",           "أمر بالقبض (المادة 193)"),
        ("judicial_control_order",   "أمر بالوضع تحت الرقابة القضائية"),
        ("discharge_order",          "أمر بالتخلي"),
        ("chamber_extension_request","طلب تمديد الحبس المؤقت أمام غرفة الاتهام"),
    };
}
