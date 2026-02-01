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

        public async Task<List<Appointment>> GetAppointmentsAsync()
        {
            var response = await _apiService.GetAsync<List<Appointment>>("/appointments");
            return response ?? new List<Appointment>();
        }

        public async Task<List<Appointment>> GetAppointmentsByDateAsync(DateTime date)
        {
            // Assuming the backend supports filtering by date
            var response = await _apiService.GetAsync<List<Appointment>>($"/appointments?date={date:yyyy-MM-dd}");
            return response ?? new List<Appointment>();
        }

        public async Task<Appointment?> CreateAppointmentAsync(Appointment appointment)
        {
            return await _apiService.PostAsync<Appointment>("/appointments", appointment);
        }

        public async Task<Appointment?> UpdateAppointmentAsync(Appointment appointment)
        {
            return await _apiService.PutAsync<Appointment>($"/appointments/{appointment.Id}", appointment);
        }

        public async Task CancelAppointmentAsync(int id, string reason)
        {
            await _apiService.PostAsync<object>($"/appointments/{id}/cancel", new { reason });
        }
    }
}
