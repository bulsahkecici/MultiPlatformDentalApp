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
        
        // Tariff properties
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
        
        // Tariff collections
        public ObservableCollection<TariffCategory> Categories { get; } = new();
        public ObservableCollection<TariffItem> TariffItems { get; } = new();
        public CollectionView TariffItemsView { get; private set; } = null!;

        // Tooth chart collections
        public ObservableCollection<ToothHotspot> ToothHotspots { get; } = new();

        // Multi-tooth selection (hangi diş/dişlere uygulandığının kaydı; tek bir Treatment'a bağlanır)
        public ObservableCollection<int> SelectedTeeth { get; } = new();

        public string? SelectedToothNumber
        {
            get => _selectedToothNumber;
            set
            {
                if (SetProperty(ref _selectedToothNumber, value))
                {
                    Treatment.ToothNumber = value ?? string.Empty;
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
                        // Load patient with institution agreement details
                        _ = LoadPatientWithDiscountsAsync(value.Id);
                    }
                    else
                    {
                        Treatment.PatientId = 0;
                        _patientCategoryDiscounts = null;
                        OnPropertyChanged(nameof(TotalCostWithDiscount));
                        OnPropertyChanged(nameof(TotalDiscount));
                        OnPropertyChanged(nameof(HasDiscount));
                    }
                }
            }
        }
        
        public decimal TotalCostWithDiscount => TotalCost - TotalDiscount;

        public decimal TotalDiscount
        {
            get
            {
                if (_patientCategoryDiscounts == null || string.IsNullOrWhiteSpace(Treatment.TreatmentType))
                    return 0m;

                return _patientCategoryDiscounts.TryGetValue(Treatment.TreatmentType, out var discountPercent)
                    ? TotalCost * (discountPercent / 100m)
                    : 0m;
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
        
        public bool HasDiscount => TotalDiscount > 0m;
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

        public bool CanViewPrices { get; }

        /// <summary>Sağ paneldeki "Seçilen İşlem" özet kartının görünürlüğü için.</summary>
        public bool HasSelectedTreatmentType => !string.IsNullOrWhiteSpace(Treatment.TreatmentType);

        public event Action<bool>? SaveCompleted;

        public TreatmentFormViewModel(TreatmentService treatmentService, PatientService patientService, Treatment? treatment = null, bool canViewPrices = false)
        {
            _treatmentService = treatmentService;
            _patientService = patientService;
            _tariffService = new TariffService();
            CanViewPrices = canViewPrices;
            
            // Initialize CollectionView for filtering
            var view = CollectionViewSource.GetDefaultView(TariffItems);
            TariffItemsView = view as CollectionView ?? new ListCollectionView(TariffItems);
            if (TariffItemsView != null)
            {
                TariffItemsView.Filter = FilterTariffItems;
            }
            
            // Initialize search timer for debounce
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
            
            // Set initial selected patient if editing
            if (treatment != null && treatment.PatientId > 0)
            {
                // Will be set after patients are loaded
            }

            SaveCommand = new RelayCommand(async _ => await SaveTreatmentAsync(), _ => !IsBusy && IsValid());
            CancelCommand = new RelayCommand(_ => SaveCompleted?.Invoke(false));
            AddTariffItemCommand = new RelayCommand(_ => AddSelectedTariffItemToTreatment(), _ => SelectedTariffItem != null);
            SelectToothCommand = new RelayCommand(OnSelectTooth);

            // Initialize tooth hotspots (FDI numbering: 11-18, 21-28, 31-38, 41-48)
            InitializeToothHotspots();

            // Initialize status options
            StatusOptions.Add(new Helpers.StatusItem { Value = "planned", Text = "Planlandı" });
            StatusOptions.Add(new Helpers.StatusItem { Value = "in_progress", Text = "Devam Ediyor" });
            StatusOptions.Add(new Helpers.StatusItem { Value = "completed", Text = "Tamamlandı" });
            StatusOptions.Add(new Helpers.StatusItem { Value = "cancelled", Text = "İptal Edildi" });

            _ = LoadPatientsAsync(patientService);
            _ = LoadTariffDataAsync();
            
            // If editing, reload full treatment data to ensure all fields are populated
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
                    
                    // Update selected patient if not already set
                    if (Treatment.PatientId > 0 && SelectedPatient == null)
                    {
                        SelectedPatient = Patients.FirstOrDefault(p => p.Id == Treatment.PatientId);
                    }
                    
                    // Diş şeması üzerinde hangi diş(ler) seçili gösterilsin (virgülle ayrılmış olabilir)
                    RestoreSelectedTeethFromTreatment();

                    // Set category if treatment type matches
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
            SearchText = string.Empty; // Arama kutusunu temizle

            if (SelectedCategory != null)
            {
                foreach (var item in SelectedCategory.Items)
                {
                    TariffItems.Add(item);
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
            _costString = SelectedTariffItem.PriceInclVat.ToString("F2", CultureInfo.InvariantCulture);

            // Açıklama alanına kod ekle
            if (string.IsNullOrWhiteSpace(Treatment.Description))
            {
                Treatment.Description = $"Kod: {SelectedTariffItem.Code}";
            }
            else if (!Treatment.Description.Contains(SelectedTariffItem.Code))
            {
                Treatment.Description = $"{Treatment.Description}\nKod: {SelectedTariffItem.Code}";
            }

            // Treatment ObservableObject değil; Treatment.* binding'lerinin (özet kart, toplam/
            // indirim) tazelenmesi için Treatment değişikliğini doğrudan bildiriyoruz.
            OnPropertyChanged(nameof(Treatment));
            OnPropertyChanged(nameof(CostString));
            OnPropertyChanged(nameof(HasSelectedTreatmentType));
            OnPropertyChanged(nameof(TotalCost));
            OnPropertyChanged(nameof(TotalDiscount));
            OnPropertyChanged(nameof(TotalCostWithDiscount));
            OnPropertyChanged(nameof(HasDiscount));
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
                
                // Set selected patient if editing
                if (Treatment.PatientId > 0)
                {
                    SelectedPatient = Patients.FirstOrDefault(p => p.Id == Treatment.PatientId);
                }

                if (IsEditMode && Treatment.Id > 0)
                {
                    RestoreSelectedTeethFromTreatment();
                }
            }
            catch (Exception ex)
            {
                System.Windows.MessageBox.Show($"Hastalar yüklenirken hata: {ex.Message}", "Hata", System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Error);
            }
        }

        /// <summary>Treatment.ToothNumber'daki (virgülle ayrılmış olabilir) diş numaralarını
        /// diş şeması üzerinde seçili göstermek için SelectedTeeth'e geri yükler.</summary>
        private void RestoreSelectedTeethFromTreatment()
        {
            SelectedTeeth.Clear();
            if (string.IsNullOrWhiteSpace(Treatment.ToothNumber))
                return;

            foreach (var part in Treatment.ToothNumber.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                if (int.TryParse(part, out var toothNumber))
                {
                    SelectedTeeth.Add(toothNumber);
                }
            }

            _selectedToothNumber = SelectedTeeth.Count > 0 ? string.Join(", ", SelectedTeeth.OrderBy(t => t)) : null;
            OnPropertyChanged(nameof(SelectedToothNumber));
        }

        private bool IsValid()
        {
            return Treatment.PatientId > 0 &&
                   !string.IsNullOrWhiteSpace(Treatment.TreatmentType);
        }

        private async Task SaveTreatmentAsync()
        {
            IsBusy = true;
            try
            {
                Treatment? savedTreatment;
                if (IsEditMode)
                {
                    savedTreatment = await _treatmentService.UpdateTreatmentAsync(Treatment, CanViewPrices);
                }
                else
                {
                    savedTreatment = await _treatmentService.CreateTreatmentAsync(Treatment, CanViewPrices);
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
            // FDI numaralandırma sistemi koordinatları.
            // mouth_chart.png (1024x482) üzerinden ölçüldü, XAML'deki 743x350 sabit
            // konteynere göre 350/482 oranıyla ölçeklendi (web tooth-chart ile aynı kaynak tablo).
            // Üst sıra soldan sağa: 18..11 | 21..28 — Alt sıra: 38..31 | 41..48

            // Üst çene (Y=69, H=98)
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 18, X = 62, Y = 69, Width = 38, Height = 98 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 17, X = 102, Y = 69, Width = 39, Height = 98 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 16, X = 145, Y = 69, Width = 41, Height = 98 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 15, X = 187, Y = 69, Width = 35, Height = 98 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 14, X = 222, Y = 69, Width = 35, Height = 98 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 13, X = 258, Y = 69, Width = 35, Height = 98 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 12, X = 294, Y = 69, Width = 36, Height = 98 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 11, X = 332, Y = 69, Width = 38, Height = 98 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 21, X = 375, Y = 69, Width = 38, Height = 98 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 22, X = 413, Y = 69, Width = 36, Height = 98 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 23, X = 451, Y = 69, Width = 35, Height = 98 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 24, X = 486, Y = 69, Width = 35, Height = 98 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 25, X = 521, Y = 69, Width = 35, Height = 98 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 26, X = 558, Y = 69, Width = 41, Height = 98 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 27, X = 602, Y = 69, Width = 39, Height = 98 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 28, X = 642, Y = 69, Width = 38, Height = 98 });

            // Alt çene (Y=183, H=123)
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 38, X = 70, Y = 183, Width = 45, Height = 123 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 37, X = 116, Y = 183, Width = 46, Height = 123 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 36, X = 168, Y = 183, Width = 48, Height = 123 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 35, X = 216, Y = 183, Width = 36, Height = 123 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 34, X = 253, Y = 183, Width = 33, Height = 123 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 33, X = 288, Y = 183, Width = 29, Height = 123 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 32, X = 320, Y = 183, Width = 26, Height = 123 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 31, X = 345, Y = 183, Width = 25, Height = 123 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 41, X = 378, Y = 183, Width = 25, Height = 123 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 42, X = 402, Y = 183, Width = 25, Height = 123 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 43, X = 428, Y = 183, Width = 28, Height = 123 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 44, X = 457, Y = 183, Width = 32, Height = 123 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 45, X = 492, Y = 183, Width = 33, Height = 123 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 46, X = 529, Y = 183, Width = 45, Height = 123 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 47, X = 582, Y = 183, Width = 45, Height = 123 });
            ToothHotspots.Add(new ToothHotspot { ToothNumber = 48, X = 630, Y = 183, Width = 44, Height = 123 });
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
            }
            else
            {
                SelectedTeeth.Add(toothNumber);
            }

            // Update selected tooth number for display
            SelectedToothNumber = SelectedTeeth.Count > 0
                ? string.Join(", ", SelectedTeeth.OrderBy(t => t))
                : null;
        }
        
        public decimal TotalCost => Treatment.Cost ?? 0m;
    }
    
    public class ProcedureItem : ObservableObject
    {
        private string _code = string.Empty;
        private string _name = string.Empty;
        private decimal _price;
        private string _category = string.Empty;
        private bool _isSelected;
        
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
