using System.Windows;
using System.Windows.Controls;
using DentalApp.Desktop.ViewModels;

namespace DentalApp.Desktop.Views
{
    public partial class PaymentsView : UserControl
    {
        public PaymentsView()
        {
            InitializeComponent();
        }
        
        private void CheckBox_Checked(object sender, RoutedEventArgs e)
        {
            if (DataContext is PaymentsViewModel vm)
            {
                vm.RefreshSelectedPlansTotal();
            }
        }
        
        private void CheckBox_Unchecked(object sender, RoutedEventArgs e)
        {
            if (DataContext is PaymentsViewModel vm)
            {
                vm.RefreshSelectedPlansTotal();
            }
        }
    }
}
