using InvestigationRoom.Core.Models;
using Microsoft.Data.Sqlite;

namespace InvestigationRoom.Core.Data;

public sealed class CaseRepository
{
    private readonly InvestigationDatabase _db;

    public CaseRepository(InvestigationDatabase db) => _db = db;

    public List<Case> GetAll() => _db.Query(
        "SELECT * FROM cases ORDER BY registration_date DESC",
        Map);

    public void Upsert(Case c)
    {
        c.UpdatedAt = DateTimeOffset.Now;
        _db.Execute(
            """
            INSERT INTO cases (id, case_number, registration_date, title, legal_qualification, is_transnational, primary_judge_name, notes, created_at, updated_at)
            VALUES ($id, $caseNumber, $regDate, $title, $qualification, $transnational, $judge, $notes, $createdAt, $updatedAt)
            ON CONFLICT(id) DO UPDATE SET
                case_number = excluded.case_number,
                registration_date = excluded.registration_date,
                title = excluded.title,
                legal_qualification = excluded.legal_qualification,
                is_transnational = excluded.is_transnational,
                primary_judge_name = excluded.primary_judge_name,
                notes = excluded.notes,
                updated_at = excluded.updated_at;
            """,
            p =>
            {
                p.AddP("$id", c.Id);
                p.AddP("$caseNumber", c.CaseNumber);
                p.AddP("$regDate", c.RegistrationDate);
                p.AddP("$title", c.Title);
                p.AddP("$qualification", c.LegalQualification);
                p.AddP("$transnational", c.IsTransnational);
                p.AddP("$judge", c.PrimaryJudgeName);
                p.AddP("$notes", c.Notes);
                p.AddP("$createdAt", c.CreatedAt);
                p.AddP("$updatedAt", c.UpdatedAt);
            });
    }

    public void Delete(string caseId) =>
        _db.Execute("DELETE FROM cases WHERE id = $id", p => p.AddP("$id", caseId));

    public List<CaseJudge> GetJudges(string caseId) => _db.Query(
        "SELECT * FROM case_judges WHERE case_id = $caseId ORDER BY assigned_at",
        MapJudge,
        p => p.AddP("$caseId", caseId));

    public void AddJudge(CaseJudge judge) => _db.Execute(
        """
        INSERT INTO case_judges (id, case_id, judge_name, role, assigned_at)
        VALUES ($id, $caseId, $name, $role, $assignedAt);
        """,
        p =>
        {
            p.AddP("$id", judge.Id);
            p.AddP("$caseId", judge.CaseId);
            p.AddP("$name", judge.JudgeName);
            p.AddP("$role", judge.Role);
            p.AddP("$assignedAt", judge.AssignedAt);
        });

    public void RemoveJudge(string judgeId) =>
        _db.Execute("DELETE FROM case_judges WHERE id = $id", p => p.AddP("$id", judgeId));

    private static Case Map(SqliteDataReader r) => new()
    {
        Id = r.GetStringOrEmpty("id"),
        CaseNumber = r.GetStringOrEmpty("case_number"),
        RegistrationDate = r.GetDateTimeOffset("registration_date"),
        Title = r.GetStringOrEmpty("title"),
        LegalQualification = r.GetStringOrEmpty("legal_qualification"),
        IsTransnational = r.GetBool("is_transnational"),
        PrimaryJudgeName = r.GetStringOrEmpty("primary_judge_name"),
        Notes = r.GetStringOrEmpty("notes"),
        CreatedAt = r.GetDateTimeOffset("created_at"),
        UpdatedAt = r.GetDateTimeOffset("updated_at"),
    };

    private static CaseJudge MapJudge(SqliteDataReader r) => new()
    {
        Id = r.GetStringOrEmpty("id"),
        CaseId = r.GetStringOrEmpty("case_id"),
        JudgeName = r.GetStringOrEmpty("judge_name"),
        Role = r.GetStringOrEmpty("role"),
        AssignedAt = r.GetDateTimeOffset("assigned_at"),
    };
}
