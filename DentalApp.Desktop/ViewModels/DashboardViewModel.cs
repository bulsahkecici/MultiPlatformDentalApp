using DentalApp.Desktop.Helpers;
using DentalApp.Desktop.Models;
using DentalApp.Desktop.Services;
using System.Windows.Input;
using System.Collections.ObjectModel;

namespace DentalApp.Desktop.ViewModels
{
    public class DashboardViewModel : ObservableObject
    {
        private readonly PatientService _patientService;
        private readonly AppointmentService _appointmentService;
        private readonly TreatmentService _treatmentService;
        private readonly ApiService _apiService;
        private readonly bool _isPatron;
        private readonly bool _isSecretary;
        private readonly bool _isDentist;
        
        private bool _isBusy;
        private int _totalPatients;
        private int _todayAppointments;
        private int _upcomingAppointments;
        private int _totalTreatments;
        
        // Patron Dashboard Properties
        private decimal _totalAmount;
        private decimal _paidAmount;
        private ObservableCollection<DentistTurnover> _dentistTurnovers = new();

        public bool IsBusy
        {
            get => _isBusy;
            set => SetProperty(ref _isBusy, value);
        }

        public int TotalPatients
        {
            get => _totalPatients;
            set => SetProperty(ref _totalPatients, value);
        }

        public int TodayAppointments
        {
            get => _todayAppointments;
            set => SetProperty(ref _todayAppointments, value);
        }

        public int UpcomingAppointments
        {
            get => _upcomingAppointments;
            set => SetProperty(ref _upcomingAppointments, value);
        }

        public int TotalTreatments
        {
            get => _totalTreatments;
            set => SetProperty(ref _totalTreatments, value);
        }

        // Patron Dashboard Properties
        public bool IsPatron => _isPatron;
        public bool IsSecretary => _isSecretary;
        public bool IsDentist => _isDentist;
        
        public decimal TotalAmount
        {
            get => _totalAmount;
            set => SetProperty(ref _totalAmount, value);
        }
        
        public decimal PaidAmount
        {
            get => _paidAmount;
            set => SetProperty(ref _paidAmount, value);
        }
        
        public decimal RemainingAmount => TotalAmount - PaidAmount;
        
        public double PaidPercentage => TotalAmount > 0 ? (double)(PaidAmount / TotalAmount * 100) : 0;
        
        public ObservableCollection<DentistTurnover> DentistTurnovers
        {
            get => _dentistTurnovers;
            set => SetProperty(ref _dentistTurnovers, value);
        }
        
        // Secretary/Dentist Dashboard - Upcoming Appointments
        private ObservableCollection<Appointment> _upcomingAppointmentsList = new();
        
        public ObservableCollection<Appointment> UpcomingAppointmentsList
        {
            get => _upcomingAppointmentsList;
            set => SetProperty(ref _upcomingAppointmentsList, value);
        }
        
        // Clock and Calendar
        private DateTime _currentTime = DateTime.Now;
        private DateTime _currentDate = DateTime.Now;
        
        public DateTime CurrentTime
        {
            get => _currentTime;
            set => SetProperty(ref _currentTime, value);
        }
        
        public DateTime CurrentDate
        {
            get => _currentDate;
            set => SetProperty(ref _currentDate, value);
        }
        
        private System.Windows.Threading.DispatcherTimer? _clockTimer;

        public ICommand RefreshCommand { get; }

        public DashboardViewModel(PatientService patientService, AppointmentService appointmentService, TreatmentService treatmentService, ApiService apiService, bool isPatron, bool isSecretary, bool isDentist)
        {
            _patientService = patientService;
            _appointmentService = appointmentService;
            _treatmentService = treatmentService;
            _apiService = apiService;
            _isPatron = isPatron;
            _isSecretary = isSecretary;
            _isDentist = isDentist;
            RefreshCommand = new RelayCommand(async _ => await LoadDashboardDataAsync(), _ => !IsBusy);
            
            // Start clock timer for Secretary/Dentist dashboard
            if (_isSecretary || _isDentist)
            {
                _clockTimer = new System.Windows.Threading.DispatcherTimer();
                _clockTimer.Interval = TimeSpan.FromSeconds(1);
                _clockTimer.Tick += (s, e) => {
                    CurrentTime = DateTime.Now;
                    CurrentDate = DateTime.Now;
                };
                _clockTimer.Start();
            }
        }

