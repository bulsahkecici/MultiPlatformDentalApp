using System.Collections.ObjectModel;
using System.IO;
using System.Text;
using System.Windows.Data;
using DentalApp.Desktop.Models;
using Newtonsoft.Json;

namespace DentalApp.Desktop.Services
{
    public class TariffService
    {
        private TariffData? _tariffData;
        private readonly string _jsonPath;

        public TariffService()
        {
            // JSON dosyasının yolu - uygulama çalıştığı dizinde Data klasöründe
            var appDirectory = AppDomain.CurrentDomain.BaseDirectory;
            _jsonPath = Path.Combine(appDirectory, "Data", "tdb_2026_tarife_full.json");
        }

        public async Task<TariffData> LoadTariffDataAsync()
        {
            if (_tariffData != null)
                return _tariffData;

            try
            {
                if (!File.Exists(_jsonPath))
                {
                    throw new FileNotFoundException($"Tarife dosyası bulunamadı: {_jsonPath}");
                }

                var jsonContent = await File.ReadAllTextAsync(_jsonPath, Encoding.UTF8);
                _tariffData = JsonConvert.DeserializeObject<TariffData>(jsonContent);

                if (_tariffData == null)
                {
                    throw new InvalidOperationException("Tarife verisi yüklenemedi.");
                }

                return _tariffData;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Tarife yükleme hatası: {ex.Message}");
                throw;
            }
        }

        public List<TariffCategory> GetCategories()
        {
            if (_tariffData == null)
                return new List<TariffCategory>();

            return _tariffData.Categories;
        }

        public List<TariffItem> GetItemsByCategory(string categoryName)
        {
            if (_tariffData == null)
                return new List<TariffItem>();

            var category = _tariffData.Categories.FirstOrDefault(c => c.Name == categoryName);
            return category?.Items ?? new List<TariffItem>();
        }

        public TariffItem? GetItemByCode(string code)
        {
            if (_tariffData == null)
                return null;

            return _tariffData.Categories
                .SelectMany(c => c.Items)
                .FirstOrDefault(i => i.Code == code);
        }
    }
}
