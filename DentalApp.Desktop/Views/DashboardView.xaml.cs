using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using DentalApp.Desktop.Models;
using DentalApp.Desktop.ViewModels;

namespace DentalApp.Desktop.Views
{
    public partial class DashboardView : UserControl
    {
        public DashboardView()
        {
            InitializeComponent();
        }
        
        private void AppointmentCard_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
        {
            try
            {
                if (sender is FrameworkElement element && element.DataContext is Appointment appointment)
                {
                    // ViewModel'deki command'i çalıştır
                    if (DataContext is DashboardViewModel viewModel)
                    {
                        if (viewModel.AppointmentCardClickCommand.CanExecute(appointment))
                        {
                            viewModel.AppointmentCardClickCommand.Execute(appointment);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error handling appointment click: {ex.Message}");
                MessageBox.Show($"Randevu açılırken hata: {ex.Message}", "Hata", 
                    MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }
    }
}
