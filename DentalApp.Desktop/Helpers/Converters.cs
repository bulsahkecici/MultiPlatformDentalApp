using System.Globalization;
using System.Windows;
using System.Windows.Data;

namespace DentalApp.Desktop.Helpers
{
    public class InverseBooleanConverter : IValueConverter
    {
        public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        {
            if (value is bool boolValue)
            {
                return !boolValue;
            }
            return true;
        }

        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        {
            if (value is bool boolValue)
            {
                return !boolValue;
            }
            return false;
        }
    }

    public class BooleanToTextConverter : IValueConverter
    {
        public string TrueText { get; set; } = "Yes";
        public string FalseText { get; set; } = "No";

        public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        {
            if (value is bool boolValue)
            {
                return boolValue ? TrueText : FalseText;
            }
            return FalseText;
        }

        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        {
            throw new NotImplementedException();
        }
    }

    public class StatusToTurkishConverter : IValueConverter
    {
        private static readonly Dictionary<string, string> StatusTranslations = new()
        {
            // Appointment statuses
            { "scheduled", "Planlandı" },
            { "confirmed", "Onaylandı" },
            { "completed", "Tamamlandı" },
            { "cancelled", "İptal Edildi" },
            { "no_show", "Gelmedi" },
            
            // Treatment statuses
            { "planned", "Planlandı" },
            { "in_progress", "Devam Ediyor" }
            // "completed" and "cancelled" already added above
        };

        public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        {
            if (value is string status && !string.IsNullOrWhiteSpace(status))
            {
                return StatusTranslations.TryGetValue(status.ToLower(), out var translation) 
                    ? translation 
                    : status;
            }
            return value?.ToString() ?? string.Empty;
        }

        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        {
            throw new NotImplementedException();
        }
    }

    public class NullToBooleanConverter : IValueConverter
    {
        public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        {
            return value != null;
        }

        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        {
            throw new NotImplementedException();
        }
    }

    public class ToothNumberEqualityConverter : IMultiValueConverter
    {
        public object Convert(object[] values, Type targetType, object parameter, CultureInfo culture)
        {
            if (values == null || values.Length < 2)
                return false;

            var selectedTooth = values[0]?.ToString();
            var currentTooth = values[1]?.ToString();

            return selectedTooth == currentTooth;
        }

        public object[] ConvertBack(object value, Type[] targetTypes, object parameter, CultureInfo culture)
        {
            throw new NotImplementedException();
        }
    }
}
