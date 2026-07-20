using System.IO;
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
        public event Action? OnUnauthorized;

        public string BaseUrl { get; set; } = "http://localhost:3000/api";

        /// <summary>Socket.IO sunucu adresi (appsettings.json'dan yüklenir).</summary>
        public string SocketUrl { get; set; } = "http://localhost:3000";

        /// <summary>Socket.IO bağlantısı için mevcut access token (salt okunur).</summary>
        public string? AccessToken => _accessToken;

        /// <summary>Logout'ta backend'e iptal için gönderilecek refresh token (salt okunur).</summary>
        public string? RefreshToken => _refreshToken;

        public ApiService()
        {
            _httpClient = new HttpClient();
            LoadConfiguration();
        }

        /// <summary>
        /// Exe'nin yanındaki appsettings.json'dan API/Socket adreslerini yükler.
        /// Dosya yoksa veya bozuksa localhost varsayılanları kullanılır.
        /// </summary>
        private void LoadConfiguration()
        {
            try
            {
                var configPath = Path.Combine(AppContext.BaseDirectory, "appsettings.json");
                if (!File.Exists(configPath))
                {
                    return;
                }

                var json = File.ReadAllText(configPath);
                var config = JsonConvert.DeserializeObject<AppSettings>(json);
                if (config == null)
                {
                    return;
                }

                if (!string.IsNullOrWhiteSpace(config.ApiBaseUrl))
                {
                    BaseUrl = config.ApiBaseUrl.TrimEnd('/');
                }
                if (!string.IsNullOrWhiteSpace(config.SocketUrl))
                {
                    SocketUrl = config.SocketUrl.TrimEnd('/');
                }
            }
            catch
            {
                // Config okunamazsa varsayılanlarla devam et
            }
        }

        private class AppSettings
        {
            [JsonProperty("ApiBaseUrl")]
            public string? ApiBaseUrl { get; set; }

            [JsonProperty("SocketUrl")]
            public string? SocketUrl { get; set; }
        }

        public void SetTokens(string accessToken, string refreshToken)
        {
            _accessToken = accessToken;
            _refreshToken = refreshToken;
            
            // Remove existing Authorization header if any
            _httpClient.DefaultRequestHeaders.Remove("Authorization");

            // Add new Authorization header
            _httpClient.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Bearer", accessToken);
        }

        public void ClearTokens()
        {
            _accessToken = null;
            _refreshToken = null;
            _httpClient.DefaultRequestHeaders.Remove("Authorization");
        }

        public async Task<T?> GetAsync<T>(string endpoint)
        {
            try
            {
                var url = $"{BaseUrl}{endpoint}";
                var response = await _httpClient.GetAsync(url);
                var responseContent = await response.Content.ReadAsStringAsync();
                return await HandleResponseAsync<T>(response, endpoint, "GET", responseContent);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[ApiService] GET {endpoint} Exception: {ex}");
                throw new Exception($"GET {endpoint} failed: {ex.Message}", ex);
            }
        }

        public async Task<T?> PostAsync<T>(string endpoint, object data)
        {
            try
            {
                var json = JsonConvert.SerializeObject(data);
                var url = $"{BaseUrl}{endpoint}";
                var content = new StringContent(json, Encoding.UTF8, "application/json");
                var response = await _httpClient.PostAsync(url, content);
                var responseContent = await response.Content.ReadAsStringAsync();
                return await HandleResponseAsync<T>(response, endpoint, "POST", responseContent);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[ApiService] POST {endpoint} Exception: {ex}");
                throw new Exception($"POST {endpoint} failed: {ex.Message}", ex);
            }
        }

        public async Task<T?> PutAsync<T>(string endpoint, object data)
        {
            try
            {
                var json = JsonConvert.SerializeObject(data);
                var url = $"{BaseUrl}{endpoint}";
                var content = new StringContent(json, Encoding.UTF8, "application/json");
                var response = await _httpClient.PutAsync(url, content);
                var responseContent = await response.Content.ReadAsStringAsync();
                return await HandleResponseAsync<T>(response, endpoint, "PUT", responseContent);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[ApiService] PUT {endpoint} Exception: {ex}");
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

        /// <summary>DELETE isteğine JSON gövde eklemek için (HttpClient.DeleteAsync gövde desteklemiyor).</summary>
        public async Task DeleteAsync(string endpoint, object body)
        {
            try
            {
                var json = JsonConvert.SerializeObject(body);
                var request = new HttpRequestMessage(HttpMethod.Delete, $"{BaseUrl}{endpoint}")
                {
                    Content = new StringContent(json, Encoding.UTF8, "application/json"),
                };
                var response = await _httpClient.SendAsync(request);
                response.EnsureSuccessStatusCode();
            }
            catch (Exception ex)
            {
                throw new Exception($"DELETE {endpoint} failed: {ex.Message}", ex);
            }
        }

        private async Task<T?> HandleResponseAsync<T>(HttpResponseMessage response, string endpoint, string method, string? contentPreRead = null)
        {
            var content = contentPreRead ?? await response.Content.ReadAsStringAsync();
            return await HandleResponseCoreAsync<T>(response, endpoint, method, content);
        }

        private Task<T?> HandleResponseCoreAsync<T>(HttpResponseMessage response, string endpoint, string method, string content)
        {
            // Handle 401 Unauthorized
            if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
            {
                System.Diagnostics.Debug.WriteLine($"[ApiService] 401 Unauthorized for {method} {endpoint}");

                // Clear tokens and notify
                ClearTokens();
                OnUnauthorized?.Invoke();
                
                throw new UnauthorizedException("Oturum süresi doldu veya yetkiniz yok. Lütfen tekrar giriş yapın.");
            }
            
            if (!response.IsSuccessStatusCode)
            {
                System.Diagnostics.Debug.WriteLine($"[ApiService] Error Response ({response.StatusCode}): {content}");
                
                // Try to parse error message from backend
                try 
                {
                    // Try to parse as dynamic to handle various error formats
                    dynamic? errorObj = null;
                    try
                    {
                        errorObj = JsonConvert.DeserializeObject<dynamic>(content);
                    }
                    catch
                    {
                        // If JSON parsing fails, use raw content
                    }
                    
                    if (errorObj != null)
                    {
                        string errorMsg = "An unexpected error occurred";
                        
                        // Try to get error.message
                        try
                        {
                            if (errorObj.error != null && errorObj.error.message != null)
                            {
                                errorMsg = errorObj.error.message.ToString();
                            }
                            else if (errorObj.message != null)
                            {
                                errorMsg = errorObj.message.ToString();
                            }
                        }
                        catch { }
                        
                        // Try to get error.details.originalError or error.details
                        try
                        {
                            if (errorObj.error != null && errorObj.error.details != null)
                            {
                                var details = errorObj.error.details;
                                
                                // Check if details is an object with originalError
                                if (details.originalError != null)
                                {
                                    errorMsg += $"\n\nDetay: {details.originalError}";
                                }
                                // Check if details is a string
                                else if (details.ToString() != null && details.ToString() != "{}")
                                {
                                    var detailsStr = details.ToString();
                                    if (!string.IsNullOrWhiteSpace(detailsStr) && detailsStr != "{}")
                                    {
                                        errorMsg += $"\n\nDetay: {detailsStr}";
                                    }
                                }
                            }
                        }
                        catch { }
                        
                        // Try to get error.stack for development
                        try
                        {
                            if (errorObj.error != null && errorObj.error.stack != null)
                            {
                                var stack = errorObj.error.stack.ToString();
                                if (!string.IsNullOrWhiteSpace(stack))
                                {
                                    System.Diagnostics.Debug.WriteLine($"[ApiService] Stack Trace: {stack}");
                                }
                            }
                        }
                        catch { }
                        
                        throw new Exception(errorMsg);
                    }
                    
                    // If we couldn't parse, use raw content
                    throw new Exception($"API Error ({response.StatusCode}): {response.ReasonPhrase}\nResponse: {content}");
                } 
                catch (Exception ex) 
                {
                    // If it's already our formatted exception, rethrow it
                    if (ex.Message.Contains("API Error") || ex.Message.Contains("Detay") || ex.Message != "An unexpected error occurred")
                        throw;
                    // Otherwise, wrap it with full response
                    throw new Exception($"API Error ({response.StatusCode}): {response.ReasonPhrase}\nResponse: {content}", ex);
                }
            }
            
            try
            {
                if (string.IsNullOrWhiteSpace(content))
                {
                    System.Diagnostics.Debug.WriteLine("[ApiService] Warning: Empty response from API");
                    return Task.FromResult<T?>(default);
                }
                return Task.FromResult<T?>(JsonConvert.DeserializeObject<T>(content));
            }
            catch (JsonException ex)
            {
                System.Diagnostics.Debug.WriteLine($"[ApiService] JSON Parse Error: {ex.Message}");
                System.Diagnostics.Debug.WriteLine($"[ApiService] Response Content: {content}");
                throw new Exception($"Failed to parse response: {ex.Message}\nResponse: {content}", ex);
            }
        }
    }
}
