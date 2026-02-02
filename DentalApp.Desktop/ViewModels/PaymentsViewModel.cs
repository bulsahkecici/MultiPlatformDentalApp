using DentalApp.Desktop.Helpers;
using DentalApp.Desktop.Models;
using DentalApp.Desktop.Services;
using System.Collections.ObjectModel;
using System.Windows.Input;
using System.Linq;
using Newtonsoft.Json;

namespace DentalApp.Desktop.ViewModels
{
    public class PaymentsViewModel : ObservableObject
    {
        private readonly ApiService _apiService;
        private readonly PatientService _patientService;
        private readonly TariffService _tariffService;
        private bool _isBusy;
        private bool _canViewPrices = true; // Patron ve Sekreter için true
        
        // İndirim Anlaşmaları
        private string _newAgreementName = string.Empty;
        private string _newAgreementDiscount = string.Empty;
        private ObservableCollection<CategoryDiscount> _categoryDiscounts = new();
        
        // Tedavi Planı Onaylama
        private TreatmentPlanItem? _selectedPlan;
        
        // Ödeme Alma
        private Patient? _selectedPaymentPatient;
        private string _selectedPaymentMethod = string.Empty;
        private decimal _paymentAmount;
        
        public bool IsBusy
        {
            get => _isBusy;
            set => SetProperty(ref _isBusy, value);
        }
        
        public bool CanViewPrices
        {
            get => _canViewPrices;
            set => SetProperty(ref _canViewPrices, value);
        }

        // İndirim Anlaşmaları
        public ObservableCollection<InstitutionAgreement> InstitutionAgreements { get; } = new();
        
        public string NewAgreementName
        {
            get => _newAgreementName;
            set => SetProperty(ref _newAgreementName, value);
        }
        
        public string NewAgreementDiscount
        {
            get => _newAgreementDiscount;
            set => SetProperty(ref _newAgreementDiscount, value);
        }
        
        public ObservableCollection<CategoryDiscount> CategoryDiscounts
        {
            get => _categoryDiscounts;
            set => SetProperty(ref _categoryDiscounts, value);
        }
        
        // Tedavi Planı Onaylama
        public ObservableCollection<TreatmentPlanItem> PendingTreatmentPlans { get; } = new();
        
        public TreatmentPlanItem? SelectedPlan
        {
            get => _selectedPlan;
            set => SetProperty(ref _selectedPlan, value);
        }
        
        public decimal SelectedPlansTotal => PendingTreatmentPlans
            .Where(p => p.IsSelected)
            .Sum(p => p.TotalCost);
        
        public void RefreshSelectedPlansTotal()
        {
            OnPropertyChanged(nameof(SelectedPlansTotal));
        }
        
        // Ödeme Alma
        public ObservableCollection<Patient> Patients { get; } = new();
        public ObservableCollection<string> PaymentMethods { get; } = new();
        public ObservableCollection<ProcedureItem> PatientTreatmentPlans { get; } = new();
        public ProcedureItem? SelectedPatientTreatmentPlan { get; set; }
        
        public Patient? SelectedPaymentPatient
        {
            get => _selectedPaymentPatient;
            set
            {
                if (SetProperty(ref _selectedPaymentPatient, value))
                {
                    _ = LoadPatientTreatmentPlansAsync();
                    CalculatePaymentInfo();
                }
            }
        }
        
        private Task LoadPatientTreatmentPlansAsync()
        {
            if (SelectedPaymentPatient == null)
            {
                PatientTreatmentPlans.Clear();
                return Task.CompletedTask;
            }
            
            try
            {
                // TODO: Load from API - get pending treatment plans for this patient
                PatientTreatmentPlans.Clear();
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Hasta tedavi planları yüklenirken hata: {ex.Message}");
            }
            return Task.CompletedTask;
        }
        
        public string SelectedPaymentMethod
        {
            get => _selectedPaymentMethod;
            set => SetProperty(ref _selectedPaymentMethod, value);
        }
        
        public decimal PaymentAmount
        {
            get => _paymentAmount;
            set
            {
                if (SetProperty(ref _paymentAmount, value))
                {
                    CalculatePaymentInfo();
                }
            }
        }
        
