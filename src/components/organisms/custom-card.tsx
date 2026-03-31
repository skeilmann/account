"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Money } from "@/components/atoms/money";
import { useDataStore } from "@/stores/data-store";
import { useCompanyStore } from "@/stores/company-store";
import type { NormalizedBalantaRow } from "@/types/balanta";
import type { DetailedAccountEntry } from "@/types/balanta-detaliata";
import { useTranslation } from "react-i18next";
import { useCustomCardStore } from "@/stores/custom-card-store";
import {
  EXPENSE_GROUP_DEFINITIONS,
  REVENUE_GROUP_DEFINITIONS,
  BALANCE_SHEET_GROUP_DEFINITIONS,
} from "@/types/expense-group";

interface CustomField {
  id: string;
  label: string;
  type: "account" | "manual" | "partner";
  accountCodes?: string;
  valueField?: "sumeTotaleD" | "sumeTotaleC" | "soldFinalD" | "soldFinalC";
  manualValue?: number;
  partnerCont?: string;
  partnerParent?: string;
  operation?: "add" | "subtract";
  multiplier?: number;
  customAdjustment?: number;
}

interface SimulationEffect {
  id: string;
  type: "kpi" | "account";
  /** For kpi: "revenue"|"expenses"|"profit"|"margin"|"tax"|"net_cash_impact" */
  /** For account: any account code like "641", "707" etc. */
  key: string;
  label: string;
}

