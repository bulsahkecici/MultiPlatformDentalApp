using DentalApp.Desktop.Helpers;
using DentalApp.Desktop.Models;
using DentalApp.Desktop.Services;
using System.Collections.ObjectModel;
using System.Windows.Input;

namespace DentalApp.Desktop.ViewModels
{
    public class DentistEarningsViewModel : ObservableObject
    {
        private readonly ApiService _apiService;
        private readonly FinancialService _financialService;
        private readonly AuthService _authService;
        private bool _isBusy;
        private decimal _salary;
        private decimal _totalTurnover; // Ciro: toplam yaptığı işlerin maliyeti
        private decimal _paidTurnoverShare; // Ödenen Ciro Payı: anlaştığı yüzde ile ödemesi alınan işlerin ücreti
        private decimal _totalEarnings; // Toplam Kazanç: maaş + ödenen ciro payı
        private decimal _commissionRate;

        public bool IsBusy
        {
            get => _isBusy;
            set => SetProperty(ref _isBusy, value);
        }

        public decimal Salary
        {
            get => _salary;
            set
            {
                if (SetProperty(ref _salary, value))
                {
                    CalculateTotalEarnings();
                }
            }
        }
        
        public decimal TotalTurnover
        {
            get => _totalTurnover;
            set
            {
                if (SetProperty(ref _totalTurnover, value))
                {
                    CalculateTotalEarnings();
                }
            }
        }
        
        public decimal PaidTurnoverShare
        {
            get => _paidTurnoverShare;
            set
            {
                if (SetProperty(ref _paidTurnoverShare, value))
                {
                    CalculateTotalEarnings();
                }
            }
        }
        
        public decimal TotalEarnings
        {
            get => _totalEarnings;
            private set => SetProperty(ref _totalEarnings, value);
        }
        
        private void CalculateTotalEarnings()
        {
            TotalEarnings = Salary + PaidTurnoverShare;
        }

        public decimal CommissionRate
        {
            get => _commissionRate;
            set => SetProperty(ref _commissionRate, value);
        }

        public ObservableCollection<EarningsTreatment> Treatments { get; } = new();

        public ICommand RefreshCommand { get; }

        public DentistEarningsViewModel(ApiService apiService, FinancialService financialService, AuthService authService)
        {
            _apiService = apiService;
            _financialService = financialService;
            _authService = authService;
            RefreshCommand = new RelayCommand(async _ => await LoadEarningsAsync(), _ => !IsBusy);
        }

        public async Task LoadEarningsAsync()
        {
            IsBusy = true;
            try
            {
                var dentistId = _authService.CurrentUser?.Id ?? 0;
                if (dentistId == 0)
                {
                    // If not authenticated or not found
                    return;
                }

                // Load earnings for current month by default
                var startDate = new DateTime(DateTime.Today.Year, DateTime.Today.Month, 1);
                var endDate = startDate.AddMonths(1).AddDays(-1);

                var data = await _financialService.GetDentistEarningsAsync(dentistId, startDate, endDate);
                
                Salary = data.Salary;
                TotalTurnover = data.TotalTurnover;
                CommissionRate = data.CommissionRate;
                PaidTurnoverShare = data.PaidTurnoverShare;
                
                // Calculate total earnings
                CalculateTotalEarnings();
                
                // TODO: Load treatments from API (if endpoint available separately or include in FinancialService)
                // For now clearing mock treatments or keeping list empty until endpoint is ready
                Treatments.Clear();
            }
            catch (Exception ex)
            {
                System.Windows.MessageBox.Show($"Kazanç bilgileri yüklenirken hata: {ex.Message}", "Hata", 
                    System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Error);
            }
            finally
            {
                IsBusy = false;
            }
            // return Task.CompletedTask;
        }
    }

    public class DentistEarningsResponse
    {
        [Newtonsoft.Json.JsonProperty("earnings")]
        public EarningsData? Earnings { get; set; }

        [Newtonsoft.Json.JsonProperty("treatments")]
        public List<EarningsTreatment>? Treatments { get; set; }
    }

    public class EarningsData
    {
        [Newtonsoft.Json.JsonProperty("totalRevenue")]
        public decimal TotalRevenue { get; set; }

        [Newtonsoft.Json.JsonProperty("commissionRate")]
        public decimal CommissionRate { get; set; }

        [Newtonsoft.Json.JsonProperty("earnings")]
        public decimal Earnings { get; set; }

        [Newtonsoft.Json.JsonProperty("treatmentCount")]
        public int TreatmentCount { get; set; }
    }

    public class EarningsTreatment : ObservableObject
    {
        [Newtonsoft.Json.JsonProperty("id")]
        public int Id { get; set; }

        [Newtonsoft.Json.JsonProperty("treatment_date")]
        public DateTime TreatmentDate { get; set; }

        [Newtonsoft.Json.JsonProperty("treatment_type")]
        public string TreatmentType { get; set; } = string.Empty;

        [Newtonsoft.Json.JsonProperty("cost")]
        public decimal Cost { get; set; }

        [Newtonsoft.Json.JsonProperty("currency")]
        public string Currency { get; set; } = string.Empty;

        [Newtonsoft.Json.JsonProperty("patient_first_name")]
        public string? PatientFirstName { get; set; }

        [Newtonsoft.Json.JsonProperty("patient_last_name")]
        public string? PatientLastName { get; set; }

        [Newtonsoft.Json.JsonProperty("earnings")]
        public decimal Earnings { get; set; }

        public string PatientFullName => $"{PatientFirstName} {PatientLastName}";
    }
}
