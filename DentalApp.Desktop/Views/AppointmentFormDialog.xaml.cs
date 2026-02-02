using System.Windows;
using DentalApp.Desktop.ViewModels;

namespace DentalApp.Desktop.Views
{
    public partial class AppointmentFormDialog : Window
    {
        public AppointmentFormDialog(AppointmentFormViewModel viewModel)
        {
            InitializeComponent();
            DataContext = viewModel;
            viewModel.SaveCompleted += (success) =>
            {
                if (success)
                {
                    DialogResult = true;
                }
                Close();
            };
        }
    }
}
