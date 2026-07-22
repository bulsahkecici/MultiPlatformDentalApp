/**
 * Tarih-only (date-only) alanlar için ortak yardımcı — `date.toISOString()`
 * UTC'ye çevirir, bu da sunucu UTC+3 gibi ileri bir saat diliminde
 * çalıştığında yerel gece yarısını bir gün geriye kaydırır (ör. ayın 1'i
 * için oluşturulan yerel Date, `toISOString().split('T')[0]` ile bir önceki
 * ayın son gününe döner — bkz. adminController.getStatistics ay sınırı
 * hesaplamaları). Bu fonksiyon her zaman yerel yıl/ay/gün bileşenlerinden
 * string üretir, hiçbir UTC dönüşümü yapmaz.
 */
function toLocalDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

module.exports = { toLocalDateString };