        public decimal SelectedPaymentPatientTotal { get; private set; }
        public decimal RemainingDebt { get; private set; }
        public decimal DentistCommission { get; private set; }
        public decimal DentistCommissionPercentage { get; private set; }

        public ICommand AddAgreementCommand { get; }
        public ICommand EditAgreementCommand { get; }
        public ICommand LoadPendingPlansCommand { get; }
        public ICommand ApprovePlansCommand { get; }
        public ICommand ProcessPaymentCommand { get; }
        public ICommand RefreshCommand { get; }

        public PaymentsViewModel(ApiService apiService, PatientService patientService, TariffService? tariffService = null)
        {
            _apiService = apiService;
            _patientService = patientService;
            _tariffService = tariffService ?? new TariffService();
            
            AddAgreementCommand = new RelayCommand(async _ => await AddAgreementAsync(), _ => !IsBusy && !string.IsNullOrWhiteSpace(NewAgreementName));
            EditAgreementCommand = new RelayCommand<InstitutionAgreement>(async a => await EditAgreementAsync(a));
            LoadPendingPlansCommand = new RelayCommand(async _ => await LoadPendingPlansAsync(), _ => !IsBusy);
            ApprovePlansCommand = new RelayCommand(async _ => await ApprovePlansAsync(), _ => !IsBusy && PendingTreatmentPlans.Any(p => p.IsSelected));
            ProcessPaymentCommand = new RelayCommand(async _ => await ProcessPaymentAsync(), _ => !IsBusy && SelectedPaymentPatient != null && PaymentAmount > 0);
            RefreshCommand = new RelayCommand(async _ => await LoadDataAsync(), _ => !IsBusy);
            
            PaymentMethods.Add("Kart");
            PaymentMethods.Add("Nakit");
            
            _ = LoadDataAsync();
            _ = LoadAgreementsAsync();
            _ = LoadCategoriesAsync();
        }
        
