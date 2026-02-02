using System.Windows;
using DentalApp.Desktop.ViewModels;

namespace DentalApp.Desktop.Views
{
    public partial class PatientFormDialog : Window
    {
        public PatientFormDialog(PatientFormViewModel viewModel)
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
