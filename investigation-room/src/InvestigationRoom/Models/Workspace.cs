using System.Collections.ObjectModel;

namespace InvestigationRoom.Models;

/// <summary>
/// The full on-disk state: every case file plus the reusable procedure
/// template the user builds up over time.
/// </summary>
public class Workspace
{
    public ObservableCollection<CaseFile> Cases { get; set; } = new();

    public ObservableCollection<string> ProcedureTemplate { get; set; } = new();
}
