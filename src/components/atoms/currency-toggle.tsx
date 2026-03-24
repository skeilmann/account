"use client";

import { useState, useRef, useEffect } from "react";
import { useCurrencyStore } from "@/stores/currency-store";

export function CurrencyToggle() {
  const { currency, eurRate, customRate, toggle, setCustomRate } =
    useCurrencyStore();
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeRate = customRate || eurRate;

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  function handleRateSubmit(value: string) {
    const parsed = parseFloat(value.replace(",", "."));
    if (!isNaN(parsed) && parsed > 0) {
      setCustomRate(parsed);
    }
    setEditing(false);
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={toggle}
        className="flex items-center gap-1 rounded-lg bg-secondary/50 p-1"
      >
        <span
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
            currency === "RON"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground"
          }`}
        >
          RON
        </span>
        <span
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
            currency === "EUR"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground"
          }`}
        >
          EUR
        </span>
      </button>

      {editing ? (
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground">1 EUR =</span>
          <input
            ref={inputRef}
            type="text"
            defaultValue={activeRate.toFixed(4)}
            className="w-16 text-[11px] font-mono bg-secondary border border-border rounded px-1.5 py-0.5 text-foreground"
            onBlur={(e) => handleRateSubmit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRateSubmit(e.currentTarget.value);
              if (e.key === "Escape") setEditing(false);
            }}
          />
          <span className="text-[10px] text-muted-foreground">RON</span>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
          title="Click to edit rate"
        >
          1 EUR = {activeRate.toFixed(4)} RON
          {customRate && (
            <span className="ml-1 text-primary">*</span>
          )}
        </button>
      )}
    </div>
  );
}
