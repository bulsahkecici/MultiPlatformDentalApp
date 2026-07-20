using DentalApp.Desktop.Models;
using System.Windows;

namespace DentalApp.Desktop.Views
{
    public partial class AgreementEditDialog : Window
    {
        public AgreementEditDialog(InstitutionAgreement agreement)
        {
            InitializeComponent();
            DataContext = agreement;
        }

        private void Save_Click(object sender, RoutedEventArgs e)
        {
            if (DataContext is not InstitutionAgreement agreement || string.IsNullOrWhiteSpace(agreement.InstitutionName))
            {
                MessageBox.Show("Kurum adı zorunludur.", "Uyarı", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }
            DialogResult = true;
        }
    }
}
