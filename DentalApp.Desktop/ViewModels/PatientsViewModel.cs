using DentalApp.Desktop.Helpers;
using DentalApp.Desktop.Models;
using DentalApp.Desktop.Services;
using System.Collections.ObjectModel;
using System.Windows;
using System.Windows.Input;

namespace DentalApp.Desktop.ViewModels
{
    public class PatientsViewModel : ObservableObject
    {
        private readonly PatientService _patientService;
        private bool _isBusy;
        private string _searchQuery = string.Empty;
        private Patient? _selectedPatient;
        private int _currentPage = 1;
        private int _totalPages = 1;
        private PaginationInfo? _pagination;

        public ObservableCollection<Patient> Patients { get; } = new();

        public bool IsBusy
        {
            get => _isBusy;
            set => SetProperty(ref _isBusy, value);
        }

        public string SearchQuery
        {
            get => _searchQuery;
            set
            {
                if (SetProperty(ref _searchQuery, value))
                {
                    _currentPage = 1;
                    _ = LoadPatientsAsync();
                }
            }
        }

        public Patient? SelectedPatient
        {
            get => _selectedPatient;
            set => SetProperty(ref _selectedPatient, value);
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

        public ICommand RefreshCommand { get; }
        public ICommand AddPatientCommand { get; }
        public ICommand EditPatientCommand { get; }
        public ICommand DeletePatientCommand { get; }
        public ICommand PreviousPageCommand { get; }
        public ICommand NextPageCommand { get; }

        public event Action<Patient>? EditPatientRequested;
        public event Action? AddPatientRequested;

        public PatientsViewModel(PatientService patientService)
        {
            _patientService = patientService;
            RefreshCommand = new RelayCommand(async _ => await LoadPatientsAsync(), _ => !IsBusy);
            AddPatientCommand = new RelayCommand(_ => AddPatientRequested?.Invoke());
            EditPatientCommand = new RelayCommand(_ => 
            {
                if (SelectedPatient != null)
                    EditPatientRequested?.Invoke(SelectedPatient);
            }, _ => SelectedPatient != null);
            DeletePatientCommand = new RelayCommand(async _ => await DeleteSelectedPatientAsync(), _ => SelectedPatient != null && !IsBusy);
            PreviousPageCommand = new RelayCommand(async _ => 
            {
                if (CurrentPage > 1)
                {
                    CurrentPage--;
                    await LoadPatientsAsync();
                }
            }, _ => CurrentPage > 1 && !IsBusy);
            NextPageCommand = new RelayCommand(async _ => 
            {
                if (CurrentPage < TotalPages)
                {
                    CurrentPage++;
                    await LoadPatientsAsync();
                }
            }, _ => CurrentPage < TotalPages && !IsBusy);
        }

        public async Task LoadPatientsAsync()
        {
            IsBusy = true;
            try
            {
                var (patients, pagination) = await _patientService.GetPatientsAsync(
                    page: CurrentPage, 
                    limit: 20, 
                    search: string.IsNullOrWhiteSpace(SearchQuery) ? null : SearchQuery);
                
                Patients.Clear();
                foreach (var p in patients)
                {
                    Patients.Add(p);
                }

                _pagination = pagination;
                TotalPages = pagination.Pages;
                OnPropertyChanged(nameof(PageInfo));
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Hastalar yüklenirken hata: {ex.Message}", "Hata", MessageBoxButton.OK, MessageBoxImage.Error);
            }
            finally
            {
                IsBusy = false;
            }
        }

        private async Task DeleteSelectedPatientAsync()
        {
            if (SelectedPatient == null) return;

            var result = MessageBox.Show(
                $"{SelectedPatient.FullName} adlı hastayı silmek istediğinize emin misiniz?",
                "Silme Onayı",
                MessageBoxButton.YesNo,
                MessageBoxImage.Warning);

            if (result == MessageBoxResult.Yes)
            {
                try
                {
                    IsBusy = true;
                    await _patientService.DeletePatientAsync(SelectedPatient.Id);
                    await LoadPatientsAsync();
                    MessageBox.Show("Hasta başarıyla silindi.", "Başarılı", MessageBoxButton.OK, MessageBoxImage.Information);
                }
                catch (Exception ex)
                {
                    MessageBox.Show($"Hasta silinirken hata: {ex.Message}", "Hata", MessageBoxButton.OK, MessageBoxImage.Error);
                }
                finally
                {
                    IsBusy = false;
                }
            }
        }
    }
}
