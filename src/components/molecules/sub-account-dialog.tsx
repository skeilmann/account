"use client";

import { useState, useCallback, useMemo, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, ArrowUpDown } from "lucide-react";
import { Money } from "@/components/atoms/money";
import { useDataStore } from "@/stores/data-store";
import { useCompanyStore } from "@/stores/company-store";
import type { DetailedAccountEntry } from "@/types/balanta-detaliata";
import { useTranslation } from "react-i18next";

type SortField = "cont" | "denumire" | "soldFinal" | "rulaje";
type SortDir = "asc" | "desc";

interface SubAccountDialogProps {
  /** Parent account code, e.g. "401" */
  parentCont: string;
  /** Display name, e.g. "Furnizori" */
  parentName: string;
  /** Which balance side to emphasize: D=debit (receivable), C=credit (payable) */
  side: "D" | "C";
  /** The clickable trigger element */
  children: ReactNode;
}

export function SubAccountDialog({
  parentCont,
  parentName,
  side,
  children,
}: SubAccountDialogProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("soldFinal");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const { i18n } = useTranslation();
  const lang = i18n.language;

  const getSubAccounts = useDataStore((s) => s.getSubAccounts);
  const { activeView } = useCompanyStore();

  const entries = useMemo(
    () => getSubAccounts(parentCont, activeView),
    [getSubAccounts, parentCont, activeView]
  );

  const hasDetail = entries.length > 0;

  const handleOpen = useCallback(() => {
    if (hasDetail) {
      setOpen(true);
      setSearch("");
    }
  }, [hasDetail]);

  const handleClose = useCallback(() => setOpen(false), []);

  const toggleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDir("desc");
      }
    },
    [sortField]
  );

  const getSoldValue = useCallback(
    (e: DetailedAccountEntry) =>
      side === "D" ? e.soldFinalD : e.soldFinalC,
    [side]
  );

  const getRulajValue = useCallback(
    (e: DetailedAccountEntry) =>
      side === "D" ? e.rulajePerioadaD : e.rulajePerioadaC,
    [side]
  );

  const filtered = useMemo(() => {
    let result = entries;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.denumire.toLowerCase().includes(q) ||
          e.cont.toLowerCase().includes(q)
      );
    }

    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "cont":
          cmp = a.cont.localeCompare(b.cont);
          break;
        case "denumire":
          cmp = a.denumire.localeCompare(b.denumire);
          break;
        case "soldFinal":
          cmp = getSoldValue(a) - getSoldValue(b);
          break;
        case "rulaje":
          cmp = getRulajValue(a) - getRulajValue(b);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [entries, search, sortField, sortDir, getSoldValue, getRulajValue]);

  const totalSold = useMemo(
    () => entries.reduce((sum, e) => sum + getSoldValue(e), 0),
    [entries, getSoldValue]
  );

  return (
    <>
      <div
        onClick={handleOpen}
        className={hasDetail ? "cursor-pointer group" : ""}
        role={hasDetail ? "button" : undefined}
        tabIndex={hasDetail ? 0 : undefined}
        onKeyDown={
          hasDetail
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleOpen();
                }
              }
            : undefined
        }
      >
        {children}
        {hasDetail && (
          <div className="text-[9px] text-primary/60 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {lang === "en"
              ? `Click for ${entries.length} sub-accounts`
              : `Click pentru ${entries.length} sub-conturi`}
          </div>
        )}
      </div>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={handleClose}
              onKeyDown={(e) => {
                if (e.key === "Escape") handleClose();
              }}
            />

            {/* Dialog */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="relative w-full max-w-2xl max-h-[75vh] bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden"
              role="dialog"
              aria-modal="true"
              aria-label={`${parentName} — ${lang === "en" ? "Sub-accounts" : "Sub-conturi"}`}
              onKeyDown={(e) => {
                if (e.key === "Escape") handleClose();
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div>
                  <h2 className="text-sm font-semibold">
                    {parentName}
                    <span className="text-muted-foreground font-mono ml-2 text-xs">
                      {parentCont}
                    </span>
                  </h2>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span>
                      {entries.length}{" "}
                      {lang === "en" ? "sub-accounts" : "sub-conturi"}
                    </span>
                    <span>
                      {lang === "en" ? "Total" : "Total"}:{" "}
                      <Money
                        amount={totalSold}
                        className="text-xs font-semibold text-foreground"
                      />
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search */}
              <div className="px-4 py-2 border-b border-border/50">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={
                      lang === "en" ? "Search by name..." : "Cauta dupa nume..."
                    }
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-secondary/50 border border-border/50 rounded-lg focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/50"
                    autoFocus
                  />
                </div>
              </div>

              {/* Table */}
              <div className="flex-1 overflow-y-auto">
                {/* Column headers */}
                <div className="sticky top-0 bg-card/95 backdrop-blur-sm border-b border-border/50 px-4 py-1.5 flex items-center gap-2 text-[10px] text-muted-foreground font-medium">
                  <SortHeader
                    label={lang === "en" ? "Code" : "Cod"}
                    field="cont"
                    current={sortField}
                    dir={sortDir}
                    onSort={toggleSort}
                    className="w-20 shrink-0"
                  />
                  <SortHeader
                    label={lang === "en" ? "Name" : "Denumire"}
                    field="denumire"
                    current={sortField}
                    dir={sortDir}
                    onSort={toggleSort}
                    className="flex-1 min-w-0"
                  />
                  <SortHeader
                    label={
                      lang === "en" ? "Period mov." : "Rulaj per."
                    }
                    field="rulaje"
                    current={sortField}
                    dir={sortDir}
                    onSort={toggleSort}
                    className="w-24 text-right shrink-0"
                  />
                  <SortHeader
                    label={
                      lang === "en" ? "Final bal." : "Sold final"
                    }
                    field="soldFinal"
                    current={sortField}
                    dir={sortDir}
                    onSort={toggleSort}
                    className="w-28 text-right shrink-0"
                  />
                </div>

                {/* Rows */}
                <div className="divide-y divide-border/30">
                  {filtered.map((entry) => {
                    const soldVal = getSoldValue(entry);
                    const rulajVal = getRulajValue(entry);

                    return (
                      <div
                        key={entry.cont}
                        className="px-4 py-1.5 flex items-center gap-2 hover:bg-secondary/30 transition-colors"
                      >
                        <span className="w-20 shrink-0 font-mono text-[10px] text-primary/70">
                          {entry.cont}
                        </span>
                        <span className="flex-1 min-w-0 text-[11px] truncate">
                          {entry.denumire}
                        </span>
                        <span className="w-24 text-right shrink-0">
                          {rulajVal !== 0 ? (
                            <Money
                              amount={rulajVal}
                              className="text-[10px] text-muted-foreground"
                            />
                          ) : (
                            <span className="text-[10px] text-muted-foreground/30">
                              —
                            </span>
                          )}
                        </span>
                        <span className="w-28 text-right shrink-0">
                          {soldVal !== 0 ? (
                            <Money
                              amount={soldVal}
                              className={`text-[11px] font-semibold ${
                                soldVal > 0
                                  ? side === "D"
                                    ? "text-emerald-400"
                                    : "text-red-400"
                                  : "text-amber-400"
                              }`}
                            />
                          ) : (
                            <span className="text-[10px] text-muted-foreground/30">
                              —
                            </span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {filtered.length === 0 && (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    {search
                      ? lang === "en"
                        ? "No results found"
                        : "Niciun rezultat gasit"
                      : lang === "en"
                        ? "No sub-account data available"
                        : "Nu exista date sub-cont"}
                  </div>
                )}
              </div>

              {/* Footer with count */}
              {search && filtered.length !== entries.length && (
                <div className="px-4 py-2 border-t border-border/50 text-[10px] text-muted-foreground">
                  {lang === "en"
                    ? `Showing ${filtered.length} of ${entries.length}`
                    : `Se afiseaza ${filtered.length} din ${entries.length}`}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

function SortHeader({
  label,
  field,
  current,
  dir,
  onSort,
  className,
}: {
  label: string;
  field: SortField;
  current: SortField;
  dir: SortDir;
  onSort: (f: SortField) => void;
  className?: string;
}) {
  const isActive = current === field;
  return (
    <button
      onClick={() => onSort(field)}
      className={`flex items-center gap-0.5 hover:text-foreground transition-colors ${className ?? ""}`}
    >
      <span>{label}</span>
      <ArrowUpDown
        className={`w-2.5 h-2.5 ${isActive ? "text-primary" : "opacity-30"}`}
      />
      {isActive && (
        <span className="text-primary text-[8px]">
          {dir === "asc" ? "↑" : "↓"}
        </span>
      )}
    </button>
  );
}
