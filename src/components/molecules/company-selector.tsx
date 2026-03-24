"use client";

import { useCompanyStore } from "@/stores/company-store";
import { COMPANY_VIEW_COLORS, type CompanyView } from "@/types/company";
import { useTranslation } from "react-i18next";

const VIEWS: CompanyView[] = ["ifp", "filato", "combined"];

export function CompanySelector() {
  const { activeView, setView } = useCompanyStore();
  const { t } = useTranslation("common");

  return (
    <div className="flex items-center gap-1 rounded-lg bg-secondary/50 p-1">
      {VIEWS.map((view) => {
        const isActive = activeView === view;
        const color = COMPANY_VIEW_COLORS[view];
        const label =
          view === "combined"
            ? t("company.combined")
            : view === "ifp"
              ? "IFP"
              : "FILATO";

        return (
          <button
            key={view}
            onClick={() => setView(view)}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{
              backgroundColor: isActive ? color : "transparent",
              color: isActive ? "#0f1117" : "#94a3b8",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