        private async Task LoadCategoriesAsync()
        {
            try
            {
                var tariffData = await _tariffService.LoadTariffDataAsync();
                CategoryDiscounts.Clear();
                foreach (var category in tariffData.Categories)
                {
                    CategoryDiscounts.Add(new CategoryDiscount
                    {
                        CategoryName = category.Name,
                        DiscountPercentage = 0m
                    });
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Kategoriler yüklenirken hata: {ex.Message}");
            }
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
        
        private async Task LoadAgreementsAsync()
        {
            try
            {
                var response = await _apiService.GetAsync<dynamic>("/institution-agreements");
                if (response != null)
                {
                    var json = JsonConvert.SerializeObject(response);
                    var agreementsData = JsonConvert.DeserializeObject<dynamic>(json);
                    
                    InstitutionAgreements.Clear();
                    if (agreementsData?.agreements != null)
                    {
                        foreach (var agreement in agreementsData.agreements)
                        {
                            var instAgreement = new InstitutionAgreement
                            {
                                Id = (int)(agreement.id ?? 0),
                                Name = agreement.institution_name?.ToString() ?? "",
                                DiscountPercentage = agreement.discount_percentage != null ? (decimal)agreement.discount_percentage : 0m
                            };
                            InstitutionAgreements.Add(instAgreement);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Kurum anlaşmaları yüklenirken hata: {ex.Message}");
                // Fallback to placeholder data
                InstitutionAgreements.Clear();
                InstitutionAgreements.Add(new InstitutionAgreement { Id = 1, Name = "SGK", DiscountPercentage = 20m });
                InstitutionAgreements.Add(new InstitutionAgreement { Id = 2, Name = "Özel Sigorta A", DiscountPercentage = 15m });
            }
        }
        
        private async Task AddAgreementAsync()
        {
            if (string.IsNullOrWhiteSpace(NewAgreementName))
            {
                System.Windows.MessageBox.Show("Kurum adı girin.", "Hata",
                    System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Warning);
                return;
            }
            
            IsBusy = true;
            try
            {
                // TODO: Save to backend when API is ready
                // Kategori bazlı indirimleri de kaydet
                var categoryDiscounts = CategoryDiscounts
                    .Where(cd => cd.DiscountPercentage > 0)
                    .ToDictionary(cd => cd.CategoryName, cd => cd.DiscountPercentage);
                
                var newAgreement = new InstitutionAgreement
                {
                    Id = InstitutionAgreements.Count + 1,
                    Name = NewAgreementName,
                    DiscountPercentage = 0m, // Genel indirim artık kullanılmıyor, kategori bazlı kullanılıyor
                    CategoryDiscounts = categoryDiscounts
                };
                InstitutionAgreements.Add(newAgreement);
                OnPropertyChanged(nameof(InstitutionAgreements));
                
                NewAgreementName = string.Empty;
                NewAgreementDiscount = string.Empty;
                // Kategori indirimlerini sıfırla
                foreach (var cd in CategoryDiscounts)
                {
                    cd.DiscountPercentage = 0m;
                }
                OnPropertyChanged(nameof(NewAgreementName));
                OnPropertyChanged(nameof(NewAgreementDiscount));
                
                await Task.CompletedTask; // Placeholder for future API call
                
                System.Windows.MessageBox.Show("İndirim anlaşması başarıyla eklendi.", "Başarılı",
                    System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Information);
            }
            catch (Exception ex)
            {
                System.Windows.MessageBox.Show($"Anlaşma eklenirken hata: {ex.Message}", "Hata",
                    System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Error);
            }
            finally
            {
                IsBusy = false;
            }
        }
        
        private Task EditAgreementAsync(InstitutionAgreement? agreement)
        {
            if (agreement == null) return Task.CompletedTask;
            // TODO: Edit agreement dialog
            System.Windows.MessageBox.Show("Düzenleme özelliği yakında eklenecek.", "Bilgi",
                System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Information);
            return Task.CompletedTask;
        }
        
        private async Task LoadPendingPlansAsync()
        {
            IsBusy = true;
            try
            {
                // TODO: Load from backend when API is ready
                await Task.CompletedTask; // Placeholder for future API call
                
                // Placeholder data
                PendingTreatmentPlans.Clear();
                var plan1 = new TreatmentPlanItem
                {
                    Id = 1,
                    PatientName = "Ahmet Yılmaz",
                    DentistName = "Dr. Ayşe Demir",
                    ProceduresCount = 3,
                    TotalCost = 1500m,
                    IsSelected = false,
                    ParentViewModel = this
                };
                plan1.Procedures.Add(new ProcedureItem { Code = "D001", Name = "Dolgu", Price = 500m, Category = "Restoratif" });
                plan1.Procedures.Add(new ProcedureItem { Code = "D002", Name = "Temizlik", Price = 400m, Category = "Profilaksi" });
                plan1.Procedures.Add(new ProcedureItem { Code = "D003", Name = "Kanal Tedavisi", Price = 600m, Category = "Endodonti" });
                PendingTreatmentPlans.Add(plan1);
                
                var plan2 = new TreatmentPlanItem
                {
                    Id = 2,
                    PatientName = "Mehmet Kaya",
                    DentistName = "Dr. Ahmet Yılmaz",
                    ProceduresCount = 2,
                    TotalCost = 800m,
                    IsSelected = false,
                    ParentViewModel = this
                };
                plan2.Procedures.Add(new ProcedureItem { Code = "D004", Name = "Çekim", Price = 300m, Category = "Cerrahi" });
                plan2.Procedures.Add(new ProcedureItem { Code = "D005", Name = "Protez", Price = 500m, Category = "Protetik" });
                PendingTreatmentPlans.Add(plan2);
                
                OnPropertyChanged(nameof(SelectedPlansTotal));
            }
            catch (Exception ex)
            {
                System.Windows.MessageBox.Show($"Planlar yüklenirken hata: {ex.Message}", "Hata",
                    System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Error);
            }
            finally
            {
                IsBusy = false;
            }
        }
        
        private async Task ApprovePlansAsync()
        {
            var selectedPlans = PendingTreatmentPlans.Where(p => p.IsSelected).ToList();
            if (selectedPlans.Count == 0)
            {
                System.Windows.MessageBox.Show("Lütfen en az bir plan seçin.", "Uyarı",
                    System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Warning);
                return;
            }
            
            IsBusy = true;
            try
            {
                // TODO: Approve plans via API
                await Task.CompletedTask; // Placeholder for future API call
                
                var total = selectedPlans.Sum(p => p.TotalCost);
                
                System.Windows.MessageBox.Show(
                    $"{selectedPlans.Count} tedavi planı onaylandı.\nToplam maliyet: {total:F2} TRY\n\nHasta borcu oluşturuldu.",
                    "Başarılı",
                    System.Windows.MessageBoxButton.OK,
                    System.Windows.MessageBoxImage.Information);
                
                // Remove approved plans
                foreach (var plan in selectedPlans)
                {
                    PendingTreatmentPlans.Remove(plan);
                }
                
                OnPropertyChanged(nameof(SelectedPlansTotal));
            }
            catch (Exception ex)
            {
                System.Windows.MessageBox.Show($"Planlar onaylanırken hata: {ex.Message}", "Hata",
                    System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Error);
            }
            finally
            {
                IsBusy = false;
            }
        }
        
        private void CalculatePaymentInfo()
        {
            // TODO: Calculate from backend data
            // Placeholder calculations
            SelectedPaymentPatientTotal = 2500m; // Placeholder
            RemainingDebt = SelectedPaymentPatientTotal - PaymentAmount;
            
            // Dentist commission (placeholder: 30%)
            DentistCommissionPercentage = 30m;
            DentistCommission = PaymentAmount * (DentistCommissionPercentage / 100m);
            
            OnPropertyChanged(nameof(SelectedPaymentPatientTotal));
            OnPropertyChanged(nameof(RemainingDebt));
            OnPropertyChanged(nameof(DentistCommission));
            OnPropertyChanged(nameof(DentistCommissionPercentage));
        }

        private async Task ProcessPaymentAsync()
        {
            if (SelectedPaymentPatient == null || PaymentAmount <= 0)
            {
                System.Windows.MessageBox.Show("Lütfen hasta seçin ve ödeme miktarı girin.", "Uyarı",
                    System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Warning);
                return;
            }
            
            IsBusy = true;
            try
            {
                // TODO: Process payment via API
                await Task.CompletedTask; // Placeholder for future API call
                
                var request = new
                {
                    patientId = SelectedPaymentPatient.Id,
                    amount = PaymentAmount,
                    method = SelectedPaymentMethod,
                    remainingDebt = RemainingDebt
                };
                
                System.Windows.MessageBox.Show(
                    $"Ödeme başarıyla işlendi.\nAlınan: {PaymentAmount:F2} TRY\nKalan Borç: {RemainingDebt:F2} TRY\nHekim Ciro Payı: {DentistCommission:F2} TRY",
                    "Başarılı",
                    System.Windows.MessageBoxButton.OK,
                    System.Windows.MessageBoxImage.Information);
                
                PaymentAmount = 0;
                CalculatePaymentInfo();
            }
            catch (Exception ex)
            {
                System.Windows.MessageBox.Show($"Ödeme işlenirken hata: {ex.Message}", "Hata",
                    System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Error);
            }
            finally
            {
                IsBusy = false;
            }
        }
    }
    
    public class TreatmentPlanItem : ObservableObject
    {
        private int _id;
        private string _patientName = string.Empty;
        private string _dentistName = string.Empty;
        private int _proceduresCount;
        private decimal _totalCost;
        private bool _isSelected;
        
        public int Id
        {
            get => _id;
            set => SetProperty(ref _id, value);
        }
        
        public string PatientName
        {
            get => _patientName;
            set => SetProperty(ref _patientName, value);
        }
        
        public string DentistName
        {
            get => _dentistName;
            set => SetProperty(ref _dentistName, value);
        }
        
        public int ProceduresCount
        {
            get => _proceduresCount;
            set => SetProperty(ref _proceduresCount, value);
        }
        
        public decimal TotalCost
        {
            get => _totalCost;
            set => SetProperty(ref _totalCost, value);
        }
        
        public bool IsSelected
        {
            get => _isSelected;
            set
            {
                if (SetProperty(ref _isSelected, value))
                {
                    // Notify parent view model to refresh total
                    ParentViewModel?.RefreshSelectedPlansTotal();
                }
            }
        }
        
        public ObservableCollection<ProcedureItem> Procedures { get; } = new();
        
        public PaymentsViewModel? ParentViewModel { get; set; }
    }
}
