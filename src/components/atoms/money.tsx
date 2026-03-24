"use client";

import { useCurrencyStore, convertAmount } from "@/stores/currency-store";
import { formatMoney } from "@/lib/utils/format";
import { useTranslation } from "react-i18next";
import { getLocaleCode } from "@/lib/utils/format";

interface MoneyProps {
  /** Amount in RON */
  amount: number;
  className?: string;
  compact?: boolean;
}

export function Money({ amount, className = "", compact }: MoneyProps) {
  const { currency, eurRate, customRate } = useCurrencyStore();
  const { i18n } = useTranslation();
  const locale = getLocaleCode(i18n.language);

  const displayAmount = convertAmount(amount, currency, eurRate, customRate);

  const formatted = compact
    ? formatCompactMoney(displayAmount, currency, locale)
    : formatMoney(displayAmount, currency, locale);

  return (
    <span
      className={`font-mono font-tabular ${className}`}
      title={
        currency === "EUR"
          ? `${formatMoney(amount, "RON", locale)}`
          : undefined
      }
    >
      {formatted}
    </span>
  );
}

function formatCompactMoney(
  amount: number,
  currency: "RON" | "EUR",
  locale: string
): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";

  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toFixed(1)}M ${currency}`;
  }
  if (abs >= 1_000) {
    return `${sign}${(abs / 1_000).toFixed(0)}K ${currency}`;
  }
  return formatMoney(amount, currency, locale);
}
