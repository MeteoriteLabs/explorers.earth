/**
 * CurrencyAmountInput Component
 * A reusable component for selecting currency and entering formatted amounts
 */

import React, { useMemo, useState, useEffect } from "react";
import Select, { StylesConfig } from "react-select";
import CurrencyInput from "react-currency-input-field";
import * as currencyCodes from "currency-codes";
import getSymbolFromCurrency from "currency-symbol-map";

interface CurrencyAmountInputProps {
  value: { amount: string; currency: string };
  onChange: (value: { amount: string; currency: string }) => void;
  className?: string;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
}

interface CurrencyOption {
  value: string;
  label: string;
}

const CurrencyAmountInput: React.FC<CurrencyAmountInputProps> = ({
  value,
  onChange,
  className = "",
  label,
  placeholder = "Enter amount",
  disabled = false,
}) => {
  const [localAmount, setLocalAmount] = useState(value.amount || "");
  const [localCurrency, setLocalCurrency] = useState(value.currency || "USD");

  // Update local state when value prop changes
  useEffect(() => {
    setLocalAmount(value.amount || "");
    setLocalCurrency(value.currency || "USD");
  }, [value.amount, value.currency]);

  // Generate currency options from currency-codes
  const currencyOptions: CurrencyOption[] = useMemo(() => {
    // currency-codes exports codes() function that returns all currency codes
    const allCodes = currencyCodes.codes();
    return allCodes
      .map((code: string) => {
        const currencyInfo = currencyCodes.code(code);
        const name = currencyInfo?.currency || code;
        const symbol = getSymbolFromCurrency(code) || code;
        return {
          value: code,
          label: `${code} — ${name} (${symbol})`,
        };
      })
      .filter((opt) => opt.value) // Filter out any invalid entries
      .sort((a, b) => a.value.localeCompare(b.value));
  }, []);

  // Handle currency change
  const handleCurrencyChange = (selectedOption: CurrencyOption | null) => {
    if (selectedOption) {
      const newCurrency = selectedOption.value;
      setLocalCurrency(newCurrency);
      onChange({
        amount: localAmount,
        currency: newCurrency,
      });
    }
  };

  // Handle amount change
  const handleAmountChange = (value: string | undefined) => {
    const amount = value || "";
    setLocalAmount(amount);
    onChange({
      amount,
      currency: localCurrency,
    });
  };

  // Get currency symbol for preview
  const currencySymbol = getSymbolFromCurrency(localCurrency) || localCurrency;

  // Format preview with Intl.NumberFormat
  const previewText = useMemo(() => {
    if (!localAmount || parseFloat(localAmount) === 0) {
      return "";
    }

    try {
      const numericValue = parseFloat(localAmount);
      if (isNaN(numericValue)) {
        return "";
      }

      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: localCurrency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(numericValue);
    } catch (error) {
      // Fallback formatting if Intl.NumberFormat fails
      return `${currencySymbol}${parseFloat(localAmount).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    }
  }, [localAmount, localCurrency, currencySymbol]);

  // Custom styles for react-select
  const selectStyles: StylesConfig<CurrencyOption, false> = {
    control: (provided, state) => ({
      ...provided,
      backgroundColor: "rgb(61, 78, 64)", // dashboard-muted
      borderColor: state.isFocused ? "rgb(52, 152, 219)" : "rgb(60, 78, 64)", // dashboard-accent or dashboard-muted
      color: "white",
      minHeight: "42px",
      boxShadow: state.isFocused ? "0 0 0 2px rgba(52, 152, 219, 0.2)" : "none",
      "&:hover": {
        borderColor: "rgb(52, 152, 219)",
      },
    }),
    menu: (provided) => ({
      ...provided,
      backgroundColor: "rgb(34, 49, 38)", // dashboard-sidebar
      zIndex: 10003, // Above modal
    }),
    option: (provided, state) => ({
      ...provided,
      backgroundColor: state.isSelected
        ? "rgb(52, 152, 219)" // dashboard-accent
        : state.isFocused
        ? "rgb(61, 78, 64)" // dashboard-muted
        : "transparent",
      color: "white",
      "&:hover": {
        backgroundColor: state.isSelected
          ? "rgb(52, 152, 219)"
          : "rgb(61, 78, 64)",
      },
    }),
    singleValue: (provided) => ({
      ...provided,
      color: "white",
    }),
    input: (provided) => ({
      ...provided,
      color: "white",
    }),
    placeholder: (provided) => ({
      ...provided,
      color: "rgba(255, 255, 255, 0.5)",
    }),
  };

  const selectedCurrency = currencyOptions.find(
    (opt) => opt.value === localCurrency
  ) || currencyOptions.find((opt) => opt.value === "USD");

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label className="block text-dashboard font-poppins text-sm font-medium">
          {label}
        </label>
      )}

      <div className="flex flex-col md:flex-row gap-2">
        {/* Currency Select */}
        <div className="w-full md:w-48 lg:w-64 flex-shrink-0">
          <Select<CurrencyOption, false>
            value={selectedCurrency}
            onChange={handleCurrencyChange}
            options={currencyOptions}
            isSearchable
            isDisabled={disabled}
            placeholder="Select currency..."
            styles={selectStyles}
            className="react-select-container"
            classNamePrefix="react-select"
          />
        </div>

        {/* Amount Input */}
        <div className="flex-1 min-w-0">
          <CurrencyInput
            id="currency-amount-input"
            name="currency-amount-input"
            value={localAmount}
            onValueChange={handleAmountChange}
            placeholder={placeholder}
            decimalsLimit={2}
            disabled={disabled}
            prefix={currencySymbol}
            className="w-full p-3 bg-dashboard-muted text-dashboard rounded-lg border border-dashboard focus:outline-none focus:ring-2 focus:ring-dashboard-accent font-poppins text-sm"
          />
        </div>
      </div>

      {/* Preview */}
      {previewText && (
        <p className="text-dashboard-light text-xs font-poppins">
          Preview: <span className="font-semibold">{previewText}</span>
        </p>
      )}
    </div>
  );
};

export default CurrencyAmountInput;

