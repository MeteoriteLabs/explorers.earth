/**
 * Centralized Password Validation Utility
 * 
 * This module provides comprehensive password validation for all password-related forms
 * in the explorers application (signup, reset password, change password).
 * 
 * Features:
 * - Real-time validation with detailed feedback
 * - Password strength calculation based on entropy and complexity
 * - Common password detection
 * - Current password reuse prevention
 * - Configurable length limits
 * 
 * Usage:
 * ```typescript
 * import { validatePassword, calculatePasswordStrength } from '@/utils/passwordValidator';
 * 
 * const validation = validatePassword(password, { currentPassword: "old123" });
 * const strength = calculatePasswordStrength(password);
 * ```
 */

// Configuration constants - make these config-driven for easy updates
export const PASSWORD_CONFIG = {
  MIN_LENGTH: 6,
  MAX_LENGTH: 32,
  REQUIRED_UPPERCASE: true,
  REQUIRED_LOWERCASE: true,
  REQUIRED_NUMBER: true,
  REQUIRED_SPECIAL_CHAR: true,
} as const;

// Common passwords list - expanded from typical weak passwords
const COMMON_PASSWORDS = new Set([
  'password', 'password123', '123456', '123456789', 'qwerty', 'abc123',
  'password1', '12345678', '111111', '1234567890', 'admin', 'welcome',
  'monkey', 'dragon', 'master', 'hello', 'freedom', 'whatever', 'qazwsx',
  'trustno1', 'superman', 'batman', 'football', 'baseball', 'soccer',
  'basketball', 'hockey', 'tennis', 'golf', 'letmein', 'mustang', 'shadow',
  'michael', 'jennifer', 'jordan', 'hunter', 'fuckyou', 'daniel', 'michelle',
  'mindy', 'patrick', '123abc', 'pass', 'test', 'guest', 'info', 'changeme',
  'secret', 'god', 'love', 'sex', 'money', 'live', 'blink182', 'jordan23',
  'iloveyou', 'family', '000000', '696969', 'stupid', 'orange', 'starwars',
  'yellow', 'internet', 'password2', 'password3', 'password12', 'abc12345',
  'qwerty123', '123qwe', '1q2w3e', 'asdfgh', 'zxcvbn', 'poiuyt', 'lkjhgf',
  'mnbvcx', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'
]);

// Regex patterns for validation rules
const VALIDATION_PATTERNS = {
  uppercase: /[A-Z]/,
  lowercase: /[a-z]/,
  number: /[0-9]/,
  specialChar: /[!@#$%^&*(),.?":{}|<>]/,
} as const;

// Password strength levels
export enum PasswordStrength {
  VERY_WEAK = 0,
  WEAK = 1,
  FAIR = 2,
  GOOD = 3,
  STRONG = 4,
  VERY_STRONG = 5,
}

// Validation result interface
export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  strength: PasswordStrength;
  strengthLabel: string;
  strengthColor: string;
  successMessage: string;
  rules: {
    minLength: boolean;
    maxLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumber: boolean;
    hasSpecialChar: boolean;
    notCommon: boolean;
    notCurrentPassword: boolean;
  };
}

// Options for password validation
export interface PasswordValidationOptions {
  currentPassword?: string;
  skipCommonCheck?: boolean;
  customMinLength?: number;
  customMaxLength?: number;
}

/**
 * Calculate password entropy and strength based on character variety and length
 */
