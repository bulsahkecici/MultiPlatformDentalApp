using DentalApp.Desktop.Models;

namespace DentalApp.Desktop.Services
{
    public class PatientService
    {
        private readonly ApiService _apiService;

        public PatientService(ApiService apiService)
        {
            _apiService = apiService;
        }

        public async Task<List<Patient>> GetPatientsAsync()
        {
            var response = await _apiService.GetAsync<List<Patient>>("/patients");
            return response ?? new List<Patient>();
        }

        public async Task<Patient?> GetPatientAsync(int id)
        {
            return await _apiService.GetAsync<Patient>($"/patients/{id}");
        }

        public async Task<Patient?> CreatePatientAsync(Patient patient)
        {
            return await _apiService.PostAsync<Patient>("/patients", patient);
        }

        public async Task<Patient?> UpdatePatientAsync(Patient patient)
        {
            return await _apiService.PutAsync<Patient>($"/patients/{patient.Id}", patient);
        }

        public async Task DeletePatientAsync(int id)
        {
            await _apiService.DeleteAsync($"/patients/{id}");
        }
    }
}
