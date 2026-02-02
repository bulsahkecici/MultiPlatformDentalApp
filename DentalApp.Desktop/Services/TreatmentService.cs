using DentalApp.Desktop.Models;

namespace DentalApp.Desktop.Services
{
    public class TreatmentService
    {
        private readonly ApiService _apiService;

        public TreatmentService(ApiService apiService)
        {
            _apiService = apiService;
        }

        public async Task<(List<Treatment> Treatments, PaginationInfo Pagination)> GetTreatmentsAsync(
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

            var response = await _apiService.GetAsync<TreatmentsResponse>($"/treatments{queryParams}");
            if (response != null)
            {
                return (response.Treatments, response.Pagination);
            }
            return (new List<Treatment>(), new PaginationInfo());
        }

        public async Task<Treatment?> GetTreatmentAsync(int id)
        {
            var response = await _apiService.GetAsync<TreatmentResponse>($"/treatments/{id}");
            return response?.Treatment;
        }

        public async Task<Treatment?> CreateTreatmentAsync(Treatment treatment)
        {
            var request = new
            {
                patientId = treatment.PatientId,
                appointmentId = treatment.AppointmentId,
                dentistId = treatment.DentistId,
                treatmentDate = treatment.TreatmentDate.ToString("yyyy-MM-dd"),
                treatmentType = treatment.TreatmentType,
                toothNumber = treatment.ToothNumber,
                description = treatment.Description,
                diagnosis = treatment.Diagnosis,
                procedureNotes = treatment.ProcedureNotes,
                cost = treatment.Cost,
                currency = treatment.Currency,
                status = treatment.Status
            };

            var response = await _apiService.PostAsync<TreatmentResponse>("/treatments", request);
            return response?.Treatment;
        }

        public async Task<Treatment?> UpdateTreatmentAsync(Treatment treatment)
        {
            var request = new
            {
                patientId = treatment.PatientId,
                appointmentId = treatment.AppointmentId,
                dentistId = treatment.DentistId,
                treatmentDate = treatment.TreatmentDate.ToString("yyyy-MM-dd"),
                treatmentType = treatment.TreatmentType,
                toothNumber = treatment.ToothNumber,
                description = treatment.Description,
                diagnosis = treatment.Diagnosis,
                procedureNotes = treatment.ProcedureNotes,
                cost = treatment.Cost,
                currency = treatment.Currency,
                status = treatment.Status
            };

            var response = await _apiService.PutAsync<TreatmentResponse>($"/treatments/{treatment.Id}", request);
            return response?.Treatment;
        }

        public async Task<bool> CreateTreatmentPlanAsync(int patientId, int? dentistId, string title, string? description, List<TreatmentPlanItem> items)
        {
            var request = new
            {
                patientId,
                dentistId,
                title,
                description,
                items = items.Select(item => new
                {
                    toothNumber = item.ToothNumber,
                    treatmentType = item.TreatmentType,
                    cost = item.Cost,
                    currency = item.Currency ?? "TRY",
                    notes = item.Notes
                }).ToList()
            };

            try
            {
                var response = await _apiService.PostAsync<object>("/treatment-plans", request);
                return response != null;
            }
            catch
            {
                return false;
            }
        }
    }

    public class TreatmentPlanItem
    {
        public int ToothNumber { get; set; }
        public string TreatmentType { get; set; } = string.Empty;
        public decimal? Cost { get; set; }
        public string? Currency { get; set; }
        public string? Notes { get; set; }
    }
}
