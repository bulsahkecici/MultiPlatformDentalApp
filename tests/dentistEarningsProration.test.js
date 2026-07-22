const {
  computeProratedSalary,
} = require('../src/controllers/dentistController');

describe('computeProratedSalary', () => {
  it('tarih aralığı verilmezse (lifetime görünüm) tam maaş döner', () => {
    expect(computeProratedSalary(30000, null, null)).toBe(30000);
  });

  it('yalnızca bir uç verilirse (belirsiz aralık) sıfır döner — tam maaş eklenmez', () => {
    expect(computeProratedSalary(30000, '2026-07-01', null)).toBe(0);
    expect(computeProratedSalary(30000, null, '2026-07-31')).toBe(0);
  });

  it('tam bir ay seçilirse tam maaşa yakın (ayın gün sayısına oranlı) sonuç döner', () => {
    // Temmuz 2026: 31 gün — 1'den 31'e tam ay
    const result = computeProratedSalary(31000, '2026-07-01', '2026-07-31');
    expect(result).toBeCloseTo(31000, 0);
  });

  it('kısa bir tarih aralığına (ör. 1 hafta) tam maaş eklenmez', () => {
    // 2026-07-01 .. 2026-07-07 => 7 gün / 31 günlük Temmuz
    const result = computeProratedSalary(31000, '2026-07-01', '2026-07-07');
    expect(result).toBeLessThan(31000);
    expect(result).toBeCloseTo(31000 * (7 / 31), 1);
  });

  it('birden fazla ayı kapsayan aralıkta 30 günlük varsayılan aya oranlanır', () => {
    const result = computeProratedSalary(30000, '2026-06-20', '2026-07-05');
    // 16 gün / 30
    expect(result).toBeCloseTo(30000 * (16 / 30), 1);
  });

  it('bitiş başlangıçtan önceyse sıfır döner', () => {
    expect(computeProratedSalary(30000, '2026-07-10', '2026-07-01')).toBe(0);
  });
});
