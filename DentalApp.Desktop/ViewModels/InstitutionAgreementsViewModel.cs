using DentalApp.Desktop.Helpers;
using DentalApp.Desktop.Models;
using DentalApp.Desktop.Services;
using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Windows;
using System.Windows.Input;

namespace DentalApp.Desktop.ViewModels
{
    public class InstitutionAgreementsViewModel : ObservableObject
    {
        private readonly InstitutionAgreementService _service;
        private bool _isBusy;
        private Models.InstitutionAgreement? _selectedAgreement;
        private string _newCategoryName = string.Empty;
        private decimal _newCategoryDiscount;

        public ObservableCollection<Models.InstitutionAgreement> Agreements { get; } = new();
        public ObservableCollection<Models.CategoryDiscount> CategoryDiscounts { get; } = new();

        public bool IsBusy
        {
            get => _isBusy;
            set => SetProperty(ref _isBusy, value);
        }

        public Models.InstitutionAgreement? SelectedAgreement
        {
            get => _selectedAgreement;
            set
            {
                if (SetProperty(ref _selectedAgreement, value))
                {
                    LoadCategoryDiscounts();
                }
            }
        }

        public string NewCategoryName
        {
            get => _newCategoryName;
            set => SetProperty(ref _newCategoryName, value);
        }

        public decimal NewCategoryDiscount
        {
            get => _newCategoryDiscount;
            set => SetProperty(ref _newCategoryDiscount, value);
        }

        public ICommand LoadAgreementsCommand { get; }
        public ICommand AddCategoryDiscountCommand { get; }
        public ICommand DeleteCategoryDiscountCommand { get; }
        public ICommand RefreshCommand { get; }

        public InstitutionAgreementsViewModel(InstitutionAgreementService service)
        {
            _service = service;
            LoadAgreementsCommand = new RelayCommand(async _ => await LoadAgreementsAsync(), _ => !IsBusy);
            AddCategoryDiscountCommand = new RelayCommand(async _ => await AddCategoryDiscountAsync(), 
                _ => SelectedAgreement != null && !string.IsNullOrWhiteSpace(NewCategoryName) && NewCategoryDiscount > 0 && !IsBusy);
            DeleteCategoryDiscountCommand = new RelayCommand<Models.CategoryDiscount>(async cd => await DeleteCategoryDiscountAsync(cd), 
                _ => SelectedAgreement != null && !IsBusy);
            RefreshCommand = new RelayCommand(async _ => await LoadAgreementsAsync(), _ => !IsBusy);

            _ = LoadAgreementsAsync();
        }

        private async Task LoadAgreementsAsync()
        {
            IsBusy = true;
            try
            {
                var agreements = await _service.GetInstitutionAgreementsAsync(isActive: true);
                Agreements.Clear();
                foreach (var agreement in agreements)
                {
                    Agreements.Add(agreement);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Kurum anlaşmaları yüklenirken hata: {ex.Message}", "Hata", 
                    MessageBoxButton.OK, MessageBoxImage.Error);
            }
            finally
            {
                IsBusy = false;
            }
        }

        private void LoadCategoryDiscounts()
        {
            CategoryDiscounts.Clear();
            if (SelectedAgreement?.CategoryDiscounts != null)
            {
                foreach (var kvp in SelectedAgreement.CategoryDiscounts)
                {
                    CategoryDiscounts.Add(new Models.CategoryDiscount
                    {
                        CategoryName = kvp.Key,
                        DiscountPercentage = kvp.Value
                    });
                }
            }
        }

        private async Task AddCategoryDiscountAsync()
        {
            if (SelectedAgreement == null || string.IsNullOrWhiteSpace(NewCategoryName))
                return;

            IsBusy = true;
            try
            {
                // Initialize CategoryDiscounts if null
                if (SelectedAgreement.CategoryDiscounts == null)
                {
                    SelectedAgreement.CategoryDiscounts = new Dictionary<string, decimal>();
                }

                // Add or update category discount
                SelectedAgreement.CategoryDiscounts[NewCategoryName] = NewCategoryDiscount;

                // Update on server
                var updated = await _service.UpdateInstitutionAgreementAsync(SelectedAgreement.Id, SelectedAgreement);
                
                // Update local copy
                var index = Agreements.IndexOf(SelectedAgreement);
                if (index >= 0)
                {
                    Agreements[index] = updated;
                    SelectedAgreement = updated;
                }

                // Clear inputs
                NewCategoryName = string.Empty;
                NewCategoryDiscount = 0;

                MessageBox.Show("Kategori indirimi başarıyla eklendi.", "Başarılı", 
                    MessageBoxButton.OK, MessageBoxImage.Information);
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Kategori indirimi eklenirken hata: {ex.Message}", "Hata", 
                    MessageBoxButton.OK, MessageBoxImage.Error);
            }
            finally
            {
                IsBusy = false;
            }
        }

        private async Task DeleteCategoryDiscountAsync(Models.CategoryDiscount? categoryDiscount)
        {
            if (SelectedAgreement == null || categoryDiscount == null)
                return;

            var result = MessageBox.Show(
                $"'{categoryDiscount.CategoryName}' kategorisi için indirim oranını silmek istediğinize emin misiniz?",
                "Silme Onayı",
                MessageBoxButton.YesNo,
                MessageBoxImage.Warning);

            if (result == MessageBoxResult.Yes)
            {
                IsBusy = true;
                try
                {
                    await _service.DeleteCategoryDiscountAsync(SelectedAgreement.Id, categoryDiscount.CategoryName);
                    
                    // Reload agreements to get updated data
                    await LoadAgreementsAsync();
                    
                    // Reselect the same agreement
                    SelectedAgreement = Agreements.FirstOrDefault(a => a.Id == SelectedAgreement.Id);

                    MessageBox.Show("Kategori indirimi başarıyla silindi.", "Başarılı", 
                        MessageBoxButton.OK, MessageBoxImage.Information);
                }
                catch (Exception ex)
                {
                    MessageBox.Show($"Kategori indirimi silinirken hata: {ex.Message}", "Hata", 
                        MessageBoxButton.OK, MessageBoxImage.Error);
                }
                finally
                {
                    IsBusy = false;
                }
            }
        }
    }
}
