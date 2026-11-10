using System;
using System.Globalization;
using Avalonia.Data.Converters;
using Avalonia.Media;
using InvestigationRoom.Models;

namespace InvestigationRoom.Converters;

public class StatusToArabicConverter : IValueConverter
{
    public static readonly StatusToArabicConverter Instance = new();

    public object? Convert(object? value, Type targetType, object? parameter, CultureInfo culture) =>
        value is ProcedureStatus status ? status.ToArabicLabel() : value?.ToString();

    public object? ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture) =>
        throw new NotSupportedException();
}

public class OverdueToBrushConverter : IValueConverter
{
    public static readonly OverdueToBrushConverter Instance = new();

    public object? Convert(object? value, Type targetType, object? parameter, CultureInfo culture) =>
        value is true ? Brushes.OrangeRed : Brushes.Transparent;

    public object? ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture) =>
        throw new NotSupportedException();
}

public class OverdueBackgroundConverter : IValueConverter
{
    public static readonly OverdueBackgroundConverter Instance = new();
    private static readonly SolidColorBrush Tint = new(Color.Parse("#26F44336"));

    public object? Convert(object? value, Type targetType, object? parameter, CultureInfo culture) =>
        value is true ? Tint : Brushes.Transparent;

    public object? ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture) =>
        throw new NotSupportedException();
}

public class StatusToBrushConverter : IValueConverter
{
    public static readonly StatusToBrushConverter Instance = new();

    public object? Convert(object? value, Type targetType, object? parameter, CultureInfo culture) =>
        value switch
        {
            ProcedureStatus.Done => new SolidColorBrush(Color.Parse("#2E7D32")),
            ProcedureStatus.InProgress => new SolidColorBrush(Color.Parse("#B8860B")),
            ProcedureStatus.NotStarted => new SolidColorBrush(Color.Parse("#616161")),
            _ => Brushes.Gray
        };

    public object? ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture) =>
        throw new NotSupportedException();
}

public class NullToFalseConverter : IValueConverter
{
    public static readonly NullToFalseConverter Instance = new();

    public object? Convert(object? value, Type targetType, object? parameter, CultureInfo culture) =>
        value != null;

    public object? ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture) =>
        throw new NotSupportedException();
}

public class InverseBoolConverter : IValueConverter
{
    public static readonly InverseBoolConverter Instance = new();

    public object? Convert(object? value, Type targetType, object? parameter, CultureInfo culture) =>
        value is bool b ? !b : value;

    public object? ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture) =>
        value is bool b ? !b : value;
}

public class DetentionAlertToBrushConverter : IValueConverter
{
    public static readonly DetentionAlertToBrushConverter Instance = new();

    public object? Convert(object? value, Type targetType, object? parameter, CultureInfo culture) =>
        value is InvestigationRoom.Core.Legal.DetentionAlertLevel level
            ? level switch
            {
                InvestigationRoom.Core.Legal.DetentionAlertLevel.Green => new SolidColorBrush(Color.Parse("#2E7D32")),
                InvestigationRoom.Core.Legal.DetentionAlertLevel.Orange => new SolidColorBrush(Color.Parse("#E65100")),
                InvestigationRoom.Core.Legal.DetentionAlertLevel.Red => new SolidColorBrush(Color.Parse("#C62828")),
                InvestigationRoom.Core.Legal.DetentionAlertLevel.Expired => new SolidColorBrush(Color.Parse("#B71C1C")),
                _ => new SolidColorBrush(Color.Parse("#757575")),
            }
            : Brushes.Gray;

    public object? ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture) =>
        throw new NotSupportedException();
}

public class DetentionAlertToBackgroundConverter : IValueConverter
{
    public static readonly DetentionAlertToBackgroundConverter Instance = new();

    public object? Convert(object? value, Type targetType, object? parameter, CultureInfo culture) =>
        value is InvestigationRoom.Core.Legal.DetentionAlertLevel level
            ? level switch
            {
                InvestigationRoom.Core.Legal.DetentionAlertLevel.Orange => new SolidColorBrush(Color.Parse("#1AE65100")),
                InvestigationRoom.Core.Legal.DetentionAlertLevel.Red => new SolidColorBrush(Color.Parse("#1AC62828")),
                InvestigationRoom.Core.Legal.DetentionAlertLevel.Expired => new SolidColorBrush(Color.Parse("#33B71C1C")),
                _ => Brushes.Transparent,
            }
            : Brushes.Transparent;

    public object? ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture) =>
        throw new NotSupportedException();
}
