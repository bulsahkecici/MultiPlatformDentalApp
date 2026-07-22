const { sanitizeAuditChanges } = require('../src/utils/auditSanitizer');

describe('sanitizeAuditChanges', () => {
  it('tanı ve prosedür notu değer olarak SAKLANMAZ, sadece alan adı olarak görünür', () => {
    const result = sanitizeAuditChanges('treatment', {
      diagnosis: 'Derin çürük, kanal tedavisi gerekli',
      procedureNotes: 'Hasta anestezi altında iyi tolere etti',
      cost: 1500,
    });

    expect(result.changedFieldNames).toEqual(
      expect.arrayContaining(['diagnosis', 'procedureNotes', 'cost']),
    );
    expect(result.values.diagnosis).toBeUndefined();
    expect(result.values.procedureNotes).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain('Derin çürük');
    expect(JSON.stringify(result)).not.toContain('anestezi');
    // cost, treatment kaynağı için allowlist'te — değer olarak kalabilir
    expect(result.values.cost).toBe(1500);
  });

  it('randevu notu ve iptal gerekçesi değer olarak saklanmaz', () => {
    const result = sanitizeAuditChanges('appointment', {
      notes: 'Hasta diyabet hastası, dikkatli olunmalı',
      cancellationReason: 'Hasta hastalandı',
      status: 'cancelled',
    });

    expect(JSON.stringify(result)).not.toContain('diyabet');
    expect(JSON.stringify(result)).not.toContain('hastalandı');
    expect(result.values.status).toBe('cancelled');
  });

  it('hasta iletişim/sağlık bilgileri (allowlist dışı alanlar) değer olarak saklanmaz', () => {
    const result = sanitizeAuditChanges('patient', {
      allergies: 'Penisilin alerjisi',
      phone: '+90 555 000 00 00',
      email: 'hasta@example.com',
      firstName: 'Ayşe',
    });

    expect(JSON.stringify(result)).not.toContain('Penisilin');
    expect(JSON.stringify(result)).not.toContain('555 000');
    expect(JSON.stringify(result)).not.toContain('hasta@example.com');
    expect(result.values.firstName).toBe('Ayşe');
  });

  it('şifre/token alanları hiçbir zaman değer olarak görünmez', () => {
    const result = sanitizeAuditChanges('user', {
      password: 'SuperSecret123!',
      token: 'abc.def.ghi',
    });
    expect(JSON.stringify(result)).not.toContain('SuperSecret123');
    expect(JSON.stringify(result)).not.toContain('abc.def.ghi');
  });

  it('boş/geçersiz girdi için boş nesne döner', () => {
    expect(sanitizeAuditChanges('treatment', null)).toEqual({});
    expect(sanitizeAuditChanges('treatment', undefined)).toEqual({});
    expect(sanitizeAuditChanges('treatment', [1, 2, 3])).toEqual({});
  });

  it('nested obje/array değerler de değer olarak saklanmaz', () => {
    const result = sanitizeAuditChanges('treatment', {
      items: [{ toothNumber: '11', notes: 'gizli not' }],
    });
    expect(JSON.stringify(result)).not.toContain('gizli not');
  });
});
