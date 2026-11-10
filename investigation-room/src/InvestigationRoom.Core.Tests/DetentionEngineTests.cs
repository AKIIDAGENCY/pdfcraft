using InvestigationRoom.Core.Legal;
using Xunit;

namespace InvestigationRoom.Core.Tests;

public class DetentionEngineTests
{
    private static readonly DateTimeOffset Jan1 = new(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);

    private static DetentionRecord Deposit(DateTimeOffset start) =>
        new(DetentionRecordType.Deposit, start, start + LegalRules.FelonyBaseDetentionTerm, start);

    private static DetentionRecord JudgeRenewal(DateTimeOffset start) =>
        new(DetentionRecordType.JudgeRenewal, start, start + LegalRules.RenewalStepLength, start);

    private static DetentionRecord ChamberExtension(DateTimeOffset start) =>
        new(DetentionRecordType.ChamberOfAccusationExtension, start, start + LegalRules.RenewalStepLength, start);

    [Fact]
    public void NoRecords_IsNotDetained()
    {
        var result = DetentionEngine.Assess(Array.Empty<DetentionRecord>(), isAggravatedFelony: true, Jan1);

        Assert.Equal(DetentionAlertLevel.NotDetained, result.AlertLevel);
        Assert.Null(result.CurrentPeriodEnd);
    }

    [Fact]
    public void LastRecordIsRelease_IsNotDetained()
    {
        var records = new[]
        {
            Deposit(Jan1),
            new DetentionRecord(DetentionRecordType.Release, Jan1.AddDays(30), Jan1.AddDays(30), Jan1.AddDays(30)),
        };

        var result = DetentionEngine.Assess(records, isAggravatedFelony: true, Jan1.AddDays(31));

        Assert.Equal(DetentionAlertLevel.NotDetained, result.AlertLevel);
    }

    [Fact]
    public void FreshDeposit_WellBeforeExpiry_IsGreen()
    {
        var records = new[] { Deposit(Jan1) };

        var result = DetentionEngine.Assess(records, isAggravatedFelony: false, Jan1.AddDays(10));

        Assert.Equal(DetentionAlertLevel.Green, result.AlertLevel);
        Assert.Equal(Jan1 + LegalRules.FelonyBaseDetentionTerm, result.CurrentPeriodEnd);
    }

    [Fact]
    public void WithinOrangeFractionOfPeriod_IsOrange()
    {
        var records = new[] { Deposit(Jan1) };
        // 120-day base term: orange starts at 25% of 120 days = 30 days remaining.
        var asOf = Jan1 + LegalRules.FelonyBaseDetentionTerm - TimeSpan.FromDays(20);

        var result = DetentionEngine.Assess(records, isAggravatedFelony: false, asOf);

        Assert.Equal(DetentionAlertLevel.Orange, result.AlertLevel);
    }

    [Fact]
    public void WithinRedWindow_IsRedEvenIfOutsideOrangeFraction()
    {
        var records = new[] { Deposit(Jan1) };
        var asOf = Jan1 + LegalRules.FelonyBaseDetentionTerm - TimeSpan.FromDays(LegalRules.RedAlertRemainingDays - 1);

        var result = DetentionEngine.Assess(records, isAggravatedFelony: false, asOf);

        Assert.Equal(DetentionAlertLevel.Red, result.AlertLevel);
    }

    [Fact]
    public void PastPeriodEnd_IsExpired()
    {
        var records = new[] { Deposit(Jan1) };
        var asOf = Jan1 + LegalRules.FelonyBaseDetentionTerm + TimeSpan.FromDays(1);

        var result = DetentionEngine.Assess(records, isAggravatedFelony: false, asOf);

        Assert.Equal(DetentionAlertLevel.Expired, result.AlertLevel);
    }

    [Fact]
    public void OrdinaryFelony_JudgeCanRenewTwice_ThenMustStop_Art204Para1()
    {
        var start = Jan1;
        var records = new List<DetentionRecord> { Deposit(start) };
        start += LegalRules.FelonyBaseDetentionTerm;

        for (var i = 0; i < LegalRules.MaxJudgeRenewalsOrdinary; i++)
        {
            records.Add(JudgeRenewal(start));
            start += LegalRules.RenewalStepLength;
        }

        var result = DetentionEngine.Assess(records, isAggravatedFelony: false, asOf: records[0].PeriodStart.AddDays(1));

        Assert.Equal(LegalRules.MaxJudgeRenewalsOrdinary, result.JudgeRenewalsUsed);
        Assert.Equal(0, result.JudgeRenewalsRemaining);
        Assert.False(result.CanRequestJudgeRenewal);
    }

