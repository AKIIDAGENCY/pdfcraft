using System;
using InvestigationRoom.Models;

namespace InvestigationRoom.ViewModels;

/// <summary>
/// A flattened, read-only row used by the "follow-up" dashboard: one
/// not-yet-done procedure, together with which case and defendant it
/// belongs to, so the investigator can see everything still owed across
/// every defendant in one sorted list.
/// </summary>
public class PendingProcedureRow
{
    public PendingProcedureRow(CaseFile caseFile, Defendant defendant, ProcedureItem procedure)
    {
        CaseFile = caseFile;
        Defendant = defendant;
        Procedure = procedure;
    }

    public CaseFile CaseFile { get; }
    public Defendant Defendant { get; }
    public ProcedureItem Procedure { get; }

    public string CaseTitle => CaseFile.Title;
    public string DefendantName => Defendant.FullName;
    public string ProcedureName => Procedure.Name;
    public ProcedureStatus Status => Procedure.Status;
    public DateTimeOffset? DueDate => Procedure.DueDate;
    public bool IsOverdue => Procedure.IsOverdue;
}
