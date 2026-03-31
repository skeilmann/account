"use client";

import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { useCurrencyStore } from "@/stores/currency-store";

type CalcMode = "basic" | "tva" | "margin" | "currency";

const MODES: { key: CalcMode; label: string }[] = [
  { key: "basic", label: "Calc" },
  { key: "tva", label: "TVA" },
  { key: "margin", label: "Marjă" },
  { key: "currency", label: "RON\u2194EUR" },
];

const NUM_BUTTONS = ["7", "8", "9", "4", "5", "6", "1", "2", "3", "0", ".", ","];
const OP_BUTTONS = ["/", "*", "-", "+"];

interface HistoryEntry {
  input: string;
  result: string;
  mode: CalcMode;
}

export function Calculator() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<CalcMode>("basic");
  const [input, setInput] = useState("");
  const [result, setResult] = useState("");
  const [tvaRate, setTvaRate] = useState(19);
  const [editingTva, setEditingTva] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const { eurRate, customRate } = useCurrencyStore();
  const rate = customRate || eurRate;

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const addToHistory = useCallback(
    (inp: string, res: string) => {
      setHistory((prev) => [{ input: inp, result: res, mode }, ...prev]);
    },
    [mode]
  );

  const calculate = useCallback(() => {
    const cleaned = input.replace(/\s/g, "").replace(",", ".");
    const val = parseFloat(cleaned);

    switch (mode) {
      case "basic":
        try {
          const r = Function(`"use strict"; return (${cleaned})`)();
          if (typeof r === "number" && isFinite(r)) {
            const res = r.toLocaleString("ro-RO", { maximumFractionDigits: 4 });
            setResult(res);
            addToHistory(input, res);
          } else {
            setResult("Eroare");
          }
        } catch {
          setResult("Eroare");
        }
        break;

      case "tva": {
        if (isNaN(val)) { setResult("\u2014"); break; }
        const multiplier = tvaRate / 100;
        const withTVA = val * (1 + multiplier);
        const netFromGross = val / (1 + multiplier);
        const tvaAmount = val * multiplier;
        const res =
          `+ TVA: ${fmt(withTVA)}\n` +
          `\u2212 TVA: ${fmt(netFromGross)}\n` +
          `TVA (${tvaRate}%): ${fmt(tvaAmount)}`;
        setResult(res);
        addToHistory(`${input} @ ${tvaRate}%`, res.split("\n")[0]);
        break;
      }

      case "margin": {
        const parts = input.split(/[;]/);
        if (parts.length >= 2) {
          const cost = parseFloat(parts[0].trim().replace(",", "."));
          const price = parseFloat(parts[1].trim().replace(",", "."));
          if (!isNaN(cost) && !isNaN(price) && price > 0) {
            const marginPct = ((price - cost) / price) * 100;
            const markupPct = cost > 0 ? ((price - cost) / cost) * 100 : 0;
            const res =
              `Marjă: ${marginPct.toFixed(1)}%\n` +
              `Adaos: ${markupPct.toFixed(1)}%\n` +
              `Profit: ${fmt(price - cost)}`;
            setResult(res);
            addToHistory(input, `Marjă ${marginPct.toFixed(1)}%`);
          }
        } else {
          setResult("Format: cost ; preț");
        }
        break;
      }

      case "currency": {
        if (isNaN(val)) { setResult("\u2014"); break; }
        const eur = val / rate;
        const ron = val * rate;
        const res =
          `${fmt(val)} RON = ${fmt(eur)} EUR\n` +
          `${fmt(val)} EUR = ${fmt(ron)} RON`;
        setResult(res);
        addToHistory(`${input} RON`, `${fmt(eur)} EUR`);
        break;
      }
    }
  }, [input, mode, rate, tvaRate, addToHistory]);

  function pressButton(char: string) {
    if (char === "," || char === ".") {
      setInput((prev) => prev + ".");
    } else {
      setInput((prev) => prev + char);
    }
  }

  function pressOp(op: string) {
    setInput((prev) => prev + ` ${op} `);
  }

  function clear() {
    setInput("");
    setResult("");
  }

  function backspace() {
    setInput((prev) => prev.trimEnd().slice(0, -1).trimEnd());
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center text-lg hover:scale-110 transition-transform z-50"
        title="Calculator (Ctrl+K)"
      >
        {"\uD83E\uDDEE"}
      </button>
    );
  }

  return (
    <motion.div
      drag
      dragMomentum={false}
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="fixed bottom-6 right-6 w-80 min-h-[520px] rounded-xl bg-card border border-border shadow-2xl z-50 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-secondary/50 cursor-grab active:cursor-grabbing">
        <span className="text-xs font-semibold">Calculator</span>
        <button
          onClick={() => setOpen(false)}
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          {"\u2715"}
        </button>
      </div>

      {/* Mode tabs */}
      <div className="flex border-b border-border">
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => { setMode(m.key); setInput(""); setResult(""); }}
            className={`flex-1 px-2 py-1.5 text-[10px] font-medium transition-colors ${
              mode === m.key
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="p-3 space-y-3">
        {/* History */}
        {history.length > 0 && (
          <div className="bg-muted/40 rounded-lg px-2 py-1.5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Istoric</p>
              <button
                onClick={() => setHistory([])}
                className="text-[9px] text-muted-foreground hover:text-destructive transition-colors"
              >
                Șterge tot
              </button>
            </div>
            <div className="space-y-0.5 max-h-28 overflow-y-auto">
              {history.map((h, i) => (
                <button
                  key={i}
                  onClick={() => { setInput(h.input); setMode(h.mode); }}
                  className="w-full flex items-center justify-between text-[10px] px-1.5 py-0.5 rounded hover:bg-secondary/80 transition-colors"
                >
                  <span className="text-muted-foreground truncate mr-2">{h.input}</span>
                  <span className="font-mono shrink-0">{h.result}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* TVA rate selector */}
        {mode === "tva" && (
          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-muted-foreground">Cotă:</span>
            {[9, 19, 5].map((r) => (
              <button
                key={r}
                onClick={() => { setTvaRate(r); setEditingTva(false); }}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                  tvaRate === r && !editingTva
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {r}%
              </button>
            ))}
            {editingTva ? (
              <input
                type="text"
                autoFocus
                defaultValue={tvaRate}
                className="w-12 bg-secondary border border-border rounded px-1.5 py-0.5 text-[10px] font-mono"
                onBlur={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v) && v > 0) setTvaRate(v);
                  setEditingTva(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const v = parseFloat(e.currentTarget.value);
                    if (!isNaN(v) && v > 0) setTvaRate(v);
                    setEditingTva(false);
                  }
                }}
              />
            ) : (
              <button
                onClick={() => setEditingTva(true)}
                className="px-2 py-0.5 rounded bg-secondary text-muted-foreground hover:text-foreground text-[10px]"
                title="Cotă personalizată"
              >
                Altă...
              </button>
            )}
          </div>
        )}

        {/* Display */}
        <div className="bg-secondary/50 rounded-lg px-3 py-2 min-h-[36px]">
          <p className="text-sm font-mono text-foreground truncate">
            {input || (
              <span className="text-muted-foreground">
                {mode === "basic" ? "0" : mode === "margin" ? "cost ; preț" : "Sumă"}
              </span>
            )}
          </p>
        </div>

        {/* Result */}
        {result && (
          <div className="bg-primary/10 border border-primary/20 rounded-lg px-3 py-2 text-sm font-mono whitespace-pre-line text-foreground">
            {result}
          </div>
        )}

        {/* Number pad */}
        <div className="grid grid-cols-4 gap-1">
          {/* Row 1: C, BS, /, = */}
          <button onClick={clear} className="calc-btn bg-destructive/20 text-destructive hover:bg-destructive/30">C</button>
          <button onClick={backspace} className="calc-btn">{"\u232B"}</button>
          {mode === "basic" ? (
            <button onClick={() => pressOp("/")} className="calc-btn bg-primary/10 text-primary">/</button>
          ) : (
            <button onClick={() => pressButton(";")} className="calc-btn bg-primary/10 text-primary">;</button>
          )}
          <button onClick={calculate} className="calc-btn bg-primary text-primary-foreground font-bold">=</button>

          {/* Rows 2-4: numbers + operations */}
          {[
            ["7", "8", "9", "*"],
            ["4", "5", "6", "-"],
            ["1", "2", "3", "+"],
          ].map((row, ri) => (
            row.map((char) => {
              const isOp = OP_BUTTONS.includes(char);
              return (
                <button
                  key={`${ri}-${char}`}
                  onClick={() => (isOp ? pressOp(char) : pressButton(char))}
                  className={`calc-btn ${isOp ? "bg-primary/10 text-primary" : ""}`}
                >
                  {char === "*" ? "\u00D7" : char}
                </button>
              );
            })
          ))}

          {/* Row 5: 00, 0, ., Enter */}
          <button onClick={() => pressButton("00")} className="calc-btn">00</button>
          <button onClick={() => pressButton("0")} className="calc-btn">0</button>
          <button onClick={() => pressButton(".")} className="calc-btn">.</button>
          <button
            onClick={calculate}
            className="calc-btn bg-primary text-primary-foreground font-bold text-[10px]"
          >
            Enter
          </button>
        </div>

        {/* Currency info */}
        {mode === "currency" && (
          <p className="text-[9px] text-muted-foreground text-center">
            1 EUR = {rate.toFixed(4)} RON
          </p>
        )}

      </div>

      <style jsx>{`
        .calc-btn {
          @apply rounded-lg py-2 text-sm font-medium transition-colors;
          @apply bg-secondary/70 hover:bg-secondary text-foreground;
          @apply active:scale-95;
        }
      `}</style>
    </motion.div>
  );
}

function fmt(n: number): string {
  return n.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
