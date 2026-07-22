using DentalApp.Desktop.Helpers;
using DentalApp.Desktop.Models;
using DentalApp.Desktop.Services;
using System.Collections.ObjectModel;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;

namespace DentalApp.Desktop.ViewModels
{
    public class AdminManagementViewModel : ObservableObject
    {
        private readonly ApiService _apiService;
        private bool _isBusy;
        private string _selectedUserType = string.Empty;
        private UserFormData _user = new();
        private ObservableCollection<User> _users = new();
        private int _totalPatients;
        private int _upcomingAppointmentsCount;
        private decimal _thisMonthFinancial;
        private decimal _lastMonthFinancial;

        public bool IsBusy
        {
            get => _isBusy;
            set => SetProperty(ref _isBusy, value);
        }

        // Klinik istatistikleri (GET /api/admin/statistics)
        public int TotalPatients
        {
            get => _totalPatients;
            set => SetProperty(ref _totalPatients, value);
        }

        public int UpcomingAppointmentsCount
        {
            get => _upcomingAppointmentsCount;
            set => SetProperty(ref _upcomingAppointmentsCount, value);
        }

        public decimal ThisMonthFinancial
        {
            get => _thisMonthFinancial;
            set => SetProperty(ref _thisMonthFinancial, value);
        }

        public decimal LastMonthFinancial
        {
            get => _lastMonthFinancial;
            set => SetProperty(ref _lastMonthFinancial, value);
        }
        
        public bool IsDentistSelected => SelectedUserType == "Dentist";
        public bool IsSecretarySelected => SelectedUserType == "Secretary";
        public bool IsPatronSelected => SelectedUserType == "Patron";
        
        public string SelectedUserType
        {
            get => _selectedUserType;
            set
            {
                if (SetProperty(ref _selectedUserType, value))
                {
                    OnPropertyChanged(nameof(IsDentistSelected));
                    OnPropertyChanged(nameof(IsSecretarySelected));
                    OnPropertyChanged(nameof(IsPatronSelected));
                    // Reset form when type changes
                    User = new UserFormData();
                }
            }
        }
        
        public UserFormData User
        {
            get => _user;
            set => SetProperty(ref _user, value);
        }
        
        public ObservableCollection<bool> Specializations { get; } = new();
        
        public string Password { get; set; } = string.Empty;
        
        public ObservableCollection<User> Users
        {
            get => _users;
            set => SetProperty(ref _users, value);
        }

        private int? _editingUserId;
        private bool _isEditingUser;
        public bool IsEditingUser
        {
            get => _isEditingUser;
            set => SetProperty(ref _isEditingUser, value);
        }

        private string _editUserEmail = string.Empty;
        public string EditUserEmail
        {
            get => _editUserEmail;
            set => SetProperty(ref _editUserEmail, value);
        }

        private string _editUserRole = string.Empty;
        public string EditUserRole
        {
            get => _editUserRole;
            set => SetProperty(ref _editUserRole, value);
        }

        public ICommand SaveCommand { get; }
        public ICommand CancelCommand { get; }
        public ICommand SelectUserTypeCommand { get; }
        public ICommand LoadUsersCommand { get; }
        public ICommand EditUserCommand { get; }
        public ICommand SaveUserEditCommand { get; }
        public ICommand CancelUserEditCommand { get; }
        public ICommand DeleteUserCommand { get; }

        public AdminManagementViewModel(ApiService apiService)
        {
            _apiService = apiService;
            
            // Initialize specializations (9 options)
            for (int i = 0; i < 9; i++)
            {
                Specializations.Add(false);
            }
            
            SelectUserTypeCommand = new RelayCommand<string>(type => SelectedUserType = type ?? "");
            SaveCommand = new RelayCommand(async _ => await SaveUserAsync(), _ => !IsBusy && IsValid());
            CancelCommand = new RelayCommand(_ => 
            {
                User = new UserFormData();
                SelectedUserType = string.Empty;
                Password = string.Empty;
                for (int i = 0; i < Specializations.Count; i++)
                {
                    Specializations[i] = false;
                }
            });
            LoadUsersCommand = new RelayCommand(async _ => await LoadUsersAsync());
            EditUserCommand = new RelayCommand<User>(user => StartEditUser(user));
            SaveUserEditCommand = new RelayCommand(async _ => await SaveUserEditAsync(), _ => !IsBusy);
            CancelUserEditCommand = new RelayCommand(_ => CancelEditUser());
            DeleteUserCommand = new RelayCommand<User>(async user => await DeleteUserAsync(user));

            // Load users on initialization
            _ = LoadUsersAsync();
        }

        private void StartEditUser(User? user)
        {
            if (user == null) return;
            _editingUserId = user.Id;
            EditUserEmail = user.Email;
            EditUserRole = user.Roles.FirstOrDefault() ?? string.Empty;
            IsEditingUser = true;
        }

        private void CancelEditUser()
        {
            _editingUserId = null;
            IsEditingUser = false;
        }

