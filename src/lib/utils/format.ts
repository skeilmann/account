/**
 * Format a monetary value according to locale.
 */
export function formatMoney(
  amount: number,
  currency: "RON" | "EUR",
  locale: string = "ro-RO"
): string {
  const absAmount = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";

  // Romanian format: 1.234,56
  // English format: 1,234.56
  // Italian format: 1.234,56
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(absAmount);

  return `${sign}${formatted} ${currency}`;
}

/**
 * Format a percentage value.
 */
export function formatPercent(value: number, locale: string = "ro-RO"): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value) + "%";
}

/**
 * Format a large number with abbreviation.
 */
export function formatCompact(amount: number, locale: string = "ro-RO"): string {
  if (Math.abs(amount) >= 1_000_000) {
    return (
      new Intl.NumberFormat(locale, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(amount / 1_000_000) + "M"
    );
  }
  if (Math.abs(amount) >= 1_000) {
    return (
      new Intl.NumberFormat(locale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 1,
      }).format(amount / 1_000) + "K"
    );
  }
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Get the locale string for number/date formatting.
 */
export function getLocaleCode(lang: string): string {
  const map: Record<string, string> = {
    ro: "ro-RO",
    en: "en-US",
    it: "it-IT",
  };
  return map[lang] || "ro-RO";
}
