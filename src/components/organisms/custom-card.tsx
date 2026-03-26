"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Money } from "@/components/atoms/money";
import { useDataStore } from "@/stores/data-store";
import { useCompanyStore } from "@/stores/company-store";
import type { NormalizedBalantaRow } from "@/types/balanta";
import type { DetailedAccountEntry } from "@/types/balanta-detaliata";
import { useTranslation } from "react-i18next";
import { useCustomCardStore } from "@/stores/custom-card-store";

interface CustomField {
  id: string;
  label: string;
  type: "account" | "manual" | "partner";
  accountCodes?: string;
  valueField?: "sumeTotaleD" | "sumeTotaleC" | "soldFinalD" | "soldFinalC";
  manualValue?: number;
  partnerCont?: string;
  partnerParent?: string;
}

interface CustomCard {
  id: string;
  title: string;
  fields: CustomField[];
  createdAt: number;
}

const STORAGE_KEY = "ifp-custom-cards";

function loadCards(): CustomCard[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCards(cards: CustomCard[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
}

const PRESETS = [
  { label: "Marfa cumparata (607)", codes: "607", field: "sumeTotaleD" as const },
  { label: "Salarii (641)", codes: "641", field: "sumeTotaleD" as const },
  { label: "Transport (624)", codes: "624", field: "sumeTotaleD" as const },
  { label: "Servicii externe (628)", codes: "628", field: "sumeTotaleD" as const },
  { label: "Chirii (6123)", codes: "6123", field: "sumeTotaleD" as const },
  { label: "Combustibil (6022)", codes: "6022", field: "sumeTotaleD" as const },
  { label: "Amortizari (6811)", codes: "6811", field: "sumeTotaleD" as const },
  { label: "Venituri vanzari (707)", codes: "707", field: "sumeTotaleC" as const },
  { label: "Venituri servicii (704)", codes: "704", field: "sumeTotaleC" as const },
  { label: "Valoare stoc (371)", codes: "371", field: "soldFinalD" as const },
  { label: "Clienti (4111)", codes: "4111", field: "soldFinalD" as const },
  { label: "Furnizori (401)", codes: "401", field: "soldFinalC" as const },
  { label: "Asigurari (613)", codes: "613", field: "sumeTotaleD" as const },
  { label: "Tichete masa (6422)", codes: "6422", field: "sumeTotaleD" as const },
  { label: "Impozit profit (691)", codes: "691", field: "sumeTotaleD" as const },
  { label: "Telecomunicatii (626)", codes: "626", field: "sumeTotaleD" as const },
];

function getFieldValue(
  rows: NormalizedBalantaRow[],
  codes: string,
  field: string
): number {
  const codeList = codes.split(",").map((c) => c.trim());
  return rows
    .filter(
      (r) =>
        !r.isClassTotal &&
        !r.isGrandTotal &&
        codeList.some((code) => r.cont === code || r.cont.startsWith(code))
    )
    .reduce((sum, r) => sum + ((r as unknown as Record<string, number>)[field] ?? 0), 0);
}

export function CustomCards() {
  const [cards, setCards] = useState<CustomCard[]>([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [pendingFields, setPendingFields] = useState<CustomField[]>([]);
  const { t } = useTranslation("dashboard");

  useEffect(() => {
    setCards(loadCards());
  }, []);

  const pendingField = useCustomCardStore((s) => s.pendingField);
  const clearPending = useCustomCardStore((s) => s.setPendingField);
  useEffect(() => {
    if (pendingField) {
      setPendingFields((prev) => [...prev, pendingField as CustomField]);
      setShowBuilder(true);
      setEditingCard(null);
      clearPending(null);
    }
  }, [pendingField, clearPending]);

  const updateCards = useCallback((newCards: CustomCard[]) => {
    setCards(newCards);
    saveCards(newCards);
  }, []);

  const [editingCard, setEditingCard] = useState<CustomCard | null>(null);

  function addCard(card: CustomCard) {
    const newCards = [card, ...cards];
    updateCards(newCards);
    setShowBuilder(false);
    setEditingCard(null);
  }

  function saveEditedCard(card: CustomCard) {
    updateCards(cards.map((c) => (c.id === card.id ? card : c)));
    setEditingCard(null);
  }

  function removeCard(id: string) {
    updateCards(cards.filter((c) => c.id !== id));
    if (editingCard?.id === id) setEditingCard(null);
  }

  function startEdit(card: CustomCard) {
    setEditingCard(card);
    setShowBuilder(false);
  }

  function openBuilder() {
    setShowBuilder(true);
    setEditingCard(null);
  }

  return (
    <div className="space-y-4">
      {/* Builder (full width, above the grid) */}
      <AnimatePresence>
        {showBuilder && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <CardBuilder
              onSave={addCard}
              onCancel={() => setShowBuilder(false)}
              injectedFields={pendingFields}
              onFieldsConsumed={() => setPendingFields([])}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cards grid — 1/3 width each */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) =>
          editingCard?.id === card.id ? (
            <div key={card.id} className="lg:col-span-3 md:col-span-2">
              <CardBuilder
                initialCard={editingCard}
                onSave={saveEditedCard}
                onCancel={() => setEditingCard(null)}
              />
            </div>
          ) : (
            <CustomCardView
              key={card.id}
              card={card}
              onRemove={() => removeCard(card.id)}
              onEdit={() => startEdit(card)}
            />
          )
        )}

        {/* Placeholder "+" card — always shown */}
        {!showBuilder && (
          <motion.button
            onClick={openBuilder}
            className="rounded-xl border-2 border-dashed border-border/50 hover:border-primary/40 bg-card/30 hover:bg-card/60 flex flex-col items-center justify-center gap-2 min-h-[140px] transition-colors group cursor-pointer"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            transition={{ duration: 0.1 }}
          >
            <span className="text-3xl text-muted-foreground/40 group-hover:text-primary/60 transition-colors">
              +
            </span>
            <span className="text-[11px] text-muted-foreground/50 group-hover:text-muted-foreground transition-colors">
              {t("custom_card.new_card_hint")}
            </span>
          </motion.button>
        )}
      </div>
    </div>
  );
}

function CardBuilder({
  initialCard,
  onSave,
  onCancel,
  injectedFields,
  onFieldsConsumed,
}: {
  initialCard?: CustomCard;
  onSave: (card: CustomCard) => void;
  onCancel: () => void;
  injectedFields?: CustomField[];
  onFieldsConsumed?: () => void;
}) {
  const { t } = useTranslation("dashboard");
  const [title, setTitle] = useState(initialCard?.title ?? "");
  const [fields, setFields] = useState<CustomField[]>(initialCard?.fields ?? []);

  useEffect(() => {
    if (injectedFields && injectedFields.length > 0) {
      setFields((prev) => [...prev, ...injectedFields]);
      onFieldsConsumed?.();
    }
  }, [injectedFields, onFieldsConsumed]);

  const [showPresets, setShowPresets] = useState(false);
  const [showPartners, setShowPartners] = useState(false);
  const [partnerSearch, setPartnerSearch] = useState("");
  const [partnerParentFilter, setPartnerParentFilter] = useState("401");
  const getSubAccounts = useDataStore((s) => s.getSubAccounts);
  const balanta = useDataStore((s) => s.balanta);
  const { activeView } = useCompanyStore();

  const ifpRows = (balanta.ifp?.rows ?? []) as NormalizedBalantaRow[];
  const filatoRows = (balanta.filato?.rows ?? []) as NormalizedBalantaRow[];

  function getValueForField(field: CustomField): number {
    if (field.type === "manual") return field.manualValue ?? 0;

    if (field.type === "partner" && field.partnerCont && field.partnerParent) {
      const vf = field.valueField ?? "sumeTotaleD";
      const entries = getSubAccounts(field.partnerParent, activeView === "combined" ? "combined" : activeView);
      const match = entries.filter((e) => e.cont === field.partnerCont);
      return match.reduce((sum, e) => sum + ((e as unknown as Record<string, number>)[vf] ?? 0), 0);
    }

    const codes = field.accountCodes ?? "";
    const vf = field.valueField ?? "sumeTotaleD";
    if (!codes) return 0;

    if (activeView === "combined") {
      return getFieldValue(ifpRows, codes, vf) + getFieldValue(filatoRows, codes, vf);
    }
    const rows = activeView === "ifp" ? ifpRows : filatoRows;
    return getFieldValue(rows, codes, vf);
  }

  function addPreset(preset: (typeof PRESETS)[0]) {
    setFields([
      ...fields,
      {
        id: crypto.randomUUID(),
        label: preset.label,
        type: "account",
        accountCodes: preset.codes,
        valueField: preset.field,
      },
    ]);
    setShowPresets(false);
  }

  function addManualField() {
    setFields([
      ...fields,
      {
        id: crypto.randomUUID(),
        label: "",
        type: "manual",
        manualValue: 0,
      },
    ]);
  }

  function addCustomAccount() {
    setFields([
      ...fields,
      {
        id: crypto.randomUUID(),
        label: "",
        type: "account",
        accountCodes: "",
        valueField: "sumeTotaleD",
      },
    ]);
  }

  function addPartner(entry: DetailedAccountEntry) {
    setFields([
      ...fields,
      {
        id: crypto.randomUUID(),
        label: entry.denumire,
        type: "partner",
        partnerCont: entry.cont,
        partnerParent: entry.parentCont,
        valueField: entry.parentCont === "4111" ? "sumeTotaleD" : "sumeTotaleD",
      },
    ]);
  }

  function updateField(id: string, updates: Partial<CustomField>) {
    setFields(fields.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  }

  function removeField(id: string) {
    setFields(fields.filter((f) => f.id !== id));
  }

  function handleSave() {
    if (!title.trim() || fields.length === 0) return;
    onSave({
      id: initialCard?.id ?? crypto.randomUUID(),
      title: title.trim(),
      fields,
      createdAt: initialCard?.createdAt ?? Date.now(),
    });
  }

  const partnerCategories = [
    { code: "401", labelKey: "custom_card.suppliers" },
    { code: "4111", labelKey: "custom_card.clients" },
    { code: "462", labelKey: "custom_card.creditors" },
    { code: "461", labelKey: "custom_card.debtors" },
  ];

  return (
    <div className="rounded-xl bg-card border-2 border-primary/30 p-5 space-y-4">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t("custom_card.title_placeholder")}
        className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
      />

      {/* Fields list */}
      <div className="space-y-2">
        {fields.map((field) => (
          <div
            key={field.id}
            className="flex items-center gap-2 bg-secondary/30 rounded-lg p-2"
          >
            {field.type === "account" && (
              <>
                <input
                  type="text"
                  value={field.label}
                  onChange={(e) => updateField(field.id, { label: e.target.value })}
                  placeholder={t("custom_card.label_placeholder")}
                  className="flex-1 bg-secondary border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <input
                  type="text"
                  value={field.accountCodes || ""}
                  onChange={(e) => updateField(field.id, { accountCodes: e.target.value })}
                  placeholder={t("custom_card.account_placeholder")}
                  className="w-24 bg-secondary border border-border rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <select
                  value={field.valueField || "sumeTotaleD"}
                  onChange={(e) =>
                    updateField(field.id, {
                      valueField: e.target.value as CustomField["valueField"],
                    })
                  }
                  className="bg-secondary border border-border rounded px-1 py-1 text-[10px]"
                >
                  <option value="sumeTotaleD">{t("custom_card.total_debit")}</option>
                  <option value="sumeTotaleC">{t("custom_card.total_credit")}</option>
                  <option value="soldFinalD">{t("custom_card.balance_d")}</option>
                  <option value="soldFinalC">{t("custom_card.balance_c")}</option>
                </select>
              </>
            )}
            {field.type === "manual" && (
              <>
                <input
                  type="text"
                  value={field.label}
                  onChange={(e) => updateField(field.id, { label: e.target.value })}
                  placeholder={t("custom_card.label_placeholder")}
                  className="flex-1 bg-secondary border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <input
                  type="number"
                  value={field.manualValue || ""}
                  onChange={(e) =>
                    updateField(field.id, { manualValue: parseFloat(e.target.value) || 0 })
                  }
                  placeholder={t("custom_card.value_placeholder")}
                  className="w-28 bg-secondary border border-border rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </>
            )}
            {field.type === "partner" && (
              <>
                <span className="text-[10px] text-emerald-400 shrink-0">👤</span>
                <input
                  type="text"
                  value={field.label}
                  onChange={(e) => updateField(field.id, { label: e.target.value })}
                  placeholder={t("custom_card.partner_placeholder")}
                  className="flex-1 bg-secondary border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <span className="text-[9px] text-muted-foreground font-mono shrink-0">{field.partnerCont}</span>
                <select
                  value={field.valueField || "sumeTotaleD"}
                  onChange={(e) =>
                    updateField(field.id, {
                      valueField: e.target.value as CustomField["valueField"],
                    })
                  }
                  className="bg-secondary border border-border rounded px-1 py-1 text-[10px]"
                >
                  <option value="sumeTotaleD">{t("custom_card.total_debit")}</option>
                  <option value="sumeTotaleC">{t("custom_card.total_credit")}</option>
                  <option value="soldFinalD">{t("custom_card.balance_d")}</option>
                  <option value="soldFinalC">{t("custom_card.balance_c")}</option>
                </select>
              </>
            )}
            {/* Live value */}
            <Money
              amount={getValueForField(field)}
              className="text-[11px] font-semibold text-muted-foreground shrink-0 min-w-[80px] text-right"
            />
            <button
              onClick={() => removeField(field.id)}
              className="text-muted-foreground hover:text-red-400 text-sm px-1"
            >
              {"\u2715"}
            </button>
          </div>
        ))}
      </div>

      {/* Running total */}
      {fields.length > 0 && (
        <div className="flex items-center justify-between text-xs border-t border-border/50 pt-2">
          <span className="text-muted-foreground">{t("custom_card.total")}</span>
          <Money
            amount={fields.reduce((s, f) => s + getValueForField(f), 0)}
            className="text-sm font-bold"
          />
        </div>
      )}

      {/* Add field buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setShowPresets(!showPresets)}
          className="px-2.5 py-1 rounded bg-secondary text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {t("custom_card.add_preset")}
        </button>
        <button
          onClick={addCustomAccount}
          className="px-2.5 py-1 rounded bg-secondary text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {t("custom_card.add_custom")}
        </button>
        <button
          onClick={addManualField}
          className="px-2.5 py-1 rounded bg-secondary text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {t("custom_card.add_fixed")}
        </button>
        <button
          onClick={() => { setShowPartners(!showPartners); setShowPresets(false); setPartnerSearch(""); }}
          className="px-2.5 py-1 rounded bg-secondary text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {t("custom_card.add_partner")}
        </button>
      </div>

      {/* Partner picker */}
      <AnimatePresence>
        {showPartners && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-secondary/30 rounded-lg p-3 space-y-2">
              <div className="flex gap-2">
                {partnerCategories.map((opt) => (
                  <button
                    key={opt.code}
                    onClick={() => setPartnerParentFilter(opt.code)}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      partnerParentFilter === opt.code
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t(opt.labelKey)} ({opt.code})
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={partnerSearch}
                onChange={(e) => setPartnerSearch(e.target.value)}
                placeholder={t("custom_card.search_partner")}
                className="w-full bg-secondary border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                autoFocus
              />
              <div className="max-h-40 overflow-y-auto space-y-0.5">
                {getSubAccounts(partnerParentFilter, "combined")
                  .filter((e) =>
                    !partnerSearch ||
                    e.denumire.toLowerCase().includes(partnerSearch.toLowerCase()) ||
                    e.cont.includes(partnerSearch)
                  )
                  .sort((a, b) => b.sumeTotaleD - a.sumeTotaleD)
                  .slice(0, 30)
                  .map((entry) => (
                    <button
                      key={entry.cont}
                      onClick={() => { addPartner(entry); setShowPartners(false); }}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-secondary/80 text-left transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-[11px] truncate">{entry.denumire}</p>
                        <p className="text-[9px] text-muted-foreground font-mono">{entry.cont}</p>
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground shrink-0 ml-2">
                        {entry.sumeTotaleD.toLocaleString("ro-RO", { maximumFractionDigits: 0 })} RON
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Presets dropdown */}
      <AnimatePresence>
        {showPresets && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap gap-1.5 p-2 bg-secondary/30 rounded-lg">
              {PRESETS.map((preset) => (
                <button
                  key={preset.codes}
                  onClick={() => addPreset(preset)}
                  className="px-2 py-1 rounded bg-secondary border border-border text-[10px] hover:border-primary/50 hover:text-primary transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Save / Cancel */}
      <div className="flex gap-2 pt-2 border-t border-border/50">
        <button
          onClick={handleSave}
          disabled={!title.trim() || fields.length === 0}
          className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:brightness-110 transition disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {initialCard ? t("custom_card.save_changes") : t("custom_card.save")}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-1.5 rounded-lg bg-secondary text-xs text-muted-foreground hover:text-foreground transition"
        >
          {t("custom_card.cancel")}
        </button>
      </div>
    </div>
  );
}

function CustomCardView({
  card,
  onRemove,
  onEdit,
}: {
  card: CustomCard;
  onRemove: () => void;
  onEdit: () => void;
}) {
  const { t } = useTranslation("dashboard");
  const balanta = useDataStore((s) => s.balanta);
  const getSubAccounts = useDataStore((s) => s.getSubAccounts);
  const { activeView } = useCompanyStore();

  const ifpRows = (balanta.ifp?.rows ?? []) as NormalizedBalantaRow[];
  const filatoRows = (balanta.filato?.rows ?? []) as NormalizedBalantaRow[];

  function getValueForField(field: CustomField): number {
    if (field.type === "manual") return field.manualValue ?? 0;

    if (field.type === "partner" && field.partnerCont && field.partnerParent) {
      const vf = field.valueField ?? "sumeTotaleD";
      const entries = getSubAccounts(field.partnerParent, activeView === "combined" ? "combined" : activeView);
      const match = entries.filter((e) => e.cont === field.partnerCont);
      return match.reduce((sum, e) => sum + ((e as unknown as Record<string, number>)[vf] ?? 0), 0);
    }

    const codes = field.accountCodes ?? "";
    const vf = field.valueField ?? "sumeTotaleD";

    if (activeView === "combined") {
      return getFieldValue(ifpRows, codes, vf) + getFieldValue(filatoRows, codes, vf);
    }
    const rows = activeView === "ifp" ? ifpRows : filatoRows;
    return getFieldValue(rows, codes, vf);
  }

  const fieldValues = card.fields.map((f) => ({
    field: f,
    value: getValueForField(f),
  }));

  const total = fieldValues.reduce((s, fv) => s + fv.value, 0);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl bg-card border border-primary/20 p-4 relative"
      style={{ borderTopColor: "#f59e0b", borderTopWidth: 3 }}
    >
      <div className="absolute top-2 right-2 flex items-center gap-1">
        <button
          onClick={onEdit}
          className="w-6 h-6 rounded-md bg-secondary/80 hover:bg-primary/20 text-muted-foreground hover:text-primary text-sm flex items-center justify-center transition-colors"
          title={t("custom_card.edit")}
        >
          {"\u270E"}
        </button>
        <button
          onClick={onRemove}
          className="w-6 h-6 rounded-md bg-secondary/80 hover:bg-red-500/20 text-muted-foreground hover:text-red-400 text-sm flex items-center justify-center transition-colors"
          title={t("custom_card.delete")}
        >
          {"\u2715"}
        </button>
      </div>

      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 pr-14">
        {card.title}
      </p>

      <div className="text-xl font-bold font-mono font-tabular mb-2">
        <Money amount={total} />
      </div>

      {/* Field breakdown */}
      <div className="space-y-1 border-t border-border/30 pt-2">
        {fieldValues.map(({ field, value }) => (
          <div key={field.id} className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground flex items-center gap-1 min-w-0 truncate">
              {field.type === "account" && (
                <span className="text-primary/60 font-mono text-[9px] shrink-0">
                  {field.accountCodes}
                </span>
              )}
              {field.type === "manual" && (
                <span className="text-amber-500/60 text-[8px] shrink-0">manual</span>
              )}
              {field.type === "partner" && (
                <span className="text-emerald-500/60 text-[8px] shrink-0">👤 {field.partnerCont}</span>
              )}
              <span className="truncate">{field.label}</span>
            </span>
            <Money amount={value} className="text-[10px] font-semibold shrink-0 ml-2" />
          </div>
        ))}
      </div>
    </motion.div>
  );
}