export function calculatePasswordStrength(password: string): PasswordStrength {
  if (!password) return PasswordStrength.VERY_WEAK;

  let score = 0;
  let charsetSize = 0;

  // Character set size calculation
  if (VALIDATION_PATTERNS.lowercase.test(password)) charsetSize += 26;
  if (VALIDATION_PATTERNS.uppercase.test(password)) charsetSize += 26;
  if (VALIDATION_PATTERNS.number.test(password)) charsetSize += 10;
  if (VALIDATION_PATTERNS.specialChar.test(password)) charsetSize += 32; // Common special chars

  // Length scoring
  if (password.length >= 6) score += 1;
  if (password.length >= 10) score += 1;
  if (password.length >= 14) score += 1;

  // Character variety scoring
  if (VALIDATION_PATTERNS.lowercase.test(password)) score += 1;
  if (VALIDATION_PATTERNS.uppercase.test(password)) score += 1;
  if (VALIDATION_PATTERNS.number.test(password)) score += 1;
  if (VALIDATION_PATTERNS.specialChar.test(password)) score += 1;

  // Entropy bonus (more diverse character sets = higher entropy)
  const entropy = password.length * Math.log2(charsetSize || 1);
  if (entropy >= 50) score += 1;
  if (entropy >= 70) score += 1;

  // Pattern penalties
  if (/(.)\1{2,}/.test(password)) score -= 1; // Repeated characters
  if (/012|123|234|345|456|567|678|789|890|abc|bcd|cde/.test(password.toLowerCase())) score -= 1; // Sequential patterns

  // Common password penalty
  if (COMMON_PASSWORDS.has(password.toLowerCase())) score -= 2;

  // Ensure score is within bounds
  score = Math.max(0, Math.min(5, score));

  return score as PasswordStrength;
}

/**
 * Get strength label and color based on strength level
 */
export function getStrengthInfo(strength: PasswordStrength, t?: (key: string) => string): { label: string; color: string } {
  const strengthMap = {
    [PasswordStrength.VERY_WEAK]: {
      label: t ? t('auth.validations.password.veryWeak') : 'Very Weak',
      color: '#ff4757'
    },
    [PasswordStrength.WEAK]: {
      label: t ? t('auth.validations.password.weak') : 'Weak',
      color: '#ff6b7a'
    },
    [PasswordStrength.FAIR]: {
      label: t ? t('auth.validations.password.fair') : 'Fair',
      color: '#ffa726'
    },
    [PasswordStrength.GOOD]: {
      label: t ? t('auth.validations.password.good') : 'Good',
      color: '#66bb6a'
    },
    [PasswordStrength.STRONG]: {
      label: t ? t('auth.validations.password.strong') : 'Strong',
      color: '#4caf50'
    },
    [PasswordStrength.VERY_STRONG]: {
      label: t ? t('auth.validations.password.veryStrong') : 'Very Strong',
      color: '#2e7d32'
    },
  };

  return strengthMap[strength];
}

/**
 * Comprehensive password validation function
 * 
 * @param password - The password to validate
 * @param options - Validation options including current password for reuse check
 * @param t - Translation function for i18n support
 * @returns Detailed validation result with errors, warnings, and strength
 */
