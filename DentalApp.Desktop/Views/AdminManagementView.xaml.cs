using System.Windows;
using System.Windows.Controls;
using DentalApp.Desktop.ViewModels;

namespace DentalApp.Desktop.Views
{
    public partial class AdminManagementView : UserControl
    {
        public AdminManagementView()
        {
            InitializeComponent();
        }
        
        private void PasswordBox_PasswordChanged(object sender, RoutedEventArgs e)
        {
            if (DataContext is AdminManagementViewModel vm && sender is PasswordBox passwordBox)
            {
                vm.Password = passwordBox.Password;
            }
        }
    }
}
