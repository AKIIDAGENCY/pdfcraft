using InvestigationRoom.Core.Models;
using Microsoft.Data.Sqlite;

namespace InvestigationRoom.Core.Data;

public sealed class CaseSupportRepository
{
    private readonly InvestigationDatabase _db;

    public CaseSupportRepository(InvestigationDatabase db) => _db = db;

    // ---- interceptions (Arts. 114-116, 120-126) --------------------------

    public List<Interception> GetInterceptions(string caseId) => _db.Query(
        "SELECT * FROM interceptions WHERE case_id = $caseId ORDER BY authorized_at",
        MapInterception,
        p => p.AddP("$caseId", caseId));

    public void UpsertInterception(Interception i) => _db.Execute(
        """
        INSERT INTO interceptions (id, case_id, kind, target_description, authorized_at, expires_at, renewal_count, authorized_by, notes)
        VALUES ($id, $caseId, $kind, $target, $authorizedAt, $expiresAt, $renewals, $authorizedBy, $notes)
        ON CONFLICT(id) DO UPDATE SET
            expires_at = excluded.expires_at,
            renewal_count = excluded.renewal_count,
            notes = excluded.notes;
        """,
        p =>
        {
            p.AddP("$id", i.Id);
            p.AddP("$caseId", i.CaseId);
            p.AddP("$kind", i.Kind);
            p.AddP("$target", i.TargetDescription);
            p.AddP("$authorizedAt", i.AuthorizedAt);
            p.AddP("$expiresAt", i.ExpiresAt);
            p.AddP("$renewals", i.RenewalCount);
            p.AddP("$authorizedBy", i.AuthorizedBy);
            p.AddP("$notes", i.Notes);
        });

    public void DeleteInterception(string id) =>
        _db.Execute("DELETE FROM interceptions WHERE id = $id", p => p.AddP("$id", id));

    // ---- seizures (Arts. 50-52, 71) --------------------------------------

    public List<Seizure> GetSeizures(string caseId) => _db.Query(
        "SELECT * FROM seizures WHERE case_id = $caseId ORDER BY seized_at",
        MapSeizure,
        p => p.AddP("$caseId", caseId));

    public void UpsertSeizure(Seizure s) => _db.Execute(
        """
        INSERT INTO seizures (id, case_id, defendant_id, asset_description, asset_kind, estimated_value, seized_at, status, notes)
        VALUES ($id, $caseId, $defendantId, $description, $kind, $value, $seizedAt, $status, $notes)
        ON CONFLICT(id) DO UPDATE SET status = excluded.status, notes = excluded.notes, estimated_value = excluded.estimated_value;
        """,
        p =>
        {
            p.AddP("$id", s.Id);
            p.AddP("$caseId", s.CaseId);
            p.AddP("$defendantId", s.DefendantId);
            p.AddP("$description", s.AssetDescription);
            p.AddP("$kind", s.AssetKind);
            p.AddP("$value", s.EstimatedValue);
            p.AddP("$seizedAt", s.SeizedAt);
            p.AddP("$status", s.Status);
            p.AddP("$notes", s.Notes);
        });

    public void DeleteSeizure(string id) =>
        _db.Execute("DELETE FROM seizures WHERE id = $id", p => p.AddP("$id", id));

    // ---- network links ----------------------------------------------------

    public List<NetworkLink> GetNetworkLinks(string caseId) => _db.Query(
        "SELECT * FROM network_links WHERE case_id = $caseId",
        MapNetworkLink,
        p => p.AddP("$caseId", caseId));

    public void AddNetworkLink(NetworkLink link) => _db.Execute(
        """
        INSERT INTO network_links (id, case_id, from_defendant_id, to_defendant_id, relationship, shared_seizure_id, notes)
        VALUES ($id, $caseId, $from, $to, $relationship, $seizureId, $notes);
        """,
        p =>
        {
            p.AddP("$id", link.Id);
            p.AddP("$caseId", link.CaseId);
            p.AddP("$from", link.FromDefendantId);
            p.AddP("$to", link.ToDefendantId);
            p.AddP("$relationship", link.Relationship);
            p.AddP("$seizureId", link.SharedSeizureId);
            p.AddP("$notes", link.Notes);
        });

    public void DeleteNetworkLink(string id) =>
        _db.Execute("DELETE FROM network_links WHERE id = $id", p => p.AddP("$id", id));

    private static Interception MapInterception(SqliteDataReader r) => new()
    {
        Id = r.GetStringOrEmpty("id"),
        CaseId = r.GetStringOrEmpty("case_id"),
        Kind = r.GetStringOrEmpty("kind"),
        TargetDescription = r.GetStringOrEmpty("target_description"),
        AuthorizedAt = r.GetDateTimeOffset("authorized_at"),
        ExpiresAt = r.GetDateTimeOffset("expires_at"),
        RenewalCount = r.GetInt32(r.GetOrdinal("renewal_count")),
        AuthorizedBy = r.GetStringOrEmpty("authorized_by"),
        Notes = r.GetStringOrEmpty("notes"),
    };

