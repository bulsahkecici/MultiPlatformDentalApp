using DentalApp.Desktop.Helpers;
using DentalApp.Desktop.Models;
using DentalApp.Desktop.Services;
using System.Collections.ObjectModel;
using System.Globalization;
using System.Windows.Input;

namespace DentalApp.Desktop.ViewModels
{
    public class AppointmentFormViewModel : ObservableObject
    {
        private readonly AppointmentService _appointmentService;
        private Appointment _appointment;
        private bool _isEditMode;
        private bool _isBusy;
        private string _startTimeString = string.Empty;
        private string _endTimeString = string.Empty;

        public Appointment Appointment
        {
            get => _appointment;
            set => SetProperty(ref _appointment, value);
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

        public string StartTimeString
        {
            get => _startTimeString;
            set
            {
                if (SetProperty(ref _startTimeString, value))
                {
                    if (string.IsNullOrWhiteSpace(value))
                        return;
                        
                    try
                    {
                        // Parse HH:mm format manually
                        if (TryParseTime(value, out var time))
                        {
                            Appointment.StartTime = time;
                        }
                    }
                    catch
                    {
                        // Ignore parse errors, user is still typing
                    }
                }
            }
        }

        public string EndTimeString
        {
            get => _endTimeString;
            set
            {
                if (SetProperty(ref _endTimeString, value))
                {
                    if (string.IsNullOrWhiteSpace(value))
                        return;
                        
                    try
                    {
                        // Parse HH:mm format manually
                        if (TryParseTime(value, out var time))
                        {
                            Appointment.EndTime = time;
                        }
                    }
                    catch
                    {
                        // Ignore parse errors, user is still typing
                    }
                }
            }
        }

        private bool TryParseTime(string timeString, out TimeSpan time)
        {
            time = TimeSpan.Zero;
            
            if (string.IsNullOrWhiteSpace(timeString))
                return false;
            
            // Try DateTime.ParseExact with HH:mm format
            if (DateTime.TryParseExact(timeString, "HH:mm", CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.None, out var dt))
            {
                time = dt.TimeOfDay;
                return true;
            }
            
            // Try hh:mm format
            if (DateTime.TryParseExact(timeString, "hh:mm", CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.None, out var dt2))
            {
                time = dt2.TimeOfDay;
                return true;
            }
            
            // Try standard TimeSpan parse
            if (TimeSpan.TryParse(timeString, out var ts))
            {
                time = ts;
                return true;
            }
            
            // Try manual parsing HH:mm
            var parts = timeString.Split(':');
            if (parts.Length == 2 && int.TryParse(parts[0], out var hours) && int.TryParse(parts[1], out var minutes))
            {
                if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60)
                {
                    time = new TimeSpan(hours, minutes, 0);
                    return true;
                }
            }
            
            return false;
        }

        public ObservableCollection<Patient> Patients { get; } = new();
        public ObservableCollection<DentistInfo> Dentists { get; } = new();
        public ObservableCollection<StatusItem> StatusOptions { get; } = new();
        public ObservableCollection<string> AppointmentTypeOptions { get; } = new();
        public ObservableCollection<string> TimeOptions { get; } = new();

        public ICommand SaveCommand { get; }
        public ICommand CancelCommand { get; }

        public event Action<bool>? SaveCompleted;

        public AppointmentFormViewModel(AppointmentService appointmentService, PatientService patientService, Appointment? appointment = null)
        {
            _appointmentService = appointmentService;
            _appointment = appointment ?? new Appointment 
            { 
                AppointmentDate = DateTime.Today,
                StartTime = new TimeSpan(9, 0, 0),
                EndTime = new TimeSpan(10, 0, 0),
                Status = "scheduled"
            };
            _isEditMode = appointment != null;
            
            // Safely format TimeSpan to string (TimeSpan doesn't support "HH" format, use "hh" or manual formatting)
            try
            {
                var hours = _appointment.StartTime.Hours;
                var minutes = _appointment.StartTime.Minutes;
                _startTimeString = $"{hours:D2}:{minutes:D2}";
            }
            catch
            {
                _startTimeString = "09:00";
                _appointment.StartTime = new TimeSpan(9, 0, 0);
            }
            
            try
            {
                var hours = _appointment.EndTime.Hours;
                var minutes = _appointment.EndTime.Minutes;
                _endTimeString = $"{hours:D2}:{minutes:D2}";
            }
            catch
            {
                _endTimeString = "10:00";
                _appointment.EndTime = new TimeSpan(10, 0, 0);
            }

            SaveCommand = new RelayCommand(async _ => await SaveAppointmentAsync(), _ => !IsBusy && IsValid());
            CancelCommand = new RelayCommand(_ => SaveCompleted?.Invoke(false));

            // Initialize status options
            StatusOptions.Add(new Helpers.StatusItem { Value = "scheduled", Text = "Planlandı" });
            StatusOptions.Add(new Helpers.StatusItem { Value = "confirmed", Text = "Onaylandı" });
            StatusOptions.Add(new Helpers.StatusItem { Value = "completed", Text = "Tamamlandı" });
            StatusOptions.Add(new Helpers.StatusItem { Value = "cancelled", Text = "İptal Edildi" });

            // Initialize appointment type options
            AppointmentTypeOptions.Add("Muayene");
            AppointmentTypeOptions.Add("Temizlik");
            AppointmentTypeOptions.Add("Dolgu");
            AppointmentTypeOptions.Add("Çekim");
            AppointmentTypeOptions.Add("Kanal Tedavisi");
            AppointmentTypeOptions.Add("Protez");
            AppointmentTypeOptions.Add("Ortodonti");
            AppointmentTypeOptions.Add("Kontrol");

            // Initialize time options (08:00 to 21:00 in 30-minute intervals)
            for (int hour = 8; hour <= 21; hour++)
            {
                TimeOptions.Add($"{hour:D2}:00");
                if (hour < 21) // Don't add :30 for 21:00
                {
                    TimeOptions.Add($"{hour:D2}:30");
                }
            }

            try
            {
                _ = LoadPatientsAsync(patientService);
                _ = LoadDentistsAsync();
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"AppointmentFormViewModel Constructor Error: {ex}");
                // Don't show message box in constructor, just log
            }
        }
        
