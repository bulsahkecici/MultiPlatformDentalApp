using DentalApp.Desktop.Helpers;
using DentalApp.Desktop.Models;
using DentalApp.Desktop.Services;
using System.Windows.Input;

namespace DentalApp.Desktop.ViewModels
{
    public class DashboardViewModel : ObservableObject
    {
        private readonly PatientService _patientService;
        private readonly AppointmentService _appointmentService;
        private readonly TreatmentService _treatmentService;
        private bool _isBusy;
        private int _totalPatients;
        private int _todayAppointments;
        private int _upcomingAppointments;
        private int _totalTreatments;

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

        public ICommand RefreshCommand { get; }

        public DashboardViewModel(PatientService patientService, AppointmentService appointmentService, TreatmentService treatmentService)
        {
            _patientService = patientService;
            _appointmentService = appointmentService;
            _treatmentService = treatmentService;
            RefreshCommand = new RelayCommand(async _ => await LoadDashboardDataAsync(), _ => !IsBusy);
        }

        public async Task LoadDashboardDataAsync()
        {
            IsBusy = true;
            try
            {
                // Load all data sequentially to avoid overwhelming the API
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
            catch (Exception ex)
            {
                // Log the full exception for debugging
                System.Diagnostics.Debug.WriteLine($"Dashboard Error: {ex}");
                System.Windows.MessageBox.Show($"Kontrol paneli verileri yüklenirken hata: {ex.Message}\n\nDetaylar: {ex.InnerException?.Message ?? "Detay yok"}", "Hata", System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Error);
            }
            finally
            {
                IsBusy = false;
            }
        }
    }
}
