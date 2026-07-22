/**
 * Tarih-only (date-only) alanlar için ortak yardımcı — `date.toISOString()`
 * UTC'ye çevirir, bu da UTC+3 gibi ileri saat dilimlerinde yerel gece
 * yarısını bir gün geriye kaydırır (ör. kullanıcı takvimde 21 Temmuz'u seçer,
 * `toISOString().split('T')[0]` "2026-07-20" üretir). `toLocalDateString`
 * her zaman `Date` nesnesinin yerel yıl/ay/gün bileşenlerinden string üretir,
 * hiçbir UTC dönüşümü yapmaz.
 */
export class DateUtils {
  static toLocalDateString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Bir saat/dakikaya belirli bir dakika ekler ve saat taşmasını (60 dakika,
   * gün sonu) doğru şekilde hesaplar. Önceden randevu slotlarında
   * `minute + 30` doğrudan string'e basılıyordu — 09:30'luk bir slot için bu
   * "09:60:00" gibi geçersiz bir saat üretiyordu.
   */
  static addMinutesToHHMM(
    hour: number,
    minute: number,
    minutesToAdd: number,
  ): { hour: number; minute: number } {
    const totalMinutes =
      (((hour * 60 + minute + minutesToAdd) % 1440) + 1440) % 1440;
    return {
      hour: Math.floor(totalMinutes / 60),
      minute: totalMinutes % 60,
    };
  }

  /** "HH:mm:ss" biçiminde, saat/dakikayı iki haneli sıfırla dolduran string üretir. */
  static formatHHMMSS(hour: number, minute: number): string {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`;
  }
}