export function validatePassword(
  password: string,
  options: PasswordValidationOptions = {},
  t?: (key: string) => string
): PasswordValidationResult {
  const {
    currentPassword,
    skipCommonCheck = false,
    customMinLength = PASSWORD_CONFIG.MIN_LENGTH,
    customMaxLength = PASSWORD_CONFIG.MAX_LENGTH,
  } = options;

  const errors: string[] = [];
  const warnings: string[] = [];
  const strength = calculatePasswordStrength(password);
  const strengthInfo = getStrengthInfo(strength, t);

  // Rule validation results
  const rules = {
    minLength: password.length >= customMinLength,
    maxLength: password.length <= customMaxLength,
    hasUppercase: VALIDATION_PATTERNS.uppercase.test(password),
    hasLowercase: VALIDATION_PATTERNS.lowercase.test(password),
    hasNumber: VALIDATION_PATTERNS.number.test(password),
    hasSpecialChar: VALIDATION_PATTERNS.specialChar.test(password),
    notCommon: skipCommonCheck || !COMMON_PASSWORDS.has(password.toLowerCase()),
    notCurrentPassword: !currentPassword || password !== currentPassword,
  };

  // Generate error messages for failed rules
  if (!rules.minLength) {
    errors.push(t ? t('auth.validations.password.minLength') : `Password must be at least ${customMinLength} characters long`);
  }

  if (!rules.maxLength) {
    errors.push(t ? t('auth.validations.password.maxLength') : `Password must not exceed ${customMaxLength} characters`);
  }

  if (PASSWORD_CONFIG.REQUIRED_UPPERCASE && !rules.hasUppercase) {
    errors.push(t ? t('auth.validations.password.uppercaseRequired') : 'Password must contain at least one uppercase letter (A-Z)');
  }

  if (PASSWORD_CONFIG.REQUIRED_LOWERCASE && !rules.hasLowercase) {
    errors.push(t ? t('auth.validations.password.lowercaseRequired') : 'Password must contain at least one lowercase letter (a-z)');
  }

  if (PASSWORD_CONFIG.REQUIRED_NUMBER && !rules.hasNumber) {
    errors.push(t ? t('auth.validations.password.numberRequired') : 'Password must contain at least one number (0-9)');
  }

  if (PASSWORD_CONFIG.REQUIRED_SPECIAL_CHAR && !rules.hasSpecialChar) {
    errors.push(t ? t('auth.validations.password.specialCharRequired') : 'Password must contain at least one special character (!@#$%^&*(),.?":{}|<>)');
  }

  if (!rules.notCommon) {
    errors.push(t ? t('auth.validations.password.tooCommon') : 'This password is too common. Please choose a more unique password');
  }

  if (!rules.notCurrentPassword) {
    errors.push(t ? t('auth.validations.password.sameAsCurrent') : 'New password cannot be the same as your current password');
  }

  // Generate warnings for weak passwords that technically pass validation
  if (strength <= PasswordStrength.WEAK && errors.length === 0) {
    warnings.push(t ? t('auth.validations.password.considerLonger') : 'Consider using a longer password with more variety for better security');
  }

  if (password.length < 10 && errors.length === 0) {
    warnings.push(t ? t('auth.validations.password.moreSecure') : 'Passwords with 10 or more characters are more secure');
  }

  const isValid = errors.length === 0;
  const successMessage = isValid && password.length > 0 ? (t ? t('auth.validations.password.meetsAllRequirements') : 'Password meets all requirements') : '';

  return {
    isValid,
    errors,
    warnings,
    strength,
    strengthLabel: strengthInfo.label,
    strengthColor: strengthInfo.color,
    rules,
    successMessage,
  };
}

/**
 * Quick validation check - returns only boolean result
 * Useful for form submission validation
 */
export function isPasswordValid(
  password: string,
  options: PasswordValidationOptions = {}
): boolean {
  return validatePassword(password, options).isValid;
}

/**
 * Get validation rules as displayable requirements list
 * Useful for showing password requirements to users
 */
export function getPasswordRequirements(options: PasswordValidationOptions = {}): string[] {
  const {
    customMinLength = PASSWORD_CONFIG.MIN_LENGTH,
    customMaxLength = PASSWORD_CONFIG.MAX_LENGTH,
  } = options;

  const requirements = [
    `At least ${customMinLength} characters long`,
    `No more than ${customMaxLength} characters`,
  ];

  if (PASSWORD_CONFIG.REQUIRED_UPPERCASE) {
    requirements.push('One uppercase letter (A-Z)');
  }

  if (PASSWORD_CONFIG.REQUIRED_LOWERCASE) {
    requirements.push('One lowercase letter (a-z)');
  }

  if (PASSWORD_CONFIG.REQUIRED_NUMBER) {
    requirements.push('One number (0-9)');
  }

  if (PASSWORD_CONFIG.REQUIRED_SPECIAL_CHAR) {
    requirements.push('One special character (!@#$%^&*(),.?":{}|<>)');
  }

  requirements.push('Not a common password');

  return requirements;
}
