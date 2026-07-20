using System.Windows;
using System.Windows.Controls;

namespace DentalApp.Desktop.Views
{
    public partial class UserEditDialog : Window
    {
        public string Email => EmailTextBox.Text.Trim();
        public string Role => (RoleComboBox.SelectedItem as ComboBoxItem)?.Tag?.ToString() ?? string.Empty;

        public UserEditDialog(string email, string? role)
        {
            InitializeComponent();
            EmailTextBox.Text = email;
            RoleComboBox.SelectedItem = RoleComboBox.Items.Cast<ComboBoxItem>().FirstOrDefault(item => item.Tag?.ToString() == role)
                ?? RoleComboBox.Items.Cast<ComboBoxItem>().First();
        }

        private void Save_Click(object sender, RoutedEventArgs e)
        {
            if (string.IsNullOrWhiteSpace(Email) || string.IsNullOrWhiteSpace(Role))
            {
                MessageBox.Show("E-posta ve rol zorunludur.", "Uyarı", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }
            DialogResult = true;
        }
    }
}
