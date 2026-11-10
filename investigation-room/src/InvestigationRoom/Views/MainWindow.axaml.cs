using Avalonia.Controls;
using Avalonia.Interactivity;
using Avalonia.Markup.Xaml;
using InvestigationRoom.Models;
using InvestigationRoom.ViewModels;

namespace InvestigationRoom.Views;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
    }

    private void InitializeComponent() => AvaloniaXamlLoader.Load(this);

    private MainWindowViewModel? ViewModel => DataContext as MainWindowViewModel;

    private async void OnDeleteCaseClick(object? sender, RoutedEventArgs e)
    {
        var vm = ViewModel;
        var caseFile = vm?.SelectedCase;
        if (vm == null || caseFile == null)
        {
            return;
        }

        var confirmed = await ConfirmDialog.Ask(
            this,
            "حذف ملف القضية",
            $"سيتم حذف الملف \"{caseFile.Title}\" وجميع المتهمين والإجراءات المسجلة فيه نهائيًا. هل تريد المتابعة؟");

        if (confirmed)
        {
            vm.RemoveCase(caseFile);
        }
    }

    private async void OnDeleteDefendantClick(object? sender, RoutedEventArgs e)
    {
        var vm = ViewModel;
        var defendant = vm?.SelectedDefendant;
        if (vm == null || defendant == null)
        {
            return;
        }

        var confirmed = await ConfirmDialog.Ask(
            this,
            "حذف المتهم",
            $"سيتم حذف المتهم \"{defendant.FullName}\" وجميع إجراءاته المسجلة نهائيًا. هل تريد المتابعة؟");

        if (confirmed)
        {
            vm.RemoveDefendant(defendant);
        }
    }

    private async void OnRemoveProcedureClick(object? sender, RoutedEventArgs e)
    {
        var vm = ViewModel;
        if (vm == null || sender is not Button { Tag: ProcedureItem procedure })
        {
            return;
        }

        var confirmed = await ConfirmDialog.Ask(
            this,
            "حذف الإجراء",
            $"سيتم حذف الإجراء \"{procedure.Name}\" من قائمة هذا المتهم. هل تريد المتابعة؟");

        if (confirmed)
        {
            vm.RemoveProcedure(procedure);
        }
    }

    private void OnManageTemplateClick(object? sender, RoutedEventArgs e)
    {
        var vm = ViewModel;
        if (vm == null)
        {
            return;
        }

        var dialog = new TemplateManagerDialog();
        dialog.Configure(vm, vm.ProcedureTemplate);
        dialog.ShowDialog(this);
    }

    private void OnMarkDoneClick(object? sender, RoutedEventArgs e)
    {
        var vm = ViewModel;
        if (vm != null && sender is Button { Tag: PendingProcedureRow row })
        {
            vm.MarkDone(row);
        }
    }

    private async void OnUnlockLegalDbClick(object? sender, RoutedEventArgs e)
    {
        var legal = ViewModel?.Legal;
        if (legal == null)
        {
            return;
        }

        await PassphraseDialog.Ask(this, legal.TryUnlock);
    }
}
