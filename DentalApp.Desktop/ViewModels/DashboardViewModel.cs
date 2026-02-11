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
        private readonly FinancialService _financialService;
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
        public ICommand AppointmentCardClickCommand { get; }
        
        // Event for opening treatment details
        public event Action<Appointment>? AppointmentCardClicked;

        public DashboardViewModel(
            PatientService patientService, 
            AppointmentService appointmentService, 
            TreatmentService treatmentService, 
            ApiService apiService, 
            FinancialService financialService,
            bool isPatron, 
            bool isSecretary, 
            bool isDentist)
        {
            _patientService = patientService;
            _appointmentService = appointmentService;
            _treatmentService = treatmentService;
            _apiService = apiService;
            _financialService = financialService;
            _isPatron = isPatron;
            _isSecretary = isSecretary;
            _isDentist = isDentist;
            RefreshCommand = new RelayCommand(async _ => await LoadDashboardDataAsync(), _ => !IsBusy);
            AppointmentCardClickCommand = new RelayCommand<Appointment>(appointment => 
            {
                if (appointment != null)
                {
                    AppointmentCardClicked?.Invoke(appointment);
                }
            });
            
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
        
        // Admin Dashboard Statistics
        private int _totalRegisteredPatients;
        private decimal _lastMonthFinancial;
        private int _lastMonthPatients;
        private int _lastMonthTransactions;
        private int _thisMonthPatients;
        private decimal _thisMonthFinancial;
        private int _upcomingAppointmentsCount;
        
        public int TotalRegisteredPatients
        {
            get => _totalRegisteredPatients;
            set => SetProperty(ref _totalRegisteredPatients, value);
        }
        
        public decimal LastMonthFinancial
        {
            get => _lastMonthFinancial;
            set => SetProperty(ref _lastMonthFinancial, value);
        }
        
        public int LastMonthPatients
        {
            get => _lastMonthPatients;
            set => SetProperty(ref _lastMonthPatients, value);
        }
        
        public int LastMonthTransactions
        {
            get => _lastMonthTransactions;
            set => SetProperty(ref _lastMonthTransactions, value);
        }
        
        public int ThisMonthPatients
        {
            get => _thisMonthPatients;
            set => SetProperty(ref _thisMonthPatients, value);
        }
        
        public decimal ThisMonthFinancial
        {
            get => _thisMonthFinancial;
            set => SetProperty(ref _thisMonthFinancial, value);
        }
        
        public int UpcomingAppointmentsCount
        {
            get => _upcomingAppointmentsCount;
            set => SetProperty(ref _upcomingAppointmentsCount, value);
        }
        
        private async Task LoadPatronDashboardAsync()
        {
            try
            {
                // Load total patients
                var (_, patientsPagination) = await _patientService.GetPatientsAsync(page: 1, limit: 1);
                TotalRegisteredPatients = patientsPagination.Total;
                
                // Load last month data
                var lastMonthStart = new DateTime(DateTime.Today.Year, DateTime.Today.Month, 1).AddMonths(-1);
                var lastMonthEnd = lastMonthStart.AddMonths(1).AddDays(-1);
                
                var (lastMonthAppts, _) = await _appointmentService.GetAppointmentsAsync(
                    page: 1, limit: 1, 
                    startDate: lastMonthStart, 
                    endDate: lastMonthEnd);
                LastMonthPatients = lastMonthAppts.Count;
                
                var (lastMonthTreatments, _) = await _treatmentService.GetTreatmentsAsync(
                    page: 1, limit: 1,
                    startDate: lastMonthStart,
                    endDate: lastMonthEnd);
                LastMonthTransactions = lastMonthTreatments.Count;
                
                // Calculate last month financial
                var stats = await _financialService.GetDashboardStatsAsync();
                LastMonthFinancial = stats.LastMonthFinancial;
                
                // Load this month data
                var thisMonthStart = new DateTime(DateTime.Today.Year, DateTime.Today.Month, 1);
                var (thisMonthAppts, _) = await _appointmentService.GetAppointmentsAsync(
                    page: 1, limit: 1,
                    startDate: thisMonthStart,
                    endDate: DateTime.Today);
                ThisMonthPatients = thisMonthAppts.Count;
                
                // Calculate this month financial
                ThisMonthFinancial = stats.ThisMonthFinancial;
                
                // Load upcoming appointments
                var (upcomingAppts, _) = await _appointmentService.GetAppointmentsAsync(
                    page: 1, limit: 1,
                    startDate: DateTime.Today,
                    endDate: DateTime.Today.AddDays(30));
                UpcomingAppointmentsCount = upcomingAppts.Count;
                
                // Load financial data
                TotalAmount = stats.TotalAmount;
                PaidAmount = stats.PaidAmount;
                
                // Load dentist turnovers (Assuming this endpoint is part of the stats or needs a separate call)
                // For now, keep mock data but it should ideally come from backend
                DentistTurnovers.Clear();
                // TODO: Backend should provide dentist turnover stats
                // Mocking dynamic updates if possible from stats API in future
                
                OnPropertyChanged(nameof(RemainingAmount));
                OnPropertyChanged(nameof(PaidPercentage));
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error loading patron dashboard: {ex}");
            }
        }
        
        private async Task LoadSecretaryDentistDashboardAsync()
        {
            try
            {
                DateTime startDate = DateTime.Today;
                DateTime endDate;
                
                if (_isSecretary)
                {
                    // Secretary: Sadece bugün ve yarın
                    endDate = DateTime.Today.AddDays(1);
                }
                else if (_isDentist)
                {
                    // Dentist: Sadece kendi randevuları (backend otomatik filtreler)
                    endDate = DateTime.Today.AddDays(7);
                }
                else
                {
                    endDate = DateTime.Today.AddDays(7);
                }
                
                var (appointments, _) = await _appointmentService.GetAppointmentsAsync(
                    page: 1, 
                    limit: 50, 
                    startDate: startDate, 
                    endDate: endDate);
                
                UpcomingAppointmentsList.Clear();
                var filteredAppointments = appointments
                    .Where(a => a.AppointmentDate >= startDate && a.AppointmentDate <= endDate)
                    .OrderBy(a => a.AppointmentDateTime)
                    .Take(_isSecretary ? 20 : 10);
                
                foreach (var apt in filteredAppointments)
                {
                    UpcomingAppointmentsList.Add(apt);
                }
                
                // Secretary için bugünkü randevu sayısını yükle
                if (_isSecretary)
                {
                    var (todayAppts, _) = await _appointmentService.GetAppointmentsAsync(
                        page: 1, limit: 1, 
                        startDate: DateTime.Today, 
                        endDate: DateTime.Today);
                    TodayAppointments = todayAppts.Count;
                    
                    // Toplam hasta sayısını yükle
                    var (_, patientsPagination) = await _patientService.GetPatientsAsync(page: 1, limit: 1);
                    TotalPatients = patientsPagination.Total;
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
