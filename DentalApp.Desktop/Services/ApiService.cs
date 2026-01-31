using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using Newtonsoft.Json;

namespace DentalApp.Desktop.Services
{
    public class ApiService
    {
        private readonly HttpClient _httpClient;
        private string? _accessToken;
        private string? _refreshToken;

        public string BaseUrl { get; set; } = "http://localhost:3000";

        public ApiService()
        {
            _httpClient = new HttpClient();
        }

        public void SetTokens(string accessToken, string refreshToken)
        {
            _accessToken = accessToken;
            _refreshToken = refreshToken;
            _httpClient.DefaultRequestHeaders.Authorization = 
                new AuthenticationHeaderValue("Bearer", accessToken);
        }

        public void ClearTokens()
        {
            _accessToken = null;
            _refreshToken = null;
            _httpClient.DefaultRequestHeaders.Authorization = null;
        }

        public async Task<T?> GetAsync<T>(string endpoint)
        {
            try
            {
                var response = await _httpClient.GetAsync($"{BaseUrl}{endpoint}");
                response.EnsureSuccessStatusCode();
                var content = await response.Content.ReadAsStringAsync();
                return JsonConvert.DeserializeObject<T>(content);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"GET Error: {ex.Message}");
                throw;
            }
        }

        public async Task<T?> PostAsync<T>(string endpoint, object data)
        {
            try
            {
                var json = JsonConvert.SerializeObject(data);
                var content = new StringContent(json, Encoding.UTF8, "application/json");
                var response = await _httpClient.PostAsync($"{BaseUrl}{endpoint}", content);
                response.EnsureSuccessStatusCode();
                var responseContent = await response.Content.ReadAsStringAsync();
                return JsonConvert.DeserializeObject<T>(responseContent);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"POST Error: {ex.Message}");
                throw;
            }
        }

        public async Task<T?> PutAsync<T>(string endpoint, object data)
        {
            try
            {
                var json = JsonConvert.SerializeObject(data);
                var content = new StringContent(json, Encoding.UTF8, "application/json");
                var response = await _httpClient.PutAsync($"{BaseUrl}{endpoint}", content);
                response.EnsureSuccessStatusCode();
                var responseContent = await response.Content.ReadAsStringAsync();
                return JsonConvert.DeserializeObject<T>(responseContent);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"PUT Error: {ex.Message}");
                throw;
            }
        }

        public async Task DeleteAsync(string endpoint)
        {
            try
            {
                var response = await _httpClient.DeleteAsync($"{BaseUrl}{endpoint}");
                response.EnsureSuccessStatusCode();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"DELETE Error: {ex.Message}");
                throw;
            }
        }
    }
}
