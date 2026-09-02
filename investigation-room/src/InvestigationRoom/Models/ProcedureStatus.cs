namespace InvestigationRoom.Models;

public enum ProcedureStatus
{
    NotStarted = 0,
    InProgress = 1,
    Done = 2
}

public static class ProcedureStatusExtensions
{
    public static string ToArabicLabel(this ProcedureStatus status) => status switch
    {
        ProcedureStatus.NotStarted => "لم يبدأ",
        ProcedureStatus.InProgress => "قيد التنفيذ",
        ProcedureStatus.Done => "منجز",
        _ => status.ToString()
    };
}
