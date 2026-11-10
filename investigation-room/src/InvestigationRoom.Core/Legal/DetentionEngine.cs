namespace InvestigationRoom.Core.Legal;

public enum DetentionRecordType
{
    Deposit,                 // أمر بالإيداع — initial pre-trial detention order
    JudgeRenewal,             // تمديد من قاضي التحقيق
    ChamberOfAccusationExtension, // تمديد من غرفة الاتهام
    Release                  // أمر بالإفراج
}

/// <summary>One decided period of detention (or its end), as stored in detention_records.</summary>
public sealed record DetentionRecord(
    DetentionRecordType Type,
    DateTimeOffset PeriodStart,
    DateTimeOffset PeriodEnd,
    DateTimeOffset DecidedAt);

public enum DetentionAlertLevel
{
    NotDetained,
    Green,
    Orange,
    Red,
    /// <summary>Current period has already run out — statutory grounds for release unless a new order was issued the same day (Arts. 83, 197, 204).</summary>
    Expired
}

public sealed record DetentionAssessment(
    DetentionAlertLevel AlertLevel,
    DateTimeOffset? CurrentPeriodEnd,
    TimeSpan? TimeRemaining,
    int JudgeRenewalsUsed,
    int JudgeRenewalsRemaining,
    int ChamberExtensionsUsed,
    int ChamberExtensionsRemaining,
    bool CanRequestJudgeRenewal,
    bool CanRequestChamberExtension,
    TimeSpan TotalElapsedDetention);

/// <summary>
/// Computes a defendant's pre-trial detention state from their ordered
/// detention_records, per the thresholds in <see cref="LegalRules"/>.
/// See the legal-accuracy notice on <see cref="LegalRules"/> — this class
/// only mechanically applies whatever numbers live there.
/// </summary>
public static class DetentionEngine
{
    /// <param name="records">Chronological detention history for this defendant.</param>
    /// <param name="isAggravatedFelony">
    /// True if the charge is punishable by 20+ years, life imprisonment,
    /// or death (Art. 204, para. 2) — raises the judge-renewal cap from 2
    /// to 3. Any felony, aggravated or not, is entitled to renewals; this
    /// flag only changes the count, it does not gate renewal access.
    /// </param>
    /// <param name="asOf">The moment to assess against (normally DateTimeOffset.Now).</param>
    public static DetentionAssessment Assess(
        IReadOnlyList<DetentionRecord> records,
        bool isAggravatedFelony,
        DateTimeOffset asOf)
    {
        if (records.Count == 0)
        {
            return NotDetained();
        }

        var ordered = records.OrderBy(r => r.PeriodStart).ToList();

        if (ordered[^1].Type == DetentionRecordType.Release)
        {
            return NotDetained();
        }

        var active = ordered[^1];

        var judgeRenewalsUsed = ordered.Count(r => r.Type == DetentionRecordType.JudgeRenewal);
        var chamberExtensionsUsed = ordered.Count(r => r.Type == DetentionRecordType.ChamberOfAccusationExtension);

        var judgeRenewalsMax = isAggravatedFelony
            ? LegalRules.MaxJudgeRenewalsAggravated
            : LegalRules.MaxJudgeRenewalsOrdinary;

        var judgeRenewalsRemaining = Math.Max(0, judgeRenewalsMax - judgeRenewalsUsed);
        var chamberExtensionsRemaining = Math.Max(0, LegalRules.MaxChamberOfAccusationExtensions - chamberExtensionsUsed);

        // Art. 204 grants renewals/extensions to any felony; it is not
        // gated by crime type. See LegalRules.MaxChamberOfAccusationExtensions
        // for the open question around Art. 205's additional scope.
        var canRequestJudgeRenewal = judgeRenewalsRemaining > 0;
        var canRequestChamberExtension = judgeRenewalsRemaining == 0 && chamberExtensionsRemaining > 0;

        var remaining = active.PeriodEnd - asOf;
        var periodLength = active.PeriodEnd - active.PeriodStart;

        var alert = ComputeAlert(remaining, periodLength);

        var totalElapsed = ComputeTotalElapsed(ordered, asOf);

        return new DetentionAssessment(
            alert,
            active.PeriodEnd,
            remaining,
            judgeRenewalsUsed,
            judgeRenewalsRemaining,
            chamberExtensionsUsed,
            chamberExtensionsRemaining,
            canRequestJudgeRenewal,
            canRequestChamberExtension,
            totalElapsed);
    }

    private static DetentionAlertLevel ComputeAlert(TimeSpan remaining, TimeSpan periodLength)
    {
        if (remaining <= TimeSpan.Zero)
        {
            return DetentionAlertLevel.Expired;
        }

        if (remaining.TotalDays <= LegalRules.RedAlertRemainingDays)
        {
            return DetentionAlertLevel.Red;
        }

        if (periodLength > TimeSpan.Zero && remaining <= periodLength * LegalRules.OrangeAlertRemainingFraction)
        {
            return DetentionAlertLevel.Orange;
        }

        return DetentionAlertLevel.Green;
    }

    /// <summary>
    /// Sums continuous custody time across the record chain. Assumes
    /// uninterrupted detention (no Release followed by a fresh Deposit)
    /// within the chain passed in — the common case this engine targets.
    /// </summary>
    private static TimeSpan ComputeTotalElapsed(IReadOnlyList<DetentionRecord> ordered, DateTimeOffset asOf)
    {
        var first = ordered[0];
        var end = asOf < ordered[^1].PeriodEnd ? asOf : ordered[^1].PeriodEnd;
        var elapsed = end - first.PeriodStart;
        return elapsed < TimeSpan.Zero ? TimeSpan.Zero : elapsed;
    }

    private static DetentionAssessment NotDetained() => new(
        DetentionAlertLevel.NotDetained,
        CurrentPeriodEnd: null,
        TimeRemaining: null,
        JudgeRenewalsUsed: 0,
        JudgeRenewalsRemaining: LegalRules.MaxJudgeRenewalsOrdinary,
        ChamberExtensionsUsed: 0,
        ChamberExtensionsRemaining: LegalRules.MaxChamberOfAccusationExtensions,
        CanRequestJudgeRenewal: false,
        CanRequestChamberExtension: false,
        TotalElapsedDetention: TimeSpan.Zero);
}
