import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import roCommon from "../../../public/locales/ro/common.json";
import roAccounts from "../../../public/locales/ro/accounts.json";
import roDashboard from "../../../public/locales/ro/dashboard.json";
import roLegislation from "../../../public/locales/ro/legislation.json";

import enCommon from "../../../public/locales/en/common.json";
import enAccounts from "../../../public/locales/en/accounts.json";
import enDashboard from "../../../public/locales/en/dashboard.json";
import enLegislation from "../../../public/locales/en/legislation.json";

import itCommon from "../../../public/locales/it/common.json";
import itAccounts from "../../../public/locales/it/accounts.json";
import itDashboard from "../../../public/locales/it/dashboard.json";
import itLegislation from "../../../public/locales/it/legislation.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ro: {
        common: roCommon,
        accounts: roAccounts,
        dashboard: roDashboard,
        legislation: roLegislation,
      },
      en: {
        common: enCommon,
        accounts: enAccounts,
        dashboard: enDashboard,
        legislation: enLegislation,
      },
      it: {
        common: itCommon,
        accounts: itAccounts,
        dashboard: itDashboard,
        legislation: itLegislation,
      },
    },
    fallbackLng: "ro",
    defaultNS: "common",
    ns: ["common", "accounts", "dashboard", "legislation"],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
    },
  });

export default i18n;
