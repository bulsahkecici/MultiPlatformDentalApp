using DentalApp.Desktop.Helpers;
using DentalApp.Desktop.Models;
using DentalApp.Desktop.Services;
using System.Windows.Input;
using System.Collections.ObjectModel;
using System.Linq;

namespace DentalApp.Desktop.ViewModels
{
    public class PatientFormViewModel : ObservableObject
    {
        private readonly PatientService _patientService;
        private Patient _patient = null!;
        private bool _isEditMode;
        private bool _isBusy;
        
        // İndirim Anlaşmaları
        private ObservableCollection<InstitutionAgreement> _institutionAgreements = new();
        private InstitutionAgreement? _selectedInstitutionAgreement;
        
        // İller, Ülkeler, Kan Grupları
        private ObservableCollection<string> _cities = new();
        private ObservableCollection<string> _countries = new();
        private ObservableCollection<string> _bloodTypes = new();

        public Patient Patient
        {
            get => _patient;
            set
            {
                if (SetProperty(ref _patient, value))
                {
                    OnPropertyChanged(nameof(PatientAge));
                    // DateOfBirth değişikliklerini dinlemek için Patient property'sini yeniden set et
                    if (value != null)
                    {
                        // DateOfBirth değiştiğinde yaşı güncellemek için bir timer veya başka bir mekanizma kullanabiliriz
                        // Şimdilik sadece property değiştiğinde güncelliyoruz
                    }
                }
            }
        }
        
