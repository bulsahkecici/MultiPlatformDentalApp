using DentalApp.Desktop.Models;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;

namespace DentalApp.Desktop.Services
{
    public class InstitutionAgreementService
    {
        private readonly ApiService _apiService;

        public InstitutionAgreementService(ApiService apiService)
        {
            _apiService = apiService;
        }

        public async Task<List<Models.InstitutionAgreement>> GetInstitutionAgreementsAsync(bool? isActive = null)
        {
            try
            {
                var queryParams = isActive.HasValue ? $"?isActive={isActive.Value.ToString().ToLower()}" : "";
                var response = await _apiService.GetAsync<InstitutionAgreementsResponse>($"/institution-agreements{queryParams}");
                return response?.Agreements ?? new List<Models.InstitutionAgreement>();
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"GetInstitutionAgreementsAsync Error: {ex}");
                throw;
            }
        }

        public async Task<Models.InstitutionAgreement> CreateInstitutionAgreementAsync(Models.InstitutionAgreement agreement)
        {
            try
            {
                var payload = new
                {
                    institutionName = agreement.InstitutionName,
                    contactPerson = agreement.ContactPerson,
                    contactPhone = agreement.ContactPhone,
                    contactEmail = agreement.ContactEmail,
                    discountPercentage = agreement.DiscountPercentage,
                    notes = agreement.Notes,
                    categoryDiscounts = agreement.CategoryDiscounts
                };

                var response = await _apiService.PostAsync<Dictionary<string, Models.InstitutionAgreement>>("/institution-agreements", payload);
                return response?["agreement"] ?? throw new Exception("Invalid response from server");
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"CreateInstitutionAgreementAsync Error: {ex}");
                throw;
            }
        }

        public async Task<Models.InstitutionAgreement> UpdateInstitutionAgreementAsync(int id, Models.InstitutionAgreement agreement)
        {
            try
            {
                var payload = new
                {
                    institutionName = agreement.InstitutionName,
                    contactPerson = agreement.ContactPerson,
                    contactPhone = agreement.ContactPhone,
                    contactEmail = agreement.ContactEmail,
                    discountPercentage = agreement.DiscountPercentage,
                    isActive = agreement.IsActive,
                    notes = agreement.Notes,
                    categoryDiscounts = agreement.CategoryDiscounts
                };

                var response = await _apiService.PutAsync<Dictionary<string, Models.InstitutionAgreement>>($"/institution-agreements/{id}", payload);
                return response?["agreement"] ?? throw new Exception("Invalid response from server");
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"UpdateInstitutionAgreementAsync Error: {ex}");
                throw;
            }
        }

        public async Task DeleteCategoryDiscountAsync(int agreementId, string categoryName)
        {
            try
            {
                // Get current agreement
                var agreements = await GetInstitutionAgreementsAsync();
                var agreement = agreements.Find(a => a.Id == agreementId);
                
                if (agreement == null)
                    throw new Exception("Agreement not found");

                // Remove category discount
                if (agreement.CategoryDiscounts != null && agreement.CategoryDiscounts.ContainsKey(categoryName))
                {
                    agreement.CategoryDiscounts.Remove(categoryName);
                    
                    // Update agreement
                    await UpdateInstitutionAgreementAsync(agreementId, agreement);
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"DeleteCategoryDiscountAsync Error: {ex}");
                throw;
            }
        }
    }
}
