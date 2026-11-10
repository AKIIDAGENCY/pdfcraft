using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.IO;
using System.Linq;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using InvestigationRoom.Core.Data;
using InvestigationRoom.Core.Legal;
using InvestigationRoom.Core.Models;
using Microsoft.Data.Sqlite;

namespace InvestigationRoom.ViewModels;

/// <summary>
/// Drives the "الحبس المؤقت والرقابة القضائية" (Detention &amp; Judicial
/// Control) tab: the SQLCipher-encrypted case database, the defendant
/// matrix, and the actions that create new detention_records rows (the
/// Detention &amp; Deadline Engine then just reads whatever is in the DB —
/// see InvestigationRoom.Core.Legal.DetentionEngine).
/// </summary>
public partial class LegalCaseViewModel : ObservableObject
{
    public static string DefaultDatabasePath { get; } = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
        "InvestigationRoom",
        "legal-cases.db");

    private InvestigationDatabase? _db;
    private CaseRepository? _caseRepo;
    private DefendantRepository? _defendantRepo;
    private CaseSupportRepository? _supportRepo;

    [ObservableProperty]
    private bool _isUnlocked;

    [ObservableProperty]
    private ObservableCollection<Case> _cases = new();

    [ObservableProperty]
    private Case? _selectedCase;

    [ObservableProperty]
    private ObservableCollection<DefendantRow> _defendantRows = new();

    [ObservableProperty]
    private string _searchText = string.Empty;

    [ObservableProperty]
    private string _statusMessage = "قاعدة بيانات القضايا مقفلة.";

    public IEnumerable<DefendantRow> FilteredRows =>
        string.IsNullOrWhiteSpace(SearchText)
            ? DefendantRows
            : DefendantRows.Where(r =>
                r.FullName.Contains(SearchText, StringComparison.OrdinalIgnoreCase) ||
                r.NationalId.Contains(SearchText, StringComparison.OrdinalIgnoreCase));

    partial void OnSearchTextChanged(string value) => OnPropertyChanged(nameof(FilteredRows));

    partial void OnDefendantRowsChanged(ObservableCollection<DefendantRow> value) => OnPropertyChanged(nameof(FilteredRows));

    /// <summary>Attempts to open (or create) the encrypted database with the given passphrase. Returns an Arabic error message on failure, or null on success.</summary>
    public string? TryUnlock(string passphrase)
    {
        try
        {
            var directory = Path.GetDirectoryName(DefaultDatabasePath)!;
            Directory.CreateDirectory(directory);

            var db = new InvestigationDatabase(DefaultDatabasePath, passphrase);
            // Force a real read so a wrong passphrase on an existing
            // SQLCipher file fails now rather than on first later use.
            db.Execute("SELECT count(*) FROM sqlite_master;");

            _db = db;
            _caseRepo = new CaseRepository(_db);
            _defendantRepo = new DefendantRepository(_db);
            _supportRepo = new CaseSupportRepository(_db);
            IsUnlocked = true;
            StatusMessage = "تم فتح قاعدة البيانات.";
            LoadCases();
            return null;
        }
        catch (SqliteException)
        {
            return "كلمة المرور غير صحيحة، أو الملف تالف.";
        }
    }

    public void LoadCases()
    {
        if (_caseRepo == null)
        {
            return;
        }

        Cases = new ObservableCollection<Case>(_caseRepo.GetAll());
        SelectedCase ??= Cases.FirstOrDefault();
        if (SelectedCase != null)
        {
            LoadDefendants(SelectedCase);
        }
    }

    partial void OnSelectedCaseChanged(Case? value)
    {
        if (value != null)
        {
            LoadDefendants(value);
        }
    }

    private void LoadDefendants(Case c)
    {
        if (_defendantRepo == null)
        {
            return;
        }

        var now = DateTimeOffset.Now;
        var rows = new List<DefendantRow>();
        foreach (var defendant in _defendantRepo.GetByCase(c.Id))
        {
            var charges = _defendantRepo.GetCharges(defendant.Id);
            var detentionRecords = _defendantRepo.GetDetentionRecords(defendant.Id)
                .Select(r => new DetentionRecord(
                    MapType(r.RecordType),
                    r.PeriodStart,
                    r.PeriodEnd,
                    r.DecidedAt))
                .ToList();

            var qualifies = charges.Any(ch => ch.QualifiesExtendedDetention);
            var assessment = DetentionEngine.Assess(detentionRecords, qualifies, c.IsTransnational, now);

            var row = new DefendantRow(defendant, assessment, this)
            {
                Charges = charges,
                JudicialControlEntries = _defendantRepo.GetJudicialControl(defendant.Id),
            };
            rows.Add(row);
        }

        DefendantRows = new ObservableCollection<DefendantRow>(rows);
    }

    private static DetentionRecordType MapType(string recordType) => recordType switch
    {
        "ايداع" => DetentionRecordType.Deposit,
        "تمديد_قاضي_تحقيق" => DetentionRecordType.JudgeRenewal,
        "تمديد_غرفة_الاتهام" => DetentionRecordType.ChamberOfAccusationExtension,
        "افراج" => DetentionRecordType.Release,
        _ => DetentionRecordType.Deposit,
    };

    [RelayCommand]
    private void SeedMockCase()
    {
        if (_db == null)
        {
            return;
        }

        var seeded = MockDataSeeder.SeedComplexCase(_db);
        StatusMessage = $"تم إنشاء قضية تجريبية بـ 60 متهمًا: {seeded.Title}";
        LoadCases();
        SelectedCase = Cases.FirstOrDefault(c => c.Id == seeded.Id);
    }

    public void RequestJudgeRenewal(DefendantRow? row)
    {
        if (_defendantRepo == null || row == null || !row.Assessment.CanRequestJudgeRenewal)
        {
            StatusMessage = "هذا المتهم غير مؤهل لتمديد جديد من قاضي التحقيق حاليًا.";
            return;
        }

        var start = row.Assessment.CurrentPeriodEnd ?? DateTimeOffset.Now;
        _defendantRepo.AddDetentionRecord(new Core.Models.DetentionRecordEntity
        {
            DefendantId = row.Defendant.Id,
            RecordType = "تمديد_قاضي_تحقيق",
            DecidedAt = DateTimeOffset.Now,
            PeriodStart = start,
            PeriodEnd = start + LegalRules.RenewalStepLength,
            DurationMonths = 4,
        });

        RefreshRow(row);
        StatusMessage = $"تم تسجيل تمديد من قاضي التحقيق للمتهم {row.FullName}.";
    }

    public void RequestChamberExtension(DefendantRow? row)
    {
        if (_defendantRepo == null || row == null || !row.Assessment.CanRequestChamberExtension)
        {
            StatusMessage = "شروط تمديد غرفة الاتهام غير متوفرة لهذا المتهم.";
            return;
        }

        var start = row.Assessment.CurrentPeriodEnd ?? DateTimeOffset.Now;
        _defendantRepo.AddDetentionRecord(new Core.Models.DetentionRecordEntity
        {
            DefendantId = row.Defendant.Id,
            RecordType = "تمديد_غرفة_الاتهام",
            DecidedAt = DateTimeOffset.Now,
            PeriodStart = start,
            PeriodEnd = start + LegalRules.RenewalStepLength,
            DurationMonths = 4,
            RequiresForensicOrCrossBorder = true,
        });

        RefreshRow(row);
        StatusMessage = $"تم تسجيل تمديد من غرفة الاتهام للمتهم {row.FullName}.";
    }

    public void ReleaseDefendant(DefendantRow? row)
    {
        if (_defendantRepo == null || row == null)
        {
            return;
        }

        var now = DateTimeOffset.Now;
        _defendantRepo.AddDetentionRecord(new Core.Models.DetentionRecordEntity
        {
            DefendantId = row.Defendant.Id,
            RecordType = "افراج",
            DecidedAt = now,
            PeriodStart = now,
            PeriodEnd = now,
            DurationMonths = 0,
        });

        row.Defendant.CustodyStatus = Core.Models.CustodyStatus.Free;
        _defendantRepo.Upsert(row.Defendant);

        RefreshRow(row);
        StatusMessage = $"تم تسجيل الإفراج عن المتهم {row.FullName}.";
    }

    private void RefreshRow(DefendantRow row)
    {
        if (SelectedCase != null)
        {
            LoadDefendants(SelectedCase);
        }
    }
}
