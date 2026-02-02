using Newtonsoft.Json;

namespace DentalApp.Desktop.Models
{
    public class TariffData
    {
        [JsonProperty("source")]
        public TariffSource? Source { get; set; }

        [JsonProperty("categories")]
        public List<TariffCategory> Categories { get; set; } = new();
    }

    public class TariffSource
    {
        [JsonProperty("title")]
        public string Title { get; set; } = string.Empty;

        [JsonProperty("year")]
        public int Year { get; set; }

        [JsonProperty("vat_rate_default")]
        public decimal VatRateDefault { get; set; }
    }

    public class TariffCategory
    {
        [JsonProperty("name")]
        public string Name { get; set; } = string.Empty;

        [JsonProperty("notes")]
        public List<string> Notes { get; set; } = new();

        [JsonProperty("items")]
        public List<TariffItem> Items { get; set; } = new();
    }

    public class TariffItem
    {
        [JsonProperty("code")]
        public string Code { get; set; } = string.Empty;

        [JsonProperty("name")]
        public string Name { get; set; } = string.Empty;

        [JsonProperty("price_excl_vat")]
        public decimal PriceExclVat { get; set; }

        [JsonProperty("vat_rate")]
        public decimal VatRate { get; set; }

        [JsonProperty("price_incl_vat")]
        public decimal PriceInclVat { get; set; }

        [JsonProperty("currency")]
        public string Currency { get; set; } = "TRY";
    }
}
