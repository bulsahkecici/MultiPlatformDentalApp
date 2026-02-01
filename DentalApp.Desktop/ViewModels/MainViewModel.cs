using DentalApp.Desktop.Helpers;
using DentalApp.Desktop.Services;
using System.Windows.Input;

namespace DentalApp.Desktop.ViewModels
{
    public class MainViewModel : ObservableObject
    {
        private readonly ApiService _apiService;
        private readonly AuthService _authService;
        private readonly PatientService _patientService;
        private readonly AppointmentService _appointmentService;
        
        private object? _currentView;
        public object? CurrentView
        {
            get => _currentView;
            set => SetProperty(ref _currentView, value);
        }

        public MainViewModel()
        {
            _apiService = new ApiService();
            _authService = new AuthService(_apiService);
            _patientService = new PatientService(_apiService);
            _appointmentService = new AppointmentService(_apiService);

            ShowLogin();
        }

        private void ShowLogin()
        {
            var loginVM = new LoginViewModel(_authService);
            loginVM.OnLoginSuccess += () => {
                ShowDashboard();
            };
            CurrentView = loginVM;
        }

        private void ShowDashboard()
        {
            // For now, let's jump straight to Patients view as a test
            var patientsVM = new PatientsViewModel(_patientService);
            _ = patientsVM.LoadPatientsAsync();
            CurrentView = patientsVM;
        }

        public ICommand LogoutCommand => new RelayCommand(_ => {
            _authService.Logout();
            ShowLogin();
        });
    }
}
