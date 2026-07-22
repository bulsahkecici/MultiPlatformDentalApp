using DentalApp.Desktop.Helpers;
using DentalApp.Desktop.Models;
using DentalApp.Desktop.Services;
using System.Collections.ObjectModel;
using System.Windows;
using System.Windows.Input;
using System.Linq;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace DentalApp.Desktop.ViewModels
{
    public class PaymentsViewModel : ObservableObject
    {
        private readonly ApiService _apiService;
        private readonly PatientService _patientService;
        private readonly TariffService _tariffService;

        // Backend yalnızca kanonik 'card'/'cash' değerlerini kabul eder (bkz.
        // paymentController.js ALLOWED_PAYMENT_METHODS) — ComboBox'ta Türkçe
        // etiket gösterilir, ama API'ye her zaman kanonik değer gönderilir.
        // Daha önce bu dönüşüm hiç yapılmıyordu ve "Kart" gibi ham Türkçe
        // etiket doğrudan veritabanına yazılıyordu (web/mobil zaten kanonik
        // değer gönderiyor — bu masaüstüne özgü bir tutarsızlıktı).
        private static string ToApiPaymentMethod(string display) => display switch
        {
            "Kart" => "card",
            "Nakit" => "cash",
            _ => display,
        };

        private static string ToDisplayPaymentMethod(string apiValue) => apiValue switch
        {
            "card" => "Kart",
            "cash" => "Nakit",
            _ => apiValue,
        };

        private bool _isBusy;
        private bool _canViewPrices = true; // Patron ve Sekreter için true
        private bool _isSecretary = false; // Treatment plan approval sadece secretary'de
        
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
        
        public bool IsSecretary
        {
            get => _isSecretary;
            set => SetProperty(ref _isSecretary, value);
        }

        // İndirim Anlaşmaları
        public ObservableCollection<InstitutionAgreement> InstitutionAgreements { get; } = new();
        /// <summary>Liste boş mesajı için; yükleme sonrası güncellenir.</summary>
        public int AgreementCount => InstitutionAgreements.Count;
        public bool IsAgreementsListEmpty => InstitutionAgreements.Count == 0;
        
        private InstitutionAgreement? _selectedAgreement;
        public InstitutionAgreement? SelectedAgreement
        {
            get => _selectedAgreement;
            set
            {
                if (SetProperty(ref _selectedAgreement, value))
                {
                    UpdateSelectedAgreementCategoryDiscounts();
                }
            }
        }
        
        public ObservableCollection<CategoryDiscount> SelectedAgreementCategoryDiscounts { get; } = new();
        public bool HasCategoryDiscounts => SelectedAgreementCategoryDiscounts.Count > 0;
        
        private void UpdateSelectedAgreementCategoryDiscounts()
        {
            SelectedAgreementCategoryDiscounts.Clear();
            if (SelectedAgreement != null && SelectedAgreement.CategoryDiscounts != null)
            {
                foreach (var kvp in SelectedAgreement.CategoryDiscounts)
                {
                    SelectedAgreementCategoryDiscounts.Add(new CategoryDiscount
                    {
                        CategoryName = kvp.Key,
                        DiscountPercentage = kvp.Value
                    });
                }
            }
            OnPropertyChanged(nameof(HasCategoryDiscounts));
        }
        
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
        
        // Gelir Gider
        private Patient? _selectedIncomePatient;
        public Patient? SelectedIncomePatient
        {
            get => _selectedIncomePatient;
            set
            {
                if (SetProperty(ref _selectedIncomePatient, value))
                {
                    _ = LoadPatientIncomeDetailsAsync();
                }
            }
        }
        
        public decimal TotalReceivables { get; private set; }
        public decimal TotalIncome { get; private set; }
        public decimal SelectedPatientTotalDebt { get; private set; }
        public decimal SelectedPatientPaidAmount { get; private set; }
        public decimal SelectedPatientRemainingDebt { get; private set; }
        public ObservableCollection<PaymentHistoryItem> SelectedPatientPayments { get; } = new();

        public ICommand AddAgreementCommand { get; }
        public ICommand EditAgreementCommand { get; }
        public ICommand LoadAgreementsCommand { get; }
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
            LoadAgreementsCommand = new RelayCommand(async _ => await LoadAgreementsAsync(), _ => !IsBusy);
            LoadPendingPlansCommand = new RelayCommand(async _ => await LoadPendingPlansAsync(), _ => !IsBusy);
            ApprovePlansCommand = new RelayCommand(async _ => await ApprovePlansAsync(), _ => !IsBusy && PendingTreatmentPlans.Any(p => p.IsSelected));
            ProcessPaymentCommand = new RelayCommand(async _ => await ProcessPaymentAsync(), _ => !IsBusy && SelectedPaymentPatient != null && PaymentAmount > 0);
            RefreshCommand = new RelayCommand(async _ => await LoadDataAsync(), _ => !IsBusy);
            
            PaymentMethods.Add("Kart");
            PaymentMethods.Add("Nakit");
            
            _ = LoadDataAsync();
            _ = LoadAgreementsAsync();
            _ = LoadCategoriesAsync();
            _ = LoadIncomeExpenseDataAsync();
        }
        
        private async Task LoadIncomeExpenseDataAsync()
        {
            try
            {
                // Load total receivables (sum of all remaining_debt from patient_debts)
                var receivablesResponse = await _apiService.GetAsync<dynamic>("/payments/total-receivables");
                if (receivablesResponse != null)
                {
                    TotalReceivables = receivablesResponse.totalReceivables != null 
                        ? (decimal)receivablesResponse.totalReceivables 
                        : 0m;
                    OnPropertyChanged(nameof(TotalReceivables));
                }
                
                // Load total income (sum of all payments)
                var incomeResponse = await _apiService.GetAsync<dynamic>("/payments/total-income");
                if (incomeResponse != null)
                {
                    TotalIncome = incomeResponse.totalIncome != null 
                        ? (decimal)incomeResponse.totalIncome 
                        : 0m;
                    OnPropertyChanged(nameof(TotalIncome));
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Gelir gider verileri yüklenirken hata: {ex.Message}");
            }
        }
        
        private async Task LoadPatientIncomeDetailsAsync()
        {
            if (SelectedIncomePatient == null)
            {
                SelectedPatientTotalDebt = 0m;
                SelectedPatientPaidAmount = 0m;
                SelectedPatientRemainingDebt = 0m;
                SelectedPatientPayments.Clear();
                OnPropertyChanged(nameof(SelectedPatientTotalDebt));
                OnPropertyChanged(nameof(SelectedPatientPaidAmount));
                OnPropertyChanged(nameof(SelectedPatientRemainingDebt));
                return;
            }
            
            try
            {
                // Load patient debt
                var debtResponse = await _apiService.GetAsync<dynamic>($"/payments/patient-debt/{SelectedIncomePatient.Id}");
                var debtObj = debtResponse?.debt;
                if (debtObj != null)
                {
                    SelectedPatientTotalDebt = Convert.ToDecimal(debtObj.total_debt ?? 0m);
                    SelectedPatientPaidAmount = Convert.ToDecimal(debtObj.paid_amount ?? 0m);
                    SelectedPatientRemainingDebt = Convert.ToDecimal(debtObj.remaining_debt ?? 0m);
                    OnPropertyChanged(nameof(SelectedPatientTotalDebt));
                    OnPropertyChanged(nameof(SelectedPatientPaidAmount));
                    OnPropertyChanged(nameof(SelectedPatientRemainingDebt));
                }
                
                var paymentsResponse = await _apiService.GetAsync<dynamic>($"/payments/patient-payments/{SelectedIncomePatient.Id}");
                var paymentsList = paymentsResponse?.payments;
                if (paymentsList != null)
                {
                    SelectedPatientPayments.Clear();
                    foreach (var payment in paymentsList)
                    {
                        var amount = payment?.amount;
                        var method = ToDisplayPaymentMethod(payment?.payment_method?.ToString() ?? "");
                        var createdAt = payment?.created_at;
                        SelectedPatientPayments.Add(new PaymentHistoryItem
                        {
                            Amount = amount != null ? Convert.ToDecimal(amount) : 0m,
                            PaymentMethod = method,
                            CreatedAt = createdAt != null ? DateTime.Parse(createdAt.ToString() ?? "") : DateTime.Now
                        });
                    }
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Hasta gelir detayları yüklenirken hata: {ex.Message}");
            }
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
                await LoadAgreementsAsync();
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
        
        /// <summary>Anlaşmalı kurumlar listesini API'den yükler. Sekme açıldığında veya Yenile'de çağrılır.</summary>
        public async Task LoadAgreementsAsync()
        {
            try
            {
                // Önce tip güvenli modelle dene
                var response = await _apiService.GetAsync<InstitutionAgreementsResponse>("/institution-agreements");
                var list = response?.Agreements;
                if (list != null)
                {
                    var toAdd = list.Select(a => new InstitutionAgreement
                    {
                        Id = a.Id,
                        Name = a.InstitutionName ?? string.Empty,
                        DiscountPercentage = a.DiscountPercentage,
                        CategoryDiscounts = a.CategoryDiscounts != null
                            ? new Dictionary<string, decimal>(a.CategoryDiscounts)
                            : new Dictionary<string, decimal>()
                    }).ToList();

                    await Application.Current.Dispatcher.InvokeAsync(() =>
                    {
                        InstitutionAgreements.Clear();
                        foreach (var item in toAdd)
                            InstitutionAgreements.Add(item);
                        OnPropertyChanged(nameof(AgreementCount));
                        OnPropertyChanged(nameof(IsAgreementsListEmpty));
                    });
                    return;
                }

                // Fallback: ham JSON ile parse (backend farklı formatta dönerse)
                var raw = await _apiService.GetAsync<JObject>("/institution-agreements");
                if (raw != null && raw["agreements"] is JArray arr)
                {
                    var toAdd = new List<InstitutionAgreement>();
                    foreach (var token in arr)
                    {
                        if (token is not JObject jo) continue;
                        var id = jo["id"]?.Type == JTokenType.Integer ? (int)jo["id"]! : 0;
                        var name = jo["institution_name"]?.ToString() ?? "";
                        var pct = 0m;
                        if (jo["discount_percentage"] != null)
                            decimal.TryParse(jo["discount_percentage"]?.ToString(), System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out pct);
                        var catDiscounts = new Dictionary<string, decimal>();
                        if (jo["category_discounts"] is JObject catObj)
                        {
                            foreach (var kv in catObj)
                                if (kv.Value != null && decimal.TryParse(kv.Value.ToString(), System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var d))
                                    catDiscounts[kv.Key] = d;
                        }
                        toAdd.Add(new InstitutionAgreement { Id = id, Name = name, DiscountPercentage = pct, CategoryDiscounts = catDiscounts });
                    }
                    await Application.Current.Dispatcher.InvokeAsync(() =>
                    {
                        InstitutionAgreements.Clear();
                        foreach (var item in toAdd)
                            InstitutionAgreements.Add(item);
                        OnPropertyChanged(nameof(AgreementCount));
                        OnPropertyChanged(nameof(IsAgreementsListEmpty));
                    });
                    return;
                }

                await Application.Current.Dispatcher.InvokeAsync(() =>
                {
                    InstitutionAgreements.Clear();
                    OnPropertyChanged(nameof(AgreementCount));
                    OnPropertyChanged(nameof(IsAgreementsListEmpty));
                });
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Kurum anlaşmaları yüklenirken hata: {ex.Message}");
                try
                {
                    var raw = await _apiService.GetAsync<JObject>("/institution-agreements");
                    if (raw != null && raw["agreements"] is JArray arr)
                    {
                        var toAdd = new List<InstitutionAgreement>();
                        foreach (var token in arr)
                        {
                            if (token is not JObject jo) continue;
                            var id = jo["id"]?.Type == JTokenType.Integer ? (int)jo["id"]! : 0;
                            var name = jo["institution_name"]?.ToString() ?? "";
                            var pct = 0m;
                            if (jo["discount_percentage"] != null)
                                decimal.TryParse(jo["discount_percentage"]?.ToString(), System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out pct);
                            var catDiscounts = new Dictionary<string, decimal>();
                            if (jo["category_discounts"] is JObject catObj)
                            {
                                foreach (var kv in catObj)
                                    if (kv.Value != null && decimal.TryParse(kv.Value.ToString(), System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var d))
                                        catDiscounts[kv.Key] = d;
                            }
                            toAdd.Add(new InstitutionAgreement { Id = id, Name = name, DiscountPercentage = pct, CategoryDiscounts = catDiscounts });
                        }
                        await Application.Current.Dispatcher.InvokeAsync(() =>
                        {
                            InstitutionAgreements.Clear();
                            foreach (var item in toAdd)
                                InstitutionAgreements.Add(item);
                            OnPropertyChanged(nameof(AgreementCount));
                            OnPropertyChanged(nameof(IsAgreementsListEmpty));
                        });
                        return;
                    }
                }
                catch { /* ignore */ }
                await Application.Current.Dispatcher.InvokeAsync(() =>
                {
                    InstitutionAgreements.Clear();
                    OnPropertyChanged(nameof(AgreementCount));
                    OnPropertyChanged(nameof(IsAgreementsListEmpty));
                });
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
                // Kategori bazlı indirimleri de kaydet
                var categoryDiscounts = CategoryDiscounts
                    .Where(cd => cd.DiscountPercentage > 0)
                    .ToDictionary(cd => cd.CategoryName, cd => cd.DiscountPercentage);
                
                var request = new
                {
                    institutionName = NewAgreementName,
                    discountPercentage = 0, // Genel indirim artık kullanılmıyor, kategori bazlı kullanılıyor
                    categoryDiscounts = categoryDiscounts
                };
                
                var response = await _apiService.PostAsync<dynamic>("/institution-agreements", request);
                var agreementObj = response?.agreement;
                if (response != null && agreementObj != null)
                {
                    // Reload agreements to get the new one with proper ID
                    await LoadAgreementsAsync();
                    
                    NewAgreementName = string.Empty;
                    NewAgreementDiscount = string.Empty;
                    // Kategori indirimlerini sıfırla
                    foreach (var cd in CategoryDiscounts)
                    {
                        cd.DiscountPercentage = 0m;
                    }
                    OnPropertyChanged(nameof(NewAgreementName));
                    OnPropertyChanged(nameof(NewAgreementDiscount));
                    
                    System.Windows.MessageBox.Show("İndirim anlaşması başarıyla eklendi.", "Başarılı",
                        System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Information);
                }
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
        
        /// <summary>Kurum anlaşması düzenleme (kategori bazlı indirimler dahil) "Kurum Anlaşmaları"
        /// ekranında yapılır — orada gerçek düzenleme/silme desteği var. Burada sadece oraya yönlendiriyoruz.</summary>
        public event Action? NavigateToInstitutionAgreementsRequested;

        private Task EditAgreementAsync(InstitutionAgreement? agreement)
        {
            if (agreement == null) return Task.CompletedTask;
            NavigateToInstitutionAgreementsRequested?.Invoke();
            return Task.CompletedTask;
        }
        
        private async Task LoadPendingPlansAsync()
        {
            IsBusy = true;
            try
            {
                PendingTreatmentPlans.Clear();
                var response = await _apiService.GetAsync<dynamic>("/payments/pending-plans");
                var plans = response?.plans as IEnumerable<dynamic>;
                if (plans != null)
                {
                    foreach (var plan in plans)
                    {
                        var vmPlan = new TreatmentPlanItem
                        {
                            Id = (int)(plan.id ?? 0),
                            PatientName = plan.patient_name ?? "Bilinmiyor",
                            DentistName = plan.dentist_email ?? "Bilinmiyor",
                            ProceduresCount = 0,
                            TotalCost = Convert.ToDecimal(plan.total_estimated_cost ?? 0m),
                            IsSelected = false,
                            ParentViewModel = this
                        };

                        var items = plan.items as IEnumerable<dynamic>;
                        if (items != null)
                        {
                            foreach (var item in items)
                            {
                                vmPlan.Procedures.Add(new ProcedureItem
                                {
                                    Code = item.treatment_type ?? string.Empty,
                                    Name = item.treatment_type ?? string.Empty,
                                    Category = item.tooth_number != null ? $"Diş {item.tooth_number}" : string.Empty,
                                    Price = Convert.ToDecimal(item.cost ?? 0m)
                                });
                            }
                            vmPlan.ProceduresCount = vmPlan.Procedures.Count;
                            if (vmPlan.TotalCost <= 0)
                            {
                                vmPlan.TotalCost = vmPlan.Procedures.Sum(p => p.Price);
                            }
                        }

                        PendingTreatmentPlans.Add(vmPlan);
                    }
                }

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
                decimal totalApproved = 0m;
                var failedIds = new List<int>();
                foreach (var plan in selectedPlans)
                {
                    try
                    {
                        await _apiService.PostAsync<dynamic>($"/payments/approve-plan/{plan.Id}", new { approved = true });
                        totalApproved += plan.TotalCost;
                        PendingTreatmentPlans.Remove(plan);
                    }
                    catch (Exception)
                    {
                        failedIds.Add(plan.Id);
                    }
                }

                if (totalApproved > 0)
                {
                    System.Windows.MessageBox.Show(
                        $"{selectedPlans.Count - failedIds.Count} tedavi planı onaylandı.\nToplam maliyet: {totalApproved:F2} ₺\n\nHasta borcu güncellendi.",
                        "Başarılı",
                        System.Windows.MessageBoxButton.OK,
                        System.Windows.MessageBoxImage.Information);
                }
                if (failedIds.Count > 0)
                {
                    System.Windows.MessageBox.Show(
                        $"Şu planlar onaylanamadı: {string.Join(", ", failedIds)}",
                        "Hata",
                        System.Windows.MessageBoxButton.OK,
                        System.Windows.MessageBoxImage.Error);
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
            if (SelectedPaymentPatient == null)
            {
                SelectedPaymentPatientTotal = 0m;
                RemainingDebt = 0m;
                DentistCommission = 0m;
                DentistCommissionPercentage = 0m;
                OnPropertyChanged(nameof(SelectedPaymentPatientTotal));
                OnPropertyChanged(nameof(RemainingDebt));
                OnPropertyChanged(nameof(DentistCommission));
                OnPropertyChanged(nameof(DentistCommissionPercentage));
                return;
            }
            
            // Load patient debt from API
            _ = LoadPatientDebtAsync(SelectedPaymentPatient.Id);
        }
        
        private async Task LoadPatientDebtAsync(int patientId)
        {
            try
            {
                var response = await _apiService.GetAsync<dynamic>($"/payments/patient-debt/{patientId}");
                var debt = response?.debt;
                if (response != null && debt != null)
                {
                    SelectedPaymentPatientTotal = Convert.ToDecimal(debt?.total_debt ?? 0m);
                    var paidAmount = Convert.ToDecimal(debt?.paid_amount ?? 0m);
                    var currentRemainingDebt = Convert.ToDecimal(debt?.remaining_debt ?? 0m);
                    
                    // Calculate remaining debt after current payment
                    RemainingDebt = Math.Max(0, currentRemainingDebt - PaymentAmount);
                    
                    // Calculate dentist commission (placeholder - should get from dentist's commission_rate)
                    DentistCommissionPercentage = 15m; // TODO: Get from dentist's commission_rate
                    DentistCommission = PaymentAmount * (DentistCommissionPercentage / 100m);
                    
                    OnPropertyChanged(nameof(SelectedPaymentPatientTotal));
                    OnPropertyChanged(nameof(RemainingDebt));
                    OnPropertyChanged(nameof(DentistCommission));
                    OnPropertyChanged(nameof(DentistCommissionPercentage));
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Hasta borç bilgileri yüklenirken hata: {ex.Message}");
                // Fallback to placeholder
                SelectedPaymentPatientTotal = 0m;
                RemainingDebt = 0m;
                DentistCommission = 0m;
                DentistCommissionPercentage = 0m;
                OnPropertyChanged(nameof(SelectedPaymentPatientTotal));
                OnPropertyChanged(nameof(RemainingDebt));
                OnPropertyChanged(nameof(DentistCommission));
                OnPropertyChanged(nameof(DentistCommissionPercentage));
            }
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
                var request = new
                {
                    patientId = SelectedPaymentPatient.Id,
                    amount = PaymentAmount,
                    paymentMethod = ToApiPaymentMethod(SelectedPaymentMethod),
                    treatmentPlanId = (int?)null, // Can be set if needed
                    notes = (string?)null
                };
                
                var response = await _apiService.PostAsync<dynamic>("/payments/process", request);
                var success = response?.success;
                if (response != null && success == true)
                {
                    System.Windows.MessageBox.Show(
                        $"Ödeme başarıyla işlendi.\nAlınan: {PaymentAmount:F2} ₺\nKalan Borç: {RemainingDebt:F2} ₺\nHekim Ciro Payı: {DentistCommission:F2} ₺",
                        "Başarılı",
                        System.Windows.MessageBoxButton.OK,
                        System.Windows.MessageBoxImage.Information);
                    
                    PaymentAmount = 0;
                    // Ana bölümdeki bilgileri de güncelle
                    CalculatePaymentInfo();
                    // Hasta borç bilgilerini yeniden yükle
                    if (SelectedPaymentPatient != null)
                    {
                        await LoadPatientDebtAsync(SelectedPaymentPatient.Id);
                    }
                    // Gelir gider verilerini yeniden yükle
                    await LoadIncomeExpenseDataAsync();
                    // Eğer seçili hasta varsa, onun bilgilerini de güncelle
                    if (SelectedIncomePatient != null)
                    {
                        await LoadPatientIncomeDetailsAsync();
                    }
                }
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
    
    public class PaymentHistoryItem : ObservableObject
    {
        private decimal _amount;
        private string _paymentMethod = string.Empty;
        private DateTime _createdAt;
        
        public decimal Amount
        {
            get => _amount;
            set => SetProperty(ref _amount, value);
        }
        
        public string PaymentMethod
        {
            get => _paymentMethod;
            set => SetProperty(ref _paymentMethod, value);
        }
        
        public DateTime CreatedAt
        {
            get => _createdAt;
            set => SetProperty(ref _createdAt, value);
        }
    }
}
