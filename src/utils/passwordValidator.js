const validator = require('validator');

/**
 * Password strength requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_REQUIREMENTS = {
  minLength: PASSWORD_MIN_LENGTH,
  minLowercase: 1,
  minUppercase: 1,
  minNumbers: 1,
  minSymbols: 1,
};

// Common weak passwords to reject
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
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validatePasswordStrength(password) {
  const errors = [];

  if (!password || typeof password !== 'string') {
    return { valid: false, errors: ['Password is required'] };
  }

  // Check minimum length
  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
  }

  // Check for uppercase
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  // Check for lowercase
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  // Check for number
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  // Check for special character
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  // Check against common passwords
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push('Password is too common, please choose a stronger password');
  }

  // Use validator library for additional checks
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
 * Check if new password matches any of the previous passwords
 * @param {string} newPassword - New password to check
 * @param {string[]} previousHashes - Array of previous password hashes
 * @param {Function} compareFunc - bcrypt compare function
 * @returns {Promise<boolean>} True if password was used before
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
