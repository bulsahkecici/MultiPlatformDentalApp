const crypto = require('crypto');
const { authenticator } = require('otplib');
const {
  encryptText,
  decryptText,
  hashRecoveryCode,
} = require('../utils/dataProtection');

authenticator.options = { window: 1 };

function createMfaEnrollment(email) {
  const secret = authenticator.generateSecret();
  return {
    secret,
    encryptedSecret: encryptText(secret),
    otpauthUrl: authenticator.keyuri(email, 'Bulka Dental', secret),
  };
}

function generateRecoveryCodes(count = 10) {
  return Array.from({ length: count }, () => {
    const raw = crypto.randomBytes(6).toString('hex').toUpperCase();
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;
  });
}

function checkTotp(encryptedSecret, code) {
  if (!encryptedSecret || !code) return false;
  try {
    return authenticator.check(
      String(code).replace(/\s/g, ''),
      decryptText(encryptedSecret),
    );
  } catch {
    return false;
  }
}

async function verifyMfaCode(user, code, queryFn) {
  if (checkTotp(user.mfa_secret_encrypted, code)) return true;

  const normalizedHash = hashRecoveryCode(code || '');
  const hashes = Array.isArray(user.mfa_recovery_codes)
    ? user.mfa_recovery_codes
    : [];
  if (!hashes.includes(normalizedHash)) return false;

  // Tek kullanımlık kodu koşullu UPDATE ile atomik tüket. İki eşzamanlı giriş
  // aynı kurtarma kodunu okuyabilse bile yalnızca biri satırı güncelleyebilir.
  const consumed = await queryFn(
    `UPDATE users
     SET mfa_recovery_codes = COALESCE((
       SELECT jsonb_agg(value)
       FROM jsonb_array_elements_text(mfa_recovery_codes) AS value
       WHERE value <> $1
     ), '[]'::jsonb)
     WHERE id = $2 AND mfa_recovery_codes @> to_jsonb(ARRAY[$1]::text[])
     RETURNING id`,
    [normalizedHash, user.id],
  );
  return consumed.rows.length === 1;
}

module.exports = {
  createMfaEnrollment,
  generateRecoveryCodes,
  checkTotp,
  verifyMfaCode,
  hashRecoveryCode,
};
