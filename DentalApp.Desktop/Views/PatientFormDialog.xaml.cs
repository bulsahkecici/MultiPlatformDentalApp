using System.Windows;
using System.Windows.Controls;
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
        
        private void DatePicker_SelectedDateChanged(object sender, SelectionChangedEventArgs e)
        {
            if (DataContext is PatientFormViewModel vm)
            {
                vm.RefreshPatientAge();
            }
        }
    }
}
