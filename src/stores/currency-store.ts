import { create } from "zustand";

type CurrencyCode = "RON" | "EUR";

const DEFAULT_EUR_RATE = 5.06;

interface CurrencyState {
  currency: CurrencyCode;
  eurRate: number;
  eurRateDate: string;
  customRate: number | null;
  toggle: () => void;
  setRate: (rate: number, date: string) => void;
  setCustomRate: (rate: number | null) => void;
}

const SERVER_DEFAULT: CurrencyCode = "EUR";

export const useCurrencyStore = create<CurrencyState>((set, get) => ({
  currency: SERVER_DEFAULT,
  eurRate: DEFAULT_EUR_RATE,
  eurRateDate: "2026-03-24",
  customRate: null,

  toggle: () => {
    const next = get().currency === "RON" ? "EUR" : "RON";
    if (typeof window !== "undefined") {
      localStorage.setItem("currency", next);
    }
    set({ currency: next });
  },

  setRate: (rate, date) => set({ eurRate: rate, eurRateDate: date }),
  setCustomRate: (rate) => set({ customRate: rate }),
}));

// Hydrate from localStorage after mount to avoid SSR mismatch
if (typeof window !== "undefined") {
  const stored = localStorage.getItem("currency") as CurrencyCode | null;
  if (stored === "RON" || stored === "EUR") {
    useCurrencyStore.setState({ currency: stored });
  }
}

/**
 * Convert RON to the active display currency.
 */
export function convertAmount(
  ronAmount: number,
  currency: CurrencyCode,
  eurRate: number,
  customRate: number | null
): number {
  if (currency === "RON") return ronAmount;
  const rate = customRate || eurRate;
  return ronAmount / rate;
}
