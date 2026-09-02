using System.Threading.Tasks;
using Avalonia.Controls;
using Avalonia.Interactivity;
using Avalonia.Markup.Xaml;

namespace InvestigationRoom.Views;

public partial class ConfirmDialog : Window
{
    private readonly TextBlock _titleText;
    private readonly TextBlock _messageText;

    public ConfirmDialog()
    {
        InitializeComponent();
        _titleText = this.FindControl<TextBlock>("TitleText")!;
        _messageText = this.FindControl<TextBlock>("MessageText")!;
    }

    private void InitializeComponent() => AvaloniaXamlLoader.Load(this);

    private void OnYesClick(object? sender, RoutedEventArgs e) => Close(true);

    private void OnNoClick(object? sender, RoutedEventArgs e) => Close(false);

    public static Task<bool> Ask(Window owner, string title, string message)
    {
        var dialog = new ConfirmDialog();
        dialog._titleText.Text = title;
        dialog._messageText.Text = message;
        return dialog.ShowDialog<bool>(owner);
    }
}
