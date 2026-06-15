using DentalApp.Desktop.Helpers;
using DentalApp.Desktop.Models;
using DentalApp.Desktop.Services;
using System.Collections.ObjectModel;
using System.Collections.Specialized;
using System.ComponentModel;
using System.Globalization;
using System.Linq;
using System.Windows.Data;
using System.Windows.Input;
using System.Windows.Threading;

namespace DentalApp.Desktop.ViewModels
{
    public class TreatmentFormViewModel : ObservableObject
    {
        private readonly TreatmentService _treatmentService;
        private readonly PatientService _patientService;
        private readonly TariffService _tariffService;
        private Treatment _treatment;
        private bool _isEditMode;
        private bool _isBusy;
        private string _costString = string.Empty;
        
        // Tarife özellikleri
        private TariffCategory? _selectedCategory;
        private string _searchText = string.Empty;
        private TariffItem? _selectedTariffItem;
        private DispatcherTimer? _searchTimer;
        private Patient? _selectedPatient;
        private string? _selectedToothNumber;
        private Dictionary<string, decimal>? _patientCategoryDiscounts;

        public Treatment Treatment
        {
            get => _treatment;
            set => SetProperty(ref _treatment, value);
        }

        public bool IsEditMode
        {
            get => _isEditMode;
            set => SetProperty(ref _isEditMode, value);
        }

        public bool IsBusy
        {
            get => _isBusy;
            set => SetProperty(ref _isBusy, value);
        }

        public string CostString
        {
            get => _costString;
            set
            {
                if (SetProperty(ref _costString, value))
                {
                    if (decimal.TryParse(value, NumberStyles.Currency | NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out var cost))
                    {
                        Treatment.Cost = cost;
                    }
                    else if (string.IsNullOrWhiteSpace(value))
                    {
                        Treatment.Cost = null;
                    }
                }
            }
        }

        public ObservableCollection<Patient> Patients { get; } = new();
        public ObservableCollection<StatusItem> StatusOptions { get; } = new();
        
        // Tarife koleksiyonları
        public ObservableCollection<TariffCategory> Categories { get; } = new();
        public ObservableCollection<TariffItem> TariffItems { get; } = new();
        public CollectionView TariffItemsView { get; private set; } = null!;

        // Diş haritası koleksiyonları
        public ObservableCollection<ToothHotspot> ToothHotspots { get; } = new();
        
        // Çoklu diş seçimi
        public ObservableCollection<int> SelectedTeeth { get; } = new();
        public bool HasSelectedTeeth => SelectedTeeth.Count > 0;
        
        // Çoklu işlem desteği: Dictionary<ToothNumber, List<ProcedureItem>>
        public Dictionary<int, ObservableCollection<ProcedureItem>> ToothPlans { get; } = new();
        
        // Seçili kategori için mevcut işlemler
        public ObservableCollection<ProcedureItem> AvailableProcedures { get; } = new();
        
        // Geçerli diş için seçili işlemler
        public ObservableCollection<ProcedureItem> SelectedProcedures { get; } = new();

        public string? SelectedToothNumber
        {
            get => _selectedToothNumber;
            set
            {
                if (SetProperty(ref _selectedToothNumber, value))
                {
                    Treatment.ToothNumber = value ?? string.Empty;
                    UpdateSelectedProcedures();
                }
            }
        }

        public Patient? SelectedPatient
        {
            get => _selectedPatient;
            set
            {
                if (SetProperty(ref _selectedPatient, value))
                {
                    if (value != null)
                    {
                        Treatment.PatientId = value.Id;
                        // Hastayı kurum anlaşması detaylarıyla birlikte yükle
                        _ = LoadPatientWithDiscountsAsync(value.Id);
                    }
                    else
                    {
                        Treatment.PatientId = 0;
                        _patientCategoryDiscounts = null;
                        OnPropertyChanged(nameof(TotalCostWithDiscount));
                        OnPropertyChanged(nameof(TotalDiscount));
                    }
                }
            }
        }
        
