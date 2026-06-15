using System.Collections.ObjectModel;
using System.Windows;
using DentalApp.Desktop.ViewModels;

namespace DentalApp.Desktop.Views
{
    public partial class EditInstitutionAgreementDialog : Window
    {
        public InstitutionAgreement? ResultAgreement { get; private set; }

        private readonly InstitutionAgreement _source;
        private readonly ObservableCollection<CategoryDiscount> _categoryDiscounts = new();

        public EditInstitutionAgreementDialog(InstitutionAgreement agreement, IList<string> allCategories)
        {
            InitializeComponent();
            _source = agreement;

            NameTextBox.Text = agreement.Name;

            foreach (var category in allCategories)
            {
                var existing = agreement.CategoryDiscounts.TryGetValue(category, out var pct) ? pct : 0m;
                _categoryDiscounts.Add(new CategoryDiscount
                {
                    CategoryName = category,
                    DiscountPercentage = existing
                });
            }

            foreach (var kvp in agreement.CategoryDiscounts)
            {
                if (!_categoryDiscounts.Any(c => c.CategoryName == kvp.Key))
                {
                    _categoryDiscounts.Add(new CategoryDiscount
                    {
                        CategoryName = kvp.Key,
                        DiscountPercentage = kvp.Value
                    });
                }
            }

            CategoryDiscountsList.ItemsSource = _categoryDiscounts;
        }

        private void SaveButton_Click(object sender, RoutedEventArgs e)
        {
            if (string.IsNullOrWhiteSpace(NameTextBox.Text))
            {
                MessageBox.Show("Kurum adı girin.", "Hata", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            ResultAgreement = new InstitutionAgreement
            {
                Id = _source.Id,
                Name = NameTextBox.Text.Trim(),
                DiscountPercentage = _source.DiscountPercentage,
                CategoryDiscounts = _categoryDiscounts
                    .Where(c => c.DiscountPercentage > 0)
                    .ToDictionary(c => c.CategoryName, c => c.DiscountPercentage)
            };

            DialogResult = true;
            Close();
        }

        private void CancelButton_Click(object sender, RoutedEventArgs e)
        {
            DialogResult = false;
            Close();
        }
    }
}
