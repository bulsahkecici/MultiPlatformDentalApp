using DentalApp.Desktop.Helpers;
using DentalApp.Desktop.Models;
using DentalApp.Desktop.Services;
using System.Collections.ObjectModel;
using System.Windows.Input;

namespace DentalApp.Desktop.ViewModels
{
    public class PaymentsViewModel : ObservableObject
    {
        private readonly ApiService _apiService;
        private readonly PatientService _patientService;
        private bool _isBusy;
        private Patient? _selectedPatient;
        private TreatmentPlan? _selectedTreatmentPlan;
        private decimal _discountAmount;
        private decimal _discountPercentage;

        public bool IsBusy
        {
            get => _isBusy;
            set => SetProperty(ref _isBusy, value);
        }

        public ObservableCollection<Patient> Patients { get; } = new();
        public ObservableCollection<TreatmentPlan> TreatmentPlans { get; } = new();

        public Patient? SelectedPatient
        {
            get => _selectedPatient;
            set
            {
                if (SetProperty(ref _selectedPatient, value))
                {
                    _ = LoadTreatmentPlansAsync();
                }
            }
        }

        public TreatmentPlan? SelectedTreatmentPlan
        {
            get => _selectedTreatmentPlan;
            set => SetProperty(ref _selectedTreatmentPlan, value);
        }

        public decimal DiscountAmount
        {
            get => _discountAmount;
            set => SetProperty(ref _discountAmount, value);
        }

        public decimal DiscountPercentage
        {
            get => _discountPercentage;
            set => SetProperty(ref _discountPercentage, value);
        }

        public ICommand ApplyDiscountCommand { get; }
        public ICommand ProcessPaymentCommand { get; }
        public ICommand RefreshCommand { get; }

        public PaymentsViewModel(ApiService apiService, PatientService patientService)
        {
            _apiService = apiService;
            _patientService = patientService;
            ApplyDiscountCommand = new RelayCommand(async _ => await ApplyDiscountAsync(), _ => !IsBusy && SelectedTreatmentPlan != null);
            ProcessPaymentCommand = new RelayCommand(async _ => await ProcessPaymentAsync(), _ => !IsBusy);
            RefreshCommand = new RelayCommand(async _ => await LoadDataAsync(), _ => !IsBusy);
        }

        public async Task LoadDataAsync()
        {
            IsBusy = true;
            try
            {
                var (patientsList, _) = await _patientService.GetPatientsAsync();
                Patients.Clear();
                if (patientsList != null)
                {
                    foreach (var patient in patientsList)
                    {
                        Patients.Add(patient);
                    }
                }
            }
            catch (Exception ex)
            {
                System.Windows.MessageBox.Show($"Veriler yüklenirken hata: {ex.Message}", "Hata",
                    System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Error);
            }
            finally
            {
                IsBusy = false;
            }
        }

        private async Task LoadTreatmentPlansAsync()
        {
            if (SelectedPatient == null) return;
            // TODO: Load treatment plans for selected patient
            TreatmentPlans.Clear();
        }

        private async Task ApplyDiscountAsync()
        {
            if (SelectedTreatmentPlan == null) return;
            IsBusy = true;
            try
            {
                var request = new
                {
                    treatmentPlanId = SelectedTreatmentPlan.Id,
                    discountAmount = DiscountAmount > 0 ? DiscountAmount : (decimal?)null,
                    discountPercentage = DiscountPercentage > 0 ? DiscountPercentage : (decimal?)null
                };

                var response = await _apiService.PostAsync<object>("/payments/discount", request);
                System.Windows.MessageBox.Show("İndirim başarıyla uygulandı.", "Başarılı",
                    System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Information);
                DiscountAmount = 0;
                DiscountPercentage = 0;
            }
            catch (Exception ex)
            {
                System.Windows.MessageBox.Show($"İndirim uygulanırken hata: {ex.Message}", "Hata",
                    System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Error);
            }
            finally
            {
                IsBusy = false;
            }
        }

        private Task ProcessPaymentAsync()
        {
            // TODO: Implement payment processing
            System.Windows.MessageBox.Show("Ödeme işlemi yakında eklenecek.", "Bilgi",
                System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Information);
            return Task.CompletedTask;
        }
    }

    public class TreatmentPlan
    {
        [Newtonsoft.Json.JsonProperty("id")]
        public int Id { get; set; }

        [Newtonsoft.Json.JsonProperty("title")]
        public string Title { get; set; } = string.Empty;

        [Newtonsoft.Json.JsonProperty("total_estimated_cost")]
        public decimal TotalEstimatedCost { get; set; }
    }
}
