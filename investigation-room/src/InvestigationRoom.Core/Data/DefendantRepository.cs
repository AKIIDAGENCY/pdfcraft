using InvestigationRoom.Core.Models;
using Microsoft.Data.Sqlite;

namespace InvestigationRoom.Core.Data;

public sealed class DefendantRepository
{
    private readonly InvestigationDatabase _db;

    public DefendantRepository(InvestigationDatabase db) => _db = db;

    public List<Defendant> GetByCase(string caseId) => _db.Query(
        "SELECT * FROM defendants WHERE case_id = $caseId ORDER BY full_name",
        MapDefendant,
        p => p.AddP("$caseId", caseId));

    public void Upsert(Defendant d)
    {
        d.UpdatedAt = DateTimeOffset.Now;
        _db.Execute(
            """
            INSERT INTO defendants (id, case_id, full_name, national_id, role_in_case, custody_status, arrest_warrant_art193, is_protected_identity, notes, created_at, updated_at)
            VALUES ($id, $caseId, $name, $nationalId, $role, $custody, $warrant, $protected, $notes, $createdAt, $updatedAt)
            ON CONFLICT(id) DO UPDATE SET
                full_name = excluded.full_name,
                national_id = excluded.national_id,
                role_in_case = excluded.role_in_case,
                custody_status = excluded.custody_status,
                arrest_warrant_art193 = excluded.arrest_warrant_art193,
                is_protected_identity = excluded.is_protected_identity,
                notes = excluded.notes,
                updated_at = excluded.updated_at;
            """,
            p =>
            {
                p.AddP("$id", d.Id);
                p.AddP("$caseId", d.CaseId);
                p.AddP("$name", d.FullName);
                p.AddP("$nationalId", d.NationalId);
                p.AddP("$role", d.RoleInCase);
                p.AddP("$custody", d.CustodyStatus);
                p.AddP("$warrant", d.ArrestWarrantArt193);
                p.AddP("$protected", d.IsProtectedIdentity);
                p.AddP("$notes", d.Notes);
                p.AddP("$createdAt", d.CreatedAt);
                p.AddP("$updatedAt", d.UpdatedAt);
            });
    }

    public void Delete(string defendantId) =>
        _db.Execute("DELETE FROM defendants WHERE id = $id", p => p.AddP("$id", defendantId));

    // ---- charges ------------------------------------------------------

    public List<Charge> GetCharges(string defendantId) => _db.Query(
        "SELECT * FROM charges WHERE defendant_id = $defendantId",
        MapCharge,
        p => p.AddP("$defendantId", defendantId));

    public void UpsertCharge(Charge c) => _db.Execute(
        """
        INSERT INTO charges (id, defendant_id, description, legal_basis, severity_band, is_aggravated_felony)
        VALUES ($id, $defendantId, $description, $legalBasis, $severity, $aggravated)
        ON CONFLICT(id) DO UPDATE SET
            description = excluded.description,
            legal_basis = excluded.legal_basis,
            severity_band = excluded.severity_band,
            is_aggravated_felony = excluded.is_aggravated_felony;
        """,
        p =>
        {
            p.AddP("$id", c.Id);
            p.AddP("$defendantId", c.DefendantId);
            p.AddP("$description", c.Description);
            p.AddP("$legalBasis", c.LegalBasis);
            p.AddP("$severity", c.SeverityBand);
            p.AddP("$aggravated", c.IsAggravatedFelony);
        });

    public void DeleteCharge(string chargeId) =>
        _db.Execute("DELETE FROM charges WHERE id = $id", p => p.AddP("$id", chargeId));

    // ---- detention records ---------------------------------------------

    public List<DetentionRecordEntity> GetDetentionRecords(string defendantId) => _db.Query(
        "SELECT * FROM detention_records WHERE defendant_id = $defendantId ORDER BY period_start",
        MapDetentionRecord,
        p => p.AddP("$defendantId", defendantId));

