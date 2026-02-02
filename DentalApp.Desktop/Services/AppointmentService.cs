using DentalApp.Desktop.Models;

namespace DentalApp.Desktop.Services
{
    public class AppointmentService
    {
        private readonly ApiService _apiService;

        public AppointmentService(ApiService apiService)
        {
            _apiService = apiService;
        }

        public async Task<(List<Appointment> Appointments, PaginationInfo Pagination)> GetAppointmentsAsync(
            int page = 1, 
            int limit = 20, 
            int? patientId = null,
            DateTime? startDate = null,
            DateTime? endDate = null)
        {
            var queryParams = $"?page={page}&limit={limit}";
            if (patientId.HasValue)
            {
                queryParams += $"&patientId={patientId.Value}";
            }
            if (startDate.HasValue)
            {
                queryParams += $"&startDate={startDate.Value:yyyy-MM-dd}";
            }
            if (endDate.HasValue)
            {
                queryParams += $"&endDate={endDate.Value:yyyy-MM-dd}";
            }

            var response = await _apiService.GetAsync<AppointmentsResponse>($"/appointments{queryParams}");
            if (response != null)
            {
                return (response.Appointments, response.Pagination);
            }
            return (new List<Appointment>(), new PaginationInfo());
        }

        public async Task<Appointment?> GetAppointmentAsync(int id)
        {
            var response = await _apiService.GetAsync<AppointmentResponse>($"/appointments/{id}");
            return response?.Appointment;
        }

        public async Task<Appointment?> CreateAppointmentAsync(Appointment appointment)
        {
            // Validate required fields
            if (appointment.PatientId <= 0)
            {
                throw new ArgumentException("Patient ID is required");
            }
            
            if (appointment.AppointmentDate == default(DateTime))
            {
                throw new ArgumentException("Appointment date is required");
            }
            
            // Format TimeSpan manually (HH:mm:ss format)
            var startTimeStr = $"{appointment.StartTime.Hours:D2}:{appointment.StartTime.Minutes:D2}:{appointment.StartTime.Seconds:D2}";
            var endTimeStr = $"{appointment.EndTime.Hours:D2}:{appointment.EndTime.Minutes:D2}:{appointment.EndTime.Seconds:D2}";
            
            // Ensure status is set
            var status = string.IsNullOrWhiteSpace(appointment.Status) ? "scheduled" : appointment.Status;
            
            var request = new
            {
                patientId = appointment.PatientId,
                dentistId = appointment.DentistId,
                appointmentDate = appointment.AppointmentDate.ToString("yyyy-MM-dd"),
                startTime = startTimeStr,
                endTime = endTimeStr,
                appointmentType = appointment.AppointmentType,
                status = status,
                notes = appointment.Notes
            };
            
            System.Diagnostics.Debug.WriteLine($"[AppointmentService] CreateAppointment Request: {Newtonsoft.Json.JsonConvert.SerializeObject(request)}");

            var response = await _apiService.PostAsync<AppointmentResponse>("/appointments", request);
            return response?.Appointment;
        }

        public async Task<Appointment?> UpdateAppointmentAsync(Appointment appointment)
        {
            // Format TimeSpan manually (HH:mm:ss format)
            var startTimeStr = $"{appointment.StartTime.Hours:D2}:{appointment.StartTime.Minutes:D2}:{appointment.StartTime.Seconds:D2}";
            var endTimeStr = $"{appointment.EndTime.Hours:D2}:{appointment.EndTime.Minutes:D2}:{appointment.EndTime.Seconds:D2}";
            
            var request = new
            {
                appointmentDate = appointment.AppointmentDate.ToString("yyyy-MM-dd"),
                startTime = startTimeStr,
                endTime = endTimeStr,
                appointmentType = appointment.AppointmentType,
                status = appointment.Status,
                notes = appointment.Notes
            };

            var response = await _apiService.PutAsync<AppointmentResponse>($"/appointments/{appointment.Id}", request);
            return response?.Appointment;
        }

        public async Task CancelAppointmentAsync(int id, string? reason = null)
        {
            await _apiService.DeleteAsync($"/appointments/{id}");
        }
    }
}
