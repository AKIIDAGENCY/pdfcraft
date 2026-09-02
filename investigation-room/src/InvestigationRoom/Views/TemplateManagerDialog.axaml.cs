using System.Collections.ObjectModel;
using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Interactivity;
using Avalonia.Markup.Xaml;
using InvestigationRoom.ViewModels;

namespace InvestigationRoom.Views;

public partial class TemplateManagerDialog : Window
{
    private MainWindowViewModel? _viewModel;
    private readonly ListBox _itemsList;
    private readonly TextBox _newItemBox;

    public TemplateManagerDialog()
    {
        InitializeComponent();
        _itemsList = this.FindControl<ListBox>("ItemsList")!;
        _newItemBox = this.FindControl<TextBox>("NewItemBox")!;
    }

    private void InitializeComponent() => AvaloniaXamlLoader.Load(this);

    public void Configure(MainWindowViewModel viewModel, ObservableCollection<string> template)
    {
        _viewModel = viewModel;
        _itemsList.ItemsSource = template;
    }

    private void OnAddClick(object? sender, RoutedEventArgs e) => AddFromBox();

    private void OnNewItemKeyDown(object? sender, KeyEventArgs e)
    {
        if (e.Key == Key.Enter)
        {
            AddFromBox();
        }
    }

    private void AddFromBox()
    {
        if (_viewModel == null)
        {
            return;
        }

        _viewModel.AddTemplateItem(_newItemBox.Text ?? string.Empty);
        _newItemBox.Text = string.Empty;
        _newItemBox.Focus();
    }

    private void OnRemoveClick(object? sender, RoutedEventArgs e)
    {
        if (_viewModel != null && sender is Button { Tag: string name })
        {
            _viewModel.RemoveTemplateItem(name);
        }
    }

    private void OnCloseClick(object? sender, RoutedEventArgs e) => Close();
}
