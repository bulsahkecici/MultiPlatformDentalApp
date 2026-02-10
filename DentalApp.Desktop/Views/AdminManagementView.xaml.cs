using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
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
        
        private void DentistCard_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
        {
            if (DataContext is AdminManagementViewModel vm)
            {
                vm.SelectUserTypeCommand?.Execute("Dentist");
            }
        }
        
        private void SecretaryCard_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
        {
            if (DataContext is AdminManagementViewModel vm)
            {
                vm.SelectUserTypeCommand?.Execute("Secretary");
            }
        }
        
        private void PatronCard_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
        {
            if (DataContext is AdminManagementViewModel vm)
            {
                vm.SelectUserTypeCommand?.Execute("Patron");
            }
        }
    }
}