        public decimal TotalCostWithDiscount
        {
            get
            {
                var total = TotalCost;
                if (_patientCategoryDiscounts != null && _patientCategoryDiscounts.Count > 0)
                {
                    var discount = TotalDiscount;
                    return total - discount;
                }
                return total;
            }
        }
        
        public decimal TotalDiscount
        {
            get
            {
                if (_patientCategoryDiscounts == null || _patientCategoryDiscounts.Count == 0)
                    return 0m;
                
                decimal totalDiscount = 0m;
                foreach (var toothPlan in ToothPlans)
                {
                    foreach (var proc in toothPlan.Value)
                    {
                        if (_patientCategoryDiscounts.TryGetValue(proc.Category, out decimal discountPercent))
                        {
                            totalDiscount += proc.Price * (discountPercent / 100m);
                        }
                    }
                }
                return totalDiscount;
            }
        }
        
        private async Task LoadPatientWithDiscountsAsync(int patientId)
        {
            try
            {
                var patient = await _patientService.GetPatientAsync(patientId);
                if (patient != null)
                {
                    _patientCategoryDiscounts = patient.CategoryDiscounts;
                    OnPropertyChanged(nameof(TotalCostWithDiscount));
                    OnPropertyChanged(nameof(TotalDiscount));
                    OnPropertyChanged(nameof(HasDiscount));
                    OnPropertyChanged(nameof(InstitutionName));
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Hasta indirim bilgileri yüklenirken hata: {ex.Message}");
            }
        }
        
        public bool HasDiscount => _patientCategoryDiscounts != null && _patientCategoryDiscounts.Count > 0;
        public string? InstitutionName => SelectedPatient?.InstitutionName;

        public TariffCategory? SelectedCategory
        {
            get => _selectedCategory;
            set
            {
                if (SetProperty(ref _selectedCategory, value))
                {
                    OnCategoryChanged();
                }
            }
        }

        public string SearchText
        {
            get => _searchText;
            set
            {
                if (SetProperty(ref _searchText, value))
                {
                    OnSearchTextChanged();
                }
            }
        }

        public TariffItem? SelectedTariffItem
        {
            get => _selectedTariffItem;
            set
            {
                if (SetProperty(ref _selectedTariffItem, value))
                {
                    OnTariffItemSelected();
                }
            }
        }

        public ICommand SaveCommand { get; }
        public ICommand CancelCommand { get; }
        public ICommand AddTariffItemCommand { get; }
        public ICommand SelectToothCommand { get; }
        public ICommand AddProcedureCommand { get; }
        public ICommand RemoveProcedureCommand { get; }
        public ICommand SavePlanCommand { get; }

        public bool CanViewPrices { get; }

        public event Action<bool>? SaveCompleted;

        public TreatmentFormViewModel(TreatmentService treatmentService, PatientService patientService, Treatment? treatment = null, bool canViewPrices = false)
        {
            _treatmentService = treatmentService;
            _patientService = patientService;
            _tariffService = new TariffService();
            CanViewPrices = canViewPrices;
            
            // Filtreleme için CollectionView'i başlat
            var view = CollectionViewSource.GetDefaultView(TariffItems);
            TariffItemsView = view as CollectionView ?? new ListCollectionView(TariffItems);
            if (TariffItemsView != null)
            {
                TariffItemsView.Filter = FilterTariffItems;
            }
            
            // Geciktirme (debounce) için arama zamanlayıcısını başlat
            _searchTimer = new DispatcherTimer
            {
                Interval = TimeSpan.FromMilliseconds(300)
            };
            _searchTimer.Tick += (s, e) =>
            {
                _searchTimer?.Stop();
                TariffItemsView?.Refresh();
            };
            _treatment = treatment ?? new Treatment 
            { 
                TreatmentDate = DateTime.Today,
                Status = "planned",
                Currency = "TRY"
            };
            _isEditMode = treatment != null;
            _costString = treatment?.Cost?.ToString(CultureInfo.InvariantCulture) ?? string.Empty;
            
            // Düzenleme yapılıyorsa başlangıçta seçili hastayı ayarla
            if (treatment != null && treatment.PatientId > 0)
            {
                // Hastalar yüklendikten sonra ayarlanacak
            }

            SaveCommand = new RelayCommand(async _ => await SaveAsync(), _ => !IsBusy && CanSave());
            CancelCommand = new RelayCommand(_ => SaveCompleted?.Invoke(false));
            AddTariffItemCommand = new RelayCommand(_ => AddSelectedTariffItemToTreatment(), _ => SelectedTariffItem != null);
            SelectToothCommand = new RelayCommand(OnSelectTooth);
            AddProcedureCommand = new RelayCommand<object>(OnAddProcedure, _ => SelectedTariffItem != null && HasSelectedTeeth);
            RemoveProcedureCommand = new RelayCommand<ProcedureItem>(OnRemoveProcedure);
            SavePlanCommand = new RelayCommand(async _ => await SavePlanAsync(), _ => !IsBusy && ToothPlans.Count > 0);

            // Diş etkin noktalarını başlat (FDI numaralandırması: 11-18, 21-28, 31-38, 41-48)
            InitializeToothHotspots();

            // Durum seçeneklerini başlat
            StatusOptions.Add(new Helpers.StatusItem { Value = "planned", Text = "Planlandı" });
            StatusOptions.Add(new Helpers.StatusItem { Value = "in_progress", Text = "Devam Ediyor" });
            StatusOptions.Add(new Helpers.StatusItem { Value = "completed", Text = "Tamamlandı" });
            StatusOptions.Add(new Helpers.StatusItem { Value = "cancelled", Text = "İptal Edildi" });

            _ = LoadPatientsAsync(patientService);
            _ = LoadTariffDataAsync();
            
            // Düzenleme yapılıyorsa, tüm alanların dolması için tam tedavi verisini yeniden yükle
            if (_isEditMode && treatment != null && treatment.Id > 0)
            {
                _ = LoadTreatmentDataAsync(treatment.Id);
            }
        }
        
        private async Task LoadTreatmentDataAsync(int treatmentId)
        {
            try
            {
                var fullTreatment = await _treatmentService.GetTreatmentAsync(treatmentId);
                if (fullTreatment != null)
                {
                    Treatment = fullTreatment;
                    _costString = fullTreatment.Cost?.ToString(CultureInfo.InvariantCulture) ?? string.Empty;
                    OnPropertyChanged(nameof(CostString));
                    
                    // Henüz ayarlanmadıysa seçili hastayı güncelle
                    if (Treatment.PatientId > 0 && SelectedPatient == null)
                    {
                        SelectedPatient = Patients.FirstOrDefault(p => p.Id == Treatment.PatientId);
                    }
                    
                    // Diş numarası varsa diş planlarını yükle
                    if (!string.IsNullOrWhiteSpace(Treatment.ToothNumber))
                    {
                        if (int.TryParse(Treatment.ToothNumber, out var toothNumber))
                        {
                            SelectedTeeth.Clear();
                            SelectedTeeth.Add(toothNumber);
                            
                            if (!ToothPlans.ContainsKey(toothNumber))
                            {
                                ToothPlans[toothNumber] = new ObservableCollection<ProcedureItem>();
                            }
                            
                            // Mevcut tedaviyi bir işlem kalemi olarak ekle
                            var procItem = new ProcedureItem
                            {
                                Code = Treatment.Description?.Contains("Kod:") == true 
                                    ? Treatment.Description.Split("Kod:")[1].Trim().Split(')')[0].Trim()
                                    : "",
                                Name = Treatment.TreatmentType ?? Treatment.Description ?? "",
                                Price = Treatment.Cost ?? 0,
                                Category = Treatment.TreatmentType ?? ""
                            };
                            
                            if (!ToothPlans[toothNumber].Any(p => p.Code == procItem.Code && p.Name == procItem.Name))
                            {
                                ToothPlans[toothNumber].Add(procItem);
                            }
                            
                            UpdateSelectedProcedures();
                        }
                    }
                    
                    // Tedavi türü eşleşiyorsa kategoriyi ayarla
                    if (!string.IsNullOrWhiteSpace(Treatment.TreatmentType))
                    {
                        var matchingCategory = Categories.FirstOrDefault(c => c.Name == Treatment.TreatmentType);
                        if (matchingCategory != null)
                        {
                            SelectedCategory = matchingCategory;
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                System.Windows.MessageBox.Show($"Tedavi verileri yüklenirken hata: {ex.Message}", "Hata", System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Error);
            }
        }

        private async Task LoadTariffDataAsync()
        {
            try
            {
                var tariffData = await _tariffService.LoadTariffDataAsync();
                Categories.Clear();
                foreach (var category in tariffData.Categories)
                {
                    Categories.Add(category);
                }
            }
            catch (Exception ex)
            {
                System.Windows.MessageBox.Show($"Tarife verileri yüklenirken hata: {ex.Message}", "Hata", System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Error);
            }
        }

        private void OnCategoryChanged()
        {
            TariffItems.Clear();
            AvailableProcedures.Clear();
            SearchText = string.Empty; // Arama kutusunu temizle
            
            if (SelectedCategory != null)
            {
                // Kategori seçildiğinde tedavi türüne otomatik yaz
                Treatment.TreatmentType = SelectedCategory.Name;
                
                foreach (var item in SelectedCategory.Items)
                {
                    TariffItems.Add(item);
                    AvailableProcedures.Add(new ProcedureItem 
                    { 
                        Code = item.Code, 
                        Name = item.Name, 
                        Price = item.PriceInclVat,
                        Category = SelectedCategory.Name
                    });
                }
            }
            
            TariffItemsView?.Refresh();
        }

        private void OnSearchTextChanged()
        {
            // Debounce: Timer'ı yeniden başlat
            _searchTimer?.Stop();
            _searchTimer?.Start();
        }

        private bool FilterTariffItems(object obj)
        {
            if (obj is not TariffItem item)
                return false;

            if (string.IsNullOrWhiteSpace(SearchText))
                return true;

            return item.Name.Contains(SearchText, StringComparison.OrdinalIgnoreCase) ||
                   item.Code.Contains(SearchText, StringComparison.OrdinalIgnoreCase);
        }

        private void OnTariffItemSelected()
        {
            // Seçili item değiştiğinde yapılacak işlemler (isteğe bağlı)
        }

        private void AddSelectedTariffItemToTreatment()
        {
            if (SelectedTariffItem == null)
                return;

            // Tedavi türünü ve maliyeti set et
            Treatment.TreatmentType = SelectedTariffItem.Name;
            Treatment.Cost = SelectedTariffItem.PriceInclVat;
            Treatment.Currency = SelectedTariffItem.Currency;
            CostString = SelectedTariffItem.PriceInclVat.ToString("F2", CultureInfo.InvariantCulture);
            
            // Açıklama alanına kod ekle
            if (string.IsNullOrWhiteSpace(Treatment.Description))
            {
                Treatment.Description = $"Kod: {SelectedTariffItem.Code}";
            }
            else if (!Treatment.Description.Contains(SelectedTariffItem.Code))
            {
                Treatment.Description = $"{Treatment.Description}\nKod: {SelectedTariffItem.Code}";
            }
        }

        private async Task LoadPatientsAsync(PatientService patientService)
        {
            try
            {
                var (patients, _) = await patientService.GetPatientsAsync(page: 1, limit: 1000);
                Patients.Clear();
                foreach (var p in patients)
                {
                    Patients.Add(p);
                }
                
                // Düzenleme yapılıyorsa seçili hastayı ayarla
                if (Treatment.PatientId > 0)
                {
                    SelectedPatient = Patients.FirstOrDefault(p => p.Id == Treatment.PatientId);
                }

                // Mevcut bir tedavi düzenleniyorsa, verisini ToothPlans'e yükle
                if (IsEditMode && Treatment.Id > 0 && !string.IsNullOrWhiteSpace(Treatment.ToothNumber))
                {
                    if (int.TryParse(Treatment.ToothNumber, out var toothNumber))
                    {
                        SelectedTeeth.Clear();
                        SelectedTeeth.Add(toothNumber);
                        
                        if (!ToothPlans.ContainsKey(toothNumber))
                        {
                            ToothPlans[toothNumber] = new ObservableCollection<ProcedureItem>();
                        }
                        
                        // Mevcut tedaviyi bir işlem kalemi olarak ekle
                        var procItem = new ProcedureItem
                        {
                            Code = Treatment.Description?.Contains("Kod:") == true 
                                ? Treatment.Description.Split("Kod:")[1].Trim().Split(')')[0].Trim()
                                : "",
                            Name = Treatment.TreatmentType ?? Treatment.Description ?? "",
                            Price = Treatment.Cost ?? 0,
                            Category = Treatment.TreatmentType ?? ""
                        };
                        
                        if (!ToothPlans[toothNumber].Any(p => p.Code == procItem.Code && p.Name == procItem.Name))
                        {
                            ToothPlans[toothNumber].Add(procItem);
                        }
                        
                        UpdateSelectedProcedures();
                    }
                }
            }
            catch (Exception ex)
            {
                System.Windows.MessageBox.Show($"Hastalar yüklenirken hata: {ex.Message}", "Hata", System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Error);
            }
        }

        private bool IsValid()
        {
            return Treatment.PatientId > 0 &&
                   !string.IsNullOrWhiteSpace(Treatment.TreatmentType);
        }

        private bool HasPlanItems()
        {
            return ToothPlans.Any(tp => tp.Value != null && tp.Value.Count > 0);
        }

        private bool CanSave()
        {
            // Kullanıcı diş bazlı bir plan oluşturduysa plan olarak kaydet. Aksi halde tek tedavi olarak kaydet.
            if (HasPlanItems())
            {
                return Treatment.PatientId > 0;
            }

            return IsValid();
        }

        private async Task SaveAsync()
        {
            if (HasPlanItems())
            {
                await SavePlanAsync();
                return;
            }

            await SaveTreatmentAsync();
        }

        private async Task SaveTreatmentAsync()
        {
            IsBusy = true;
            try
            {
                Treatment? savedTreatment;
                if (IsEditMode)
                {
                    savedTreatment = await _treatmentService.UpdateTreatmentAsync(Treatment);
                }
                else
                {
                    savedTreatment = await _treatmentService.CreateTreatmentAsync(Treatment);
                }

                if (savedTreatment != null)
                {
                    Treatment = savedTreatment;
                    SaveCompleted?.Invoke(true);
                }
                else
                {
                    System.Windows.MessageBox.Show("Tedavi kaydedilemedi.", "Hata", System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Error);
                }
            }
            catch (Exception ex)
            {
                System.Windows.MessageBox.Show($"Tedavi kaydedilirken hata: {ex.Message}", "Hata", System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Error);
            }
            finally
            {
                IsBusy = false;
            }
        }

        private void InitializeToothHotspots()
        {
            // FDI numaralandırması — koordinatlar web diş haritasıyla hizalı (600×400 viewBox)
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 18, X = 300, Y = 50, Width = 30, Height = 45 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 17, X = 335, Y = 50, Width = 30, Height = 45 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 16, X = 370, Y = 50, Width = 30, Height = 45 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 15, X = 405, Y = 50, Width = 30, Height = 45 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 14, X = 440, Y = 50, Width = 30, Height = 45 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 13, X = 475, Y = 50, Width = 30, Height = 45 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 12, X = 510, Y = 50, Width = 30, Height = 45 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 11, X = 545, Y = 50, Width = 30, Height = 45 });

            ToothHotspots.Add(new ToothHotspot { ToothNumber = 21, X = 270, Y = 50, Width = 30, Height = 45 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 22, X = 235, Y = 50, Width = 30, Height = 45 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 23, X = 200, Y = 50, Width = 30, Height = 45 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 24, X = 165, Y = 50, Width = 30, Height = 45 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 25, X = 130, Y = 50, Width = 30, Height = 45 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 26, X = 95, Y = 50, Width = 30, Height = 45 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 27, X = 60, Y = 50, Width = 30, Height = 45 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 28, X = 25, Y = 50, Width = 30, Height = 45 });

            ToothHotspots.Add(new ToothHotspot { ToothNumber = 38, X = 25, Y = 150, Width = 30, Height = 45 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 37, X = 60, Y = 150, Width = 30, Height = 45 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 36, X = 95, Y = 150, Width = 30, Height = 45 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 35, X = 130, Y = 150, Width = 30, Height = 45 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 34, X = 165, Y = 150, Width = 30, Height = 45 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 33, X = 200, Y = 150, Width = 30, Height = 45 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 32, X = 235, Y = 150, Width = 30, Height = 45 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 31, X = 270, Y = 150, Width = 30, Height = 45 });

            ToothHotspots.Add(new ToothHotspot { ToothNumber = 41, X = 545, Y = 150, Width = 30, Height = 45 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 42, X = 510, Y = 150, Width = 30, Height = 45 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 43, X = 475, Y = 150, Width = 30, Height = 45 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 44, X = 440, Y = 150, Width = 30, Height = 45 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 45, X = 405, Y = 150, Width = 30, Height = 45 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 46, X = 370, Y = 150, Width = 30, Height = 45 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 47, X = 335, Y = 150, Width = 30, Height = 45 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 48, X = 300, Y = 150, Width = 30, Height = 45 });
        }

        private void OnSelectTooth(object? parameter)
        {
            if (parameter is int toothNumber)
            {
                ToggleToothSelection(toothNumber);
            }
            else if (parameter is string toothNumberStr && int.TryParse(toothNumberStr, out var toothNum))
            {
                ToggleToothSelection(toothNum);
            }
        }
        
        private void ToggleToothSelection(int toothNumber)
        {
            if (SelectedTeeth.Contains(toothNumber))
            {
                SelectedTeeth.Remove(toothNumber);
                ToothPlans.Remove(toothNumber);
            }
            else
            {
                SelectedTeeth.Add(toothNumber);
                if (!ToothPlans.ContainsKey(toothNumber))
                {
                    ToothPlans[toothNumber] = new ObservableCollection<ProcedureItem>();
                }
            }

            if (!HasSelectedTeeth)
            {
                SelectedCategory = null;
                SelectedTariffItem = null;
                AvailableProcedures.Clear();
            }
            
            // Görüntüleme için seçili diş numarasını güncelle
            if (SelectedTeeth.Count > 0)
            {
                SelectedToothNumber = string.Join(", ", SelectedTeeth.OrderBy(t => t));
            }
            else
            {
                SelectedToothNumber = null;
            }
            
            UpdateSelectedProcedures();
            OnPropertyChanged(nameof(HasSelectedTeeth));
            System.Windows.Input.CommandManager.InvalidateRequerySuggested();
        }
        
        private void UpdateSelectedProcedures()
        {
            SelectedProcedures.Clear();
            if (SelectedTeeth.Count == 1)
            {
                var tooth = SelectedTeeth.First();
                if (ToothPlans.ContainsKey(tooth))
                {
                    foreach (var proc in ToothPlans[tooth])
                    {
                        SelectedProcedures.Add(proc);
                    }
                }
            }
            OnPropertyChanged(nameof(TotalCost));
            OnPropertyChanged(nameof(TotalCostWithDiscount));
            OnPropertyChanged(nameof(TotalDiscount));
        }
        
        public decimal TotalCost
        {
            get
            {
                decimal total = 0m;
                foreach (var toothPlan in ToothPlans)
                {
                    foreach (var proc in toothPlan.Value)
                    {
                        total += proc.Price;
                    }
                }
                return total;
            }
        }
        
        private void OnAddProcedure(object? parameter)
        {
            if (SelectedTariffItem == null) return;
            
            var procItem = new ProcedureItem
            {
                Code = SelectedTariffItem.Code,
                Name = SelectedTariffItem.Name,
                Price = SelectedTariffItem.PriceInclVat,
                Category = SelectedCategory?.Name ?? ""
            };
            
            // Tüm seçili dişlere ekle
            foreach (var tooth in SelectedTeeth)
            {
                if (!ToothPlans.ContainsKey(tooth))
                {
                    ToothPlans[tooth] = new ObservableCollection<ProcedureItem>();
                }
                
                // Zaten eklenmiş mi kontrol et
                if (!ToothPlans[tooth].Any(p => p.Code == procItem.Code))
                {
                    ToothPlans[tooth].Add(procItem);
                }
            }
            
            UpdateSelectedProcedures();
        }
        
        private void OnRemoveProcedure(ProcedureItem? procedure)
        {
            if (procedure == null) return;
            
            foreach (var toothPlan in ToothPlans.Values)
            {
                var item = toothPlan.FirstOrDefault(p => p.Code == procedure.Code);
                if (item != null)
                {
                    toothPlan.Remove(item);
                }
            }
            
            UpdateSelectedProcedures();
        }
        
        private async Task SavePlanAsync()
        {
            if (Treatment.PatientId <= 0)
            {
                System.Windows.MessageBox.Show("Lütfen bir hasta seçin.", "Uyarı", System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Warning);
                return;
            }

            if (ToothPlans.Count == 0)
            {
                System.Windows.MessageBox.Show("Lütfen en az bir diş ve işlem seçin.", "Uyarı", System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Warning);
                return;
            }

            IsBusy = true;
            try
            {
                // Tedavi planı kalemlerini hazırla
                var planItems = new List<Services.TreatmentPlanItem>();
                
                foreach (var toothPlan in ToothPlans)
                {
                    var toothNumber = toothPlan.Key;
                    var procedures = toothPlan.Value;
                    
                    foreach (var proc in procedures)
                    {
                        planItems.Add(new Services.TreatmentPlanItem
                        {
                            ToothNumber = toothNumber,
                            TreatmentType = proc.Category,
                            Cost = CanViewPrices ? proc.Price : null,
                            Currency = "TRY",
                            Notes = $"{proc.Name} (Kod: {proc.Code})"
                        });
                    }
                }

                // API kullanarak tedavi planı oluştur
                var title = $"Tedavi Planı - {Treatment.TreatmentDate:dd.MM.yyyy}";
                var description = $"Toplam {planItems.Count} işlem, {ToothPlans.Count} diş";
                
                var success = await _treatmentService.CreateTreatmentPlanAsync(
                    Treatment.PatientId,
                    Treatment.DentistId,
                    title,
                    description,
                    planItems
                );

                if (success)
                {
                    System.Windows.MessageBox.Show("Tedavi planı başarıyla kaydedildi.", "Başarılı", System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Information);
                    SaveCompleted?.Invoke(true);
                }
                else
                {
                    System.Windows.MessageBox.Show("Tedavi planı kaydedilemedi.", "Hata", System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Error);
                }
            }
            catch (Exception ex)
            {
                System.Windows.MessageBox.Show($"Tedavi planı kaydedilirken hata: {ex.Message}", "Hata", System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Error);
            }
            finally
            {
                IsBusy = false;
            }
        }
    }
    
    public class ProcedureItem : ObservableObject
    {
        private int _id;
        private string _code = string.Empty;
        private string _name = string.Empty;
        private decimal _price;
        private string _category = string.Empty;
        private bool _isSelected;

        public int Id
        {
            get => _id;
            set => SetProperty(ref _id, value);
        }
        
        public string Code
        {
            get => _code;
            set => SetProperty(ref _code, value);
        }
        
        public string Name
        {
            get => _name;
            set => SetProperty(ref _name, value);
        }
        
        public decimal Price
        {
            get => _price;
            set => SetProperty(ref _price, value);
        }
        
        public string Category
        {
            get => _category;
            set => SetProperty(ref _category, value);
        }
        
        public bool IsSelected
        {
            get => _isSelected;
            set => SetProperty(ref _isSelected, value);
        }
    }
}