    private static Seizure MapSeizure(SqliteDataReader r) => new()
    {
        Id = r.GetStringOrEmpty("id"),
        CaseId = r.GetStringOrEmpty("case_id"),
        DefendantId = r.GetNullableString("defendant_id"),
        AssetDescription = r.GetStringOrEmpty("asset_description"),
        AssetKind = r.GetStringOrEmpty("asset_kind"),
        EstimatedValue = r.GetStringOrEmpty("estimated_value"),
        SeizedAt = r.GetDateTimeOffset("seized_at"),
        Status = r.GetStringOrEmpty("status"),
        Notes = r.GetStringOrEmpty("notes"),
    };

    private static NetworkLink MapNetworkLink(SqliteDataReader r) => new()
    {
        Id = r.GetStringOrEmpty("id"),
        CaseId = r.GetStringOrEmpty("case_id"),
        FromDefendantId = r.GetStringOrEmpty("from_defendant_id"),
        ToDefendantId = r.GetStringOrEmpty("to_defendant_id"),
        Relationship = r.GetStringOrEmpty("relationship"),
        SharedSeizureId = r.GetNullableString("shared_seizure_id"),
        Notes = r.GetStringOrEmpty("notes"),
    };
}

/// <summary>
/// Separate repository for the protected-witness table on purpose: it is
/// the one place <see cref="WitnessProtected.RealIdentitySealed"/> is ever
/// read back, so every call site that touches it is easy to audit
/// (Arts. 128-138 — identity isolation for protected witnesses/informants).
/// </summary>
public sealed class WitnessProtectionRepository
{
    private readonly InvestigationDatabase _db;

    public WitnessProtectionRepository(InvestigationDatabase db) => _db = db;

    /// <summary>Listing view: alias only, never the sealed real identity.</summary>
    public List<(string Id, string AliasCode, string ProtectionMeasures, DateTimeOffset AuthorizedAt)> GetAliasesForCase(string caseId) =>
        _db.Query(
            "SELECT id, alias_code, protection_measures, authorized_at FROM witnesses_protected WHERE case_id = $caseId ORDER BY authorized_at",
            r => (r.GetStringOrEmpty("id"), r.GetStringOrEmpty("alias_code"), r.GetStringOrEmpty("protection_measures"), r.GetDateTimeOffset("authorized_at")),
            p => p.AddP("$caseId", caseId));

    /// <summary>Explicit reveal of the sealed identity — call only from a user-confirmed "reveal" action.</summary>
    public WitnessProtected? Reveal(string id) => _db.QuerySingle(
        "SELECT * FROM witnesses_protected WHERE id = $id",
        Map,
        p => p.AddP("$id", id));

    public void Upsert(WitnessProtected w) => _db.Execute(
        """
        INSERT INTO witnesses_protected (id, case_id, alias_code, real_identity_sealed, protection_measures, authorized_at, authorized_by, notes)
        VALUES ($id, $caseId, $alias, $real, $measures, $authorizedAt, $authorizedBy, $notes)
        ON CONFLICT(id) DO UPDATE SET
            protection_measures = excluded.protection_measures,
            notes = excluded.notes;
        """,
        p =>
        {
            p.AddP("$id", w.Id);
            p.AddP("$caseId", w.CaseId);
            p.AddP("$alias", w.AliasCode);
            p.AddP("$real", w.RealIdentitySealed);
            p.AddP("$measures", w.ProtectionMeasures);
            p.AddP("$authorizedAt", w.AuthorizedAt);
            p.AddP("$authorizedBy", w.AuthorizedBy);
            p.AddP("$notes", w.Notes);
        });

    public void Delete(string id) =>
        _db.Execute("DELETE FROM witnesses_protected WHERE id = $id", p => p.AddP("$id", id));

    private static WitnessProtected Map(SqliteDataReader r) => new()
    {
        Id = r.GetStringOrEmpty("id"),
        CaseId = r.GetStringOrEmpty("case_id"),
        AliasCode = r.GetStringOrEmpty("alias_code"),
        RealIdentitySealed = r.GetStringOrEmpty("real_identity_sealed"),
        ProtectionMeasures = r.GetStringOrEmpty("protection_measures"),
        AuthorizedAt = r.GetDateTimeOffset("authorized_at"),
        AuthorizedBy = r.GetStringOrEmpty("authorized_by"),
        Notes = r.GetStringOrEmpty("notes"),
    };
}
