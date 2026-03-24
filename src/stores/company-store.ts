import { create } from "zustand";
import type { CompanyView } from "@/types/company";

interface CompanyState {
  activeView: CompanyView;
  setView: (view: CompanyView) => void;
}

export const useCompanyStore = create<CompanyState>((set) => ({
  activeView: "combined",
  setView: (view) => set({ activeView: view }),
}));