    public void AddDetentionRecord(DetentionRecordEntity r) => _db.Execute(
        """
        INSERT INTO detention_records (id, defendant_id, record_type, decided_at, period_start, period_end, duration_months, decided_by, requires_forensic_or_cross_border, notified_at, notes, created_at)
        VALUES ($id, $defendantId, $type, $decidedAt, $start, $end, $months, $decidedBy, $forensic, $notifiedAt, $notes, $createdAt);
        """,
        p =>
        {
            p.AddP("$id", r.Id);
            p.AddP("$defendantId", r.DefendantId);
            p.AddP("$type", r.RecordType);
            p.AddP("$decidedAt", r.DecidedAt);
            p.AddP("$start", r.PeriodStart);
            p.AddP("$end", r.PeriodEnd);
            p.AddP("$months", r.DurationMonths);
            p.AddP("$decidedBy", r.DecidedBy);
            p.AddP("$forensic", r.RequiresForensicOrCrossBorder);
            p.AddP("$notifiedAt", r.NotifiedAt);
            p.AddP("$notes", r.Notes);
            p.AddP("$createdAt", r.CreatedAt);
        });

    public void DeleteDetentionRecord(string recordId) =>
        _db.Execute("DELETE FROM detention_records WHERE id = $id", p => p.AddP("$id", recordId));

    // ---- judicial control -----------------------------------------------

    public List<JudicialControlEntry> GetJudicialControl(string defendantId) => _db.Query(
        "SELECT * FROM judicial_control WHERE defendant_id = $defendantId ORDER BY imposed_at",
        MapJudicialControl,
        p => p.AddP("$defendantId", defendantId));

    public void UpsertJudicialControl(JudicialControlEntry e) => _db.Execute(
        """
        INSERT INTO judicial_control (id, defendant_id, measure_code, imposed_at, expires_at, lifted_at, notes)
        VALUES ($id, $defendantId, $code, $imposedAt, $expiresAt, $liftedAt, $notes)
        ON CONFLICT(id) DO UPDATE SET
            expires_at = excluded.expires_at,
            lifted_at = excluded.lifted_at,
            notes = excluded.notes;
        """,
        p =>
        {
            p.AddP("$id", e.Id);
            p.AddP("$defendantId", e.DefendantId);
            p.AddP("$code", e.MeasureCode);
            p.AddP("$imposedAt", e.ImposedAt);
            p.AddP("$expiresAt", e.ExpiresAt);
            p.AddP("$liftedAt", e.LiftedAt);
            p.AddP("$notes", e.Notes);
        });

    public void DeleteJudicialControl(string entryId) =>
        _db.Execute("DELETE FROM judicial_control WHERE id = $id", p => p.AddP("$id", entryId));

    // ---- lawyers ----------------------------------------------------------

    public List<Lawyer> GetAllLawyers() => _db.Query("SELECT * FROM lawyers ORDER BY name", MapLawyer);

    public void UpsertLawyer(Lawyer l) => _db.Execute(
        """
        INSERT INTO lawyers (id, name, bar_id, phone, notes)
        VALUES ($id, $name, $barId, $phone, $notes)
        ON CONFLICT(id) DO UPDATE SET name = excluded.name, bar_id = excluded.bar_id, phone = excluded.phone, notes = excluded.notes;
        """,
        p =>
        {
            p.AddP("$id", l.Id);
            p.AddP("$name", l.Name);
            p.AddP("$barId", l.BarId);
            p.AddP("$phone", l.Phone);
            p.AddP("$notes", l.Notes);
        });

    public List<Lawyer> GetLawyersForDefendant(string defendantId) => _db.Query(
        """
        SELECT l.* FROM lawyers l
        JOIN defendant_lawyers dl ON dl.lawyer_id = l.id
        WHERE dl.defendant_id = $defendantId;
        """,
        MapLawyer,
        p => p.AddP("$defendantId", defendantId));

    public void AttachLawyer(string defendantId, string lawyerId) => _db.Execute(
        "INSERT OR IGNORE INTO defendant_lawyers (defendant_id, lawyer_id) VALUES ($d, $l);",
        p =>
        {
            p.AddP("$d", defendantId);
            p.AddP("$l", lawyerId);
        });

    public void DetachLawyer(string defendantId, string lawyerId) => _db.Execute(
        "DELETE FROM defendant_lawyers WHERE defendant_id = $d AND lawyer_id = $l;",
        p =>
        {
            p.AddP("$d", defendantId);
            p.AddP("$l", lawyerId);
        });

    // ---- interrogations -----------------------------------------------------

    public List<Interrogation> GetInterrogations(string defendantId) => _db.Query(
        "SELECT * FROM interrogations WHERE defendant_id = $defendantId ORDER BY occurred_at",
        MapInterrogation,
        p => p.AddP("$defendantId", defendantId));

