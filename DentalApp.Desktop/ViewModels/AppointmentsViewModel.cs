using DentalApp.Desktop.Helpers;
using DentalApp.Desktop.Models;
using DentalApp.Desktop.Services;
using System;
using System.Collections.ObjectModel;
using System.Windows;
using System.Windows.Input;
using Newtonsoft.Json;

namespace DentalApp.Desktop.ViewModels
{
    public class AppointmentsViewModel : ObservableObject
    {
        private readonly AppointmentService _appointmentService;
        private readonly PatientService _patientService;
        private readonly ApiService _apiService;
        private bool _isBusy;
        private Appointment? _selectedAppointment;
        private DateTime _selectedDate = DateTime.Today;
        private int _currentPage = 1;
        private int _totalPages = 1;

        public ObservableCollection<Appointment> Appointments { get; } = new();
        public ObservableCollection<Patient> Patients { get; } = new();
        public ObservableCollection<DentistInfo> Dentists { get; } = new();
        public ObservableCollection<TimeSlot> TimeSlots { get; } = new();
        public ObservableCollection<AppointmentSlot> AppointmentSlots { get; } = new();

        public bool IsBusy
        {
            get => _isBusy;
            set => SetProperty(ref _isBusy, value);
        }

        public Appointment? SelectedAppointment
        {
            get => _selectedAppointment;
            set => SetProperty(ref _selectedAppointment, value);
        }

