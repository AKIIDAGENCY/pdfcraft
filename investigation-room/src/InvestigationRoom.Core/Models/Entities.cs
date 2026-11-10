namespace InvestigationRoom.Core.Models;

public sealed class Case
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string CaseNumber { get; set; } = string.Empty;
    public DateTimeOffset RegistrationDate { get; set; } = DateTimeOffset.Now;
    public string Title { get; set; } = string.Empty;
    public string LegalQualification { get; set; } = string.Empty;
    public bool IsTransnational { get; set; }
    public string PrimaryJudgeName { get; set; } = string.Empty;
    public string Notes { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.Now;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.Now;
}

public sealed class CaseJudge
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string CaseId { get; set; } = string.Empty;
    public string JudgeName { get; set; } = string.Empty;
    /// <summary>"رئيسي" (lead) or "ملحق" (associate, Art. 145).</summary>
    public string Role { get; set; } = "ملحق";
    public DateTimeOffset AssignedAt { get; set; } = DateTimeOffset.Now;
}

public static class CustodyStatus
{
    public const string Free = "حر";
    public const string JudicialControl = "تحت الرقابة القضائية";
    public const string Detained = "محبوس مؤقتا";
    public const string Wanted = "فار (بحث عنه)";
}

public sealed class Defendant
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string CaseId { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string NationalId { get; set; } = string.Empty;
    /// <summary>فاعل أصلي / شريك / محرض.</summary>
    public string RoleInCase { get; set; } = string.Empty;
    public string CustodyStatus { get; set; } = Models.CustodyStatus.Free;
    public bool ArrestWarrantArt193 { get; set; }
    public bool IsProtectedIdentity { get; set; }
    public string Notes { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.Now;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.Now;
}

public sealed class Lawyer
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = string.Empty;
    public string BarId { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Notes { get; set; } = string.Empty;
}

public sealed class Interrogation
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string DefendantId { get; set; } = string.Empty;
    public DateTimeOffset OccurredAt { get; set; } = DateTimeOffset.Now;
    /// <summary>استجواب | استجواب إجمالي (Art. 183) | مواجهة.</summary>
    public string Kind { get; set; } = "استجواب";
    public string Summary { get; set; } = string.Empty;
    public bool LawyerPresent { get; set; }
}

public sealed class Charge
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string DefendantId { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string LegalBasis { get; set; } = string.Empty;
    /// <summary>جنحة | جناية | جناية مشددة.</summary>
    public string SeverityBand { get; set; } = "جناية";
    public bool QualifiesExtendedDetention { get; set; }
}

public sealed class DetentionRecordEntity
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string DefendantId { get; set; } = string.Empty;
    /// <summary>ايداع | تمديد_قاضي_تحقيق | تمديد_غرفة_الاتهام | افراج.</summary>
    public string RecordType { get; set; } = string.Empty;
    public DateTimeOffset DecidedAt { get; set; } = DateTimeOffset.Now;
    public DateTimeOffset PeriodStart { get; set; }
    public DateTimeOffset PeriodEnd { get; set; }
    public int DurationMonths { get; set; } = 4;
    public string DecidedBy { get; set; } = string.Empty;
    public bool RequiresForensicOrCrossBorder { get; set; }
    public DateTimeOffset? NotifiedAt { get; set; }
    public string Notes { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.Now;
}

public sealed class JudicialControlEntry
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string DefendantId { get; set; } = string.Empty;
    public string MeasureCode { get; set; } = string.Empty;
    public DateTimeOffset ImposedAt { get; set; } = DateTimeOffset.Now;
    public DateTimeOffset? ExpiresAt { get; set; }
    public DateTimeOffset? LiftedAt { get; set; }
    public string Notes { get; set; } = string.Empty;
}

public sealed class Interception
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string CaseId { get; set; } = string.Empty;
    /// <summary>تنصت | اعتراض_مراسلات | تسرب.</summary>
    public string Kind { get; set; } = string.Empty;
    public string TargetDescription { get; set; } = string.Empty;
    public DateTimeOffset AuthorizedAt { get; set; } = DateTimeOffset.Now;
    public DateTimeOffset ExpiresAt { get; set; }
    public int RenewalCount { get; set; }
    public string AuthorizedBy { get; set; } = string.Empty;
    public string Notes { get; set; } = string.Empty;
}

public sealed class Seizure
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string CaseId { get; set; } = string.Empty;
    public string? DefendantId { get; set; }
    public string AssetDescription { get; set; } = string.Empty;
    public string AssetKind { get; set; } = string.Empty;
    public string EstimatedValue { get; set; } = string.Empty;
    public DateTimeOffset SeizedAt { get; set; } = DateTimeOffset.Now;
    /// <summary>محجوز | مجمد | مرفوع عنه الحجز.</summary>
    public string Status { get; set; } = "محجوز";
    public string Notes { get; set; } = string.Empty;
}

public sealed class NetworkLink
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string CaseId { get; set; } = string.Empty;
    public string FromDefendantId { get; set; } = string.Empty;
    public string ToDefendantId { get; set; } = string.Empty;
    public string Relationship { get; set; } = string.Empty;
    public string? SharedSeizureId { get; set; }
    public string Notes { get; set; } = string.Empty;
}

/// <summary>
/// Protected witness/informant record (Arts. 128-138). The UI must never
/// list <see cref="RealIdentitySealed"/> in a grid or include it in any
/// export — only behind a single explicit "reveal" action.
/// </summary>
public sealed class WitnessProtected
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string CaseId { get; set; } = string.Empty;
    public string AliasCode { get; set; } = string.Empty;
    public string RealIdentitySealed { get; set; } = string.Empty;
    public string ProtectionMeasures { get; set; } = string.Empty;
    public DateTimeOffset AuthorizedAt { get; set; } = DateTimeOffset.Now;
    public string AuthorizedBy { get; set; } = string.Empty;
    public string Notes { get; set; } = string.Empty;
}