        private async Task SaveUserEditAsync()
        {
            if (_editingUserId == null) return;
            var userId = _editingUserId.Value;
            var original = Users.FirstOrDefault(u => u.Id == userId);
            if (original == null) return;

            IsBusy = true;
            try
            {
                if (!string.Equals(EditUserEmail, original.Email, StringComparison.Ordinal))
                {
                    await _apiService.PutAsync<object>($"/users/{userId}", new { email = EditUserEmail });
                }

                var originalRole = original.Roles.FirstOrDefault() ?? string.Empty;
                if (!string.Equals(EditUserRole, originalRole, StringComparison.Ordinal) && !string.IsNullOrWhiteSpace(EditUserRole))
                {
                    await _apiService.PutAsync<object>($"/users/{userId}/roles", new { roles = new List<string> { EditUserRole } });
                }

                System.Windows.MessageBox.Show("Kullanıcı güncellendi.", "Başarılı",
                    System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Information);
                CancelEditUser();
                await LoadUsersAsync();
            }
            catch (Exception ex)
            {
                System.Windows.MessageBox.Show($"Kullanıcı güncellenirken hata: {ex.Message}", "Hata",
                    System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Error);
            }
            finally
            {
                IsBusy = false;
            }
        }

        private async Task DeleteUserAsync(User? user)
        {
            if (user == null) return;

            var result = System.Windows.MessageBox.Show(
                $"{user.FullName} ({user.Email}) kullanıcısını silmek istediğinize emin misiniz?",
                "Silme Onayı",
                System.Windows.MessageBoxButton.YesNo,
                System.Windows.MessageBoxImage.Warning);

            if (result != System.Windows.MessageBoxResult.Yes) return;

            IsBusy = true;
            try
            {
                await _apiService.DeleteAsync($"/users/{user.Id}");
                Users.Remove(user);
            }
            catch (Exception ex)
            {
                System.Windows.MessageBox.Show($"Kullanıcı silinirken hata: {ex.Message}", "Hata",
                    System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Error);
            }
            finally
            {
                IsBusy = false;
            }
        }
        
        private bool IsValid()
        {
            if (string.IsNullOrWhiteSpace(SelectedUserType))
                return false;
            
            if (string.IsNullOrWhiteSpace(User.FirstName) || string.IsNullOrWhiteSpace(User.LastName))
                return false;
            
            if (string.IsNullOrWhiteSpace(User.Email) || string.IsNullOrWhiteSpace(Password))
                return false;
            
            // Dentist specific validations
            if (IsDentistSelected)
            {
                if (string.IsNullOrWhiteSpace(User.TCNo) || 
                    string.IsNullOrWhiteSpace(User.Phone) ||
                    string.IsNullOrWhiteSpace(User.University) ||
                    string.IsNullOrWhiteSpace(User.DiplomaNo))
                    return false;
            }
            
            // Secretary specific validations
            if (IsSecretarySelected)
            {
                if (string.IsNullOrWhiteSpace(User.TCNo) || string.IsNullOrWhiteSpace(User.Phone))
                    return false;
            }
            
            // Patron specific validations
            if (IsPatronSelected)
            {
                if (string.IsNullOrWhiteSpace(User.Phone))
                    return false;
            }
            
            return true;
        }
        
        private async Task SaveUserAsync()
        {
            IsBusy = true;
            try
            {
                var roles = new List<string>();
                if (IsDentistSelected) roles.Add("dentist");
                else if (IsSecretarySelected) roles.Add("secretary");
                else if (IsPatronSelected) roles.Add("admin");
                
                var request = new
                {
                    email = User.Email,
                    password = Password,
                    roles = roles, // Send as array, not string
                    firstName = User.FirstName,
                    lastName = User.LastName,
                    phone = User.Phone,
                    tcNo = User.TCNo,
                    address = User.Address,
                    iban = User.IBAN,
                    salary = User.Salary,
                    commissionRate = User.CommissionRate,
                    university = User.University,
                    diplomaDate = User.DiplomaDate?.ToString("yyyy-MM-dd"),
                    diplomaNo = User.DiplomaNo,
                    specializations = IsDentistSelected ? GetSelectedSpecializations() : null
                };
                
                var response = await _apiService.PostAsync<object>("/users", request);
                
                System.Windows.MessageBox.Show(
                    $"{SelectedUserType} kullanıcısı başarıyla oluşturuldu.",
                    "Başarılı",
                    System.Windows.MessageBoxButton.OK,
                    System.Windows.MessageBoxImage.Information);
                
                // Reset form
                User = new UserFormData();
                Password = string.Empty;
                SelectedUserType = string.Empty;
                for (int i = 0; i < Specializations.Count; i++)
                {
                    Specializations[i] = false;
                }
                
                // Reload users list
                await LoadUsersAsync();
            }
            catch (Exception ex)
            {
                string errorMessage = ex.Message;
                
                // Şifre gereksinimleri hatası için özel mesaj
                if (errorMessage.Contains("Password does not meet requirements") || errorMessage.Contains("password"))
                {
                    errorMessage = "Şifre gereksinimleri karşılanmıyor.\n\n" +
                                  "Şifre aşağıdaki gereksinimleri karşılamalıdır:\n" +
                                  "• En az 8 karakter uzunluğunda olmalıdır\n" +
                                  "• En az bir büyük harf içermelidir (A-Z)\n" +
                                  "• En az bir rakam içermelidir (0-9)\n" +
                                  "• En az bir özel karakter içermelidir (!@#$%^&* vb.)\n\n" +
                                  "Örnek: Admin@123456";
                }
                // Email hatası için özel mesaj
                else if (errorMessage.Contains("Valid email is required") || errorMessage.Contains("email"))
                {
                    errorMessage = "Geçerli bir e-posta adresi girmelisiniz.\n\n" +
                                  "E-posta adresi formatı: kullanici@ornek.com\n" +
                                  "Örnek: doktor@klinik.com";
                }
                
                System.Windows.MessageBox.Show($"Kullanıcı oluşturulurken hata:\n\n{errorMessage}", "Hata",
                    System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Error);
            }
            finally
            {
                IsBusy = false;
            }
        }
        
