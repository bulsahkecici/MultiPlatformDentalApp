using DentalApp.Desktop.Helpers;
using DentalApp.Desktop.Models;
using DentalApp.Desktop.Services;
using System.Collections.ObjectModel;
using System.Windows;
using System.Windows.Input;

namespace DentalApp.Desktop.ViewModels
{
    public class AppointmentsViewModel : ObservableObject
    {
        private readonly AppointmentService _appointmentService;
        private readonly PatientService _patientService;
        private bool _isBusy;
        private Appointment? _selectedAppointment;
        private DateTime _selectedDate = DateTime.Today;
        private int _currentPage = 1;
        private int _totalPages = 1;

        public ObservableCollection<Appointment> Appointments { get; } = new();
        public ObservableCollection<Patient> Patients { get; } = new();

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

        public AppointmentsViewModel(AppointmentService appointmentService, PatientService patientService)
        {
            _appointmentService = appointmentService;
            _patientService = patientService;
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
        }

        public async Task LoadAppointmentsAsync()
        {
            IsBusy = true;
            try
            {
                var (appointments, pagination) = await _appointmentService.GetAppointmentsAsync(
                    page: CurrentPage,
                    limit: 20,
                    startDate: SelectedDate,
                    endDate: SelectedDate);

                Appointments.Clear();
                foreach (var a in appointments)
                {
                    Appointments.Add(a);
                }

                TotalPages = pagination.Pages;
                OnPropertyChanged(nameof(PageInfo));
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
}
