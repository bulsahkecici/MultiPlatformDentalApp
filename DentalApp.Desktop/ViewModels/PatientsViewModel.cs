using DentalApp.Desktop.Helpers;
using DentalApp.Desktop.Models;
using DentalApp.Desktop.Services;
using System.Collections.ObjectModel;
using System.Windows;
using System.Windows.Input;
using System.Linq;

namespace DentalApp.Desktop.ViewModels
{
    public class PatientsViewModel : ObservableObject
    {
        private readonly PatientService _patientService;
        private readonly AppointmentService? _appointmentService;
        private readonly TreatmentService? _treatmentService;
        private bool _isBusy;
        private string _searchQuery = string.Empty;
        private Patient? _selectedPatient;
        private int _currentPage = 1;
        private int _totalPages = 1;
        private PaginationInfo? _pagination;
        private bool _canEdit;

        public ObservableCollection<Patient> Patients { get; } = new();
        public ObservableCollection<Appointment> PatientAppointments { get; } = new();
        public ObservableCollection<Treatment> PatientTreatments { get; } = new();

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
            set
            {
                if (SetProperty(ref _selectedPatient, value))
                {
                    if (value != null)
                    {
                        _ = LoadPatientDetailsAsync();
                    }
                    else
                    {
                        PatientAppointments.Clear();
                        PatientTreatments.Clear();
                    }
                }
            }
        }
        
        public bool CanEdit
        {
            get => _canEdit;
            set => SetProperty(ref _canEdit, value);
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

        public PatientsViewModel(PatientService patientService, AppointmentService? appointmentService = null, TreatmentService? treatmentService = null, bool canEdit = true)
        {
            _patientService = patientService;
            _appointmentService = appointmentService;
            _treatmentService = treatmentService;
            _canEdit = canEdit;
            RefreshCommand = new RelayCommand(async _ => await LoadPatientsAsync(), _ => !IsBusy);
            AddPatientCommand = new RelayCommand(_ => AddPatientRequested?.Invoke(), _ => CanEdit);
            EditPatientCommand = new RelayCommand(_ => 
            {
                if (SelectedPatient != null)
                    EditPatientRequested?.Invoke(SelectedPatient);
            }, _ => SelectedPatient != null && CanEdit);
            DeletePatientCommand = new RelayCommand(async _ => await DeleteSelectedPatientAsync(), _ => SelectedPatient != null && !IsBusy && CanEdit);
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
        
        private async Task LoadPatientDetailsAsync()
        {
            if (SelectedPatient == null || _appointmentService == null || _treatmentService == null)
            {
                PatientAppointments.Clear();
                PatientTreatments.Clear();
                return;
            }
            
            try
            {
                // Load appointments
                var (appointments, _) = await _appointmentService.GetAppointmentsAsync(
                    page: 1,
                    limit: 1000,
                    patientId: SelectedPatient.Id);
                
                PatientAppointments.Clear();
                foreach (var apt in appointments.OrderByDescending(a => a.AppointmentDate))
                {
                    PatientAppointments.Add(apt);
                }
                
                // Load treatments
                var (treatments, _) = await _treatmentService.GetTreatmentsAsync(
                    page: 1,
                    limit: 1000,
                    patientId: SelectedPatient.Id);
                
                PatientTreatments.Clear();
                foreach (var treatment in treatments.OrderByDescending(t => t.TreatmentDate))
                {
                    PatientTreatments.Add(treatment);
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Hasta detayları yüklenirken hata: {ex.Message}");
            }
        }
    }
}
