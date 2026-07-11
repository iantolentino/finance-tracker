export interface Customer {
  id: string;
  fullName: string;
  contactNumber: string;
  messengerLink: string;
  notes: string;
  status: "Active" | "Fully Paid" | "Overdue";
  carriedOverBalance: number;
  billingCycle: string;
  createdAt: string;
}

export interface Purchase {
  id: string;
  customerId: string;
  itemName: string;
  description: string;
  quantity: number;
  purchaseDate: string;
  originalCost: number;
  totalAmount: number;
  dueDate: string;
  installmentMonths: number;
  remarks: string;
  billingCycle: string;
}

export interface Payment {
  id: string;
  customerId: string;
  paymentDate: string;
  amountPaid: number;
  paymentMethod: string;
  notes: string;
  billingCycle: string;
}

export interface LoanPayment {
  id: string;
  paymentDate: string;
  amountPaid: number;
  paymentMethod: string;
  notes: string;
}

export interface Loan {
  id: string;
  borrowerName: string;
  contactNumber: string;
  address: string;
  principalAmount: number;
  loanDate: string;
  dueDate: string;
  paymentSchedule: string;
  interestType: "Fixed Amount" | "Percentage";
  interestValue: number;
  status: "Active" | "Completed" | "Overdue";
  notes: string;
  payments: LoanPayment[];
  createdAt: string;
}

export interface Archive {
  id: string;
  cycle: string;
  archivedAt: string;
  data: {
    customers: Customer[];
    purchases: Purchase[];
    payments: Payment[];
  };
}

export interface SystemSettings {
  currency: string;
  theme: "light" | "dark";
  personalBusinessName: string;
  defaultBillingDate: string;
  defaultDueDate: string;
  backupPreference: "manual" | "daily" | "disabled";
}

export interface ActivityLog {
  id: string;
  action: string;
  details: string;
  timestamp: string;
}

export interface BackupRecord {
  id: string;
  filename: string;
  type: "automatic" | "manual";
  createdAt: string;
  size: number;
}

export interface BudgetAllocation {
  id: string;
  category: string;
  allocatedAmount: number;
  spentAmount: number;
}

export interface BudgetExpense {
  id: string;
  allocationId: string;
  itemName: string;
  amount: number;
  date: string;
  notes: string;
}

export interface MonthlyBudget {
  id: string;
  month: string;
  salary: number;
  additionalIncome: number;
  allocations: BudgetAllocation[];
  expenses: BudgetExpense[];
  createdAt: string;
}