        private List<string> GetSelectedSpecializations()
        {
            var specs = new List<string>
            {
                "Diş Tabibi",
                "Ağız-Diş-Çene Cerrahisi",
                "Radyoloji",
                "Endodonti",
                "Ortodonti",
                "Pedodonti",
                "Periodontoloji",
                "Protetik",
                "Restoratif"
            };
            
            var selected = new List<string>();
            for (int i = 0; i < Specializations.Count && i < specs.Count; i++)
            {
                if (Specializations[i])
                {
                    selected.Add(specs[i]);
                }
            }
            return selected;
        }
        
        public async Task LoadStatisticsAsync()
        {
            try
            {
                // Backend: GET /api/admin/statistics (Faz 1'de payments/patient_debts tabanlı hale getirildi)
                var response = await _apiService.GetAsync<AdminStatisticsResponse>("/admin/statistics");
                if (response?.Statistics != null)
                {
                    var stats = response.Statistics;
                    await Application.Current.Dispatcher.InvokeAsync(() =>
                    {
                        TotalPatients = stats.TotalPatients;
                        UpcomingAppointmentsCount = stats.UpcomingAppointmentsCount;
                        ThisMonthFinancial = stats.ThisMonthFinancial;
                        LastMonthFinancial = stats.LastMonthFinancial;
                    });
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error loading statistics: {ex.Message}");
            }
        }
        
        private async Task LoadUsersAsync()
        {
            try
            {
                var response = await _apiService.GetAsync<UsersResponse>("/users?limit=100");
                if (response?.Users != null)
                {
                    var list = response.Users;
                    await Application.Current.Dispatcher.InvokeAsync(() =>
                    {
                        Users.Clear();
                        foreach (var user in list)
                        {
                            Users.Add(user);
                        }
                    });
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Kullanıcılar yüklenirken hata: {ex.Message}");
            }
        }
    }
    
    public class UserFormData : ObservableObject
    {
        private string _firstName = string.Empty;
        private string _lastName = string.Empty;
        private string _tcNo = string.Empty;
        private string _phone = string.Empty;
        private string _email = string.Empty;
        private string _address = string.Empty;
        private string _iban = string.Empty;
        private decimal? _salary;
        private decimal? _commissionRate;
        private string _university = string.Empty;
        private DateTime? _diplomaDate;
        private string _diplomaNo = string.Empty;
        
        public string FirstName
        {
            get => _firstName;
            set => SetProperty(ref _firstName, value);
        }
        
        public string LastName
        {
            get => _lastName;
            set => SetProperty(ref _lastName, value);
        }
        
        public string TCNo
        {
            get => _tcNo;
            set => SetProperty(ref _tcNo, value);
        }
        
        public string Phone
        {
            get => _phone;
            set => SetProperty(ref _phone, value);
        }
        
        public string Email
        {
            get => _email;
            set => SetProperty(ref _email, value);
        }
        
        public string Address
        {
            get => _address;
            set => SetProperty(ref _address, value);
        }
        
        public string IBAN
        {
            get => _iban;
            set => SetProperty(ref _iban, value);
        }
        
        public decimal? Salary
        {
            get => _salary;
            set => SetProperty(ref _salary, value);
        }
        
        public decimal? CommissionRate
        {
            get => _commissionRate;
            set => SetProperty(ref _commissionRate, value);
        }
        
        public string University
        {
            get => _university;
            set => SetProperty(ref _university, value);
        }
        
        public DateTime? DiplomaDate
        {
            get => _diplomaDate;
            set => SetProperty(ref _diplomaDate, value);
        }
        
        public string DiplomaNo
        {
            get => _diplomaNo;
            set => SetProperty(ref _diplomaNo, value);
        }
    }
}
