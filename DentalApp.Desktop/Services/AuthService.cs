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
                var response = await _apiService.PostAsync<LoginResponse>("/api/auth/login", new
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
            catch
            {
                return false;
            }
        }

        public void Logout()
        {
            CurrentUser = null;
            _apiService.ClearTokens();
        }
    }
}