interface CustomCard {
  id: string;
  title: string;
  fields: CustomField[];
  simulationEffects?: SimulationEffect[];
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

type ValueField = "sumeTotaleD" | "sumeTotaleC" | "soldFinalD" | "soldFinalC";

interface GroupedPreset {
  groupId: string;
  icon: string;
  accounts: { cont: string; denumire: string; defaultField: ValueField }[];
}

const ALL_GROUP_DEFS = [
  ...EXPENSE_GROUP_DEFINITIONS,
  ...REVENUE_GROUP_DEFINITIONS,
  ...BALANCE_SHEET_GROUP_DEFINITIONS,
];

function buildGroupedPresets(rows: NormalizedBalantaRow[]): GroupedPreset[] {
  const accountMap = new Map<string, { cont: string; denumire: string }>();
  for (const r of rows) {
    if (r.isClassTotal || r.isGrandTotal) continue;
    if (!accountMap.has(r.cont)) {
      accountMap.set(r.cont, { cont: r.cont, denumire: r.denumire });
    }
  }

  const groups: GroupedPreset[] = [];

  for (const def of ALL_GROUP_DEFS) {
    const matched: { cont: string; denumire: string; defaultField: ValueField }[] = [];
    for (const acc of accountMap.values()) {
      if (def.accounts.some((prefix) => acc.cont.startsWith(prefix))) {
        const classNum = parseInt(acc.cont.charAt(0), 10);
        const defaultField: ValueField =
          classNum === 7 ? "sumeTotaleC" : classNum === 6 ? "sumeTotaleD" : "soldFinalD";
        matched.push({ ...acc, defaultField });
      }
    }
    if (matched.length > 0) {
      matched.sort((a, b) => a.cont.localeCompare(b.cont));
      groups.push({ groupId: def.id, icon: def.icon, accounts: matched });
    }
  }

  // Collect any accounts not matched by any group definition
  const matchedConts = new Set(groups.flatMap((g) => g.accounts.map((a) => a.cont)));
  const unmatched: { cont: string; denumire: string; defaultField: ValueField }[] = [];
  for (const acc of accountMap.values()) {
    if (!matchedConts.has(acc.cont)) {
      const classNum = parseInt(acc.cont.charAt(0), 10);
      const defaultField: ValueField =
        classNum === 7 ? "sumeTotaleC" : classNum === 6 ? "sumeTotaleD" : "soldFinalD";
      unmatched.push({ ...acc, defaultField });
    }
  }
  if (unmatched.length > 0) {
    unmatched.sort((a, b) => a.cont.localeCompare(b.cont));
    groups.push({ groupId: "neclasificate", icon: "\u2753", accounts: unmatched });
  }

  return groups;
}

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

function getSignedValue(field: CustomField, rawValue: number): number {
  return field.operation === "subtract" ? -rawValue : rawValue;
}

function getAdjustedValue(field: CustomField, rawValue: number): number {
  const mult = (field.multiplier ?? 100) / 100;
  const adj = field.customAdjustment ?? 0;
  const base = rawValue * mult + adj;
  return field.operation === "subtract" ? -base : base;
}

function hasAnyAdjustments(fields: CustomField[]): boolean {
  return fields.some(
    (f) =>
      (f.multiplier !== undefined && f.multiplier !== 100) ||
      (f.customAdjustment !== undefined && f.customAdjustment !== 0)
  );
}

/**
 * Calculates tax impact from adjusted fields.
 * Logic: more expenses → less profit → less tax (and vice versa).
 * For each adjusted field, the "expense delta" is the raw change in the
 * underlying value (ignoring +/- operation), because expenses always reduce
 * taxable profit regardless of how the card totals them.
 */
function calcTaxImpact(fields: CustomField[], getVal: (f: CustomField) => number): number {
  let expenseDelta = 0;
  for (const f of fields) {
    const raw = getVal(f);
    const mult = (f.multiplier ?? 100) / 100;
    const adj = f.customAdjustment ?? 0;
    const adjusted = raw * mult + adj;
    const fieldDelta = adjusted - raw; // how much MORE is spent/earned
    // Class 6 = expenses: more spending → less tax
    // Class 7 = revenue: more revenue → more tax
    const code = f.accountCodes?.trim().charAt(0) ?? "";
    if (code === "6") {
      expenseDelta += fieldDelta; // more expenses = less profit
    } else if (code === "7") {
      expenseDelta -= fieldDelta; // more revenue = more profit
    }
    // manual / partner / balance sheet fields: skip (ambiguous impact)
  }
  // Each RON of extra expense reduces profit by 1 RON, saving 16% tax
  return expenseDelta * -0.16;
}

/** Predefined KPI effects the user can add to a card */
const KPI_EFFECT_OPTIONS: { key: string; labelKey: string }[] = [
  { key: "expenses", labelKey: "kpi.expenses" },
  { key: "revenue", labelKey: "kpi.revenue" },
  { key: "profit", labelKey: "kpi.profit" },
  { key: "margin", labelKey: "kpi.margin" },
  { key: "tax", labelKey: "custom_card.tax_16" },
  { key: "net_cash_impact", labelKey: "custom_card.net_cash_impact" },
];

/**
 * Calculate the ripple effects of card adjustments on KPIs and accounts.
 *
 * Given the field-level deltas (class 6 = expense change, class 7 = revenue change),
 * compute how each selected metric is affected, including cascading tax savings.
 */
function calcSimulationEffects(
  fields: CustomField[],
  effects: SimulationEffect[],
  getVal: (f: CustomField) => number,
  getAccountValue: (codes: string, valueField: string) => number,
): { effect: SimulationEffect; actual: number; simulated: number; delta: number }[] {
  // Step 1: compute aggregate deltas by class
  let expenseDelta = 0; // positive = spending more
  let revenueDelta = 0; // positive = earning more
  for (const f of fields) {
    const raw = getVal(f);
    const mult = (f.multiplier ?? 100) / 100;
    const adj = f.customAdjustment ?? 0;
    const adjusted = raw * mult + adj;
    const fieldDelta = adjusted - raw;
    if (Math.abs(fieldDelta) < 0.01) continue;
    const code = f.accountCodes?.trim().charAt(0) ?? "";
    if (code === "6") expenseDelta += fieldDelta;
    else if (code === "7") revenueDelta += fieldDelta;
  }

  const profitDelta = revenueDelta - expenseDelta;
  const taxDelta = profitDelta * 0.16; // more profit → more tax
  const netCashDelta = profitDelta - taxDelta; // profit change minus tax change

  return effects.map((effect) => {
    if (effect.type === "kpi") {
      switch (effect.key) {
        case "expenses":
          return { effect, actual: 0, simulated: expenseDelta, delta: expenseDelta };
        case "revenue":
          return { effect, actual: 0, simulated: revenueDelta, delta: revenueDelta };
        case "profit":
          return { effect, actual: 0, simulated: profitDelta, delta: profitDelta };
        case "margin":
          // margin is a % — can't compute without full revenue, return delta as pp
          return { effect, actual: 0, simulated: profitDelta, delta: profitDelta };
        case "tax":
          return { effect, actual: 0, simulated: taxDelta, delta: taxDelta };
        case "net_cash_impact":
          return { effect, actual: 0, simulated: netCashDelta, delta: netCashDelta };
        default:
          return { effect, actual: 0, simulated: 0, delta: 0 };
      }
    }
    // Account type: check if the account is one of the adjusted fields
    if (effect.type === "account") {
      let accountDelta = 0;
      for (const f of fields) {
        const codes = f.accountCodes?.split(",").map((c) => c.trim()) ?? [];
        if (codes.some((c) => effect.key === c || effect.key.startsWith(c) || c.startsWith(effect.key))) {
          const raw = getVal(f);
          const mult = (f.multiplier ?? 100) / 100;
          const adj = f.customAdjustment ?? 0;
          accountDelta += (raw * mult + adj) - raw;
        }
      }
      const actualVal = getAccountValue(effect.key, "sumeTotaleD");
      return { effect, actual: actualVal, simulated: actualVal + accountDelta, delta: accountDelta };
    }
    return { effect, actual: 0, simulated: 0, delta: 0 };
  });
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

  function duplicateCard(card: CustomCard) {
    const dup: CustomCard = {
      id: crypto.randomUUID(),
      title: `${card.title} (copy)`,
      fields: card.fields.map((f) => ({ ...f, id: crypto.randomUUID() })),
      simulationEffects: card.simulationEffects?.map((e) => ({ ...e, id: crypto.randomUUID() })),
      createdAt: Date.now(),
    };
    updateCards([dup, ...cards]);
  }

  function startEdit(card: CustomCard) {
    setEditingCard(card);
    setShowBuilder(false);
  }

  function openBuilder() {
    setShowBuilder(true);
    setEditingCard(null);
  }

  // Drag & drop reorder
  const dragIdRef = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  function handleDragStart(id: string) {
    dragIdRef.current = id;
  }

  function handleDragOver(e: React.DragEvent, overId: string) {
    e.preventDefault();
    if (dragIdRef.current && dragIdRef.current !== overId) {
      setDragOverId(overId);
    }
  }

  function handleDrop(targetId: string) {
    const srcId = dragIdRef.current;
    if (!srcId || srcId === targetId) {
      dragIdRef.current = null;
      setDragOverId(null);
      return;
    }
    const srcIdx = cards.findIndex((c) => c.id === srcId);
    const tgtIdx = cards.findIndex((c) => c.id === targetId);
    if (srcIdx === -1 || tgtIdx === -1) return;
    const reordered = [...cards];
    const [moved] = reordered.splice(srcIdx, 1);
    reordered.splice(tgtIdx, 0, moved);
    updateCards(reordered);
    dragIdRef.current = null;
    setDragOverId(null);
  }

  function handleDragEnd() {
    dragIdRef.current = null;
    setDragOverId(null);
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
              onDuplicate={() => duplicateCard(card)}
              isDragOver={dragOverId === card.id}
              onDragStart={() => handleDragStart(card.id)}
              onDragOver={(e: React.DragEvent) => handleDragOver(e, card.id)}
              onDrop={() => handleDrop(card.id)}
              onDragEnd={handleDragEnd}
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
  const [simEffects, setSimEffects] = useState<SimulationEffect[]>(initialCard?.simulationEffects ?? []);
  const [showEffectPicker, setShowEffectPicker] = useState(false);
  const [effectAccountCode, setEffectAccountCode] = useState("");

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

  const [presetSearch, setPresetSearch] = useState("");
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  const allRows = [...ifpRows, ...filatoRows];
  const groupedPresets = buildGroupedPresets(allRows);

  function addGroupedPreset(acc: GroupedPreset["accounts"][0]) {
    setFields([
      ...fields,
      {
        id: crypto.randomUUID(),
        label: `${acc.denumire} (${acc.cont})`,
        type: "account",
        accountCodes: acc.cont,
        valueField: acc.defaultField,
      },
    ]);
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
      simulationEffects: simEffects.length > 0 ? simEffects : undefined,
      createdAt: initialCard?.createdAt ?? Date.now(),
    });
  }

