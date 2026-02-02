using DentalApp.Desktop.Helpers;
using DentalApp.Desktop.Models;
using DentalApp.Desktop.Services;
using DentalApp.Desktop.Views;
using System.Collections.ObjectModel;
using System.Windows;
using System.Windows.Input;

namespace DentalApp.Desktop.ViewModels
{
    public class MainViewModel : ObservableObject
    {
        private readonly ApiService _apiService;
        private readonly AuthService _authService;
        private readonly PatientService _patientService;
        private readonly AppointmentService _appointmentService;
        private readonly TreatmentService _treatmentService;
        
        private object? _currentView;
        public object? CurrentView
        {
            get => _currentView;
            set => SetProperty(ref _currentView, value);
        }

        public bool IsAuthenticated => _authService.IsAuthenticated;
        public User? CurrentUser => _authService.CurrentUser;

        // Rol kontrolü helper metodları
        public bool IsAdmin => CurrentUser?.Roles.Contains("admin") ?? false;
        public bool IsPatron => IsAdmin; // Patron = Admin
        public bool IsSecretary => CurrentUser?.Roles.Contains("secretary") ?? false;
        public bool IsDentist => CurrentUser?.Roles.Contains("dentist") ?? false;
        public bool CanViewPrices => IsAdmin || IsSecretary;

        public ICommand NavigateToDashboardCommand { get; }
        public ICommand NavigateToPatientsCommand { get; }
        public ICommand NavigateToAppointmentsCommand { get; }
        public ICommand NavigateToTreatmentsCommand { get; }
        public ICommand NavigateToDentistEarningsCommand { get; }
        public ICommand NavigateToPaymentsCommand { get; }
        public ICommand NavigateToAdminManagementCommand { get; }
        public ICommand NavigateToProsthesisCommand { get; }
        public ICommand NavigateToSMSCommand { get; }
        public ICommand LogoutCommand { get; }

        public MainViewModel()
        {
            _apiService = new ApiService();
            _apiService.OnUnauthorized += HandleUnauthorized;
            _authService = new AuthService(_apiService);
            _patientService = new PatientService(_apiService);
            _appointmentService = new AppointmentService(_apiService);
            _treatmentService = new TreatmentService(_apiService);

            NavigateToDashboardCommand = new RelayCommand(_ => ShowDashboard());
            NavigateToPatientsCommand = new RelayCommand(_ => ShowPatients());
            NavigateToAppointmentsCommand = new RelayCommand(_ => ShowAppointments());
            NavigateToTreatmentsCommand = new RelayCommand(_ => ShowTreatments());
            NavigateToDentistEarningsCommand = new RelayCommand(_ => ShowDentistEarnings());
            NavigateToPaymentsCommand = new RelayCommand(_ => ShowPayments());
            NavigateToAdminManagementCommand = new RelayCommand(_ => ShowAdminManagement());
            NavigateToProsthesisCommand = new RelayCommand(_ => ShowProsthesis());
            NavigateToSMSCommand = new RelayCommand(_ => ShowSMS());
            LogoutCommand = new RelayCommand(_ => Logout());

            ShowLogin();
        }

        private void HandleUnauthorized()
        {
            // Clear authentication state
            _authService.Logout();
            OnPropertyChanged(nameof(IsAuthenticated));
            OnPropertyChanged(nameof(CurrentUser));
            
            // Show message and redirect to login
            System.Windows.Application.Current.Dispatcher.Invoke(() =>
            {
                System.Windows.MessageBox.Show(
                    "Oturum süresi doldu veya yetkiniz yok. Lütfen tekrar giriş yapın.",
                    "Oturum Sonlandı",
                    System.Windows.MessageBoxButton.OK,
                    System.Windows.MessageBoxImage.Warning);
                ShowLogin();
            });
        }

        private void ShowLogin()
        {
            var loginVM = new LoginViewModel(_authService);
            loginVM.OnLoginSuccess += () => {
                OnPropertyChanged(nameof(IsAuthenticated));
                OnPropertyChanged(nameof(CurrentUser));
                OnPropertyChanged(nameof(IsAdmin));
                OnPropertyChanged(nameof(IsPatron));
                OnPropertyChanged(nameof(IsSecretary));
                OnPropertyChanged(nameof(IsDentist));
                OnPropertyChanged(nameof(CanViewPrices));
                ShowDashboard();
            };
            CurrentView = loginVM;
        }

        private void ShowDashboard()
        {
            try
            {
                var dashboardVM = new DashboardViewModel(_patientService, _appointmentService, _treatmentService, _apiService, IsPatron, IsSecretary, IsDentist);
                CurrentView = dashboardVM;
                // Load data asynchronously without blocking UI
                _ = dashboardVM.LoadDashboardDataAsync();
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"ShowDashboard Error: {ex}");
                System.Windows.MessageBox.Show($"Kontrol paneli yüklenirken hata: {ex.Message}", "Hata", System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Error);
            }
        }

        private void ShowPatients()
        {
            // Diş hekimi için sadece görüntüleme modu
            var canEdit = !IsDentist;
            var patientsVM = new PatientsViewModel(_patientService, _appointmentService, _treatmentService, canEdit);
            patientsVM.AddPatientRequested += () => ShowPatientForm(null);
            patientsVM.EditPatientRequested += (patient) => ShowPatientForm(patient);
            _ = patientsVM.LoadPatientsAsync();
            CurrentView = patientsVM;
        }

