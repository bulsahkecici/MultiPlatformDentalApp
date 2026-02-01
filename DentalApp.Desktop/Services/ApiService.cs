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

        public string BaseUrl { get; set; } = "http://localhost:3000/api";

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
                return await HandleResponseAsync<T>(response);
            }
            catch (Exception ex)
            {
                throw new Exception($"GET {endpoint} failed: {ex.Message}", ex);
            }
        }

        public async Task<T?> PostAsync<T>(string endpoint, object data)
        {
            try
            {
                var json = JsonConvert.SerializeObject(data);
                var content = new StringContent(json, Encoding.UTF8, "application/json");
                var response = await _httpClient.PostAsync($"{BaseUrl}{endpoint}", content);
                return await HandleResponseAsync<T>(response);
            }
            catch (Exception ex)
            {
                throw new Exception($"POST {endpoint} failed: {ex.Message}", ex);
            }
        }

        public async Task<T?> PutAsync<T>(string endpoint, object data)
        {
            try
            {
                var json = JsonConvert.SerializeObject(data);
                var content = new StringContent(json, Encoding.UTF8, "application/json");
                var response = await _httpClient.PutAsync($"{BaseUrl}{endpoint}", content);
                return await HandleResponseAsync<T>(response);
            }
            catch (Exception ex)
            {
                throw new Exception($"PUT {endpoint} failed: {ex.Message}", ex);
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
                throw new Exception($"DELETE {endpoint} failed: {ex.Message}", ex);
            }
        }

        private async Task<T?> HandleResponseAsync<T>(HttpResponseMessage response)
        {
            var content = await response.Content.ReadAsStringAsync();
            if (!response.IsSuccessStatusCode)
            {
                // Try to parse error message from backend
                try {
                    var errorObj = JsonConvert.DeserializeAnonymousType(content, new { error = new { message = "" } });
                    throw new Exception(errorObj?.error?.message ?? response.ReasonPhrase);
                } catch {
                    throw new Exception($"API Error ({response.StatusCode}): {response.ReasonPhrase}");
                }
            }
            
            return JsonConvert.DeserializeObject<T>(content);
        }
    }
}
