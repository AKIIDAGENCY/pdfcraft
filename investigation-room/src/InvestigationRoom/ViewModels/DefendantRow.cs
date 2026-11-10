using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Windows.Input;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using InvestigationRoom.Core.Legal;
using InvestigationRoom.Core.Models;

namespace InvestigationRoom.ViewModels;

/// <summary>One row in the defendant matrix: the raw record plus its computed detention assessment.</summary>
public partial class DefendantRow : ObservableObject
{
    public Defendant Defendant { get; }
    public List<Charge> Charges { get; set; } = new();
    public List<JudicialControlEntry> JudicialControlEntries { get; set; } = new();

    [ObservableProperty]
    private DetentionAssessment _assessment;

    public ICommand RequestJudgeRenewalCommand { get; }
    public ICommand RequestChamberExtensionCommand { get; }
    public ICommand ReleaseCommand { get; }

    public DefendantRow(Defendant defendant, DetentionAssessment assessment, LegalCaseViewModel owner)
    {
        Defendant = defendant;
        _assessment = assessment;
        RequestJudgeRenewalCommand = new RelayCommand(() => owner.RequestJudgeRenewal(this));
        RequestChamberExtensionCommand = new RelayCommand(() => owner.RequestChamberExtension(this));
        ReleaseCommand = new RelayCommand(() => owner.ReleaseDefendant(this));
    }

    public string FullName => Defendant.FullName;
    public string NationalId => Defendant.NationalId;
    public string CustodyStatus => Defendant.CustodyStatus;
    public string RoleInCase => Defendant.RoleInCase;

    public string ChargesSummary => Charges.Count == 0
        ? "—"
        : string.Join("، ", Charges.Select(c => c.Description));

    public string JudicialControlSummary => JudicialControlEntries.Count == 0
        ? "—"
        : string.Join("، ", JudicialControlEntries
            .Where(e => e.LiftedAt == null)
            .Select(e => LegalRules.JudicialControlMeasures.FirstOrDefault(m => m.Code == e.MeasureCode).ArabicLabel ?? e.MeasureCode));

    public string DetentionLabel => Assessment.AlertLevel switch
    {
        DetentionAlertLevel.NotDetained => "غير محبوس",
        DetentionAlertLevel.Expired => "⚠ انتهت المدة القانونية — إفراج وجوبي أو تمديد فوري",
        DetentionAlertLevel.Red => $"يبقى {Math.Max(0, (int)(Assessment.TimeRemaining?.TotalDays ?? 0))} يوم",
        DetentionAlertLevel.Orange => $"يبقى {Math.Max(0, (int)(Assessment.TimeRemaining?.TotalDays ?? 0))} يوم",
        DetentionAlertLevel.Green => $"يبقى {Math.Max(0, (int)(Assessment.TimeRemaining?.TotalDays ?? 0))} يوم",
        _ => "—"
    };

    public string RenewalsSummary =>
        $"قاضي: {Assessment.JudgeRenewalsUsed}/{LegalRules.MaxJudgeRenewals} — غرفة الاتهام: {Assessment.ChamberExtensionsUsed}/{LegalRules.MaxChamberOfAccusationExtensions}";

    public void RaiseAllChanged()
    {
        OnPropertyChanged(nameof(FullName));
        OnPropertyChanged(nameof(CustodyStatus));
        OnPropertyChanged(nameof(ChargesSummary));
        OnPropertyChanged(nameof(JudicialControlSummary));
        OnPropertyChanged(nameof(DetentionLabel));
        OnPropertyChanged(nameof(RenewalsSummary));
    }
}