        private void ShowAppointments()
        {
            var appointmentsVM = new AppointmentsViewModel(_appointmentService, _patientService, _apiService);
            appointmentsVM.AddAppointmentRequested += (appointment) => ShowAppointmentForm(appointment);
            appointmentsVM.EditAppointmentRequested += (appointment) => ShowAppointmentForm(appointment);
            _ = appointmentsVM.LoadAppointmentsAsync();
            _ = appointmentsVM.LoadPatientsAsync();
            CurrentView = appointmentsVM;
        }

        private void ShowTreatments()
        {
            var treatmentsVM = new TreatmentsViewModel(_treatmentService, _patientService, CanViewPrices);
            treatmentsVM.AddTreatmentRequested += () => ShowTreatmentForm(null);
            treatmentsVM.EditTreatmentRequested += (treatment) => ShowTreatmentForm(treatment);
            _ = treatmentsVM.LoadTreatmentsAsync();
            _ = treatmentsVM.LoadPatientsAsync();
            CurrentView = treatmentsVM;
        }

        private void ShowPatientForm(Patient? patient)
        {
            // PaymentsViewModel'den InstitutionAgreements'i al
            ObservableCollection<ViewModels.InstitutionAgreement>? agreements = null;
            if (CurrentView is PaymentsViewModel paymentsVM)
            {
                agreements = paymentsVM.InstitutionAgreements;
            }
            
            var formVM = new PatientFormViewModel(_patientService, patient, agreements);
            var dialog = new PatientFormDialog(formVM);
            dialog.Owner = Application.Current.MainWindow;
            dialog.ShowDialog();
            
            // Refresh patients list if we're on patients view
            if (CurrentView is PatientsViewModel patientsVM)
            {
                _ = patientsVM.LoadPatientsAsync();
            }
        }

        private void ShowAppointmentForm(Appointment? appointment)
        {
            try
            {
                var formVM = new AppointmentFormViewModel(_appointmentService, _patientService, appointment);
                var dialog = new AppointmentFormDialog(formVM);
                dialog.Owner = Application.Current.MainWindow;
                var result = dialog.ShowDialog();
                
                // Refresh appointments list if we're on appointments view
                if (CurrentView is AppointmentsViewModel appointmentsVM)
                {
                    _ = appointmentsVM.LoadAppointmentsAsync();
                }
            }
            catch (Exception ex)
            {
                System.Windows.MessageBox.Show($"Randevu formu açılırken hata: {ex.Message}\n\nDetay: {ex.InnerException?.Message ?? "Detay yok"}", "Hata",
                    System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Error);
                System.Diagnostics.Debug.WriteLine($"ShowAppointmentForm Error: {ex}");
                System.Diagnostics.Debug.WriteLine($"Stack Trace: {ex.StackTrace}");
            }
        }

        private void ShowTreatmentForm(Treatment? treatment)
        {
            try
            {
                var formVM = new TreatmentFormViewModel(_treatmentService, _patientService, treatment, CanViewPrices);
                var dialog = new TreatmentFormDialog(formVM);
                dialog.Owner = Application.Current.MainWindow;
                var result = dialog.ShowDialog();
                
                // Refresh treatments list if we're on treatments view
                if (CurrentView is TreatmentsViewModel treatmentsVM)
                {
                    _ = treatmentsVM.LoadTreatmentsAsync();
                }
            }
            catch (Exception ex)
            {
                System.Windows.MessageBox.Show($"Tedavi formu açılırken hata: {ex.Message}", "Hata",
                    System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Error);
            }
        }

        private void ShowDentistEarnings()
        {
            if (!IsDentist) return;
            var earningsVM = new DentistEarningsViewModel(_apiService);
            CurrentView = earningsVM;
            _ = earningsVM.LoadEarningsAsync();
        }

        private void ShowPayments()
        {
            if (!IsSecretary && !IsAdmin) return;
            var tariffService = new Services.TariffService();
            var paymentsVM = new PaymentsViewModel(_apiService, _patientService, tariffService);
            CurrentView = paymentsVM;
            _ = paymentsVM.LoadDataAsync();
        }

        private void ShowAdminManagement()
        {
            if (!IsAdmin) return;
            var adminVM = new AdminManagementViewModel(_apiService);
            CurrentView = adminVM;
            _ = adminVM.LoadStatisticsAsync();
        }

        private void ShowProsthesis()
        {
            // Placeholder - Yakında
            System.Windows.MessageBox.Show(
                "Protez İş Süreçleri modülü yakında eklenecektir.",
                "Yakında",
                System.Windows.MessageBoxButton.OK,
                System.Windows.MessageBoxImage.Information);
        }

        private void ShowSMS()
        {
            // Placeholder - Yakında
            System.Windows.MessageBox.Show(
                "SMS gönderme özelliği yakında eklenecektir.",
                "Yakında",
                System.Windows.MessageBoxButton.OK,
                System.Windows.MessageBoxImage.Information);
        }

        private void Logout()
        {
            _authService.Logout();
            OnPropertyChanged(nameof(IsAuthenticated));
            OnPropertyChanged(nameof(CurrentUser));
            OnPropertyChanged(nameof(IsAdmin));
            OnPropertyChanged(nameof(IsSecretary));
            OnPropertyChanged(nameof(IsDentist));
            OnPropertyChanged(nameof(CanViewPrices));
            ShowLogin();
        }
    }
}
