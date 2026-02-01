using DentalApp.Desktop.Helpers;
using DentalApp.Desktop.Models;
using DentalApp.Desktop.Services;
using System.Collections.ObjectModel;
using System.Windows.Input;

namespace DentalApp.Desktop.ViewModels
{
    public class PatientsViewModel : ObservableObject
    {
        private readonly PatientService _patientService;
        private bool _isBusy;
        private string _searchQuery = string.Empty;
        private Patient? _selectedPatient;

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
                    // Filter logic could go here or be triggered by RefreshCommand
                }
            }
        }

        public Patient? SelectedPatient
        {
            get => _selectedPatient;
            set => SetProperty(ref _selectedPatient, value);
        }

        public ICommand RefreshCommand { get; }
        public ICommand AddPatientCommand { get; }

        public PatientsViewModel(PatientService patientService)
        {
            _patientService = patientService;
            RefreshCommand = new RelayCommand(async _ => await LoadPatientsAsync(), _ => !IsBusy);
            AddPatientCommand = new RelayCommand(ExecuteAddPatient);
        }

        public async Task LoadPatientsAsync()
        {
            IsBusy = true;
            try
            {
                var patients = await _patientService.GetPatientsAsync();
                Patients.Clear();
                foreach (var p in patients)
                {
                    Patients.Add(p);
                }
            }
            catch (Exception ex)
            {
                System.Windows.MessageBox.Show($"Error loading patients: {ex.Message}");
            }
            finally
            {
                IsBusy = false;
            }
        }

        private void ExecuteAddPatient(object? parameter)
        {
            // Logic to open a dialog to add a patient
        }
    }
}
