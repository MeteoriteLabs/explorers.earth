/**
 * Password Strength Meter Component
 *
 * A reusable component that displays password strength visually with:
 * - Strength meter bar with color coding
 * - Real-time validation error messages
 * - Strength label and warnings
 * - Clean, minimal interface without detailed requirements list
 *
 * Usage:
 * ```tsx
 * <PasswordStrengthMeter
 *   password={password}
 *   currentPassword={currentPassword} // For change password scenarios
 *   className="mt-2"
 * />
 * ```
 */

import React from "react";
import {
  validatePassword,
  PasswordValidationOptions,
} from "../../utils/passwordValidator";
import { useTranslation } from "react-i18next";

interface PasswordStrengthMeterProps {
  password: string;
  currentPassword?: string;
  showStrengthLabel?: boolean;
  className?: string;
  validationOptions?: PasswordValidationOptions;
}

const PasswordStrengthMeter: React.FC<PasswordStrengthMeterProps> = ({
  password,
  currentPassword,
  showStrengthLabel = true,
  className = "",
  validationOptions = {},
}) => {
  const { t } = useTranslation();

  // Merge current password into validation options
  const options = {
    ...validationOptions,
    currentPassword,
  };

  const validation = validatePassword(password, options, t);

  // Calculate strength percentage for progress bar
  const strengthPercentage = (validation.strength / 5) * 100;

  // Get strength meter color classes
  const getStrengthBarClass = (strength: number) => {
    if (strength === 0) return "bg-gray-300";
    if (strength <= 1) return "bg-red-500";
    if (strength <= 2) return "bg-orange-500";
    if (strength <= 3) return "bg-yellow-500";
    if (strength <= 4) return "bg-green-500";
    return "bg-green-600";
  };

  // Only render if password has content
  if (!password) {
    return null;
  }

  return (
    <div className={`password-strength-meter ${className}`}>
      {/* Strength Meter Bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-white">
            {t('auth.validations.password.strength')}
          </span>
          {showStrengthLabel && (
            <span
              className="text-xs font-medium"
              style={{ color: validation.strengthColor }}
            >
              {validation.strengthLabel}
            </span>
          )}
        </div>
        <div className="w-full bg-gray-600 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${getStrengthBarClass(
              validation.strength
            )}`}
            style={{ width: `${strengthPercentage}%` }}
          />
        </div>
      </div>

      {/* Validation Errors */}
      {validation.errors.length > 0 && (
        <div className="mb-3">
          {validation.errors.map((error, index) => (
            <div
              key={index}
              className="flex items-start gap-2 text-xs text-red-400 mb-1"
            >
              <svg
                className="w-3 h-3 mt-0.5 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="break-words">{error}</span>
            </div>
          ))}
        </div>
      )}

      {/* Validation Warnings */}
      {validation.warnings.length > 0 && (
        <div className="mb-3">
          {validation.warnings.map((warning, index) => (
            <div
              key={index}
              className="flex items-start gap-2 text-xs text-orange-400 mb-1"
            >
              <svg
                className="w-3 h-3 mt-0.5 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="break-words">{warning}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PasswordStrengthMeter;