    [Fact]
    public void OrdinaryFelony_CannotGetAThirdJudgeRenewal_EvenThoughAggravatedFelonyCouldHave()
    {
        // Two renewals already used on an ORDINARY felony: no third slot,
        // unlike an aggravated felony which would still have one left.
        var records = new List<DetentionRecord>
        {
            Deposit(Jan1),
            JudgeRenewal(Jan1 + LegalRules.FelonyBaseDetentionTerm),
            JudgeRenewal(Jan1 + LegalRules.FelonyBaseDetentionTerm + LegalRules.RenewalStepLength),
        };

        var ordinary = DetentionEngine.Assess(records, isAggravatedFelony: false, Jan1.AddDays(1));
        var aggravated = DetentionEngine.Assess(records, isAggravatedFelony: true, Jan1.AddDays(1));

        Assert.False(ordinary.CanRequestJudgeRenewal);
        Assert.Equal(0, ordinary.JudgeRenewalsRemaining);

        Assert.True(aggravated.CanRequestJudgeRenewal);
        Assert.Equal(1, aggravated.JudgeRenewalsRemaining);
    }

    [Fact]
    public void AggravatedFelony_JudgeCanRenewThreeTimes_ThenMustStop_Art204Para2()
    {
        var start = Jan1;
        var records = new List<DetentionRecord> { Deposit(start) };
        start += LegalRules.FelonyBaseDetentionTerm;

        for (var i = 0; i < LegalRules.MaxJudgeRenewalsAggravated; i++)
        {
            records.Add(JudgeRenewal(start));
            start += LegalRules.RenewalStepLength;
        }

        var result = DetentionEngine.Assess(records, isAggravatedFelony: true, asOf: records[0].PeriodStart.AddDays(1));

        Assert.Equal(LegalRules.MaxJudgeRenewalsAggravated, result.JudgeRenewalsUsed);
        Assert.Equal(0, result.JudgeRenewalsRemaining);
        Assert.False(result.CanRequestJudgeRenewal);
    }

    [Fact]
    public void ChamberExtension_OnlyAvailable_AfterJudgeRenewalsExhausted_Art204()
    {
        var records = new List<DetentionRecord> { Deposit(Jan1) };

        // Only 1 of 2 ordinary-felony judge renewals used — chamber extension must not be offered yet.
        records.Add(JudgeRenewal(Jan1 + LegalRules.FelonyBaseDetentionTerm));

        var tooEarly = DetentionEngine.Assess(records, isAggravatedFelony: false, Jan1.AddDays(5));
        Assert.False(tooEarly.CanRequestChamberExtension);

        // Exhaust the remaining judge renewal.
        var cursor = Jan1 + LegalRules.FelonyBaseDetentionTerm + LegalRules.RenewalStepLength;
        for (var i = 1; i < LegalRules.MaxJudgeRenewalsOrdinary; i++)
        {
            records.Add(JudgeRenewal(cursor));
            cursor += LegalRules.RenewalStepLength;
        }

        var afterExhaustion = DetentionEngine.Assess(records, isAggravatedFelony: false, Jan1.AddDays(5));
        Assert.Equal(0, afterExhaustion.JudgeRenewalsRemaining);
        Assert.True(afterExhaustion.CanRequestChamberExtension);
    }

    [Fact]
    public void ChamberExtension_CapsAtFour_Art204()
    {
        var records = new List<DetentionRecord> { Deposit(Jan1) };
        var cursor = Jan1 + LegalRules.FelonyBaseDetentionTerm;

        for (var i = 0; i < LegalRules.MaxJudgeRenewalsOrdinary; i++)
        {
            records.Add(JudgeRenewal(cursor));
            cursor += LegalRules.RenewalStepLength;
        }

        for (var i = 0; i < LegalRules.MaxChamberOfAccusationExtensions; i++)
        {
            records.Add(ChamberExtension(cursor));
            cursor += LegalRules.RenewalStepLength;
        }

        var result = DetentionEngine.Assess(records, isAggravatedFelony: false, Jan1.AddDays(5));

        Assert.Equal(LegalRules.MaxChamberOfAccusationExtensions, result.ChamberExtensionsUsed);
        Assert.Equal(0, result.ChamberExtensionsRemaining);
        Assert.False(result.CanRequestChamberExtension);
    }

    [Fact]
    public void TotalElapsedDetention_SumsAcrossPeriods()
    {
        var records = new[]
        {
            Deposit(Jan1),
            JudgeRenewal(Jan1 + LegalRules.FelonyBaseDetentionTerm),
        };

        var asOf = Jan1 + LegalRules.FelonyBaseDetentionTerm + TimeSpan.FromDays(10);
        var result = DetentionEngine.Assess(records, isAggravatedFelony: false, asOf);

        Assert.Equal(asOf - Jan1, result.TotalElapsedDetention);
    }

    [Fact]
    public void JudicialControlMeasures_HasExactlyTenEntries_Art198()
    {
        Assert.Equal(10, LegalRules.JudicialControlMeasures.Count);
    }
}