  function addKpiEffect(key: string, labelKey: string) {
    if (simEffects.some((e) => e.type === "kpi" && e.key === key)) return;
    setSimEffects([...simEffects, { id: crypto.randomUUID(), type: "kpi", key, label: t(labelKey) }]);
  }

  function addAccountEffect(code: string) {
    if (!code.trim()) return;
    if (simEffects.some((e) => e.type === "account" && e.key === code)) return;
    // find label from rows
    const allR = [...ifpRows, ...filatoRows];
    const match = allR.find((r) => r.cont === code && !r.isClassTotal && !r.isGrandTotal);
    const label = match ? `${match.denumire} (${code})` : code;
    setSimEffects([...simEffects, { id: crypto.randomUUID(), type: "account", key: code, label }]);
    setEffectAccountCode("");
  }

  function removeEffect(id: string) {
    setSimEffects(simEffects.filter((e) => e.id !== id));
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
        {fields.map((field) => {
          const rawVal = getValueForField(field);
          const fieldHasAdj =
            (field.multiplier !== undefined && field.multiplier !== 100) ||
            (field.customAdjustment !== undefined && field.customAdjustment !== 0);

          return (
            <div key={field.id} className="bg-secondary/30 rounded-lg p-2 space-y-1">
              <div className="flex items-center gap-2">
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
                    <span className="text-[10px] text-emerald-400 shrink-0">{"\uD83D\uDC64"}</span>
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
                  amount={rawVal}
                  className="text-[11px] font-semibold text-muted-foreground shrink-0 min-w-[80px] text-right"
                />
                {/* +/- toggle */}
                <button
                  onClick={() =>
                    updateField(field.id, {
                      operation: field.operation === "subtract" ? "add" : "subtract",
                    })
                  }
                  className={`w-6 h-6 rounded text-xs font-bold transition-colors shrink-0 ${
                    field.operation === "subtract"
                      ? "bg-red-500/20 text-red-400"
                      : "bg-emerald-500/20 text-emerald-400"
                  }`}
                  title={
                    field.operation === "subtract"
                      ? t("custom_card.subtract_value")
                      : t("custom_card.add_value")
                  }
                >
                  {field.operation === "subtract" ? "\u2212" : "+"}
                </button>
                {/* Adjustment toggle */}
                <button
                  onClick={() =>
                    updateField(field.id, {
                      multiplier: field.multiplier === undefined ? 100 : undefined,
                    })
                  }
                  className={`w-6 h-6 rounded text-[10px] transition-colors shrink-0 ${
                    fieldHasAdj || field.multiplier !== undefined
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-secondary text-muted-foreground/50 hover:text-muted-foreground"
                  }`}
                  title={t("custom_card.adjustments")}
                >
                  {"\u2699"}
                </button>
                <button
                  onClick={() => removeField(field.id)}
                  className="text-muted-foreground hover:text-red-400 text-sm px-1"
                >
                  {"\u2715"}
                </button>
              </div>

              {/* Adjustment inputs (collapsible) */}
              {field.multiplier !== undefined && (
                <div className="flex items-center gap-2 ml-4 pt-1">
                  <label className="text-[9px] text-muted-foreground shrink-0">
                    {t("custom_card.multiplier")}
                  </label>
                  <div className="flex items-center gap-0.5">
                    <input
                      type="number"
                      value={field.multiplier}
                      onChange={(e) =>
                        updateField(field.id, {
                          multiplier: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-16 bg-secondary border border-border rounded px-1.5 py-0.5 text-[10px] font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <span className="text-[9px] text-muted-foreground">%</span>
                  </div>
                  <label className="text-[9px] text-muted-foreground shrink-0 ml-2">
                    {t("custom_card.adjustment")}
                  </label>
                  <div className="flex items-center gap-0.5">
                    <input
                      type="number"
                      value={field.customAdjustment || ""}
                      onChange={(e) =>
                        updateField(field.id, {
                          customAdjustment: parseFloat(e.target.value) || 0,
                        })
                      }
                      placeholder="0"
                      className="w-20 bg-secondary border border-border rounded px-1.5 py-0.5 text-[10px] font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <span className="text-[9px] text-muted-foreground">RON</span>
                  </div>
                  {fieldHasAdj && (
                    <span className="text-[9px] text-amber-400 ml-auto">
                      {"\u2192"}{" "}
                      <Money
                        amount={Math.abs(getAdjustedValue(field, rawVal))}
                        className="text-[9px] text-amber-400 inline"
                      />
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Running total */}
      {fields.length > 0 && (() => {
        const actualTotal = fields.reduce((s, f) => s + getSignedValue(f, getValueForField(f)), 0);
        const withAdj = hasAnyAdjustments(fields);
        const adjustedTotal = withAdj
          ? fields.reduce((s, f) => s + getAdjustedValue(f, getValueForField(f)), 0)
          : actualTotal;
        const delta = adjustedTotal - actualTotal;

        return (
          <div className="border-t border-border/50 pt-2 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {withAdj ? t("custom_card.actual_total") : t("custom_card.total")}
              </span>
              <Money amount={actualTotal} className={`text-sm ${withAdj ? "text-muted-foreground" : "font-bold"}`} />
            </div>
            {withAdj && (
              <>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-amber-400">{t("custom_card.adjusted_total")}</span>
                  <Money amount={adjustedTotal} className="text-sm font-bold text-amber-400" />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{t("custom_card.delta")}</span>
                  <span className={`text-xs font-semibold ${delta >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {delta >= 0 ? "+" : ""}<Money amount={delta} className="inline text-xs" />
                  </span>
                </div>
                {(() => {
                  const taxImpact = calcTaxImpact(fields, getValueForField);
                  if (Math.abs(taxImpact) < 1) return null;
                  return (
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground/70">
                      <span>{t("custom_card.tax_impact")}</span>
                      <span className={taxImpact >= 0 ? "text-emerald-400/70" : "text-red-400/70"}>
                        {taxImpact >= 0 ? "+" : ""}<Money amount={taxImpact} className="inline text-[10px]" />
                      </span>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        );
      })()}

      {/* Simulation effects */}
      {hasAnyAdjustments(fields) && (
        <div className="border-t border-border/50 pt-2 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              {t("custom_card.simulation_effects")}
            </span>
            <button
              onClick={() => setShowEffectPicker(!showEffectPicker)}
              className="text-[10px] text-primary hover:text-primary/80 transition-colors"
            >
              + {t("custom_card.add_effect")}
            </button>
          </div>

          {/* Effect picker */}
          <AnimatePresence>
            {showEffectPicker && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-secondary/30 rounded-lg p-3 space-y-2">
                  <p className="text-[9px] text-muted-foreground">{t("custom_card.effect_kpi_label")}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {KPI_EFFECT_OPTIONS.map((opt) => {
                      const alreadyAdded = simEffects.some((e) => e.type === "kpi" && e.key === opt.key);
                      return (
                        <button
                          key={opt.key}
                          onClick={() => addKpiEffect(opt.key, opt.labelKey)}
                          disabled={alreadyAdded}
                          className={`px-2 py-1 rounded text-[10px] transition-colors ${
                            alreadyAdded
                              ? "bg-primary/20 text-primary/50 cursor-not-allowed"
                              : "bg-secondary border border-border hover:border-primary/50 hover:text-primary"
                          }`}
                        >
                          {t(opt.labelKey)}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[9px] text-muted-foreground mt-2">{t("custom_card.effect_account_label")}</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={effectAccountCode}
                      onChange={(e) => setEffectAccountCode(e.target.value)}
                      placeholder={t("custom_card.account_placeholder")}
                      className="w-24 bg-secondary border border-border rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                      onKeyDown={(e) => e.key === "Enter" && addAccountEffect(effectAccountCode)}
                    />
                    <button
                      onClick={() => addAccountEffect(effectAccountCode)}
                      className="px-2 py-1 rounded bg-secondary border border-border text-[10px] hover:border-primary/50 hover:text-primary transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Active effects with live calculation */}
          {simEffects.length > 0 && (
            <div className="space-y-1">
              {calcSimulationEffects(fields, simEffects, getValueForField, (codes, vf) => {
                if (activeView === "combined") {
                  return getFieldValue(ifpRows, codes, vf) + getFieldValue(filatoRows, codes, vf);
                }
                return getFieldValue(activeView === "ifp" ? ifpRows : filatoRows, codes, vf);
              }).map(({ effect, actual, simulated, delta: d }) => (
                <div key={effect.id} className="flex items-center justify-between bg-secondary/20 rounded px-2 py-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[10px] text-cyan-400">{"\u2192"}</span>
                    <span className="text-[10px] truncate">{effect.label}</span>
                    {effect.type === "account" && (
                      <span className="text-[9px] font-mono text-muted-foreground/50">{effect.key}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {effect.type === "account" && actual !== 0 && (
                      <>
                        <Money amount={actual} className="text-[9px] text-muted-foreground/50" />
                        <span className="text-[8px] text-muted-foreground/40">{"\u2192"}</span>
                        <Money amount={simulated} className="text-[10px] text-cyan-400" />
                      </>
                    )}
                    <span className={`text-[10px] font-semibold ${d >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {d >= 0 ? "+" : ""}<Money amount={d} className="inline text-[10px]" />
                    </span>
                    <button
                      onClick={() => removeEffect(effect.id)}
                      className="text-muted-foreground/40 hover:text-red-400 text-[10px] ml-1"
                    >
                      {"\u2715"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
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

      {/* Grouped account picker */}
      <AnimatePresence>
        {showPresets && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-secondary/30 rounded-lg p-3 space-y-2">
              <input
                type="text"
                value={presetSearch}
                onChange={(e) => setPresetSearch(e.target.value)}
                placeholder={t("custom_card.search_accounts")}
                className="w-full bg-secondary border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                autoFocus
              />
              <div className="max-h-60 overflow-y-auto space-y-1">
                {groupedPresets
                  .map((group) => {
                    const search = presetSearch.toLowerCase();
                    const filtered = search
                      ? group.accounts.filter(
                          (a) =>
                            a.cont.includes(search) ||
                            a.denumire.toLowerCase().includes(search)
                        )
                      : group.accounts;
                    if (filtered.length === 0) return null;

                    const isOpen = expandedGroup === group.groupId || !!presetSearch;

                    return (
                      <div key={group.groupId}>
                        <button
                          onClick={() =>
                            setExpandedGroup(isOpen && !presetSearch ? null : group.groupId)
                          }
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-secondary/80 text-left transition-colors"
                        >
                          <span className="text-sm">{group.icon}</span>
                          <span className="text-[11px] font-medium flex-1">
                            {t(`expense_groups.${group.groupId}`, group.groupId)}
                          </span>
                          <span className="text-[9px] text-muted-foreground">
                            {filtered.length}
                          </span>
                          <motion.span
                            className="text-[8px] text-muted-foreground/60"
                            animate={{ rotate: isOpen ? 180 : 0 }}
                            transition={{ duration: 0.15 }}
                          >
                            {"\u25BC"}
                          </motion.span>
                        </button>
                        <AnimatePresence>
                          {isOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.15 }}
                              className="overflow-hidden"
                            >
                              <div className="ml-6 space-y-0.5 border-l-2 border-primary/20 pl-2 py-1">
                                {filtered.map((acc) => (
                                  <button
                                    key={acc.cont}
                                    onClick={() => addGroupedPreset(acc)}
                                    className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-secondary/80 text-left transition-colors"
                                  >
                                    <span className="text-primary font-mono text-[10px] shrink-0">
                                      {acc.cont}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground truncate flex-1">
                                      {acc.denumire}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })
                  .filter(Boolean)}
              </div>
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
  onDuplicate,
  isDragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  card: CustomCard;
  onRemove: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  isDragOver?: boolean;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: () => void;
  onDragEnd?: () => void;
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

  const actualTotal = fieldValues.reduce((s, fv) => s + getSignedValue(fv.field, fv.value), 0);
  const withAdj = hasAnyAdjustments(card.fields);
  const adjustedTotal = withAdj
    ? fieldValues.reduce((s, fv) => s + getAdjustedValue(fv.field, fv.value), 0)
    : actualTotal;
  const delta = adjustedTotal - actualTotal;
  const displayTotal = withAdj ? adjustedTotal : actualTotal;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`rounded-xl bg-card border p-4 relative cursor-grab active:cursor-grabbing transition-all ${
        isDragOver
          ? "border-primary ring-2 ring-primary/30 scale-[1.02]"
          : "border-primary/20"
      }`}
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
          onClick={onDuplicate}
          className="w-6 h-6 rounded-md bg-secondary/80 hover:bg-primary/20 text-muted-foreground hover:text-primary text-[10px] flex items-center justify-center transition-colors"
          title={t("custom_card.duplicate")}
        >
          {"\u2398"}
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

      <div className="text-xl font-bold font-mono font-tabular mb-1">
        <Money amount={displayTotal} />
      </div>

      {/* Actual vs adjusted summary */}
      {withAdj && (
        <div className="flex items-center gap-3 text-[10px] mb-2">
          <span className="text-muted-foreground">
            {t("custom_card.actual_total")}: <Money amount={actualTotal} className="inline text-[10px]" />
          </span>
          <span className={delta >= 0 ? "text-emerald-400" : "text-red-400"}>
            {t("custom_card.delta")}: {delta >= 0 ? "+" : ""}<Money amount={delta} className="inline text-[10px]" />
          </span>
        </div>
      )}

      {/* Field breakdown */}
      <div className="space-y-1 border-t border-border/30 pt-2">
        {fieldValues.map(({ field, value }) => {
          const fieldAdj =
            (field.multiplier !== undefined && field.multiplier !== 100) ||
            (field.customAdjustment !== undefined && field.customAdjustment !== 0);
          const adjVal = fieldAdj ? Math.abs(getAdjustedValue(field, value)) : null;

          return (
            <div key={field.id} className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground flex items-center gap-1 min-w-0 truncate">
                {field.operation === "subtract" && (
                  <span className="text-red-400 font-bold text-[9px] shrink-0">{"\u2212"}</span>
                )}
                {field.type === "account" && (
                  <span className="text-primary/60 font-mono text-[9px] shrink-0">
                    {field.accountCodes}
                  </span>
                )}
                {field.type === "manual" && (
                  <span className="text-amber-500/60 text-[8px] shrink-0">manual</span>
                )}
                {field.type === "partner" && (
                  <span className="text-emerald-500/60 text-[8px] shrink-0">{"\uD83D\uDC64"} {field.partnerCont}</span>
                )}
                <span className={`truncate ${field.operation === "subtract" ? "text-red-400/70" : ""}`}>
                  {field.label}
                </span>
                {fieldAdj && (
                  <span className="text-amber-400/60 text-[8px] shrink-0">
                    {field.multiplier !== undefined && field.multiplier !== 100 ? `${field.multiplier}%` : ""}
                  </span>
                )}
              </span>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                {fieldAdj && (
                  <Money
                    amount={value}
                    className="text-[9px] text-muted-foreground/50 line-through"
                  />
                )}
                <Money
                  amount={adjVal ?? value}
                  className={`text-[10px] font-semibold ${
                    field.operation === "subtract" ? "text-red-400" : fieldAdj ? "text-amber-400" : ""
                  }`}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Tax impact */}
      {withAdj && (() => {
        const taxImpact = calcTaxImpact(card.fields, getValueForField);
        if (Math.abs(taxImpact) < 1) return null;
        return (
          <div className="flex items-center justify-between text-[9px] text-muted-foreground/60 border-t border-border/20 pt-1 mt-2">
            <span>{t("custom_card.tax_impact")}</span>
            <span className={taxImpact >= 0 ? "text-emerald-400/60" : "text-red-400/60"}>
              {taxImpact >= 0 ? "+" : ""}<Money amount={taxImpact} className="inline text-[9px]" />
            </span>
          </div>
        );
      })()}

      {/* Simulation effects */}
      {withAdj && card.simulationEffects && card.simulationEffects.length > 0 && (
        <div className="border-t border-border/20 pt-1.5 mt-2 space-y-1">
          <p className="text-[8px] text-muted-foreground/50 uppercase tracking-wider">
            {t("custom_card.simulation_effects")}
          </p>
          {calcSimulationEffects(card.fields, card.simulationEffects, getValueForField, (codes, vf) => {
            if (activeView === "combined") {
              return getFieldValue(ifpRows, codes, vf) + getFieldValue(filatoRows, codes, vf);
            }
            return getFieldValue(activeView === "ifp" ? ifpRows : filatoRows, codes, vf);
          }).map(({ effect, actual, simulated, delta: d }) => (
            <div key={effect.id} className="flex items-center justify-between text-[9px]">
              <span className="text-muted-foreground/70 flex items-center gap-1 min-w-0 truncate">
                <span className="text-cyan-400/60">{"\u2192"}</span>
                <span className="truncate">{effect.label}</span>
              </span>
              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                {effect.type === "account" && actual !== 0 && (
                  <>
                    <Money amount={actual} className="text-[8px] text-muted-foreground/40" />
                    <span className="text-[7px] text-muted-foreground/30">{"\u2192"}</span>
                    <Money amount={simulated} className="text-[9px] text-cyan-400/70" />
                  </>
                )}
                <span className={`font-semibold ${d >= 0 ? "text-emerald-400/70" : "text-red-400/70"}`}>
                  {d >= 0 ? "+" : ""}<Money amount={d} className="inline text-[9px]" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
