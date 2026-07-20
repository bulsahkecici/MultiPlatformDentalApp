using DentalApp.Desktop.Helpers;
using DentalApp.Desktop.Models;
using System;
using System.Windows.Input;

namespace DentalApp.Desktop.ViewModels
{
    public class AppointmentDetailsViewModel : ObservableObject
    {
        private Appointment _appointment;

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

        public bool CanCancel => Appointment?.Status != "cancelled";

        public ICommand EditCommand { get; }
        public ICommand CloseCommand { get; }
        public ICommand CancelCommand { get; }

        public event Action? EditRequested;
        public event Action? CloseRequested;
        public event Action? CancelRequested;

        public AppointmentDetailsViewModel(Appointment appointment)
        {
            _appointment = appointment;
            EditCommand = new RelayCommand(_ => EditRequested?.Invoke());
            CloseCommand = new RelayCommand(_ => CloseRequested?.Invoke());
            CancelCommand = new RelayCommand(_ => CancelRequested?.Invoke(), _ => CanCancel);
        }
    }
}