        public DateTime SelectedDate
        {
            get => _selectedDate;
            set
            {
                if (SetProperty(ref _selectedDate, value))
                {
                    _ = LoadAppointmentsAsync();
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

        public ICommand RefreshCommand { get; }
        public ICommand AddAppointmentCommand { get; }
        public ICommand EditAppointmentCommand { get; }
        public ICommand CancelAppointmentCommand { get; }
        public ICommand PreviousPageCommand { get; }
        public ICommand NextPageCommand { get; }

        public event Action<Appointment>? EditAppointmentRequested;
        public event Action? AddAppointmentRequested;

        public ICommand SlotClickCommand { get; }
        public ICommand SMSCommand { get; }

        public AppointmentsViewModel(AppointmentService appointmentService, PatientService patientService, ApiService? apiService = null)
        {
            _appointmentService = appointmentService;
            _patientService = patientService;
            _apiService = apiService ?? new ApiService();
            RefreshCommand = new RelayCommand(async _ => await LoadAppointmentsAsync(), _ => !IsBusy);
            AddAppointmentCommand = new RelayCommand(_ => AddAppointmentRequested?.Invoke());
            EditAppointmentCommand = new RelayCommand(_ =>
            {
                if (SelectedAppointment != null)
                    EditAppointmentRequested?.Invoke(SelectedAppointment);
            }, _ => SelectedAppointment != null);
            CancelAppointmentCommand = new RelayCommand(async _ => await CancelSelectedAppointmentAsync(), _ => SelectedAppointment != null && !IsBusy);
            PreviousPageCommand = new RelayCommand(async _ =>
            {
                if (CurrentPage > 1)
                {
                    CurrentPage--;
                    await LoadAppointmentsAsync();
                }
            }, _ => CurrentPage > 1 && !IsBusy);
            NextPageCommand = new RelayCommand(async _ =>
            {
                if (CurrentPage < TotalPages)
                {
                    CurrentPage++;
                    await LoadAppointmentsAsync();
                }
            }, _ => CurrentPage < TotalPages && !IsBusy);
            SlotClickCommand = new RelayCommand<AppointmentSlot>(async slot => await HandleSlotClickAsync(slot));
            SMSCommand = new RelayCommand<Appointment>(async apt => await SendSMSAsync(apt), _ => SelectedAppointment != null);
            
            InitializeTimeSlots();
            _ = LoadDentistsAsync();
        }
        
        private void InitializeTimeSlots()
        {
            TimeSlots.Clear();
            for (int hour = 8; hour <= 21; hour++)
            {
                TimeSlots.Add(new TimeSlot { Time = new TimeSpan(hour, 0, 0) });
                if (hour < 21)
                {
                    TimeSlots.Add(new TimeSlot { Time = new TimeSpan(hour, 30, 0) });
                }
            }
        }
        
        private async Task LoadDentistsAsync()
        {
            try
            {
                // TODO: Load from /api/users?role=dentist when API is ready
                // For now, use placeholder data
                Dentists.Clear();
                Dentists.Add(new DentistInfo { Id = 1, Name = "Dr. Ahmet Yılmaz", Email = "ahmet@example.com" });
                Dentists.Add(new DentistInfo { Id = 2, Name = "Dr. Ayşe Demir", Email = "ayse@example.com" });
                Dentists.Add(new DentistInfo { Id = 3, Name = "Dr. Mehmet Kaya", Email = "mehmet@example.com" });
                
                // After loading dentists, refresh slots
                await RefreshSlotsAsync();
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error loading dentists: {ex}");
            }
        }
        
        private async Task RefreshSlotsAsync()
        {
            AppointmentSlots.Clear();
            
            // Create slots for each time and dentist combination
            foreach (var timeSlot in TimeSlots)
            {
                foreach (var dentist in Dentists)
                {
                    var slot = new AppointmentSlot
                    {
                        Time = timeSlot.Time,
                        DentistId = dentist.Id,
                        DentistName = dentist.Name,
                        Date = SelectedDate
                    };
                    
                    // Check if there's an appointment for this slot
                    var appointment = Appointments.FirstOrDefault(a => 
                        a.AppointmentDate.Date == SelectedDate.Date &&
                        a.DentistId == dentist.Id &&
                        a.StartTime <= timeSlot.Time &&
                        a.EndTime > timeSlot.Time);
                    
                    if (appointment != null)
                    {
                        slot.Appointment = appointment;
                        slot.Status = SlotStatus.Occupied;
                    }
                    else
                    {
                        slot.Status = SlotStatus.Available;
                    }
                    
                    AppointmentSlots.Add(slot);
                }
            }
        }
        
        private async Task HandleSlotClickAsync(AppointmentSlot? slot)
        {
            try
            {
                if (slot == null) return;
                
                if (slot.Status == SlotStatus.Unavailable)
                {
                    return; // Kırmızı slotlara tıklanamaz
                }
                
                if (slot.Status == SlotStatus.Occupied && slot.Appointment != null)
                {
                    // Dolu slot - detay/düzenle
                    SelectedAppointment = slot.Appointment;
                    EditAppointmentRequested?.Invoke(slot.Appointment);
                }
                else
                {
                    // Boş slot - randevu ekle
                    var newAppointment = new Appointment
                    {
                        AppointmentDate = slot.Date,
                        StartTime = slot.Time,
                        EndTime = slot.Time.Add(TimeSpan.FromMinutes(30)),
                        DentistId = slot.DentistId
                    };
                    AddAppointmentRequested?.Invoke();
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"HandleSlotClickAsync Error: {ex}");
                System.Windows.MessageBox.Show($"Randevu slot'una tıklanırken hata: {ex.Message}\n\nDetay: {ex.InnerException?.Message ?? "Detay yok"}", "Hata",
                    System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Error);
            }
        }
        
        private async Task SendSMSAsync(Appointment? appointment)
        {
            if (appointment == null) return;
            
            // Placeholder - SMS ayarları sonra eklenecek
            MessageBox.Show(
                "SMS gönderme özelliği yakında eklenecektir.",
                "Yakında",
                MessageBoxButton.OK,
                MessageBoxImage.Information);
        }

        public async Task LoadAppointmentsAsync()
        {
            IsBusy = true;
            try
            {
                var (appointments, pagination) = await _appointmentService.GetAppointmentsAsync(
                    page: CurrentPage,
                    limit: 1000, // Load all for scheduler
                    startDate: SelectedDate,
                    endDate: SelectedDate);

                Appointments.Clear();
                foreach (var a in appointments)
                {
                    Appointments.Add(a);
                }

                TotalPages = pagination.Pages;
                OnPropertyChanged(nameof(PageInfo));
                
                // Refresh slots after loading appointments
                await RefreshSlotsAsync();
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Randevular yüklenirken hata: {ex.Message}", "Hata", MessageBoxButton.OK, MessageBoxImage.Error);
            }
            finally
            {
                IsBusy = false;
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

        private async Task CancelSelectedAppointmentAsync()
        {
            if (SelectedAppointment == null) return;

            var result = MessageBox.Show(
                $"Bu randevuyu iptal etmek istediğinize emin misiniz?",
                "İptal Onayı",
                MessageBoxButton.YesNo,
                MessageBoxImage.Warning);

            if (result == MessageBoxResult.Yes)
            {
                try
                {
                    IsBusy = true;
                    await _appointmentService.CancelAppointmentAsync(SelectedAppointment.Id);
                    await LoadAppointmentsAsync();
                    MessageBox.Show("Randevu başarıyla iptal edildi.", "Başarılı", MessageBoxButton.OK, MessageBoxImage.Information);
                }
                catch (Exception ex)
                {
                    MessageBox.Show($"Randevu iptal edilirken hata: {ex.Message}", "Hata", MessageBoxButton.OK, MessageBoxImage.Error);
                }
                finally
                {
                    IsBusy = false;
                }
            }
        }
    }
    
    public class DentistInfo : ObservableObject
    {
        private int _id;
        private string _name = string.Empty;
        private string _email = string.Empty;
        
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
        
        public string Email
        {
            get => _email;
            set => SetProperty(ref _email, value);
        }
    }
    
    public class TimeSlot : ObservableObject
    {
        private TimeSpan _time;
        
        public TimeSpan Time
        {
            get => _time;
            set => SetProperty(ref _time, value);
        }
        
        public string TimeString => $"{Time.Hours:D2}:{Time.Minutes:D2}";
    }
    
    public enum SlotStatus
    {
        Available,    // Yeşil - Boş
        Occupied,     // Mavi - Dolu
        Unavailable   // Kırmızı - Müsait değil
    }
    
    public class AppointmentSlot : ObservableObject
    {
        private TimeSpan _time;
        private int _dentistId;
        private string _dentistName = string.Empty;
        private DateTime _date;
        private SlotStatus _status;
        private Appointment? _appointment;
        
        public TimeSpan Time
        {
            get => _time;
            set => SetProperty(ref _time, value);
        }
        
        public int DentistId
        {
            get => _dentistId;
            set => SetProperty(ref _dentistId, value);
        }
        
        public string DentistName
        {
            get => _dentistName;
            set => SetProperty(ref _dentistName, value);
        }
        
        public DateTime Date
        {
            get => _date;
            set => SetProperty(ref _date, value);
        }
        
        public SlotStatus Status
        {
            get => _status;
            set => SetProperty(ref _status, value);
        }
        
        public Appointment? Appointment
        {
            get => _appointment;
            set => SetProperty(ref _appointment, value);
        }
        
        public string TimeString => $"{Time.Hours:D2}:{Time.Minutes:D2}";
        
        public string PatientName => Appointment?.PatientFullName ?? "";
    }
}
