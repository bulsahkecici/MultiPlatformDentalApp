using DentalApp.Desktop.Helpers;
using DentalApp.Desktop.Services;
using System.Windows;
using System.Windows.Input;

namespace DentalApp.Desktop.ViewModels
{
    public class LoginViewModel : ObservableObject
    {
        private readonly AuthService _authService;
        private string _email = string.Empty;
        private string _password = string.Empty;
        private string _mfaCode = string.Empty;
        private bool _isBusy;
        private string _errorMessage = string.Empty;

        public string Email
        {
            get => _email;
            set => SetProperty(ref _email, value);
        }

        public string Password
        {
            get => _password;
            set => SetProperty(ref _password, value);
        }

        public string MfaCode
        {
            get => _mfaCode;
            set => SetProperty(ref _mfaCode, value);
        }

        public bool IsBusy
        {
            get => _isBusy;
            set => SetProperty(ref _isBusy, value);
        }

        public string ErrorMessage
        {
            get => _errorMessage;
            set => SetProperty(ref _errorMessage, value);
        }

        public ICommand LoginCommand { get; }

        public event Action? OnLoginSuccess;

        public LoginViewModel(AuthService authService)
        {
            _authService = authService;
            LoginCommand = new RelayCommand(ExecuteLogin, _ => !IsBusy);
        }

        private static string GetUserFriendlyErrorMessage(Exception ex)
        {
            var msg = ex.Message;
            if (string.IsNullOrWhiteSpace(msg))
                return "Giriş sırasında bir hata oluştu.";

            // Ağ / bağlantı hataları
            if (msg.Contains("connection") || msg.Contains("bağlan") || msg.Contains("No connection") ||
                msg.Contains("Connection refused") || msg.Contains("Unable to connect") ||
                msg.Contains("Timeout") || msg.Contains("timed out"))
                return "Sunucuya bağlanılamadı. API sunucusunun çalıştığından emin olun (örn. npm start).";

            // Yetki / kimlik hataları
            if (msg.Contains("Invalid credentials") || msg.Contains("Geçersiz"))
                return "Geçersiz e-posta veya şifre.";
            if (msg.Contains("Account is locked") || msg.Contains("locked"))
                return "Çok fazla hatalı deneme. Hesap geçici olarak kilitlendi. Lütfen daha sonra tekrar deneyin.";
            if (msg.Contains("verify your email") || msg.Contains("verify"))
                return "Giriş yapmadan önce e-posta adresinizi doğrulamanız gerekiyor.";
            if (msg.Contains("Oturum süresi doldu") || msg.Contains("Unauthorized"))
                return "Oturum süresi doldu. Lütfen tekrar giriş yapın.";
            if (msg.Contains("MFA_ENROLLMENT_REQUIRED"))
                return "İki aşamalı doğrulama kurulumu zorunlu. İlk kurulumu web uygulamasından tamamlayın.";
            if (msg.Contains("Multi-factor") || msg.Contains("MFA_REQUIRED"))
                return "Kimlik doğrulama uygulamanızdaki 6 haneli kodu girin.";

            // JSON / yanıt hatası
            if (msg.Contains("parse") || msg.Contains("Failed to parse"))
                return "Sunucu yanıtı işlenemedi. Sunucu sürümünü kontrol edin.";

            // Diğer API hatalarında İngilizce mesajı Türkçe’ye çevir
            if (msg.Contains("Email and password are required"))
                return "E-posta ve şifre gereklidir.";
            if (msg.Contains("Invalid email format"))
                return "Geçerli bir e-posta adresi girin.";
            if (msg.Contains("Login failed"))
                return "Giriş başarısız. Lütfen bilgilerinizi kontrol edip tekrar deneyin.";

            return msg.Length > 200 ? "Sunucu hatası. Lütfen daha sonra tekrar deneyin." : msg;
        }

        private async void ExecuteLogin(object? parameter)
        {
            if (string.IsNullOrWhiteSpace(Email) || string.IsNullOrWhiteSpace(Password))
            {
                ErrorMessage = "E-posta ve şifre gereklidir.";
                return;
            }

            ErrorMessage = string.Empty;
            IsBusy = true;

            try
            {
                var success = await _authService.LoginAsync(Email, Password, MfaCode);
                if (success)
                {
                    OnLoginSuccess?.Invoke();
                }
                else
                {
                    ErrorMessage = "Geçersiz kullanıcı adı veya şifre.";
                }
            }
            catch (Exception ex)
            {
                ErrorMessage = GetUserFriendlyErrorMessage(ex);
            }
            finally
            {
                IsBusy = false;
            }
        }
    }
}
