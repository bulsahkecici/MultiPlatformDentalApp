using System;
using System.Threading.Tasks;
using DentalApp.Desktop.Models;

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
                var response = await _apiService.GetAsync<DashboardStatsResponse>("/financial/stats");
                return response?.Stats ?? new DashboardStats();
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error fetching dashboard stats: {ex.Message}");
                return new DashboardStats();
            }
        }

        public async Task<DentistEarningsData> GetDentistEarningsAsync(int dentistId, DateTime startDate, DateTime endDate)
        {
            try
            {
                var query = $"?dentistId={dentistId}&startDate={startDate:yyyy-MM-dd}&endDate={endDate:yyyy-MM-dd}";
                var response = await _apiService.GetAsync<DentistEarningsResponse>($"/financial/dentist-earnings{query}");
                return response?.Data ?? new DentistEarningsData();
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error fetching dentist earnings: {ex.Message}");
                return new DentistEarningsData();
            }
        }
    }

    public class DashboardStatsResponse
    {
        [Newtonsoft.Json.JsonProperty("stats")]
        public DashboardStats Stats { get; set; } = new();
    }

    public class DashboardStats
    {
        [Newtonsoft.Json.JsonProperty("total_amount")]
        public decimal TotalAmount { get; set; }

        [Newtonsoft.Json.JsonProperty("paid_amount")]
        public decimal PaidAmount { get; set; }

        [Newtonsoft.Json.JsonProperty("last_month_financial")]
        public decimal LastMonthFinancial { get; set; }

        [Newtonsoft.Json.JsonProperty("this_month_financial")]
        public decimal ThisMonthFinancial { get; set; }
    }

    public class DentistEarningsResponse
    {
        [Newtonsoft.Json.JsonProperty("data")]
        public DentistEarningsData Data { get; set; } = new();
    }

    public class DentistEarningsData
    {
        [Newtonsoft.Json.JsonProperty("salary")]
        public decimal Salary { get; set; }

        [Newtonsoft.Json.JsonProperty("total_turnover")]
        public decimal TotalTurnover { get; set; }

        [Newtonsoft.Json.JsonProperty("commission_rate")]
        public decimal CommissionRate { get; set; }

        [Newtonsoft.Json.JsonProperty("paid_turnover_share")]
        public decimal PaidTurnoverShare { get; set; }
    }
}
