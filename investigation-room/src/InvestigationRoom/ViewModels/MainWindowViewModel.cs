using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Collections.Specialized;
using System.Linq;
using Avalonia.Threading;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using InvestigationRoom.Models;
using InvestigationRoom.Services;

namespace InvestigationRoom.ViewModels;

public partial class MainWindowViewModel : ObservableObject
{
    private readonly DataStore _store;
    private readonly Workspace _workspace;
    private readonly DispatcherTimer _saveTimer;

    public ObservableCollection<CaseFile> Cases => _workspace.Cases;

    public ObservableCollection<string> ProcedureTemplate => _workspace.ProcedureTemplate;

    [ObservableProperty]
    private CaseFile? _selectedCase;

    [ObservableProperty]
    private Defendant? _selectedDefendant;

    [ObservableProperty]
    private string _newCaseTitle = string.Empty;

    [ObservableProperty]
    private string _newDefendantName = string.Empty;

    [ObservableProperty]
    private string _newAdHocProcedureName = string.Empty;

    [ObservableProperty]
    private string _defendantFilterText = string.Empty;

    [ObservableProperty]
    private ObservableCollection<PendingProcedureRow> _pendingItems = new();

    [ObservableProperty]
    private bool _showAllCasesInPending = true;

    [ObservableProperty]
    private string _statusMessage = "جاهز";

    public LegalCaseViewModel Legal { get; } = new();

    public MainWindowViewModel()
    {
        _store = new DataStore();
        _workspace = _store.Load();

        _saveTimer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(400) };
        _saveTimer.Tick += (_, _) =>
        {
            _saveTimer.Stop();
            _store.Save(_workspace);
            StatusMessage = $"تم الحفظ تلقائيًا - {DateTime.Now:HH:mm:ss}";
        };

        WireWorkspace();
        RefreshPending();

