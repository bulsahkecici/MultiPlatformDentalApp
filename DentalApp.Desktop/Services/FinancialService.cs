using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Newtonsoft.Json;

namespace DentalApp.Desktop.Services
{
    public class FinancialService
    {
        private readonly ApiService _apiService;

        public FinancialService(ApiService apiService)
        {
            _apiService = apiService;
        }

        public async Task<DashboardStats> GetDashboardStatsAsync()
        {
            try
            {
                var response = await _apiService.GetAsync<AdminStatisticsResponse>("/admin/statistics");
                var stats = response?.Statistics;
                if (stats == null)
                    return new DashboardStats();

                return new DashboardStats
                {
                    TotalPatients = stats.TotalPatients > 0 ? stats.TotalPatients : stats.Patients?.Total ?? 0,
                    LastMonthFinancial = stats.LastMonthFinancial,
                    LastMonthPatients = stats.LastMonthPatients,
                    LastMonthTransactions = stats.LastMonthTransactions,
                    ThisMonthPatients = stats.ThisMonthPatients,
                    ThisMonthFinancial = stats.ThisMonthFinancial,
                    UpcomingAppointmentsCount = stats.UpcomingAppointmentsCount,
                    TotalAmount = stats.Invoices?.TotalRevenue ?? stats.Treatments?.TotalRevenue ?? 0,
                    PaidAmount = stats.Invoices?.PaidRevenue ?? 0,
                    DentistTurnovers = stats.DentistTurnovers ?? new List<DentistTurnoverItem>()
                };
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error fetching dashboard stats: {ex.Message}");
                return new DashboardStats();
            }
        }

        public async Task<DentistEarningsResult> GetDentistEarningsAsync(DateTime startDate, DateTime endDate)
        {
            try
            {
                var query = $"?startDate={startDate:yyyy-MM-dd}&endDate={endDate:yyyy-MM-dd}";
                var response = await _apiService.GetAsync<DentistEarningsApiResponse>($"/dentist/earnings{query}");
                if (response == null)
                    return new DentistEarningsResult();

                return new DentistEarningsResult
                {
                    Earnings = response.Earnings ?? new DentistEarningsData(),
                    Treatments = response.Treatments ?? new List<EarningsTreatment>()
                };
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error fetching dentist earnings: {ex.Message}");
                return new DentistEarningsResult();
            }
        }
    }

    public class AdminStatisticsResponse
    {
        [JsonProperty("statistics")]
        public AdminStatistics? Statistics { get; set; }
    }

    public class AdminStatistics
    {
        [JsonProperty("totalPatients")]
        public int TotalPatients { get; set; }

        [JsonProperty("lastMonthFinancial")]
        public decimal LastMonthFinancial { get; set; }

        [JsonProperty("lastMonthPatients")]
        public int LastMonthPatients { get; set; }

        [JsonProperty("lastMonthTransactions")]
        public int LastMonthTransactions { get; set; }

        [JsonProperty("thisMonthPatients")]
        public int ThisMonthPatients { get; set; }

        [JsonProperty("thisMonthFinancial")]
        public decimal ThisMonthFinancial { get; set; }

        [JsonProperty("upcomingAppointmentsCount")]
        public int UpcomingAppointmentsCount { get; set; }

        [JsonProperty("patients")]
        public StatisticsCount? Patients { get; set; }

        [JsonProperty("treatments")]
        public TreatmentStatistics? Treatments { get; set; }

        [JsonProperty("invoices")]
        public InvoiceStatistics? Invoices { get; set; }

        [JsonProperty("dentistTurnovers")]
        public List<DentistTurnoverItem>? DentistTurnovers { get; set; }
    }

    public class DentistTurnoverItem
    {
        [JsonProperty("dentistId")]
        public int DentistId { get; set; }

        [JsonProperty("firstName")]
        public string? FirstName { get; set; }

        [JsonProperty("lastName")]
        public string? LastName { get; set; }

        [JsonProperty("email")]
        public string? Email { get; set; }

        [JsonProperty("turnover")]
        public decimal Turnover { get; set; }

        [JsonProperty("treatmentCount")]
        public int TreatmentCount { get; set; }

        public string DisplayName
        {
            get
            {
                var name = $"{FirstName} {LastName}".Trim();
                return string.IsNullOrEmpty(name) ? Email ?? "Doktor" : name;
            }
        }
    }

    public class StatisticsCount
    {
        [JsonProperty("total")]
        public int Total { get; set; }
    }

    public class TreatmentStatistics
    {
        [JsonProperty("total")]
        public int Total { get; set; }

        [JsonProperty("totalRevenue")]
        public decimal TotalRevenue { get; set; }
    }

    public class InvoiceStatistics
    {
        [JsonProperty("total")]
        public int Total { get; set; }

        [JsonProperty("totalRevenue")]
        public decimal TotalRevenue { get; set; }

        [JsonProperty("paidRevenue")]
        public decimal PaidRevenue { get; set; }
    }

    public class DashboardStats
    {
        public int TotalPatients { get; set; }
        public decimal LastMonthFinancial { get; set; }
        public int LastMonthPatients { get; set; }
        public int LastMonthTransactions { get; set; }
        public int ThisMonthPatients { get; set; }
        public decimal ThisMonthFinancial { get; set; }
        public int UpcomingAppointmentsCount { get; set; }
        public decimal TotalAmount { get; set; }
        public decimal PaidAmount { get; set; }
        public List<DentistTurnoverItem> DentistTurnovers { get; set; } = new();
    }

    public class DentistEarningsApiResponse
    {
        [JsonProperty("earnings")]
        public DentistEarningsData? Earnings { get; set; }

        [JsonProperty("treatments")]
        public List<EarningsTreatment>? Treatments { get; set; }
    }

    public class DentistEarningsResult
    {
        public DentistEarningsData Earnings { get; set; } = new();
        public List<EarningsTreatment> Treatments { get; set; } = new();
    }

    public class DentistEarningsData
    {
        [JsonProperty("salary")]
        public decimal Salary { get; set; }

        [JsonProperty("totalTurnover")]
        public decimal TotalTurnover { get; set; }

        [JsonProperty("commissionRate")]
        public decimal CommissionRate { get; set; }

        [JsonProperty("paidTurnoverShare")]
        public decimal PaidTurnoverShare { get; set; }

        [JsonProperty("totalEarnings")]
        public decimal TotalEarnings { get; set; }
    }

    public class EarningsTreatment
    {
        [JsonProperty("id")]
        public int Id { get; set; }

        [JsonProperty("treatment_date")]
        public DateTime TreatmentDate { get; set; }

        [JsonProperty("treatment_type")]
        public string TreatmentType { get; set; } = string.Empty;

        [JsonProperty("cost")]
        public decimal Cost { get; set; }

        [JsonProperty("currency")]
        public string Currency { get; set; } = string.Empty;

        [JsonProperty("patient_first_name")]
        public string? PatientFirstName { get; set; }

        [JsonProperty("patient_last_name")]
        public string? PatientLastName { get; set; }

        [JsonProperty("earnings")]
        public decimal Earnings { get; set; }

        public string PatientFullName => $"{PatientFirstName} {PatientLastName}".Trim();
    }
}
