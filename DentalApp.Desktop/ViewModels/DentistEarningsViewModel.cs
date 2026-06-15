using DentalApp.Desktop.Helpers;
using DentalApp.Desktop.Services;
using System.Collections.ObjectModel;
using System.Windows.Input;

namespace DentalApp.Desktop.ViewModels
{
    public class DentistEarningsViewModel : ObservableObject
    {
        private readonly FinancialService _financialService;
        private readonly AuthService _authService;
        private bool _isBusy;
        private decimal _salary;
        private decimal _totalTurnover;
        private decimal _paidTurnoverShare;
        private decimal _totalEarnings;
        private decimal _commissionRate;

        public bool IsBusy
        {
            get => _isBusy;
            set => SetProperty(ref _isBusy, value);
        }

        public decimal Salary
        {
            get => _salary;
            set
            {
                if (SetProperty(ref _salary, value))
                {
                    CalculateTotalEarnings();
                }
            }
        }

        public decimal TotalTurnover
        {
            get => _totalTurnover;
            set
            {
                if (SetProperty(ref _totalTurnover, value))
                {
                    CalculateTotalEarnings();
                }
            }
        }

        public decimal PaidTurnoverShare
        {
            get => _paidTurnoverShare;
            set
            {
                if (SetProperty(ref _paidTurnoverShare, value))
                {
                    CalculateTotalEarnings();
                }
            }
        }

        public decimal TotalEarnings
        {
            get => _totalEarnings;
            private set => SetProperty(ref _totalEarnings, value);
        }

        private void CalculateTotalEarnings()
        {
            TotalEarnings = Salary + PaidTurnoverShare;
        }

        public decimal CommissionRate
        {
            get => _commissionRate;
            set => SetProperty(ref _commissionRate, value);
        }

        public ObservableCollection<EarningsTreatment> Treatments { get; } = new();

        public ICommand RefreshCommand { get; }

        public DentistEarningsViewModel(FinancialService financialService, AuthService authService)
        {
            _financialService = financialService;
            _authService = authService;
            RefreshCommand = new RelayCommand(async _ => await LoadEarningsAsync(), _ => !IsBusy);
        }

        public async Task LoadEarningsAsync()
        {
            IsBusy = true;
            try
            {
                if (_authService.CurrentUser?.Id == null || _authService.CurrentUser.Id == 0)
                    return;

                var startDate = new DateTime(DateTime.Today.Year, DateTime.Today.Month, 1);
                var endDate = startDate.AddMonths(1).AddDays(-1);

                var result = await _financialService.GetDentistEarningsAsync(startDate, endDate);

                Salary = result.Earnings.Salary;
                TotalTurnover = result.Earnings.TotalTurnover;
                CommissionRate = result.Earnings.CommissionRate;
                PaidTurnoverShare = result.Earnings.PaidTurnoverShare;

                if (result.Earnings.TotalEarnings > 0)
                    TotalEarnings = result.Earnings.TotalEarnings;
                else
                    CalculateTotalEarnings();

                Treatments.Clear();
                foreach (var treatment in result.Treatments)
                {
                    Treatments.Add(treatment);
                }
            }
            catch (Exception ex)
            {
                System.Windows.MessageBox.Show($"Kazanç bilgileri yüklenirken hata: {ex.Message}", "Hata",
                    System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Error);
            }
            finally
            {
                IsBusy = false;
            }
        }
    }
}