        public async Task LoadDashboardDataAsync()
        {
            IsBusy = true;
            try
            {
                if (_isPatron)
                {
                    await LoadPatronDashboardAsync();
                }
                else if (_isSecretary || _isDentist)
                {
                    await LoadSecretaryDentistDashboardAsync();
                }
                else
                {
                    // Default dashboard for other roles
                    await LoadDefaultDashboardAsync();
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Dashboard Error: {ex}");
                System.Windows.MessageBox.Show($"Kontrol paneli verileri yüklenirken hata: {ex.Message}\n\nDetaylar: {ex.InnerException?.Message ?? "Detay yok"}", "Hata", System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Error);
            }
            finally
            {
                IsBusy = false;
            }
        }
        
        private async Task LoadPatronDashboardAsync()
        {
            // TODO: Load from backend when API is ready
            // For now, use placeholder data
            TotalAmount = 150000m; // Placeholder
            PaidAmount = 95000m; // Placeholder
            
            // Placeholder dentist turnovers
            DentistTurnovers.Clear();
            DentistTurnovers.Add(new DentistTurnover { DentistName = "Dr. Ahmet Yılmaz", Turnover = 50000m, TurnoverPercentage = 33.33m });
            DentistTurnovers.Add(new DentistTurnover { DentistName = "Dr. Ayşe Demir", Turnover = 45000m, TurnoverPercentage = 30.00m });
            DentistTurnovers.Add(new DentistTurnover { DentistName = "Dr. Mehmet Kaya", Turnover = 55000m, TurnoverPercentage = 36.67m });
            
            OnPropertyChanged(nameof(RemainingAmount));
            OnPropertyChanged(nameof(PaidPercentage));
        }
        
        private async Task LoadSecretaryDentistDashboardAsync()
        {
            try
            {
                var (appointments, _) = await _appointmentService.GetAppointmentsAsync(
                    page: 1, 
                    limit: 10, 
                    startDate: DateTime.Today, 
                    endDate: DateTime.Today.AddDays(7));
                
                UpcomingAppointmentsList.Clear();
                foreach (var apt in appointments.OrderBy(a => a.AppointmentDateTime).Take(10))
                {
                    UpcomingAppointmentsList.Add(apt);
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error loading upcoming appointments: {ex}");
            }
        }
        
        private async Task LoadDefaultDashboardAsync()
        {
            try
            {
                var (_, patientsPagination) = await _patientService.GetPatientsAsync(page: 1, limit: 1);
                TotalPatients = patientsPagination.Total;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error loading patients: {ex}");
                TotalPatients = 0;
            }

            try
            {
                var (_, todayApptsPagination) = await _appointmentService.GetAppointmentsAsync(page: 1, limit: 1, startDate: DateTime.Today, endDate: DateTime.Today);
                TodayAppointments = todayApptsPagination.Total;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error loading today appointments: {ex}");
                TodayAppointments = 0;
            }

            try
            {
                var (_, upcomingApptsPagination) = await _appointmentService.GetAppointmentsAsync(page: 1, limit: 1, startDate: DateTime.Today.AddDays(1), endDate: DateTime.Today.AddDays(7));
                UpcomingAppointments = upcomingApptsPagination.Total;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error loading upcoming appointments: {ex}");
                UpcomingAppointments = 0;
            }

            try
            {
                var (_, treatmentsPagination) = await _treatmentService.GetTreatmentsAsync(page: 1, limit: 1);
                TotalTreatments = treatmentsPagination.Total;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error loading treatments: {ex}");
                TotalTreatments = 0;
            }
        }
    }
    
    public class DentistTurnover : ObservableObject
    {
        private string _dentistName = string.Empty;
        private decimal _turnover;
        private decimal _turnoverPercentage;
        
        public string DentistName
        {
            get => _dentistName;
            set => SetProperty(ref _dentistName, value);
        }
        
        public decimal Turnover
        {
            get => _turnover;
            set => SetProperty(ref _turnover, value);
        }
        
        public decimal TurnoverPercentage
        {
            get => _turnoverPercentage;
            set => SetProperty(ref _turnoverPercentage, value);
        }
    }
}
