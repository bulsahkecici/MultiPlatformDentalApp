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
            => Binding.DoNothing;
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
            return Binding.DoNothing;
        }
    }

    public class StatusToTurkishConverter : IValueConverter
    {
        private static readonly Dictionary<string, string> StatusTranslations = new()
        {
            // Randevu durumları
            { "scheduled", "Planlandı" },
            { "confirmed", "Onaylandı" },
            { "completed", "Tamamlandı" },
            { "cancelled", "İptal Edildi" },
            { "no_show", "Gelmedi" },
            
            // Tedavi durumları
            { "planned", "Planlandı" },
            { "in_progress", "Devam Ediyor" }
            // "completed" ve "cancelled" yukarıda zaten eklendi
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
            return Binding.DoNothing;
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
            return Binding.DoNothing;
        }
    }

    public class ToothNumberEqualityConverter : IMultiValueConverter
    {
        public object Convert(object[] values, Type targetType, object parameter, CultureInfo culture)
        {
            if (values == null || values.Length < 2)
                return false;

            // Hem tek diş (string) hem de çoklu diş (koleksiyon) desteği
            var selectedTeeth = values[0];
            var currentTooth = values[1]?.ToString();

            if (currentTooth == null) return false;

            // Eğer bir koleksiyonsa (ObservableCollection<int>)
            if (selectedTeeth is System.Collections.ICollection teethCollection)
            {
                foreach (var tooth in teethCollection)
                {
                    if (tooth?.ToString() == currentTooth)
                        return true;
                }
                return false;
            }

            // Eğer bir string ise (tek diş veya virgülle ayrılmış)
            var selectedToothStr = selectedTeeth?.ToString();
            if (string.IsNullOrWhiteSpace(selectedToothStr))
                return false;

            // Geçerli dişin virgülle ayrılmış listede olup olmadığını kontrol et
            var teethList = selectedToothStr.Split(',').Select(t => t.Trim());
            return teethList.Contains(currentTooth);
        }

        public object[] ConvertBack(object value, Type[] targetTypes, object parameter, CultureInfo culture)
        {
            return null;
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
            return Binding.DoNothing;
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
            return Binding.DoNothing;
        }
    }
    
    public class BooleanToBrushConverter : IValueConverter
    {
        public System.Windows.Media.Brush TrueBrush { get; set; } = System.Windows.Media.Brushes.Green;
        public System.Windows.Media.Brush FalseBrush { get; set; } = System.Windows.Media.Brushes.Red;

        public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        {
            if (value is bool boolValue)
            {
                return boolValue ? TrueBrush : FalseBrush;
            }
            return FalseBrush;
        }

        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        {
            return Binding.DoNothing;
        }
    }

    /// <summary>Para alanları: decimal &lt;-&gt; string (Türkçe: 1.234,56)</summary>
    public class DecimalToTurkishStringConverter : IValueConverter
    {
        private static readonly CultureInfo Turkish = CultureInfo.GetCultureInfo("tr-TR");

        public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        {
            var suffix = parameter as string ?? "";
            if (value is decimal d)
                return d.ToString("N2", Turkish) + suffix;
            if (value is double dbl)
                return dbl.ToString("N2", Turkish) + suffix;
            return "0,00" + suffix;
        }

        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        {
            if (value is not string s || string.IsNullOrWhiteSpace(s))
                return 0m;
            var suffix = parameter as string ?? "";
            if (!string.IsNullOrEmpty(suffix) && s.EndsWith(suffix, StringComparison.Ordinal))
                s = s.Substring(0, s.Length - suffix.Length);
            s = s.Trim().Replace("\u00A0", "");
            if (decimal.TryParse(s, NumberStyles.Number, Turkish, out var result))
                return result;
            if (decimal.TryParse(s.Replace(",", "."), NumberStyles.Number, CultureInfo.InvariantCulture, out result))
                return result;
            return 0m;
        }
    }

    public class NullToVisibilityConverter : IValueConverter
    {
        public Visibility NullValue { get; set; } = Visibility.Collapsed;
        public Visibility NotNullValue { get; set; } = Visibility.Visible;

        public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        {
            return value == null ? NullValue : NotNullValue;
        }

        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        {
            return Binding.DoNothing;
        }
    }

    public class StatusToColorConverter : IValueConverter
    {
        public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        {
            if (value is string status && !string.IsNullOrWhiteSpace(status))
            {
                return status.ToLower() switch
                {
                    "scheduled" or "planned" => System.Windows.Media.Brushes.SkyBlue,
                    "confirmed" or "in_progress" => System.Windows.Media.Brushes.Orange,
                    "completed" => System.Windows.Media.Brushes.LimeGreen,
                    "cancelled" or "no_show" => System.Windows.Media.Brushes.Tomato,
                    _ => System.Windows.Media.Brushes.Gray
                };
            }
            return System.Windows.Media.Brushes.Gray;
        }

        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        {
            return Binding.DoNothing;
        }
    }
}
