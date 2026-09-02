using System;

namespace InvestigationRoom.Models;

public static class ProcedureStatusValues
{
    public static ProcedureStatus[] All { get; } = (ProcedureStatus[])Enum.GetValues(typeof(ProcedureStatus));
}
