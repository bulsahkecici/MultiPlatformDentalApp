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

            // Support both single tooth (string) and multiple teeth (collection)
            var selectedTeeth = values[0];
            var currentTooth = values[1]?.ToString();

            if (currentTooth == null) return false;

            // If it's a collection (ObservableCollection<int>)
            if (selectedTeeth is System.Collections.ICollection teethCollection)
            {
                foreach (var tooth in teethCollection)
                {
                    if (tooth?.ToString() == currentTooth)
                        return true;
                }
                return false;
            }

            // If it's a string (single tooth or comma-separated)
            var selectedToothStr = selectedTeeth?.ToString();
            if (string.IsNullOrWhiteSpace(selectedToothStr))
                return false;

            // Check if current tooth is in the comma-separated list
            var teethList = selectedToothStr.Split(',').Select(t => t.Trim());
            return teethList.Contains(currentTooth);
        }

        public object[] ConvertBack(object value, Type[] targetTypes, object parameter, CultureInfo culture)
        {
            throw new NotImplementedException();
        }
    }
    
    public class ToothInCollectionConverter : IValueConverter
    {
        public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        {
            if (value == null || parameter == null)
                return false;

            var toothNumber = parameter.ToString();
            if (value is System.Collections.ICollection collection)
            {
                foreach (var item in collection)
                {
                    if (item?.ToString() == toothNumber)
                        return true;
                }
            }
            return false;
        }

        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        {
            throw new NotImplementedException();
        }
    }
}
