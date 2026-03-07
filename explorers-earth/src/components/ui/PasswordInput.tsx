/**
 * Enhanced Password Input Component
 *
 * A reusable password input with built-in validation, strength meter, and security features:
 * - Real-time password validation with individual error messages
 * - Password strength meter with visual feedback
 * - Show/hide password toggle
 * - Autocomplete disabled for security
 * - Form integration with error states
 *
 * Usage:
 * ```tsx
 * <PasswordInput
 *   value={password}
 *   onChange={setPassword}
 *   currentPassword={currentPassword} // For change password scenarios
 *   placeholder="Enter your password"
 *   showStrengthMeter={true}
 *   onValidationChange={(isValid) => setFormValid(isValid)}
 * />
 * ```
 */

import React, { useState, useCallback, useEffect } from "react";
import {
  validatePassword,
  PasswordValidationOptions,
} from "../../utils/passwordValidator";
import PasswordStrengthMeter from "./PasswordStrengthMeter";
import EyeOnIcon from "../../assets/icons/EyeOnIcon";
import EyeOffIcon from "../../assets/icons/EyeOffIcon";
import { useTranslation } from "react-i18next";

interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  labelColor?: "black" | "white" | string;
  currentPassword?: string;
  showStrengthMeter?: boolean;
  showValidationStatus?: boolean;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  validationOptions?: PasswordValidationOptions;
  onValidationChange?: (
    isValid: boolean,
    validation: ReturnType<typeof validatePassword>
  ) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  "data-testid"?: string;
}

const PasswordInput: React.FC<PasswordInputProps> = ({
  value,
  onChange,
  placeholder = "Enter your password",
  label,
  labelColor = "black",
  currentPassword,
  showStrengthMeter = true,
  showValidationStatus = true,
  className = "",
  disabled = false,
  required = false,
  validationOptions = {},
  onValidationChange,
  onBlur,
  onFocus,
  "data-testid": testId,
}) => {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const { t } = useTranslation();

  // Merge current password into validation options
  const options = {
    ...validationOptions,
    currentPassword,
  };

  // Validate password when value changes
  const validation = validatePassword(value, options, t);

  // Notify parent component of validation changes
  useEffect(() => {
    if (onValidationChange) {
      onValidationChange(validation.isValid, validation);
    }
  }, [validation.isValid, validation, onValidationChange]);

  const handleTogglePasswordVisibility = useCallback(() => {
    setIsPasswordVisible((prev) => !prev);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    onFocus?.();
  }, [onFocus]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    onBlur?.();
  }, [onBlur]);

  // Determine input styling based on validation state
  const getInputClasses = () => {
    const baseClasses =
      "w-full placeholder:text-gray-400 outline-none px-3 py-2 pr-12 border font-poppins rounded-md text-sm focus:outline-none focus:ring-2 transition-colors text-white";

    if (disabled) {
      return `${baseClasses} bg-gray-600/50 border-gray-600 text-gray-400 cursor-not-allowed`;
    }

    if (!value || !showValidationStatus) {
      return `${baseClasses} border-dashboard bg-dashboard-muted focus:ring-dashboard-accent focus:border-dashboard-accent hover:border-dashboard-accent focus:bg-dashboard-muted`;
    }

    if (validation.errors.length > 0) {
      return `${baseClasses} border-[hsl(var(--destructive))] bg-dashboard-muted focus:ring-[hsl(var(--destructive))] focus:border-[hsl(var(--destructive))] focus:bg-dashboard-muted`;
    }

    if (validation.isValid) {
      return `${baseClasses} border-dashboard bg-dashboard-muted focus:ring-dashboard-accent focus:border-dashboard-accent focus:bg-dashboard-muted`;
    }

    return `${baseClasses} border-[hsl(var(--amber))] bg-gray-700/50 focus:ring-[hsl(var(--amber))] focus:border-[hsl(var(--amber))] focus:bg-gray-700`;
  };

  // Get label color class based on the labelColor prop
  const getLabelColorClass = () => {
    if (labelColor === "white") {
      return "text-white";
    } else if (labelColor === "black") {
      return "text-[hsl(var(--charcoal))]";
    } else {
      // Custom color - assume it's a valid Tailwind class or CSS color
      return labelColor.startsWith("text-") ? labelColor : `text-${labelColor}`;
    }
    return "dt-label"; // Default to dashboard theme label
  };

  return (
    <div
      className={`password-input-container w-full max-w-full overflow-hidden ${className}`}
    >
      {/* Label */}
      {label && (
        <label
          className={`block text-sm font-poppins text-black font-semibold mb-1 ${getLabelColorClass()}`}
        >
          {label}
          {required && (
            <span className="text-[hsl(var(--destructive))] ml-1">*</span>
          )}
        </label>
      )}

      {/* Input Field */}
      <div className="relative">
        <input
          type={isPasswordVisible ? "text" : "password"}
          value={value}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className={getInputClasses()}
          autoComplete="new-password" // Prevent browser autofill
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          data-testid={testId}
        />

        {/* Password visibility toggle */}
        <button
          type="button"
          onClick={handleTogglePasswordVisibility}
          disabled={disabled}
          className="absolute right-4 top-1/2 transform -translate-y-1/2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 text-gray-400 hover:text-white transition-colors"
          aria-label={isPasswordVisible ? t('common.hidePassword') : t('common.showPassword')}
          tabIndex={-1}
        >
          {isPasswordVisible ? <EyeOnIcon /> : <EyeOffIcon />}
        </button>
      </div>

      {/* Validation Status Indicator */}
      {showValidationStatus && value && (
        <div className="flex items-center mt-1">
          {validation.isValid ? (
            <div className="flex items-center text-dashboard-accent text-xs font-poppins">
              <svg
                className="w-3 h-3 mr-1"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{validation.successMessage}</span>
            </div>
          ) : null}
        </div>
      )}

      {/* Password Strength Meter */}
      {showStrengthMeter &&
        value &&
        (isFocused || validation.errors.length > 0) && (
          <PasswordStrengthMeter
            password={value}
            currentPassword={currentPassword}
            className="mt-3"
            validationOptions={options}
          />
        )}
    </div>
  );
};

export default PasswordInput;
