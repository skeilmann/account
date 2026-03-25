import type { CompanyId } from "./company";

export interface ExpenseGroupDefinition {
  id: string;
  icon: string;
  /** Account codes that belong to this group (class 6 expenses) */
  accounts: string[];
  /** Related balance sheet accounts for cross-validation */
  relatedBalanceAccounts?: string[];
}

export interface ExpenseGroupValue {
  definition: ExpenseGroupDefinition;
  totalAmount: number;
  perCompany: Record<CompanyId, number>;
  percentOfExpenses: number;
  percentOfRevenue: number;
}

export const EXPENSE_GROUP_DEFINITIONS: ExpenseGroupDefinition[] = [
  {
    id: "marfa",
    icon: "\uD83E\uDDF6",
    accounts: ["607"],
    relatedBalanceAccounts: ["371"],
  },
  {
    id: "transport",
    icon: "\uD83D\uDE9A",
    accounts: ["624"],
  },
  {
    id: "administrative",
    icon: "\uD83C\uDFE2",
    accounts: ["626", "627", "628"],
  },
  {
    id: "personal",
    icon: "\uD83D\uDC65",
    accounts: ["641", "6422", "6458", "6461"],
  },
  {
    id: "financiare",
    icon: "\uD83D\uDCB1",
    accounts: ["6651", "667"],
  },
  {
    id: "amortizari",
    icon: "\uD83D\uDCC9",
    accounts: ["6811"],
  },
  {
    id: "combustibil_materiale",
    icon: "\u26FD",
    accounts: ["6022", "6024", "6028", "603", "604"],
  },
  {
    id: "chirii_asigurari",
    icon: "\uD83C\uDFE0",
    accounts: ["6123", "613"],
  },
  {
    id: "taxe",
    icon: "\uD83C\uDFDB\uFE0F",
    accounts: ["635", "691"],
  },
  {
    id: "intretinere",
    icon: "\uD83D\uDD27",
    accounts: ["611"],
  },
  {
    id: "marketing",
    icon: "\uD83D\uDCE3",
    accounts: ["623"],
  },
  {
    id: "altele",
    icon: "\uD83D\uDCCB",
    accounts: ["6051", "625", "6231", "6581", "6583"],
  },
];

/** Revenue group definitions — mirrors expense groups but for class 7 accounts */
export type RevenueGroupDefinition = ExpenseGroupDefinition;
export type RevenueGroupValue = ExpenseGroupValue;

export const REVENUE_GROUP_DEFINITIONS: RevenueGroupDefinition[] = [
  {
    id: "vanzari_marfa",
    icon: "\uD83E\uDDF6",
    accounts: ["707"],
  },
  {
    id: "venituri_servicii",
    icon: "\uD83D\uDD27",
    accounts: ["704"],
  },
  {
    id: "alte_venituri_exploatare",
    icon: "\uD83D\uDCE6",
    accounts: ["758", "7588"],
  },
  {
    id: "venituri_financiare",
    icon: "\uD83D\uDCB0",
    accounts: ["766", "767", "768"],
  },
  {
    id: "reduceri_comerciale",
    icon: "\uD83C\uDFF7\uFE0F",
    accounts: ["709"],
  },
];
