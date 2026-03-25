"use client";

import { useCallback, useState } from "react";
import { useDataStore } from "@/stores/data-store";
import { useTranslation } from "react-i18next";

export function FileUpload() {
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const setBalanta = useDataStore((s) => s.setBalanta);
  const setBalantaDetaliata = useDataStore((s) => s.setBalantaDetaliata);
  const setStock = useDataStore((s) => s.setStock);
  const { t } = useTranslation("common");

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files) return;
      setUploading(true);
      setResults([]);

      const newResults: string[] = [];

      for (const file of Array.from(files)) {
        try {
          const formData = new FormData();
          formData.append("file", file);

          const isPdf = file.name.toLowerCase().endsWith(".pdf");
          const isExcel =
            file.name.toLowerCase().endsWith(".xls") ||
            file.name.toLowerCase().endsWith(".xlsx");

          if (isPdf) {
            const res = await fetch("/api/parse-balanta", {
              method: "POST",
              body: formData,
            });
            const json = await res.json();
            if (json.success) {
              if (json.type === "detailed") {
                setBalantaDetaliata(json.data.companyId, json.data);
                newResults.push(
                  `\u2705 ${file.name}: ${json.summary.company} — ${json.summary.totalEntries} sub-conturi (detaliat)`
                );
              } else {
                setBalanta(json.data.companyId, json.data);
                newResults.push(
                  `\u2705 ${file.name}: ${json.summary.company} — ${json.summary.totalAccounts} conturi`
                );
              }
            } else {
              newResults.push(`\u274C ${file.name}: ${json.error}`);
            }
          } else if (isExcel) {
            const res = await fetch("/api/parse-stock", {
              method: "POST",
              body: formData,
            });
            const json = await res.json();
            if (json.success) {
              setStock(json.data.companyId, json.data);
              newResults.push(
                `\u2705 ${file.name}: ${json.summary.company} — ${json.summary.totalProducts} produse`
              );
            } else {
              newResults.push(`\u274C ${file.name}: ${json.error}`);
            }
          } else {
            newResults.push(
              `\u26A0\uFE0F ${file.name}: format necunoscut (acceptam .pdf, .xls, .xlsx)`
            );
          }
        } catch (err) {
          newResults.push(
            `\u274C ${file.name}: ${err instanceof Error ? err.message : "eroare"}`
          );
        }
      }

      setResults(newResults);
      setUploading(false);
    },
    [setBalanta, setBalantaDetaliata, setStock]
  );

  return (
    <div className="rounded-xl bg-card border border-border border-dashed p-8 text-center">
      <input
        type="file"
        multiple
        accept=".pdf,.xls,.xlsx"
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
        id="file-upload"
      />
      <label
        htmlFor="file-upload"
        className="cursor-pointer flex flex-col items-center gap-3"
      >
        <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-xl">
          {uploading ? "\u23F3" : "\uD83D\uDCC2"}
        </div>
        <p className="text-sm text-muted-foreground">
          {uploading
            ? "Se procesează..."
            : t("status.upload_prompt")}
        </p>
        <p className="text-xs text-muted-foreground/60">
          Balanța de verificare (PDF) + Balanța stocului (XLS)
        </p>
      </label>

      {results.length > 0 && (
        <div className="mt-4 text-left space-y-1">
          {results.map((r, i) => (
            <p key={i} className="text-xs">
              {r}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
