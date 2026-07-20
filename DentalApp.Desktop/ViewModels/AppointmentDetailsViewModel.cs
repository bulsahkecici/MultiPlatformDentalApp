using DentalApp.Desktop.Helpers;
using DentalApp.Desktop.Models;
using System;
using System.Windows.Input;

namespace DentalApp.Desktop.ViewModels
{
    public class AppointmentDetailsViewModel : ObservableObject
    {
        private Appointment _appointment;
        private string? _cancellationReason;

        public Appointment Appointment
        {
            get => _appointment;
            set
            {
                if (SetProperty(ref _appointment, value))
                {
                    OnPropertyChanged(nameof(StatusDisplay));
                    OnPropertyChanged(nameof(HasNotes));
                }
            }
        }

        public string StatusDisplay
        {
            get
            {
                if (Appointment == null) return "";
                return Appointment.Status switch
                {
                    "scheduled" => "Planlandı",
                    "confirmed" => "Onaylandı",
                    "completed" => "Tamamlandı",
                    "cancelled" => "İptal Edildi",
                    "no_show" => "Gelmedi",
                    _ => Appointment.Status
                };
            }
        }

        public bool HasNotes => !string.IsNullOrWhiteSpace(Appointment?.Notes);
        public bool CanCancel => Appointment?.Status != "cancelled" && Appointment?.Status != "completed";

        public string? CancellationReason
        {
            get => _cancellationReason;
            set => SetProperty(ref _cancellationReason, value);
        }

        public ICommand EditCommand { get; }
        public ICommand CancelCommand { get; }
        public ICommand CloseCommand { get; }

        public event Action? EditRequested;
        public event Action<string?>? CancelRequested;
        public event Action? CloseRequested;

        public AppointmentDetailsViewModel(Appointment appointment)
        {
            _appointment = appointment;
            EditCommand = new RelayCommand(_ => EditRequested?.Invoke());
            CancelCommand = new RelayCommand(_ => CancelRequested?.Invoke(CancellationReason), _ => CanCancel);
            CloseCommand = new RelayCommand(_ => CloseRequested?.Invoke());
        }
    }
}