    public void AddInterrogation(Interrogation i) => _db.Execute(
        """
        INSERT INTO interrogations (id, defendant_id, occurred_at, kind, summary, lawyer_present)
        VALUES ($id, $defendantId, $occurredAt, $kind, $summary, $lawyerPresent);
        """,
        p =>
        {
            p.AddP("$id", i.Id);
            p.AddP("$defendantId", i.DefendantId);
            p.AddP("$occurredAt", i.OccurredAt);
            p.AddP("$kind", i.Kind);
            p.AddP("$summary", i.Summary);
            p.AddP("$lawyerPresent", i.LawyerPresent);
        });

    // ---- mapping --------------------------------------------------------

    private static Defendant MapDefendant(SqliteDataReader r) => new()
    {
        Id = r.GetStringOrEmpty("id"),
        CaseId = r.GetStringOrEmpty("case_id"),
        FullName = r.GetStringOrEmpty("full_name"),
        NationalId = r.GetStringOrEmpty("national_id"),
        RoleInCase = r.GetStringOrEmpty("role_in_case"),
        CustodyStatus = r.GetStringOrEmpty("custody_status"),
        ArrestWarrantArt193 = r.GetBool("arrest_warrant_art193"),
        IsProtectedIdentity = r.GetBool("is_protected_identity"),
        Notes = r.GetStringOrEmpty("notes"),
        CreatedAt = r.GetDateTimeOffset("created_at"),
        UpdatedAt = r.GetDateTimeOffset("updated_at"),
    };

    private static Charge MapCharge(SqliteDataReader r) => new()
    {
        Id = r.GetStringOrEmpty("id"),
        DefendantId = r.GetStringOrEmpty("defendant_id"),
        Description = r.GetStringOrEmpty("description"),
        LegalBasis = r.GetStringOrEmpty("legal_basis"),
        SeverityBand = r.GetStringOrEmpty("severity_band"),
        IsAggravatedFelony = r.GetBool("is_aggravated_felony"),
    };

    private static DetentionRecordEntity MapDetentionRecord(SqliteDataReader r) => new()
    {
        Id = r.GetStringOrEmpty("id"),
        DefendantId = r.GetStringOrEmpty("defendant_id"),
        RecordType = r.GetStringOrEmpty("record_type"),
        DecidedAt = r.GetDateTimeOffset("decided_at"),
        PeriodStart = r.GetDateTimeOffset("period_start"),
        PeriodEnd = r.GetDateTimeOffset("period_end"),
        DurationMonths = r.GetInt32(r.GetOrdinal("duration_months")),
        DecidedBy = r.GetStringOrEmpty("decided_by"),
        RequiresForensicOrCrossBorder = r.GetBool("requires_forensic_or_cross_border"),
        NotifiedAt = r.GetNullableDateTimeOffset("notified_at"),
        Notes = r.GetStringOrEmpty("notes"),
        CreatedAt = r.GetDateTimeOffset("created_at"),
    };

    private static JudicialControlEntry MapJudicialControl(SqliteDataReader r) => new()
    {
        Id = r.GetStringOrEmpty("id"),
        DefendantId = r.GetStringOrEmpty("defendant_id"),
        MeasureCode = r.GetStringOrEmpty("measure_code"),
        ImposedAt = r.GetDateTimeOffset("imposed_at"),
        ExpiresAt = r.GetNullableDateTimeOffset("expires_at"),
        LiftedAt = r.GetNullableDateTimeOffset("lifted_at"),
        Notes = r.GetStringOrEmpty("notes"),
    };

    private static Lawyer MapLawyer(SqliteDataReader r) => new()
    {
        Id = r.GetStringOrEmpty("id"),
        Name = r.GetStringOrEmpty("name"),
        BarId = r.GetStringOrEmpty("bar_id"),
        Phone = r.GetStringOrEmpty("phone"),
        Notes = r.GetStringOrEmpty("notes"),
    };

    private static Interrogation MapInterrogation(SqliteDataReader r) => new()
    {
        Id = r.GetStringOrEmpty("id"),
        DefendantId = r.GetStringOrEmpty("defendant_id"),
        OccurredAt = r.GetDateTimeOffset("occurred_at"),
        Kind = r.GetStringOrEmpty("kind"),
        Summary = r.GetStringOrEmpty("summary"),
        LawyerPresent = r.GetBool("lawyer_present"),
    };
}