        private async Task LoadDentistsAsync()
        {
            try
            {
                // TODO: Load from /api/users?role=dentist when API is ready
                // For now, use placeholder data - using same class from AppointmentsViewModel
                Dentists.Clear();
                Dentists.Add(new DentistInfo { Id = 1, Name = "Dr. Ahmet Yılmaz", Email = "ahmet@example.com" });
                Dentists.Add(new DentistInfo { Id = 2, Name = "Dr. Ayşe Demir", Email = "ayse@example.com" });
                Dentists.Add(new DentistInfo { Id = 3, Name = "Dr. Mehmet Kaya", Email = "mehmet@example.com" });
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error loading dentists: {ex}");
            }
        }

        private async Task LoadPatientsAsync(PatientService patientService)
        {
            try
            {
                if (patientService == null)
                {
                    System.Diagnostics.Debug.WriteLine("LoadPatientsAsync: patientService is null");
                    return;
                }
                
                var (patients, _) = await patientService.GetPatientsAsync(page: 1, limit: 1000);
                Patients.Clear();
                foreach (var p in patients)
                {
                    Patients.Add(p);
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error loading patients: {ex}");
                // Don't show message box in async method, just log
                // The error will be visible when user tries to select a patient
            }
        }

        private bool IsValid()
        {
            return Appointment.PatientId > 0 &&
                   !string.IsNullOrWhiteSpace(StartTimeString) &&
                   !string.IsNullOrWhiteSpace(EndTimeString);
        }

        private async Task SaveAppointmentAsync()
        {
            IsBusy = true;
            try
            {
                // Validate required fields
                if (Appointment.PatientId <= 0)
                {
                    System.Windows.MessageBox.Show("Lütfen bir hasta seçin.", "Hata", System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Warning);
                    IsBusy = false;
                    return;
                }
                
                // Validate and ensure times are set correctly
                if (string.IsNullOrWhiteSpace(StartTimeString) || !TryParseTime(StartTimeString, out var startTime))
                {
                    System.Windows.MessageBox.Show("Lütfen geçerli bir başlangıç saati girin (HH:mm formatında, örn: 09:00).", "Hata", System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Warning);
                    IsBusy = false;
                    return;
                }
                Appointment.StartTime = startTime;
                
                if (string.IsNullOrWhiteSpace(EndTimeString) || !TryParseTime(EndTimeString, out var endTime))
                {
                    System.Windows.MessageBox.Show("Lütfen geçerli bir bitiş saati girin (HH:mm formatında, örn: 10:00).", "Hata", System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Warning);
                    IsBusy = false;
                    return;
                }
                Appointment.EndTime = endTime;
                
                // Ensure status is set (default to scheduled if not set)
                if (string.IsNullOrWhiteSpace(Appointment.Status))
                {
                    Appointment.Status = "scheduled";
                }
                
                // Debug: Log appointment data before sending
                System.Diagnostics.Debug.WriteLine($"[AppointmentFormViewModel] Saving appointment:");
                System.Diagnostics.Debug.WriteLine($"  PatientId: {Appointment.PatientId}");
                System.Diagnostics.Debug.WriteLine($"  AppointmentDate: {Appointment.AppointmentDate:yyyy-MM-dd}");
                System.Diagnostics.Debug.WriteLine($"  StartTime: {Appointment.StartTime.Hours:D2}:{Appointment.StartTime.Minutes:D2}:{Appointment.StartTime.Seconds:D2}");
                System.Diagnostics.Debug.WriteLine($"  EndTime: {Appointment.EndTime.Hours:D2}:{Appointment.EndTime.Minutes:D2}:{Appointment.EndTime.Seconds:D2}");
                System.Diagnostics.Debug.WriteLine($"  Status: {Appointment.Status}");
                System.Diagnostics.Debug.WriteLine($"  AppointmentType: {Appointment.AppointmentType}");
                
                Appointment? savedAppointment;
                if (IsEditMode)
                {
                    savedAppointment = await _appointmentService.UpdateAppointmentAsync(Appointment);
                }
                else
                {
                    savedAppointment = await _appointmentService.CreateAppointmentAsync(Appointment);
                }

                if (savedAppointment != null)
                {
                    Appointment = savedAppointment;
                    SaveCompleted?.Invoke(true);
                }
                else
                {
                    System.Windows.MessageBox.Show("Randevu kaydedilemedi.", "Hata", System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Error);
                }
            }
            catch (Services.UnauthorizedException)
            {
                // UnauthorizedException is handled by MainViewModel via ApiService.OnUnauthorized
                throw; // Re-throw to let MainViewModel handle it
            }
            catch (Exception ex)
            {
                var errorMessage = $"Randevu kaydedilirken hata: {ex.Message}";
                if (ex.InnerException != null)
                {
                    errorMessage += $"\n\nİç Hata: {ex.InnerException.Message}";
                }
                System.Windows.MessageBox.Show(errorMessage, "Hata", System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Error);
                System.Diagnostics.Debug.WriteLine($"SaveAppointmentAsync Error: {ex}");
                System.Diagnostics.Debug.WriteLine($"Stack Trace: {ex.StackTrace}");
            }
            finally
            {
                IsBusy = false;
            }
        }
    }
}
