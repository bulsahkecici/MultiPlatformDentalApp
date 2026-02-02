using DentalApp.Desktop.Models;
using Newtonsoft.Json;

namespace DentalApp.Desktop.Services
{
    public class PatientService
    {
        private readonly ApiService _apiService;

        public PatientService(ApiService apiService)
        {
            _apiService = apiService;
        }

        public async Task<(List<Patient> Patients, PaginationInfo Pagination)> GetPatientsAsync(int page = 1, int limit = 20, string? search = null)
        {
            var queryParams = $"?page={page}&limit={limit}";
            if (!string.IsNullOrWhiteSpace(search))
            {
                queryParams += $"&search={Uri.EscapeDataString(search)}";
            }

            var response = await _apiService.GetAsync<PatientsResponse>($"/patients{queryParams}");
            if (response != null)
            {
                return (response.Patients, response.Pagination);
            }
            return (new List<Patient>(), new PaginationInfo());
        }

        public async Task<Patient?> GetPatientAsync(int id)
        {
            var response = await _apiService.GetAsync<PatientResponse>($"/patients/{id}");
            return response?.Patient;
        }

        public async Task<Patient?> CreatePatientAsync(Patient patient)
        {
            var request = new
            {
                firstName = patient.FirstName,
                lastName = patient.LastName,
                dateOfBirth = patient.DateOfBirth?.ToString("yyyy-MM-dd"),
                gender = patient.Gender,
                email = patient.Email,
                phone = patient.Phone,
                address = patient.Address,
                city = patient.City,
                // postalCode removed - backend doesn't support it
                country = patient.Country,
                bloodType = patient.BloodType,
                allergies = patient.Allergies,
                medicalConditions = patient.MedicalConditions,
                currentMedications = patient.CurrentMedications,
                emergencyContactName = patient.EmergencyContactName,
                emergencyContactPhone = patient.EmergencyContactPhone,
                insuranceProvider = patient.InsuranceProvider,
                insurancePolicyNumber = patient.InsurancePolicyNumber,
                notes = patient.Notes
            };

            var response = await _apiService.PostAsync<PatientResponse>("/patients", request);
            return response?.Patient;
        }

        public async Task<Patient?> UpdatePatientAsync(Patient patient)
        {
            var request = new
            {
                firstName = patient.FirstName,
                lastName = patient.LastName,
                dateOfBirth = patient.DateOfBirth?.ToString("yyyy-MM-dd"),
                gender = patient.Gender,
                email = patient.Email,
                phone = patient.Phone,
                address = patient.Address,
                city = patient.City,
                // postalCode removed - backend doesn't support it
                country = patient.Country,
                bloodType = patient.BloodType,
                allergies = patient.Allergies,
                medicalConditions = patient.MedicalConditions,
                currentMedications = patient.CurrentMedications,
                emergencyContactName = patient.EmergencyContactName,
                emergencyContactPhone = patient.EmergencyContactPhone,
                insuranceProvider = patient.InsuranceProvider,
                insurancePolicyNumber = patient.InsurancePolicyNumber,
                notes = patient.Notes
            };

            var response = await _apiService.PutAsync<PatientResponse>($"/patients/{patient.Id}", request);
            return response?.Patient;
        }

        public async Task DeletePatientAsync(int id)
        {
            await _apiService.DeleteAsync($"/patients/{id}");
        }
    }
}
