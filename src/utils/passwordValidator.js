const validator = require('validator');

/**
 * Parola güçlülük gereksinimleri:
 * - En az 8 karakter
 * - En az bir büyük harf
 * - En az bir küçük harf
 * - En az bir rakam
 * - En az bir özel karakter
 */

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_REQUIREMENTS = {
  minLength: PASSWORD_MIN_LENGTH,
  minLowercase: 1,
  minUppercase: 1,
  minNumbers: 1,
  minSymbols: 1,
};

// Reddedilecek yaygın zayıf parolalar
const COMMON_PASSWORDS = new Set([
  'password',
  'password123',
  '12345678',
  'qwerty123',
  'abc123456',
  'password1',
  'admin123',
  'letmein',
  'welcome123',
  '123456789',
]);

/**
 * Parola güçlülüğünü doğrular
 * @param {string} password - Doğrulanacak parola
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validatePasswordStrength(password) {
  const errors = [];

  if (!password || typeof password !== 'string') {
    return { valid: false, errors: ['Password is required'] };
  }

  // Minimum uzunluğu kontrol et
  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
  }

  // Büyük harf kontrolü
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  // Küçük harf kontrolü
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  // Rakam kontrolü
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  // Özel karakter kontrolü
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  // Yaygın parolalara karşı kontrol et
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push('Password is too common, please choose a stronger password');
  }

  // Ek kontroller için validator kütüphanesini kullan
  if (
    !validator.isStrongPassword(password, {
      minLength: PASSWORD_REQUIREMENTS.minLength,
      minLowercase: PASSWORD_REQUIREMENTS.minLowercase,
      minUppercase: PASSWORD_REQUIREMENTS.minUppercase,
      minNumbers: PASSWORD_REQUIREMENTS.minNumbers,
      minSymbols: PASSWORD_REQUIREMENTS.minSymbols,
    })
  ) {
    if (errors.length === 0) {
      errors.push('Password does not meet strength requirements');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Yeni parolanın önceki parolalardan herhangi biriyle eşleşip eşleşmediğini kontrol eder
 * @param {string} newPassword - Kontrol edilecek yeni parola
 * @param {string[]} previousHashes - Önceki parola hash'lerinin dizisi
 * @param {Function} compareFunc - bcrypt karşılaştırma fonksiyonu
 * @returns {Promise<boolean>} Parola daha önce kullanıldıysa true
 */
async function isPasswordReused(newPassword, previousHashes, compareFunc) {
  if (!Array.isArray(previousHashes) || previousHashes.length === 0) {
    return false;
  }

  for (const hash of previousHashes) {
    const matches = await compareFunc(newPassword, hash);
    if (matches) {
      return true;
    }
  }

  return false;
}

module.exports = {
  validatePasswordStrength,
  isPasswordReused,
  PASSWORD_MIN_LENGTH,
  PASSWORD_REQUIREMENTS,
};
