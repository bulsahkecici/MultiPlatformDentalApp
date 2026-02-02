using System.Windows;
using DentalApp.Desktop.ViewModels;

namespace DentalApp.Desktop.Views
{
    public partial class AppointmentFormDialog : Window
    {
        public AppointmentFormDialog(AppointmentFormViewModel viewModel)
        {
            try
            {
                InitializeComponent();
                DataContext = viewModel;
                viewModel.SaveCompleted += (success) =>
                {
                    try
                    {
                        if (success)
                        {
                            DialogResult = true;
                        }
                        Close();
                    }
                    catch (Exception ex)
                    {
                        System.Diagnostics.Debug.WriteLine($"AppointmentFormDialog SaveCompleted Error: {ex}");
                        MessageBox.Show($"Randevu formu kapatılırken hata: {ex.Message}", "Hata",
                            MessageBoxButton.OK, MessageBoxImage.Error);
                    }
                };
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"AppointmentFormDialog Constructor Error: {ex}");
                MessageBox.Show($"Randevu formu açılırken hata: {ex.Message}\n\nDetay: {ex.InnerException?.Message ?? "Detay yok"}", "Hata",
                    MessageBoxButton.OK, MessageBoxImage.Error);
                throw; // Re-throw to prevent showing a broken dialog
            }
        }
    }
}
