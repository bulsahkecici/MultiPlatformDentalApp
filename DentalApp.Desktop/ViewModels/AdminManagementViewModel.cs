using DentalApp.Desktop.Helpers;
using DentalApp.Desktop.Models;
using DentalApp.Desktop.Services;
using System.Windows.Input;

namespace DentalApp.Desktop.ViewModels
{
    public class AdminManagementViewModel : ObservableObject
    {
        private readonly ApiService _apiService;
        private bool _isBusy;
        private StatisticsData? _statistics;

        public bool IsBusy
        {
            get => _isBusy;
            set => SetProperty(ref _isBusy, value);
        }

        public StatisticsData? Statistics
        {
            get => _statistics;
            set => SetProperty(ref _statistics, value);
        }

        public ICommand RefreshCommand { get; }

        public AdminManagementViewModel(ApiService apiService)
        {
            _apiService = apiService;
            RefreshCommand = new RelayCommand(async _ => await LoadStatisticsAsync(), _ => !IsBusy);
        }

        public async Task LoadStatisticsAsync()
        {
            IsBusy = true;
            try
            {
                var response = await _apiService.GetAsync<StatisticsResponse>("/admin/statistics");
                if (response != null && response.Statistics != null)
                {
                    Statistics = response.Statistics;
                    OnPropertyChanged(nameof(Statistics));
                }
                else
                {
                    // Initialize with default values if null
                    Statistics = new StatisticsData
                    {
                        Patients = new PatientStats { Total = 0 },
                        Appointments = new AppointmentStats { Total = 0, Completed = 0, Cancelled = 0 },
                        Treatments = new TreatmentStats { Total = 0, TotalRevenue = 0 },
                        Invoices = new InvoiceStats { Total = 0, TotalRevenue = 0, PaidRevenue = 0 },
                        Dentists = new DentistStats { Total = 0 }
                    };
                    OnPropertyChanged(nameof(Statistics));
                }
            }
            catch (Exception ex)
            {
                System.Windows.MessageBox.Show($"İstatistikler yüklenirken hata: {ex.Message}", "Hata",
                    System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Error);
                // Initialize with default values on error
                Statistics = new StatisticsData
                {
                    Patients = new PatientStats { Total = 0 },
                    Appointments = new AppointmentStats { Total = 0, Completed = 0, Cancelled = 0 },
                    Treatments = new TreatmentStats { Total = 0, TotalRevenue = 0 },
                    Invoices = new InvoiceStats { Total = 0, TotalRevenue = 0, PaidRevenue = 0 },
                    Dentists = new DentistStats { Total = 0 }
                };
                OnPropertyChanged(nameof(Statistics));
            }
            finally
            {
                IsBusy = false;
            }
        }
    }

    public class StatisticsResponse
    {
        [Newtonsoft.Json.JsonProperty("statistics")]
        public StatisticsData? Statistics { get; set; }
    }

    public class StatisticsData : ObservableObject
    {
        [Newtonsoft.Json.JsonProperty("patients")]
        public PatientStats? Patients { get; set; }

        [Newtonsoft.Json.JsonProperty("appointments")]
        public AppointmentStats? Appointments { get; set; }

        [Newtonsoft.Json.JsonProperty("treatments")]
        public TreatmentStats? Treatments { get; set; }

        [Newtonsoft.Json.JsonProperty("invoices")]
        public InvoiceStats? Invoices { get; set; }

        [Newtonsoft.Json.JsonProperty("dentists")]
        public DentistStats? Dentists { get; set; }
    }

    public class PatientStats
    {
        [Newtonsoft.Json.JsonProperty("total")]
        public int Total { get; set; }
    }

    public class AppointmentStats
    {
        [Newtonsoft.Json.JsonProperty("total")]
        public int Total { get; set; }

        [Newtonsoft.Json.JsonProperty("completed")]
        public int Completed { get; set; }

        [Newtonsoft.Json.JsonProperty("cancelled")]
        public int Cancelled { get; set; }
    }

    public class TreatmentStats
    {
        [Newtonsoft.Json.JsonProperty("total")]
        public int Total { get; set; }

        [Newtonsoft.Json.JsonProperty("totalRevenue")]
        public decimal TotalRevenue { get; set; }
    }

    public class InvoiceStats
    {
        [Newtonsoft.Json.JsonProperty("total")]
        public int Total { get; set; }

        [Newtonsoft.Json.JsonProperty("totalRevenue")]
        public decimal TotalRevenue { get; set; }

        [Newtonsoft.Json.JsonProperty("paidRevenue")]
        public decimal PaidRevenue { get; set; }
    }

    public class DentistStats
    {
        [Newtonsoft.Json.JsonProperty("total")]
        public int Total { get; set; }
    }
}
