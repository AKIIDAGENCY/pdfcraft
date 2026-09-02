using System;
using CommunityToolkit.Mvvm.ComponentModel;

namespace InvestigationRoom.Models;

public partial class ProcedureItem : ObservableObject
{
    public Guid Id { get; set; } = Guid.NewGuid();

    [ObservableProperty]
    private string _name = string.Empty;

    [ObservableProperty]
    private ProcedureStatus _status = ProcedureStatus.NotStarted;

    [ObservableProperty]
    private DateTimeOffset? _dueDate;

    [ObservableProperty]
    private DateTimeOffset? _completedDate;

    [ObservableProperty]
    private string _notes = string.Empty;

    public bool IsOverdue =>
        Status != ProcedureStatus.Done &&
        DueDate.HasValue &&
        DueDate.Value.Date < DateTimeOffset.Now.Date;

    partial void OnStatusChanged(ProcedureStatus value)
    {
        CompletedDate = value == ProcedureStatus.Done ? DateTimeOffset.Now : null;
        OnPropertyChanged(nameof(IsOverdue));
    }

    partial void OnDueDateChanged(DateTimeOffset? value) => OnPropertyChanged(nameof(IsOverdue));
}
