using System;
using System.Collections.ObjectModel;
using System.Linq;
using CommunityToolkit.Mvvm.ComponentModel;

namespace InvestigationRoom.Models;

public partial class Defendant : ObservableObject
{
    public Guid Id { get; set; } = Guid.NewGuid();

    [ObservableProperty]
    private string _fullName = string.Empty;

    [ObservableProperty]
    private string _nationalId = string.Empty;

    [ObservableProperty]
    private string _charge = string.Empty;

    [ObservableProperty]
    private DateTimeOffset? _arrestDate;

    [ObservableProperty]
    private string _notes = string.Empty;

    public ObservableCollection<ProcedureItem> Procedures { get; set; } = new();

    public int TotalCount => Procedures.Count;

    public int DoneCount => Procedures.Count(p => p.Status == ProcedureStatus.Done);

    public int PendingCount => Procedures.Count(p => p.Status != ProcedureStatus.Done);

    public bool HasOverdue => Procedures.Any(p => p.IsOverdue);

    public string ProgressLabel => $"{DoneCount} / {TotalCount}";

    public void RaiseProgressChanged()
    {
        OnPropertyChanged(nameof(TotalCount));
        OnPropertyChanged(nameof(DoneCount));
        OnPropertyChanged(nameof(PendingCount));
        OnPropertyChanged(nameof(HasOverdue));
        OnPropertyChanged(nameof(ProgressLabel));
    }
}
