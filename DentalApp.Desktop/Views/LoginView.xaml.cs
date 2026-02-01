using System.Windows.Controls;

namespace DentalApp.Desktop.Views
{
    public partial class LoginView : UserControl
    {
        public LoginView()
        {
            InitializeComponent();
            PasswordBox.PasswordChanged += (s, e) => {
                if (DataContext is ViewModels.LoginViewModel vm) {
                    vm.Password = PasswordBox.Password;
                }
            };
        }
    }
}
