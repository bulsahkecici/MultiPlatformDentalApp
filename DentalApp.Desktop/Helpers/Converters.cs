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

    /// <summary>true -> Collapsed, false -> Visible (liste dolu iken DataGrid göster).</summary>
    public class InverseBooleanToVisibilityConverter : IValueConverter
    {
        public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        {
            if (value is bool b)
                return b ? Visibility.Collapsed : Visibility.Visible;
            return Visibility.Visible;
        }
        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
            => throw new NotImplementedException();
    }

    /// <summary>Bir koleksiyonun Count'unu boş-durum mesajı göstermek için kullanır: 0 -> Visible, aksi -> Collapsed.</summary>
    public class ZeroToVisibilityConverter : IValueConverter
    {
        public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        {
            if (value is int count)
                return count == 0 ? Visibility.Visible : Visibility.Collapsed;
            return Visibility.Collapsed;
        }
        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
            => throw new NotImplementedException();
    }

    /// <summary>ZeroToVisibilityConverter'ın tersi: liste doluyken asıl içeriği (ör. DataGrid) gösterir.</summary>
    public class NonZeroToVisibilityConverter : IValueConverter
    {
        public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        {
            if (value is int count)
                return count == 0 ? Visibility.Collapsed : Visibility.Visible;
            return Visibility.Collapsed;
        }
        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
            => throw new NotImplementedException();
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

    /// <summary>Bir nesne null değilse Visible, null ise Collapsed döner (Visibility hedefleri için).</summary>
    public class ObjectToVisibilityConverter : IValueConverter
    {
        public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
            => value != null ? Visibility.Visible : Visibility.Collapsed;

        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
            => throw new NotImplementedException();
    }

    /// <summary>ObjectToVisibilityConverter'ın tersi: null ise Visible (ör. "seçim yapın" mesajı), null değilse Collapsed.</summary>
    public class ObjectToCollapsedConverter : IValueConverter
    {
        public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
            => value != null ? Visibility.Collapsed : Visibility.Visible;

        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
            => throw new NotImplementedException();
    }

    public class GenderToTurkishConverter : IValueConverter
    {
        private static readonly Dictionary<string, string> Translations = new(StringComparer.OrdinalIgnoreCase)
        {
            { "male", "Erkek" },
            { "female", "Kadın" },
            { "other", "Diğer" }
        };

        public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        {
            if (value is string gender && !string.IsNullOrWhiteSpace(gender))
            {
                return Translations.TryGetValue(gender.Trim(), out var translation) ? translation : gender;
            }
            return value?.ToString() ?? string.Empty;
        }

        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
            => throw new NotImplementedException();
    }

    public class AppointmentTypeToTurkishConverter : IValueConverter
    {
        private static readonly Dictionary<string, string> Translations = new(StringComparer.OrdinalIgnoreCase)
        {
            { "extraction", "Çekim" },
            { "filling", "Dolgu" },
            { "cleaning", "Temizlik" },
            { "checkup", "Muayene" },
            { "examination", "Muayene" },
            { "consultation", "Muayene" },
            { "root_canal", "Kanal Tedavisi" },
            { "root canal", "Kanal Tedavisi" },
            { "orthodontics", "Ortodonti" },
            { "prosthesis", "Protez" },
            { "prosthetics", "Protez" },
            { "control", "Kontrol" },
            { "whitening", "Diş Beyazlatma" },
            { "surgery", "Cerrahi" },
            { "implant", "İmplant" }
        };

        public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        {
            if (value is string type && !string.IsNullOrWhiteSpace(type))
            {
                return Translations.TryGetValue(type.Trim(), out var translation) ? translation : type;
            }
            return value?.ToString() ?? string.Empty;
        }

        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
            => throw new NotImplementedException();
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
    
    public class DateToColorConverter : IValueConverter
    {
        public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        {
            if (value is DateTime date)
            {
                var today = DateTime.Today;
                var tomorrow = today.AddDays(1);
                
                if (date.Date == today)
                {
                    // Bugün - açık mavi
                    return System.Windows.Media.Brushes.LightBlue;
                }
                else if (date.Date == tomorrow)
                {
                    // Yarın - açık yeşil
                    return System.Windows.Media.Brushes.LightGreen;
                }
                else
                {
                    // Diğer günler - beyaz
                    return System.Windows.Media.Brushes.White;
                }
            }
            return System.Windows.Media.Brushes.White;
        }

        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        {
            throw new NotImplementedException();
        }
    }
    
    /// <summary>
    /// true/false değerini bir fırçaya çevirir. ConverterParameter "trueRenk|falseRenk"
    /// biçiminde verilirse (ör. "#E3F2FD|White") o renkler kullanılır; parametre
    /// verilmezse TrueBrush/FalseBrush (varsayılan Yeşil/Kırmızı) kullanılır.
    /// </summary>
    public class BooleanToBrushConverter : IValueConverter
    {
        public System.Windows.Media.Brush TrueBrush { get; set; } = System.Windows.Media.Brushes.Green;
        public System.Windows.Media.Brush FalseBrush { get; set; } = System.Windows.Media.Brushes.Red;

        private static readonly System.Windows.Media.BrushConverter BrushParser = new();

        public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        {
            var boolValue = value is bool b && b;

            if (parameter is string paramString && paramString.Contains('|'))
            {
                var parts = paramString.Split('|', 2);
                var colorText = boolValue ? parts[0] : parts[1];
                try
                {
                    var brush = BrushParser.ConvertFromString(colorText) as System.Windows.Media.Brush;
                    if (brush != null)
                    {
                        brush.Freeze();
                        return brush;
                    }
                }
                catch (FormatException)
                {
                    // Geçersiz renk metni - aşağıdaki varsayılana düş
                }
            }

            return boolValue ? TrueBrush : FalseBrush;
        }

        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        {
            throw new NotImplementedException();
        }
    }
}
