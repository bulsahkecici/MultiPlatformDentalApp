using DentalApp.Desktop.Helpers;
using DentalApp.Desktop.Models;
using DentalApp.Desktop.Services;
using System.Windows.Input;

namespace DentalApp.Desktop.ViewModels
{
    public class PatientFormViewModel : ObservableObject
    {
        private readonly PatientService _patientService;
        private Patient _patient;
        private bool _isEditMode;
        private bool _isBusy;

        public Patient Patient
        {
            get => _patient;
            set => SetProperty(ref _patient, value);
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

        public ICommand SaveCommand { get; }
        public ICommand CancelCommand { get; }

        public event Action<bool>? SaveCompleted; // true if successful

        public PatientFormViewModel(PatientService patientService, Patient? patient = null)
        {
            _patientService = patientService;
            _patient = patient ?? new Patient();
            _isEditMode = patient != null;

            SaveCommand = new RelayCommand(async _ => await SavePatientAsync(), _ => !IsBusy && IsValid());
            CancelCommand = new RelayCommand(_ => SaveCompleted?.Invoke(false));
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
}