        if (Cases.Count > 0)
        {
            SelectedCase = Cases[0];
        }
    }

    public IEnumerable<Defendant> FilteredDefendants =>
        SelectedCase == null
            ? Enumerable.Empty<Defendant>()
            : string.IsNullOrWhiteSpace(DefendantFilterText)
                ? SelectedCase.Defendants
                : SelectedCase.Defendants.Where(d =>
                    d.FullName.Contains(DefendantFilterText, StringComparison.OrdinalIgnoreCase) ||
                    d.Charge.Contains(DefendantFilterText, StringComparison.OrdinalIgnoreCase) ||
                    d.NationalId.Contains(DefendantFilterText, StringComparison.OrdinalIgnoreCase));

    public string PendingCountLabel => PendingItems.Count == 0
        ? "لا توجد إجراءات معلّقة"
        : $"{PendingItems.Count} إجراء بانتظار التنفيذ ({PendingItems.Count(p => p.IsOverdue)} متجاوز الموعد)";

    public bool HasSelectedCase => SelectedCase != null;

    public bool HasSelectedDefendant => SelectedDefendant != null;

    partial void OnSelectedCaseChanged(CaseFile? value)
    {
        SelectedDefendant = value?.Defendants.FirstOrDefault();
        OnPropertyChanged(nameof(FilteredDefendants));
        OnPropertyChanged(nameof(HasSelectedCase));
        RefreshPending();
    }

    partial void OnSelectedDefendantChanged(Defendant? value) => OnPropertyChanged(nameof(HasSelectedDefendant));

    partial void OnDefendantFilterTextChanged(string value) => OnPropertyChanged(nameof(FilteredDefendants));

    partial void OnShowAllCasesInPendingChanged(bool value) => RefreshPending();

    [RelayCommand]
    private void AddCase()
    {
        var title = NewCaseTitle.Trim();
        if (title.Length == 0)
        {
            StatusMessage = "أدخل عنوان الملف أولًا";
            return;
        }

        var newCase = new CaseFile { Title = title };
        Cases.Add(newCase);
        SelectedCase = newCase;
        NewCaseTitle = string.Empty;
    }

    public void RemoveCase(CaseFile caseFile)
    {
        Cases.Remove(caseFile);
        if (ReferenceEquals(SelectedCase, caseFile))
        {
            SelectedCase = Cases.FirstOrDefault();
        }
    }

    [RelayCommand]
    private void AddDefendant()
    {
        if (SelectedCase == null)
        {
            StatusMessage = "اختر ملف قضية أولًا";
            return;
        }

        var name = NewDefendantName.Trim();
        if (name.Length == 0)
        {
            StatusMessage = "أدخل اسم المتهم أولًا";
            return;
        }

        var defendant = new Defendant { FullName = name };
        foreach (var procedureName in ProcedureTemplate)
        {
            defendant.Procedures.Add(new ProcedureItem { Name = procedureName });
        }

        SelectedCase.Defendants.Add(defendant);
        SelectedDefendant = defendant;
        NewDefendantName = string.Empty;
    }

    public void RemoveDefendant(Defendant defendant)
    {
        SelectedCase?.Defendants.Remove(defendant);
        if (ReferenceEquals(SelectedDefendant, defendant))
        {
            SelectedDefendant = SelectedCase?.Defendants.FirstOrDefault();
        }
    }

    [RelayCommand]
    private void ApplyTemplateToSelectedDefendant()
    {
        if (SelectedDefendant == null)
        {
            StatusMessage = "اختر متهمًا أولًا";
            return;
        }

        var existingNames = SelectedDefendant.Procedures.Select(p => p.Name).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var added = 0;
        foreach (var name in ProcedureTemplate)
        {
            if (existingNames.Contains(name))
            {
                continue;
            }

            SelectedDefendant.Procedures.Add(new ProcedureItem { Name = name });
            added++;
        }

        StatusMessage = added == 0
            ? "لا توجد إجراءات جديدة لإضافتها من القائمة"
            : $"تمت إضافة {added} إجراء من القائمة";
    }

    [RelayCommand]
    private void AddAdHocProcedure()
    {
        if (SelectedDefendant == null)
        {
            StatusMessage = "اختر متهمًا أولًا";
            return;
        }

        var name = NewAdHocProcedureName.Trim();
        if (name.Length == 0)
        {
            StatusMessage = "أدخل اسم الإجراء أولًا";
            return;
        }

        SelectedDefendant.Procedures.Add(new ProcedureItem { Name = name });
        NewAdHocProcedureName = string.Empty;
    }

    public void RemoveProcedure(ProcedureItem procedure)
    {
        SelectedDefendant?.Procedures.Remove(procedure);
    }

    public void MarkDone(PendingProcedureRow row)
    {
        row.Procedure.Status = ProcedureStatus.Done;
    }

    public void AddTemplateItem(string name)
    {
        var trimmed = name.Trim();
        if (trimmed.Length == 0 || ProcedureTemplate.Any(p => string.Equals(p, trimmed, StringComparison.OrdinalIgnoreCase)))
        {
            return;
        }

        ProcedureTemplate.Add(trimmed);
    }

    public void RemoveTemplateItem(string name) => ProcedureTemplate.Remove(name);

    private void WireWorkspace()
    {
        _workspace.Cases.CollectionChanged += CasesOnCollectionChanged;
        foreach (var caseFile in _workspace.Cases)
        {
            WireCase(caseFile);
        }

        _workspace.ProcedureTemplate.CollectionChanged += (_, _) => RequestSave();
    }

    private void CasesOnCollectionChanged(object? sender, NotifyCollectionChangedEventArgs e)
    {
        if (e.NewItems != null)
        {
            foreach (CaseFile caseFile in e.NewItems)
            {
                WireCase(caseFile);
            }
        }

        RequestSave();
        RefreshPending();
    }

    private void WireCase(CaseFile caseFile)
    {
        caseFile.PropertyChanged += (_, _) => RequestSave();
        caseFile.Defendants.CollectionChanged += (_, e) => DefendantsOnCollectionChanged(caseFile, e);
        foreach (var defendant in caseFile.Defendants)
        {
            WireDefendant(defendant);
        }
    }

    private void DefendantsOnCollectionChanged(CaseFile caseFile, NotifyCollectionChangedEventArgs e)
    {
        if (e.NewItems != null)
        {
            foreach (Defendant defendant in e.NewItems)
            {
                WireDefendant(defendant);
            }
        }

        RequestSave();
        RefreshPending();
        if (ReferenceEquals(caseFile, SelectedCase))
        {
            OnPropertyChanged(nameof(FilteredDefendants));
        }
    }

    private void WireDefendant(Defendant defendant)
    {
        defendant.PropertyChanged += (_, _) => RequestSave();
        defendant.Procedures.CollectionChanged += (_, e) => ProceduresOnCollectionChanged(defendant, e);
        foreach (var procedure in defendant.Procedures)
        {
            WireProcedure(defendant, procedure);
        }
    }

    private void ProceduresOnCollectionChanged(Defendant defendant, NotifyCollectionChangedEventArgs e)
    {
        if (e.NewItems != null)
        {
            foreach (ProcedureItem procedure in e.NewItems)
            {
                WireProcedure(defendant, procedure);
            }
        }

        defendant.RaiseProgressChanged();
        RequestSave();
        RefreshPending();
    }

    private void WireProcedure(Defendant defendant, ProcedureItem procedure)
    {
        procedure.PropertyChanged += (_, _) =>
        {
            defendant.RaiseProgressChanged();
            RequestSave();
            RefreshPending();
        };
    }

    private void RequestSave()
    {
        _saveTimer.Stop();
        _saveTimer.Start();
    }

    private void RefreshPending()
    {
        var source = ShowAllCasesInPending
            ? Cases.AsEnumerable()
            : SelectedCase != null
                ? new[] { SelectedCase }
                : Enumerable.Empty<CaseFile>();

        var rows = source
            .SelectMany(c => c.Defendants.Select(d => (Case: c, Defendant: d)))
            .SelectMany(cd => cd.Defendant.Procedures
                .Where(p => p.Status != ProcedureStatus.Done)
                .Select(p => new PendingProcedureRow(cd.Case, cd.Defendant, p)))
            .OrderByDescending(r => r.IsOverdue)
            .ThenBy(r => r.DueDate.HasValue ? 0 : 1)
            .ThenBy(r => r.DueDate)
            .ThenBy(r => r.ProcedureName, StringComparer.CurrentCulture)
            .ToList();

        PendingItems = new ObservableCollection<PendingProcedureRow>(rows);
        OnPropertyChanged(nameof(PendingCountLabel));
    }
}
