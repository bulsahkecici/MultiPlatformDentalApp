using DentalApp.Desktop.Helpers;
using DentalApp.Desktop.Services;
using System.Windows;
using System.Windows.Input;

namespace DentalApp.Desktop.ViewModels
{
    public class MainViewModel : ObservableObject
    {
        private readonly AuthService _authService;
        private readonly NotificationService _notificationService;
        
        private string _welcomeMessage = "Welcome to Dental App";

        public string WelcomeMessage
        {
            get => _welcomeMessage;
            set => SetProperty(ref _welcomeMessage, value);
        }

        private bool _isLoggedIn;
        public bool IsLoggedIn
        {
            get => _isLoggedIn;
            set => SetProperty(ref _isLoggedIn, value);
        }

        public ICommand LoginCommand { get; }

        public MainViewModel()
        {
            // In a real app, use Dependency Injection
            var apiService = new ApiService();
            _authService = new AuthService(apiService);
            _notificationService = new NotificationService();

            LoginCommand = new RelayCommand(ExecuteLogin);
        }

        private async void ExecuteLogin(object? parameter)
        {
            // This is just a simulation for now since we don't have the full LoginView yet
            // In a real scenario, this would open a LoginWindow or switch views
            WelcomeMessage = "Logging in...";
            
            // Hardcoded credentials for quick test if backend is running, 
            // or just simulate success if not.
            // Let's assume backend might not be running or credentials unknown, 
            // so we'll just toggle UI state for demonstration.
            
            await Task.Delay(1000); // Simulate network delay
            
            IsLoggedIn = true;
            WelcomeMessage = "Logged in successfully!";
            
            MessageBox.Show("Login functionality simulated. Backend connection would happen here.");
        }
    }
}
