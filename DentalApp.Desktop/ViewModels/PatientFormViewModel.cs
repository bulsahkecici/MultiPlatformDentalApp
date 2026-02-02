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
            
            // DateOfBirth değiştiğinde yaşı güncelle - Patient ObservableObject değil, bu yüzden Patient property'si değiştiğinde kontrol edeceğiz
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
