using System.Collections.Generic;
using System.Globalization;
using DentalApp.Desktop.Helpers;
using DentalApp.Desktop.Models;
using Newtonsoft.Json;
using Xunit;

namespace DentalApp.Desktop.Tests
{
    /// <summary>Durum metni dönüştürücüsü testleri (İngilizce kod → Türkçe etiket).</summary>
    public class StatusToTurkishConverterTests
    {
        private readonly StatusToTurkishConverter _converter = new();

        [Theory]
        [InlineData("scheduled", "Planlandı")]
        [InlineData("confirmed", "Onaylandı")]
        [InlineData("completed", "Tamamlandı")]
        [InlineData("cancelled", "İptal Edildi")]
        [InlineData("no_show", "Gelmedi")]
        [InlineData("in_progress", "Devam Ediyor")]
        public void Convert_BilinenDurum_TurkceEtiketDoner(string status, string beklenen)
        {
            var sonuc = _converter.Convert(status, typeof(string), null!, CultureInfo.InvariantCulture);
            Assert.Equal(beklenen, sonuc);
        }

        [Fact]
        public void Convert_BilinmeyenDurum_OlduguGibiDoner()
        {
            var sonuc = _converter.Convert("foo_bar", typeof(string), null!, CultureInfo.InvariantCulture);
            Assert.Equal("foo_bar", sonuc);
        }
    }

    /// <summary>Para birimi dönüştürücüsü testleri (Türkçe biçim: 1.234,56 ₺).</summary>
    public class DecimalToTurkishStringConverterTests
    {
        private readonly DecimalToTurkishStringConverter _converter = new();

        [Fact]
        public void Convert_Decimal_TurkceBicimVeEkDoner()
        {
            var sonuc = _converter.Convert(1234.56m, typeof(string), " ₺", CultureInfo.InvariantCulture);
            Assert.Equal("1.234,56 ₺", sonuc);
        }

        [Fact]
        public void ConvertBack_TurkceMetin_DecimalDoner()
        {
            var sonuc = _converter.ConvertBack("1.234,56 ₺", typeof(decimal), " ₺", CultureInfo.InvariantCulture);
            Assert.Equal(1234.56m, sonuc);
        }
    }

    /// <summary>JSON model çözümleme testleri (RolesConverter, FlexibleDecimalConverter, varsayılanlar).</summary>
    public class ModelDeserializationTests
    {
        [Fact]
        public void User_Roller_CsvDizeOlarakGelirseListeyeCozulur()
        {
            var user = JsonConvert.DeserializeObject<User>("{\"roles\":\"admin,dentist\"}");
            Assert.NotNull(user);
            Assert.Equal(new List<string> { "admin", "dentist" }, user!.Roles);
        }

        [Fact]
        public void User_Roller_DiziOlarakGelirseListeyeCozulur()
        {
            var user = JsonConvert.DeserializeObject<User>("{\"roles\":[\"secretary\"]}");
            Assert.NotNull(user);
            Assert.Equal(new List<string> { "secretary" }, user!.Roles);
        }

        [Theory]
        [InlineData("{\"discount_percentage\":\"12.5\"}")]
        [InlineData("{\"discount_percentage\":12.5}")]
        public void InstitutionAgreement_IndirimYuzdesi_DizeVeyaSayiOlsaDaDecimalOlur(string json)
        {
            var agreement = JsonConvert.DeserializeObject<InstitutionAgreement>(json);
            Assert.NotNull(agreement);
            Assert.Equal(12.5m, agreement!.DiscountPercentage);
        }

        [Fact]
        public void Treatment_VarsayilanParaBirimi_TLdir()
        {
            // Para birimi standardizasyonu: varsayılan TRY olmalı (USD değil).
            Assert.Equal("TRY", new Treatment().Currency);
        }
    }
}