        public int? PatientAge
        {
            get
            {
                if (Patient?.DateOfBirth == null)
                    return null;
                
                var today = DateTime.Today;
                var age = today.Year - Patient.DateOfBirth.Value.Year;
                if (Patient.DateOfBirth.Value.Date > today.AddYears(-age))
                    age--;
                
                return age;
            }
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

        public ObservableCollection<InstitutionAgreement> InstitutionAgreements
        {
            get => _institutionAgreements;
            set => SetProperty(ref _institutionAgreements, value);
        }
        
        public InstitutionAgreement? SelectedInstitutionAgreement
        {
            get => _selectedInstitutionAgreement;
            set => SetProperty(ref _selectedInstitutionAgreement, value);
        }
        
        public ObservableCollection<string> Cities
        {
            get => _cities;
            set => SetProperty(ref _cities, value);
        }
        
        public ObservableCollection<string> Countries
        {
            get => _countries;
            set => SetProperty(ref _countries, value);
        }
        
        public ObservableCollection<string> BloodTypes
        {
            get => _bloodTypes;
            set => SetProperty(ref _bloodTypes, value);
        }

        public ICommand SaveCommand { get; }
        public ICommand CancelCommand { get; }

        public event Action<bool>? SaveCompleted; // true if successful

        public PatientFormViewModel(PatientService patientService, Patient? patient = null, ObservableCollection<InstitutionAgreement>? institutionAgreements = null)
        {
            _patientService = patientService;
            _patient = patient ?? new Patient();
            _isEditMode = patient != null;

            SaveCommand = new RelayCommand(async _ => await SavePatientAsync(), _ => !IsBusy && IsValid());
            CancelCommand = new RelayCommand(_ => SaveCompleted?.Invoke(false));
            
            // InstitutionAgreements'i dışarıdan al veya varsayılan değerleri kullan
            if (institutionAgreements != null)
            {
                InstitutionAgreements = institutionAgreements;
            }
            else
            {
                LoadDefaultAgreements();
            }
            
            // İller, Ülkeler, Kan Grupları yükle
            LoadCities();
            LoadCountries();
            LoadBloodTypes();
            
            // DateOfBirth değiştiğinde yaşı güncelle - Patient ObservableObject değil, bu yüzden Patient property'si değiştiğinde kontrol edeceğiz
        }
        
        private void LoadCities()
        {
            Cities.Clear();
            var turkishCities = new[]
            {
                "Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Amasya", "Ankara", "Antalya", "Artvin",
                "Aydın", "Balıkesir", "Bilecik", "Bingöl", "Bitlis", "Bolu", "Burdur", "Bursa",
                "Çanakkale", "Çankırı", "Çorum", "Denizli", "Diyarbakır", "Edirne", "Elazığ", "Erzincan",
                "Erzurum", "Eskişehir", "Gaziantep", "Giresun", "Gümüşhane", "Hakkari", "Hatay", "Isparta",
                "İçel (Mersin)", "İstanbul", "İzmir", "Kars", "Kastamonu", "Kayseri", "Kırklareli", "Kırşehir",
                "Kocaeli", "Konya", "Kütahya", "Malatya", "Manisa", "Kahramanmaraş", "Mardin", "Muğla",
                "Muş", "Nevşehir", "Niğde", "Ordu", "Rize", "Sakarya", "Samsun", "Siirt",
                "Sinop", "Sivas", "Tekirdağ", "Tokat", "Trabzon", "Tunceli", "Şanlıurfa", "Uşak",
                "Van", "Yozgat", "Zonguldak", "Aksaray", "Bayburt", "Karaman", "Kırıkkale", "Batman",
                "Şırnak", "Bartın", "Ardahan", "Iğdır", "Yalova", "Karabük", "Kilis", "Osmaniye", "Düzce"
            };
            foreach (var city in turkishCities)
            {
                Cities.Add(city);
            }
        }
        
        private void LoadCountries()
        {
            Countries.Clear();
            var countries = new[]
            {
                "Almanya", "Amerika Birleşik Devletleri", "Avustralya", "Avusturya", "Azerbaycan",
                "Belçika", "Birleşik Arap Emirlikleri", "Birleşik Krallık", "Bulgaristan", "Danimarka",
                "Fransa", "Hollanda", "İspanya", "İsveç", "İsviçre", "İtalya", "Kanada", "Katar",
                "Kuveyt", "Norveç", "Romanya", "Rusya", "Suudi Arabistan", "Ukrayna", "Yunanistan", "Diğer"
            };
            foreach (var country in countries)
            {
                Countries.Add(country);
            }
        }
        
        private void LoadBloodTypes()
        {
            BloodTypes.Clear();
            var bloodTypes = new[] { "A+", "A-", "B+", "B-", "AB+", "AB-", "0+", "0-" };
            foreach (var bloodType in bloodTypes)
            {
                BloodTypes.Add(bloodType);
            }
        }
        
        private void LoadDefaultAgreements()
        {
            // Varsayılan anlaşmalar (PaymentsViewModel'den yüklenene kadar)
            InstitutionAgreements.Clear();
            InstitutionAgreements.Add(new InstitutionAgreement { Id = 1, Name = "SGK", DiscountPercentage = 20m });
            InstitutionAgreements.Add(new InstitutionAgreement { Id = 2, Name = "Özel Sigorta A", DiscountPercentage = 15m });
        }

        private bool IsValid()
        {
            return !string.IsNullOrWhiteSpace(Patient.FirstName) &&
                   !string.IsNullOrWhiteSpace(Patient.LastName);
        }

        private async Task SavePatientAsync()
        {
            IsBusy = true;
            try
            {
                Patient? savedPatient;
                if (IsEditMode)
                {
                    savedPatient = await _patientService.UpdatePatientAsync(Patient);
                }
                else
                {
                    savedPatient = await _patientService.CreatePatientAsync(Patient);
                }

                if (savedPatient != null)
                {
                    Patient = savedPatient;
                    SaveCompleted?.Invoke(true);
                }
                else
                {
                    System.Windows.MessageBox.Show("Hasta kaydedilemedi.", "Hata", System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Error);
                }
            }
            catch (Exception ex)
            {
                System.Windows.MessageBox.Show($"Hasta kaydedilirken hata: {ex.Message}", "Hata", System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Error);
            }
            finally
            {
                IsBusy = false;
            }
        }
    }
    
    public class InstitutionAgreement : ObservableObject
    {
        private int _id;
        private string _name = string.Empty;
        private decimal _discountPercentage;
        
        public int Id
        {
            get => _id;
            set => SetProperty(ref _id, value);
        }
        
        public string Name
        {
            get => _name;
            set => SetProperty(ref _name, value);
        }
        
        public decimal DiscountPercentage
        {
            get => _discountPercentage;
            set => SetProperty(ref _discountPercentage, value);
        }
        
        private Dictionary<string, decimal> _categoryDiscounts = new();
        
        public Dictionary<string, decimal> CategoryDiscounts
        {
            get => _categoryDiscounts;
            set => SetProperty(ref _categoryDiscounts, value);
        }
        
        // Ortalama indirim oranını hesapla (görüntüleme için)
        public decimal AverageDiscountPercentage
        {
            get
            {
                if (_categoryDiscounts.Count == 0)
                    return _discountPercentage;
                return _categoryDiscounts.Values.Average();
            }
        }
    }
    
    public class CategoryDiscount : ObservableObject
    {
        private string _categoryName = string.Empty;
        private decimal _discountPercentage;
        
        public string CategoryName
        {
            get => _categoryName;
            set => SetProperty(ref _categoryName, value);
        }
        
        public decimal DiscountPercentage
        {
            get => _discountPercentage;
            set => SetProperty(ref _discountPercentage, value);
        }
    }
}
