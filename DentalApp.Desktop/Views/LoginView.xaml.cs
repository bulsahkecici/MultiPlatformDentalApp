using System.Windows;
using System.Windows.Controls;
using MaterialDesignThemes.Wpf;

namespace DentalApp.Desktop.Views
{
    public partial class LoginView : UserControl
    {
        private bool _isPasswordVisible = false;

        public LoginView()
        {
            InitializeComponent();
            PasswordBox.PasswordChanged += PasswordBox_PasswordChanged;
        }

        private void PasswordBox_PasswordChanged(object sender, RoutedEventArgs e)
        {
            if (DataContext is ViewModels.LoginViewModel vm)
            {
                vm.Password = PasswordBox.Password;
            }
        }

        private void PasswordTextBox_TextChanged(object sender, TextChangedEventArgs e)
        {
            if (DataContext is ViewModels.LoginViewModel vm)
            {
                vm.Password = PasswordTextBox.Text;
                PasswordBox.Password = PasswordTextBox.Text;
            }
        }

        private void TogglePasswordButton_Click(object sender, RoutedEventArgs e)
        {
            _isPasswordVisible = !_isPasswordVisible;

            if (_isPasswordVisible)
            {
                // Show password
                PasswordTextBox.Text = PasswordBox.Password;
                PasswordTextBox.Visibility = Visibility.Visible;
                PasswordBox.Visibility = Visibility.Collapsed;
                PasswordIcon.Kind = PackIconKind.EyeOff;
            }
            else
            {
                // Hide password
                PasswordBox.Password = PasswordTextBox.Text;
                PasswordBox.Visibility = Visibility.Visible;
                PasswordTextBox.Visibility = Visibility.Collapsed;
                PasswordIcon.Kind = PackIconKind.Eye;
            }
        }
    }
}
