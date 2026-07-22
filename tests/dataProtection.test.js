const { authenticator } = require('otplib');
const {
  encryptText,
  decryptText,
  hashRecoveryCode,
} = require('../src/utils/dataProtection');
const {
  createMfaEnrollment,
  checkTotp,
  verifyMfaCode,
} = require('../src/services/mfaService');

describe('Şifreleme ve MFA yardımcıları', () => {
  it('korunan metni AES-GCM ile geri çözer ve oynanmış veriyi reddeder', () => {
    const encrypted = encryptText('klinik-sir');
    expect(encrypted).not.toContain('klinik-sir');
    expect(decryptText(encrypted)).toBe('klinik-sir');
    const parts = encrypted.split('.');
    const ciphertext = Buffer.from(parts[2], 'base64url');
    ciphertext[0] ^= 0x01;
    parts[2] = ciphertext.toString('base64url');
    const tampered = parts.join('.');
    expect(() => decryptText(tampered)).toThrow();
  });

  it('üretilen TOTP sırrıyla geçerli kodu doğrular', () => {
    const enrollment = createMfaEnrollment('dentist@example.com');
    const code = authenticator.generate(enrollment.secret);
    expect(checkTotp(enrollment.encryptedSecret, code)).toBe(true);
    expect(checkTotp(enrollment.encryptedSecret, '000000')).toBe(false);
  });

  it('kurtarma kodunu normalize eder ve veritabanında atomik tüketir', async () => {
    const hash = hashRecoveryCode('abcd-1234-ef56');
    const query = jest.fn().mockResolvedValue({ rows: [{ id: 7 }] });
    const valid = await verifyMfaCode(
      {
        id: 7,
        mfa_secret_encrypted: null,
        mfa_recovery_codes: [hash],
      },
      'ABCD-1234-EF56',
      query,
    );
    expect(valid).toBe(true);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain('RETURNING id');
  });
});
