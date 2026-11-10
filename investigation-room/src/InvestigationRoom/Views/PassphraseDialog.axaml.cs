using System;
using System.Threading.Tasks;
using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Interactivity;
using Avalonia.Markup.Xaml;

namespace InvestigationRoom.Views;

public partial class PassphraseDialog : Window
{
    private readonly TextBox _passwordBox;
    private readonly TextBlock _errorText;
    private Func<string, string?>? _tryOpen;

    public PassphraseDialog()
    {
        InitializeComponent();
        _passwordBox = this.FindControl<TextBox>("PasswordBox")!;
        _errorText = this.FindControl<TextBlock>("ErrorText")!;
    }

    private void InitializeComponent() => AvaloniaXamlLoader.Load(this);

    /// <summary>
    /// Shows the dialog. <paramref name="tryOpen"/> is called with the
    /// entered passphrase; return null on success, or an Arabic error
    /// message to keep the dialog open and show it. Result is the
    /// accepted passphrase, or null if the user cancelled.
    /// </summary>
    public static Task<string?> Ask(Window owner, Func<string, string?> tryOpen)
    {
        var dialog = new PassphraseDialog { _tryOpen = tryOpen };
        return dialog.ShowDialog<string?>(owner);
    }

    private void OnKeyDown(object? sender, KeyEventArgs e)
    {
        if (e.Key == Key.Enter)
        {
            Attempt();
        }
    }

    private void OnOkClick(object? sender, RoutedEventArgs e) => Attempt();

    private void OnCancelClick(object? sender, RoutedEventArgs e) => Close(null);

    private void Attempt()
    {
        var password = _passwordBox.Text ?? string.Empty;
        if (password.Length == 0)
        {
            ShowError("أدخل كلمة مرور.");
            return;
        }

        var error = _tryOpen?.Invoke(password);
        if (error == null)
        {
            Close(password);
        }
        else
        {
            ShowError(error);
        }
    }

    private void ShowError(string message)
    {
        _errorText.Text = message;
        _errorText.IsVisible = true;
    }
}
