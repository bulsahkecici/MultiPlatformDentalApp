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

        public ApiService()
        {
            _httpClient = new HttpClient();
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
            
            // Debug logging
            var tokenPreview = accessToken.Length > 15 
                ? $"{accessToken.Substring(0, 15)}..." 
                : "***";
            System.Diagnostics.Debug.WriteLine($"[ApiService] Tokens set. Token preview: {tokenPreview}");
            System.Diagnostics.Debug.WriteLine($"[ApiService] Authorization header present: {_httpClient.DefaultRequestHeaders.Authorization != null}");
        }

        public void ClearTokens()
        {
            _accessToken = null;
            _refreshToken = null;
            _httpClient.DefaultRequestHeaders.Remove("Authorization");
            System.Diagnostics.Debug.WriteLine("[ApiService] Tokens cleared");
        }

        public async Task<T?> GetAsync<T>(string endpoint)
        {
            try
            {
                var url = $"{BaseUrl}{endpoint}";
                var hasAuth = _httpClient.DefaultRequestHeaders.Authorization != null;
                var authHeader = hasAuth 
                    ? $"Bearer {(_accessToken?.Length > 15 ? _accessToken.Substring(0, 15) + "..." : "***")}" 
                    : "NONE";
                
                System.Diagnostics.Debug.WriteLine($"[ApiService] GET {url}");
                System.Diagnostics.Debug.WriteLine($"[ApiService] Authorization header: {authHeader}");
                
                var response = await _httpClient.GetAsync(url);
                
                var responseContent = await response.Content.ReadAsStringAsync();
                System.Diagnostics.Debug.WriteLine($"[ApiService] Response Status: {response.StatusCode}");
                System.Diagnostics.Debug.WriteLine($"[ApiService] Response: {responseContent}");
                
                return await HandleResponseAsync<T>(response, endpoint, "GET");
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
                var hasAuth = _httpClient.DefaultRequestHeaders.Authorization != null;
                var authHeader = hasAuth 
                    ? $"Bearer {(_accessToken?.Length > 15 ? _accessToken.Substring(0, 15) + "..." : "***")}" 
                    : "NONE";
                
                System.Diagnostics.Debug.WriteLine($"[ApiService] POST {url}");
                System.Diagnostics.Debug.WriteLine($"[ApiService] Authorization header: {authHeader}");
                System.Diagnostics.Debug.WriteLine($"[ApiService] Request: {json}");
                
                var content = new StringContent(json, Encoding.UTF8, "application/json");
                var response = await _httpClient.PostAsync(url, content);
                
                var responseContent = await response.Content.ReadAsStringAsync();
                System.Diagnostics.Debug.WriteLine($"[ApiService] Response Status: {response.StatusCode}");
                System.Diagnostics.Debug.WriteLine($"[ApiService] Response: {responseContent}");
                
                return await HandleResponseAsync<T>(response, endpoint, "POST");
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
                var hasAuth = _httpClient.DefaultRequestHeaders.Authorization != null;
                var authHeader = hasAuth 
                    ? $"Bearer {(_accessToken?.Length > 15 ? _accessToken.Substring(0, 15) + "..." : "***")}" 
                    : "NONE";
                
                System.Diagnostics.Debug.WriteLine($"[ApiService] PUT {url}");
                System.Diagnostics.Debug.WriteLine($"[ApiService] Authorization header: {authHeader}");
                
                var content = new StringContent(json, Encoding.UTF8, "application/json");
                var response = await _httpClient.PutAsync(url, content);
                return await HandleResponseAsync<T>(response, endpoint, "PUT");
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

        private async Task<T?> HandleResponseAsync<T>(HttpResponseMessage response, string endpoint, string method)
        {
            var content = await response.Content.ReadAsStringAsync();
            
            // Handle 401 Unauthorized
            if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
            {
                System.Diagnostics.Debug.WriteLine($"[ApiService] 401 Unauthorized for {method} {endpoint}");
                System.Diagnostics.Debug.WriteLine($"[ApiService] Response: {content}");
                
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
                    return default(T);
                }
                
                return JsonConvert.DeserializeObject<T>(content);
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
