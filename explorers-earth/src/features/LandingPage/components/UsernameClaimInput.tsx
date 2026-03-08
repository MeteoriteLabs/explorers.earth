import React, { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "./ui/landingButton";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { LoadingSpinner } from "./LoadingSpinner";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

// Import the centralized username validation system
import { validateUsername } from "../../../utils/usernameValidation";
import { useUsernameValidation } from "../../../hooks/useUsernameValidation";
import { isManualAuthEnabled } from "../../../config/featureFlags";

interface UsernameClaimInputProps {
  className?: string;
  username: string;
  setUsername: (value: string) => void;
}

/**
 * Username Claim Input Component for Landing Page
 *
 * This component integrates the centralized username validation system
 * used in the signup form to provide consistent validation experience.
 *
 * Features:
 * - Real-time validation using shared validator utility
 * - Username availability checking (async)
 * - Visual feedback matching signup form UX
 * - Pre-fills signup form on successful validation
 * - Redirects to signup page with validated username
 */
export function UsernameClaimInput({
  className,
  username,
  setUsername,
}: UsernameClaimInputProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [validationState, setValidationState] = useState<{
    isValid: boolean;
    errors: string[];
    suggestions: string[];
    isAvailable?: boolean;
  }>({
    isValid: true,
    errors: [],
    suggestions: [],
    isAvailable: undefined,
  });

  const navigate = useNavigate();
  const { t } = useTranslation();

  // Use the new username validation hook
  const { validateUsernameWithAvailability, isValidating } =
    useUsernameValidation();

  /**
   * Debounced validation function to prevent excessive API calls
   * Uses the same validation logic as the signup form
   */
  const validateUsernameDebounced = useCallback(
    debounce(async (value: string) => {
      if (!value.trim()) {
        setValidationState({
          isValid: true,
          errors: [],
          suggestions: [],
          isAvailable: undefined,
        });
        return;
      }

      try {
        // Use the validation hook method for username availability checking
        const validationResult = await validateUsernameWithAvailability(
          value,
          true
        );
        setIsCheckingAvailability(false);

        setValidationState({
          isValid: validationResult.isValid,
          errors: validationResult.errors,
          suggestions: validationResult.suggestions,
          isAvailable: validationResult.availability?.isAvailable,
        });
      } catch (error) {
        setIsCheckingAvailability(false);
        console.error("Username validation error:", error);
        setValidationState({
          isValid: false,
          errors: ["Unable to check username availability. Please try again."],
          suggestions: [],
          isAvailable: undefined,
        });
      }
    }, 300),
    [validateUsernameWithAvailability]
  );

  // Real-time validation as user types
  useEffect(() => {
    if (username) {
      setIsCheckingAvailability(true);
    }
    validateUsernameDebounced(username);
  }, [username, validateUsernameDebounced]);

  /**
   * Handle username input change with real-time lowercase conversion
   * Matches the behavior in the signup form UsernameInput component
   */
  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase(); // Real-time lowercase conversion
    setUsername(value);
  };

  /**
   * Handle the "Claim your explorers" button click
   * Redirects to signup page with pre-filled username (if manual auth enabled)
   * Otherwise redirects to login for OAuth
   */
  const handleClaimQR = async () => {
    if (!username.trim() || !validationState.isValid) return;

    setIsLoading(true);

    try {
      // MANUAL AUTH DISABLED - Redirect to login for OAuth-only mode
      if (!isManualAuthEnabled()) {
        toast.info(t('auth.oauthOnlyMessage') || 'Please sign up with Google to continue');
        navigate('/login');
        return;
      }

      // Final validation before redirect (only for manual auth)
      const finalValidation = await validateUsername(username);

      if (finalValidation.isValid && validationState.isAvailable) {
        // Redirect to signup page with pre-filled username
        // Using URL parameter to pre-fill the signup form
        navigate(`/register?username=${encodeURIComponent(username)}`);
      } else {
        // Show validation errors if final check fails
        setValidationState({
          isValid: false,
          errors: finalValidation.errors || ["Username validation failed"],
          suggestions: finalValidation.suggestions || [],
          isAvailable: false,
        });
      }
    } catch (error) {
      console.error("Final username validation error:", error);
      setValidationState({
        isValid: false,
        errors: ["Validation failed. Please try again."],
        suggestions: [],
        isAvailable: false,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Determine button state - now uses isValidating from hook instead of isCheckingAvailability
  const isButtonDisabled =
    !username.trim() ||
    !validationState.isValid ||
    isLoading ||
    isValidating ||
    validationState.isAvailable === false;

  // Format error messages for display (simple array display, not using formatValidationMessages)
  const displayErrors = validationState.errors;
  const displaySuggestions = validationState.suggestions;

  return (
    <div className={`space-y-4 ${className}`}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6 }}
        className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20 animated-border"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <Label className="text-sm font-medium text-white">
            {t('hero.inputLabel')}
          </Label>
          <span className="text-xs font-medium text-white/90 bg-white/10 px-2.5 py-1 rounded-md whitespace-nowrap">
            Free Forever
          </span>
        </div>

        <div className="flex flex-col sm:flex-row w-full max-w-full">
          <span className="inline-flex items-center px-3 sm:px-4 py-2 sm:py-[10px] bg-white/20 border border-white/30 sm:border-r-0 rounded-lg sm:rounded-l-lg sm:rounded-r-none text-xs sm:text-sm whitespace-nowrap flex-shrink-0">
            explorers.earth/
          </span>

          <div className="relative flex-1 min-w-0">
            <Input
              type="text"
              placeholder={t('hero.inputPlaceholder')}
              value={username}
              onChange={handleUsernameChange}
              className={`flex-1 mt-2 sm:mt-0 rounded-lg sm:rounded-l-none sm:rounded-r-lg placeholder-gray-400 py-2 sm:py-[10px] px-3 h-auto input-animated text-gray-900 text-sm sm:text-base w-full max-w-full ${
                username && !validationState.isValid
                  ? "border-red-500 focus:ring-red-500"
                  : username &&
                    validationState.isValid &&
                    validationState.isAvailable
                  ? "border-green-500 focus:ring-green-500"
                  : "border-gray-300"
              }`}
              style={{ backgroundColor: "hsl(var(--light-gray))" }}
              onKeyPress={(e) =>
                e.key === "Enter" && !isButtonDisabled && handleClaimQR()
              }
            />

            {/* Loading indicator for availability check */}
            {isCheckingAvailability && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <LoadingSpinner size="sm" />
              </div>
            )}
          </div>
        </div>

        {/* Validation Messages */}
        {username && (
          <div className="mt-3 space-y-2">
            {/* Error Messages */}
            {displayErrors.length > 0 && (
              <div className="text-red-300 text-xs space-y-1">
                {displayErrors.map((error: string, index: number) => (
                  <div key={index} className="flex items-start gap-2">
                    <span className="text-red-400 mt-0.5">•</span>
                    <span>{error}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Suggestions */}
            {displaySuggestions.length > 0 &&
              validationState.errors.length > 0 && (
                <div className="text-yellow-300 text-xs space-y-1">
                  <div className="font-medium">Suggestions:</div>
                  {displaySuggestions.map(
                    (suggestion: string, index: number) => (
                      <div key={index} className="flex items-start gap-2">
                        <span className="text-yellow-400 mt-0.5">•</span>
                        <span>{suggestion}</span>
                      </div>
                    )
                  )}
                </div>
              )}

            {/* Availability Status */}
            {username &&
              !isCheckingAvailability &&
              validationState.isAvailable === true && (
                <div className="text-green-300 text-xs flex items-center gap-2">
                  <span className="text-green-400">✓</span>
                  <span>Username is available!</span>
                </div>
              )}

            {username &&
              !isCheckingAvailability &&
              validationState.isAvailable === false && (
                <div className="text-red-300 text-xs flex items-center gap-2">
                  <span className="text-red-400">×</span>
                  <span>Username is not available</span>
                </div>
              )}

            {isCheckingAvailability && (
              <div className="text-blue-300 text-xs flex items-center gap-2">
                <LoadingSpinner size="sm" />
                <span>Checking availability...</span>
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* Claim Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.6 }}
        whileHover={{ scale: isButtonDisabled ? 1 : 1.05 }}
        whileTap={{ scale: isButtonDisabled ? 1 : 0.95 }}
      >
        <Button
          onClick={handleClaimQR}
          disabled={isButtonDisabled}
          size="lg"
          className={`w-full sm:w-auto lg:w-auto font-semibold text-base sm:text-lg btn-animated ripple-effect text-white px-6 sm:px-8 py-3 sm:py-4 ${
            isButtonDisabled
              ? "opacity-50 cursor-not-allowed"
              : "hover:opacity-90"
          }`}
          style={{ backgroundColor: "hsl(var(--blue-cta))" }}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <LoadingSpinner size="sm" />
              Validating...
            </span>
          ) : (
            t('hero.ctaButton')
          )}
        </Button>
      </motion.div>
    </div>
  );
}

/**
 * Debounce utility function to limit API calls
 * @param func Function to debounce
 * @param delay Delay in milliseconds
 */
function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): T {
  let timeoutId: ReturnType<typeof setTimeout>;
  return ((...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), delay);
  }) as T;
}
