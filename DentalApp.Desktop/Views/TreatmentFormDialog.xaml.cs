using System.Windows;
using DentalApp.Desktop.ViewModels;

namespace DentalApp.Desktop.Views
{
    public partial class TreatmentFormDialog : Window
    {
        public TreatmentFormDialog(TreatmentFormViewModel viewModel)
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
