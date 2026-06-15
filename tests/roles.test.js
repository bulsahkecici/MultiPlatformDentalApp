const { parseRolesCsv, serializeRolesCsv } = require('../src/utils/roles');

describe('roles util', () => {
  describe('parseRolesCsv', () => {
    it('CSV dizesini rol listesine çözer', () => {
      expect(parseRolesCsv('admin,dentist')).toEqual(['admin', 'dentist']);
    });

    it('boşlukları temizler ve boş öğeleri atar', () => {
      expect(parseRolesCsv(' admin , , secretary ')).toEqual([
        'admin',
        'secretary',
      ]);
    });

    it('boş/undefined girdide boş dizi döner', () => {
      expect(parseRolesCsv('')).toEqual([]);
      expect(parseRolesCsv(undefined)).toEqual([]);
      expect(parseRolesCsv(null)).toEqual([]);
    });
  });

  describe('serializeRolesCsv', () => {
    it('rol listesini CSV dizesine çevirir', () => {
      expect(serializeRolesCsv(['admin', 'dentist'])).toBe('admin,dentist');
    });

    it('dizi olmayan girdide boş dize döner', () => {
      expect(serializeRolesCsv(null)).toBe('');
      expect(serializeRolesCsv('admin')).toBe('');
    });

    it('parse ile karşılıklı tutarlıdır (round-trip)', () => {
      const csv = 'admin,secretary,dentist';
      expect(serializeRolesCsv(parseRolesCsv(csv))).toBe(csv);
    });
  });
});
