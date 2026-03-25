import { create } from "zustand";

export interface PendingCardField {
  id: string;
  label: string;
  type: "account" | "manual" | "partner";
  accountCodes?: string;
  valueField?: "sumeTotaleD" | "sumeTotaleC" | "soldFinalD" | "soldFinalC";
  manualValue?: number;
  partnerCont?: string;
  partnerParent?: string;
}

interface CustomCardStore {
  pendingField: PendingCardField | null;
  setPendingField: (field: PendingCardField | null) => void;
}

export const useCustomCardStore = create<CustomCardStore>((set) => ({
  pendingField: null,
  setPendingField: (field) => set({ pendingField: field }),
}));
