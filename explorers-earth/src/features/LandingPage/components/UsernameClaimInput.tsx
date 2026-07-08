import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "./ui/landingButton";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { LoadingSpinner } from "./LoadingSpinner";
import { isManualAuthEnabled } from "../../../config/featureFlags";
import { useUsernameValidation } from "../../../hooks/useUsernameValidation";
import { validateUsername } from "../../../utils/usernameValidation";

interface UsernameClaimInputProps {
  className?: string;
  username: string;
  setUsername: (value: string) => void;
}

type ValidationState = {
  isValid: boolean;
  errors: string[];
  suggestions: string[];
  isAvailable?: boolean;
  availabilityUnavailable?: boolean;
};

const getInitialValidationState = (): ValidationState => ({
  isValid: true,
  errors: [],
  suggestions: [],
  isAvailable: undefined,
  availabilityUnavailable: false,
});

export function UsernameClaimInput({
  className,
  username,
  setUsername,
}: UsernameClaimInputProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [validationState, setValidationState] =
    useState<ValidationState>(getInitialValidationState);

  const navigate = useNavigate();
  const { t } = useTranslation();
  const { validateUsernameWithAvailability, isValidating } =
    useUsernameValidation();

  const validateClaimUsername = useCallback(
    async (value: string) => {
      if (!value.trim()) {
        setIsCheckingAvailability(false);
        setValidationState(getInitialValidationState());
        return;
      }

      const basicValidation = validateUsername(value, t);

      if (!basicValidation.isValid) {
        setIsCheckingAvailability(false);
        setValidationState({
          isValid: false,
          errors: basicValidation.errors,
          suggestions: basicValidation.suggestions,
          isAvailable: undefined,
          availabilityUnavailable: false,
        });
        return;
      }

      try {
        const validationResult = await validateUsernameWithAvailability(
          value,
          true
        );
        const availabilityError = validationResult.availability?.error || "";
        const availabilityUnavailable = availabilityError
          .toLowerCase()
          .includes("unable to check");

        setIsCheckingAvailability(false);

        if (availabilityUnavailable) {
          setValidationState({
            isValid: true,
            errors: [],
            suggestions: [],
            isAvailable: undefined,
            availabilityUnavailable: true,
          });
          return;
        }

        setValidationState({
          isValid: validationResult.isValid,
          errors: validationResult.errors,
          suggestions: validationResult.suggestions,
          isAvailable: validationResult.availability?.isAvailable,
          availabilityUnavailable: false,
        });
      } catch (error) {
        setIsCheckingAvailability(false);
        console.error("Username validation error:", error);
        setValidationState({
          isValid: true,
          errors: [],
          suggestions: [],
          isAvailable: undefined,
          availabilityUnavailable: true,
        });
      }
    },
    [t, validateUsernameWithAvailability]
  );

  useEffect(() => {
    if (username) {
      setIsCheckingAvailability(true);
    }
    const timeoutId = window.setTimeout(() => {
      void validateClaimUsername(username);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [username, validateClaimUsername]);

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(e.target.value.toLowerCase());
  };

  const handleClaimQR = async () => {
    if (!username.trim() || !validationState.isValid) return;

    setIsLoading(true);

    try {
      if (!isManualAuthEnabled()) {
        toast.info(
          t("auth.oauthOnlyMessage") || "Please sign up with Google to continue"
        );
        navigate("/login");
        return;
      }

      const finalValidation = await validateUsernameWithAvailability(
        username,
        true
      );
      const availabilityError = finalValidation.availability?.error || "";
      const availabilityUnavailable = availabilityError
        .toLowerCase()
        .includes("unable to check");

      if (
        finalValidation.isValid &&
        finalValidation.availability?.isAvailable === true
      ) {
        navigate(`/register?username=${encodeURIComponent(username)}`);
      } else if (availabilityUnavailable) {
        navigate("/register");
      } else {
        setValidationState(
          availabilityUnavailable
            ? {
                isValid: true,
                errors: [],
                suggestions: [],
                isAvailable: undefined,
                availabilityUnavailable: true,
              }
            : {
                isValid: false,
                errors: finalValidation.errors || ["Username validation failed"],
                suggestions: finalValidation.suggestions || [],
                isAvailable: finalValidation.availability?.isAvailable,
                availabilityUnavailable: false,
              }
        );
      }
    } catch (error) {
      console.error("Final username validation error:", error);
      if (validationState.availabilityUnavailable) {
        navigate("/register");
      } else {
        setValidationState({
          isValid: false,
          errors: ["Validation failed. Please try again."],
          suggestions: [],
          isAvailable: false,
          availabilityUnavailable: false,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const isButtonDisabled =
    !username.trim() ||
    !validationState.isValid ||
    isLoading ||
    isCheckingAvailability ||
    isValidating ||
    (validationState.isAvailable !== true &&
      !validationState.availabilityUnavailable);

  return (
    <div className={`space-y-2 ${className}`}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6 }}
        className="landing-claim-box rounded-[28px] p-2 sm:rounded-full"
      >
        <Label className="sr-only">{t("hero.inputLabel")}</Label>

        <div className="grid w-full grid-cols-[auto_1fr] gap-2 sm:grid-cols-[auto_1fr_auto] sm:items-center">
          <span className="inline-flex items-center rounded-full px-3 py-3 text-xs font-extrabold text-[#66715f] sm:px-5 sm:text-sm">
            explorers.earth/
          </span>

          <div className="relative min-w-0">
            <Input
              type="text"
              placeholder={t("hero.inputPlaceholder")}
              value={username}
              onChange={handleUsernameChange}
              className={`h-12 w-full rounded-full border-0 bg-transparent px-2 py-3 text-sm font-bold text-[#17231a] shadow-none outline-none placeholder:text-[#66715f]/65 focus-visible:ring-0 sm:px-3 sm:text-base ${
                username && !validationState.isValid
                  ? "ring-2 ring-red-500"
                  : username &&
                      validationState.isValid &&
                      validationState.isAvailable
                    ? "ring-2 ring-green-500"
                    : ""
              }`}
              onKeyDown={(e) =>
                e.key === "Enter" && !isButtonDisabled && handleClaimQR()
              }
            />

            {isCheckingAvailability && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <LoadingSpinner size="sm" />
              </div>
            )}
          </div>

          <Button
            onClick={handleClaimQR}
            disabled={isButtonDisabled}
            size="lg"
            className={`landing-green-button col-span-2 h-12 rounded-full px-6 text-sm font-extrabold text-white sm:col-auto ${
              isButtonDisabled ? "cursor-not-allowed" : "hover:opacity-95"
            }`}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <LoadingSpinner size="sm" />
                {t("usernameClaim.validating")}
              </span>
            ) : (
              t("usernameClaim.claimFree")
            )}
          </Button>
        </div>
      </motion.div>

      <div
        aria-live="polite"
        className="min-h-[1.5rem] px-3 text-xs font-bold leading-5 sm:px-5"
      >
        {username && validationState.errors.length > 0 && (
          <div className="space-y-1 text-red-600">
            {validationState.errors.map((error, index) => (
              <div key={index} className="flex items-start gap-2">
                <span aria-hidden className="mt-0.5 text-red-500">
                  *
                </span>
                <span>{error}</span>
              </div>
            ))}
          </div>
        )}

        {username &&
          validationState.suggestions.length > 0 &&
          validationState.errors.length > 0 && (
            <div className="mt-1 text-yellow-700">
              {t("usernameClaim.trySuggestions", {
                suggestions: validationState.suggestions.slice(0, 3).join(", "),
              })}
            </div>
          )}

        {username &&
          !isCheckingAvailability &&
          validationState.isAvailable === true && (
            <div className="text-green-700">{t("usernameClaim.available")}</div>
          )}

        {username &&
          !isCheckingAvailability &&
          validationState.isAvailable === false && (
            <div className="text-red-600">{t("usernameClaim.unavailable")}</div>
          )}

        {username &&
          !isCheckingAvailability &&
          validationState.availabilityUnavailable && (
            <div className="text-[#6f6a5f]">
              {t("usernameClaim.confirmOnSignup")}
            </div>
          )}

        {username && isCheckingAvailability && (
          <div className="flex items-center gap-2 text-blue-700">
            <LoadingSpinner size="sm" />
            <span>{t("usernameClaim.checkingAvailability")}</span>
          </div>
        )}
      </div>
    </div>
  );
}
