export type CompanyId = "ifp" | "filato";
export type CompanyView = CompanyId | "combined";

export interface Company {
  id: CompanyId;
  name: string;
  cui: string;
  regCom: string;
  address: string;
  capitalSocial: number;
  color: string;
}

export const COMPANIES: Record<CompanyId, Company> = {
  ifp: {
    id: "ifp",
    name: "IFP FILATI PREGIATI S.R.L.",
    cui: "RO47181930",
    regCom: "J27/1408/2022",
    address: "Piatra Neamt, str. Erou Apetrei nr. 23, jud. Neamt",
    capitalSocial: 200,
    color: "#3b82f6",
  },
  filato: {
    id: "filato",
    name: "FILATO A MODO TUO S.R.L.",
    cui: "RO48445070",
    regCom: "J27/682/2023",
    address:
      "Piatra Neamt, Aleea Paltinilor nr. 6, bl. C4, ap. 39, cod 610174, jud. Neamt",
    capitalSocial: 200,
    color: "#14b8a6",
  },
};

export const COMPANY_VIEW_COLORS: Record<CompanyView, string> = {
  ifp: "#3b82f6",
  filato: "#14b8a6",
  combined: "#f59e0b",
};
