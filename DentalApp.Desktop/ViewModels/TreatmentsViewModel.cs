using DentalApp.Desktop.Helpers;
using DentalApp.Desktop.Models;
using DentalApp.Desktop.Services;
using System.Collections.ObjectModel;
using System.Linq;
using System.Windows;
using System.Windows.Input;

namespace DentalApp.Desktop.ViewModels
{
    public class TreatmentsViewModel : ObservableObject
    {
        private readonly TreatmentService _treatmentService;
        private readonly PatientService _patientService;
        private bool _isBusy;
        private bool _canViewPrices;
        private Treatment? _selectedTreatment;
        private int? _selectedPatientId;
        private DateTime? _startDate;
        private DateTime? _endDate;
        private int _currentPage = 1;
        private int _totalPages = 1;

        public ObservableCollection<Treatment> Treatments { get; } = new();
        public ObservableCollection<Patient> Patients { get; } = new();
        public ObservableCollection<PatientTreatmentGroup> PatientGroups { get; } = new();

        public bool IsBusy
        {
            get => _isBusy;
            set => SetProperty(ref _isBusy, value);
        }

        public Treatment? SelectedTreatment
        {
            get => _selectedTreatment;
            set => SetProperty(ref _selectedTreatment, value);
        }

        public int? SelectedPatientId
        {
            get => _selectedPatientId;
            set
            {
                if (SetProperty(ref _selectedPatientId, value))
                {
                    CurrentPage = 1;
                    _ = LoadTreatmentsAsync();
                }
            }
        }

        public DateTime? StartDate
        {
            get => _startDate;
            set
            {
                if (SetProperty(ref _startDate, value))
                {
                    CurrentPage = 1;
                    _ = LoadTreatmentsAsync();
                }
            }
        }

        public DateTime? EndDate
        {
            get => _endDate;
            set
            {
                if (SetProperty(ref _endDate, value))
                {
                    CurrentPage = 1;
                    _ = LoadTreatmentsAsync();
                }
            }
        }

        public int CurrentPage
        {
            get => _currentPage;
            set => SetProperty(ref _currentPage, value);
        }

        public int TotalPages
        {
            get => _totalPages;
            set => SetProperty(ref _totalPages, value);
        }

        public string PageInfo => $"Sayfa {CurrentPage} / {TotalPages}";
        
        public bool CanViewPrices
        {
            get => _canViewPrices;
            set => SetProperty(ref _canViewPrices, value);
        }

        public ICommand RefreshCommand { get; }
        public ICommand AddTreatmentCommand { get; }
        public ICommand EditTreatmentCommand { get; }
        public ICommand PreviousPageCommand { get; }
        public ICommand NextPageCommand { get; }
        public ICommand ClearFiltersCommand { get; }

        public event Action<Treatment>? EditTreatmentRequested;
        public event Action? AddTreatmentRequested;

        public TreatmentsViewModel(TreatmentService treatmentService, PatientService patientService, bool canViewPrices = false)
        {
            _treatmentService = treatmentService;
            _patientService = patientService;
            _canViewPrices = canViewPrices;
            RefreshCommand = new RelayCommand(async _ => await LoadTreatmentsAsync(), _ => !IsBusy);
            AddTreatmentCommand = new RelayCommand(_ => AddTreatmentRequested?.Invoke());
            EditTreatmentCommand = new RelayCommand(_ =>
            {
                try
                {
                    if (SelectedTreatment != null)
                        EditTreatmentRequested?.Invoke(SelectedTreatment);
                    else
                        MessageBox.Show("Lütfen düzenlemek için bir tedavi seçin.", "Uyarı", MessageBoxButton.OK, MessageBoxImage.Warning);
                }
                catch (Exception ex)
                {
                    MessageBox.Show($"Tedavi düzenlenirken hata: {ex.Message}", "Hata", MessageBoxButton.OK, MessageBoxImage.Error);
                }
            }, _ => SelectedTreatment != null);
            PreviousPageCommand = new RelayCommand(async _ =>
            {
                if (CurrentPage > 1)
                {
                    CurrentPage--;
                    await LoadTreatmentsAsync();
                }
            }, _ => CurrentPage > 1 && !IsBusy);
            NextPageCommand = new RelayCommand(async _ =>
            {
                if (CurrentPage < TotalPages)
                {
                    CurrentPage++;
                    await LoadTreatmentsAsync();
                }
            }, _ => CurrentPage < TotalPages && !IsBusy);
            ClearFiltersCommand = new RelayCommand(_ =>
            {
                SelectedPatientId = null;
                StartDate = null;
                EndDate = null;
            });
        }

        public async Task LoadTreatmentsAsync()
        {
            IsBusy = true;
            try
            {
                var (treatments, pagination) = await _treatmentService.GetTreatmentsAsync(
                    page: CurrentPage,
                    limit: 1000, // Tüm tedavileri almak için limit artırıldı
                    patientId: SelectedPatientId,
                    startDate: StartDate,
                    endDate: EndDate);

                Treatments.Clear();
                foreach (var t in treatments)
                {
                    Treatments.Add(t);
                }

                // Hasta bazlı gruplama
                UpdatePatientGroups();

                TotalPages = pagination.Pages;
                OnPropertyChanged(nameof(PageInfo));
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Tedaviler yüklenirken hata: {ex.Message}", "Hata", MessageBoxButton.OK, MessageBoxImage.Error);
            }
            finally
            {
                IsBusy = false;
            }
        }

        private void UpdatePatientGroups()
        {
            PatientGroups.Clear();
            
            // Tedavileri hasta ID'sine göre grupla
            var grouped = Treatments
                .GroupBy(t => new { t.PatientId, PatientName = t.PatientFullName })
                .OrderBy(g => g.Key.PatientName);

            foreach (var group in grouped)
            {
                var patientGroup = new PatientTreatmentGroup
                {
                    PatientId = group.Key.PatientId,
                    PatientName = group.Key.PatientName ?? "Bilinmeyen Hasta"
                };

                foreach (var treatment in group.OrderByDescending(t => t.TreatmentDate))
                {
                    patientGroup.Treatments.Add(treatment);
                }

                PatientGroups.Add(patientGroup);
            }
        }

        public async Task LoadPatientsAsync()
        {
            try
            {
                var (patients, _) = await _patientService.GetPatientsAsync(page: 1, limit: 1000);
                Patients.Clear();
                foreach (var p in patients)
                {
                    Patients.Add(p);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Hastalar yüklenirken hata: {ex.Message}", "Hata", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }
    }

    public class PatientTreatmentGroup : ObservableObject
    {
        public int PatientId { get; set; }
        public string PatientName { get; set; } = string.Empty;
        public ObservableCollection<Treatment> Treatments { get; } = new();
        private bool _isExpanded;

        public bool IsExpanded
        {
            get => _isExpanded;
            set => SetProperty(ref _isExpanded, value);
        }
    }
}
