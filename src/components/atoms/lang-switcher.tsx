"use client";

import { useTranslation } from "react-i18next";

const LANGUAGES = [
  { code: "ro", flag: "\uD83C\uDDF7\uD83C\uDDF4", label: "RO" },
  { code: "en", flag: "\uD83C\uDDEC\uD83C\uDDE7", label: "EN" },
  { code: "it", flag: "\uD83C\uDDEE\uD83C\uDDF9", label: "IT" },
];

export function LangSwitcher() {
  const { i18n } = useTranslation();

  return (
    <div className="flex items-center gap-1 rounded-lg bg-secondary/50 p-1">
      {LANGUAGES.map(({ code, flag, label }) => (
        <button
          key={code}
          onClick={() => i18n.changeLanguage(code)}
          className={`px-2 py-1 rounded-md text-xs transition-all ${
            i18n.language === code
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          title={label}
        >
          {flag}
        </button>
      ))}
    </div>
  );
}
