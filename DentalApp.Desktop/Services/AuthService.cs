using DentalApp.Desktop.Models;

namespace DentalApp.Desktop.Services
{
    public class AuthService
    {
        private readonly ApiService _apiService;
        public User? CurrentUser { get; private set; }
        public bool IsAuthenticated => CurrentUser != null;

        public AuthService(ApiService apiService)
        {
            _apiService = apiService;
        }

        public async Task<bool> LoginAsync(string email, string password)
        {
            try
            {
                var response = await _apiService.PostAsync<LoginResponse>("/auth/login", new
                {
                    email,
                    password
                });

                if (response != null)
                {
                    CurrentUser = response.User;
                    _apiService.SetTokens(response.AccessToken, response.RefreshToken);
                    return true;
                }

                return false;
            }
            catch (Exception ex)
            {
                // Better to throw or handle error UI side
                Console.WriteLine($"Login failed: {ex.Message}");
                throw;
            }
        }

        public void Logout()
        {
            CurrentUser = null;
            _apiService.ClearTokens();
        }

        public async Task<bool> CheckSessionAsync()
        {
            try
            {
                var response = await _apiService.GetAsync<UserResponse>("/auth/me");
                if (response != null && response.User != null)
                {
                    CurrentUser = response.User;
                    return true;
                }
                return false;
            }
            catch
            {
                CurrentUser = null;
                _apiService.ClearTokens();
                return false;
            }
        }
    }
}
