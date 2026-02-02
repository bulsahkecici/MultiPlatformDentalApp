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
        private bool _isBusy;
        private decimal _totalRevenue;
        private decimal _totalEarnings;
        private decimal _commissionRate;
        private int _treatmentCount;

        public bool IsBusy
        {
            get => _isBusy;
            set => SetProperty(ref _isBusy, value);
        }

        public decimal TotalRevenue
        {
            get => _totalRevenue;
            set => SetProperty(ref _totalRevenue, value);
        }

        public decimal TotalEarnings
        {
            get => _totalEarnings;
            set => SetProperty(ref _totalEarnings, value);
        }

        public decimal CommissionRate
        {
            get => _commissionRate;
            set => SetProperty(ref _commissionRate, value);
        }

        public int TreatmentCount
        {
            get => _treatmentCount;
            set => SetProperty(ref _treatmentCount, value);
        }

        public ObservableCollection<EarningsTreatment> Treatments { get; } = new();

        public ICommand RefreshCommand { get; }

        public DentistEarningsViewModel(ApiService apiService)
        {
            _apiService = apiService;
            RefreshCommand = new RelayCommand(async _ => await LoadEarningsAsync(), _ => !IsBusy);
        }

        public async Task LoadEarningsAsync()
        {
            IsBusy = true;
            try
            {
                var response = await _apiService.GetAsync<DentistEarningsResponse>("/dentist/earnings");
                if (response != null && response.Earnings != null)
                {
                    TotalRevenue = response.Earnings.TotalRevenue;
                    TotalEarnings = response.Earnings.Earnings;
                    CommissionRate = response.Earnings.CommissionRate;
                    TreatmentCount = response.Earnings.TreatmentCount;

                    Treatments.Clear();
                    if (response.Treatments != null)
                    {
                        foreach (var treatment in response.Treatments)
                        {
                            Treatments.Add(treatment);
                        }
                    }
                }
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
