import {
  Customer,
  Purchase,
  Payment,
  Loan,
  Archive,
  SystemSettings,
  ActivityLog,
  BackupRecord,
  MonthlyBudget,
  CreditCardEntry
} from "./types";

const API_BASE = "/api";

export const getAuthToken = (): string | null => {
  return localStorage.getItem("pfms_token");
};

export const setAuthToken = (token: string | null) => {
  if (token) {
    localStorage.setItem("pfms_token", token);
  } else {
    localStorage.removeItem("pfms_token");
  }
};

export const getDisplayName = (): string | null => {
  return localStorage.getItem("pfms_display_name");
};

export const setDisplayName = (name: string | null) => {
  if (name) {
    localStorage.setItem("pfms_display_name", name);
  } else {
    localStorage.removeItem("pfms_display_name");
  }
};

const getHeaders = (): HeadersInit => {
  const token = getAuthToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
};

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 401 || response.status === 403) {
    setAuthToken(null);
    window.dispatchEvent(new Event("auth-expired"));
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Session expired. Please log in again.");
  }
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Request failed with status ${response.status}`);
  }
  
  return response.json() as Promise<T>;
}

export const api = {
  // Authentication
  async login(username: string, password: string): Promise<{ success: boolean; token: string; displayName: string }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    return handleResponse(res);
  },

  async verify(token: string): Promise<{ valid: boolean }> {
    const res = await fetch(`${API_BASE}/auth/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token })
    });
    return handleResponse(res);
  },

  async changePassword(data: { oldPassword: string; newPassword: string }): Promise<{ success: boolean; token: string }> {
    const res = await fetch(`${API_BASE}/auth/change-password`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  async updateDisplayName(displayName: string): Promise<{ success: boolean; token: string; displayName: string }> {
    const res = await fetch(`${API_BASE}/auth/display-name`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify({ displayName })
    });
    return handleResponse(res);
  },

  // Settings
  async getSettings(): Promise<SystemSettings> {
    const res = await fetch(`${API_BASE}/settings`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async updateSettings(settings: Partial<SystemSettings>): Promise<{ success: boolean; settings: SystemSettings }> {
    const res = await fetch(`${API_BASE}/settings`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(settings)
    });
    return handleResponse(res);
  },

  // Billing Cycles
  async getBillingCycles(): Promise<{ activeCycle: string; cycles: string[] }> {
    const res = await fetch(`${API_BASE}/billing-cycles`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async completeBillingCycle(): Promise<{ success: boolean; nextCycle: string }> {
    const res = await fetch(`${API_BASE}/billing-cycles/complete`, {
      method: "POST",
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  // Customers
  async getCustomers(): Promise<Customer[]> {
    const res = await fetch(`${API_BASE}/customers`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async createCustomer(customer: Partial<Customer>): Promise<Customer> {
    const res = await fetch(`${API_BASE}/customers`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(customer)
    });
    return handleResponse(res);
  },

  async updateCustomer(id: string, customer: Partial<Customer>): Promise<Customer> {
    const res = await fetch(`${API_BASE}/customers/${id}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(customer)
    });
    return handleResponse(res);
  },

  async deleteCustomer(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/customers/${id}`, {
      method: "DELETE",
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  // Purchases
  async getPurchases(): Promise<Purchase[]> {
    const res = await fetch(`${API_BASE}/purchases`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async createPurchase(purchase: Partial<Purchase>): Promise<{ purchase: Purchase; updatedCustomer: Customer | null }> {
    const res = await fetch(`${API_BASE}/purchases`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(purchase)
    });
    return handleResponse(res);
  },

  async updatePurchase(id: string, purchase: Partial<Purchase>): Promise<{ purchase: Purchase; updatedCustomer: Customer | null }> {
    const res = await fetch(`${API_BASE}/purchases/${id}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(purchase)
    });
    return handleResponse(res);
  },

  async deletePurchase(id: string): Promise<{ success: boolean; updatedCustomer: Customer | null }> {
    const res = await fetch(`${API_BASE}/purchases/${id}`, {
      method: "DELETE",
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  // Payments
  async getPayments(): Promise<Payment[]> {
    const res = await fetch(`${API_BASE}/payments`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async createPayment(payment: Partial<Payment>): Promise<{ payment: Payment; updatedCustomer: Customer | null }> {
    const res = await fetch(`${API_BASE}/payments`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(payment)
    });
    return handleResponse(res);
  },

  async updatePayment(id: string, payment: Partial<Payment>): Promise<{ payment: Payment; updatedCustomer: Customer | null }> {
    const res = await fetch(`${API_BASE}/payments/${id}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(payment)
    });
    return handleResponse(res);
  },

  async deletePayment(id: string): Promise<{ success: boolean; updatedCustomer: Customer | null }> {
    const res = await fetch(`${API_BASE}/payments/${id}`, {
      method: "DELETE",
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  // Loans
  async getLoans(): Promise<Loan[]> {
    const res = await fetch(`${API_BASE}/loans`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async createLoan(loan: Partial<Loan>): Promise<Loan> {
    const res = await fetch(`${API_BASE}/loans`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(loan)
    });
    return handleResponse(res);
  },

  async updateLoan(id: string, loan: Partial<Loan>): Promise<Loan> {
    const res = await fetch(`${API_BASE}/loans/${id}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(loan)
    });
    return handleResponse(res);
  },

  async deleteLoan(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/loans/${id}`, {
      method: "DELETE",
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  // Loan Payments
  async createLoanPayment(loanId: string, payment: { paymentDate: string; amountPaid: number; paymentMethod: string; notes?: string }): Promise<Loan> {
    const res = await fetch(`${API_BASE}/loans/${loanId}/payments`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(payment)
    });
    return handleResponse(res);
  },

  async updateLoanPayment(loanId: string, paymentId: string, payment: { paymentDate?: string; amountPaid?: number; paymentMethod?: string; notes?: string }): Promise<Loan> {
    const res = await fetch(`${API_BASE}/loans/${loanId}/payments/${paymentId}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(payment)
    });
    return handleResponse(res);
  },

  async deleteLoanPayment(loanId: string, paymentId: string): Promise<Loan> {
    const res = await fetch(`${API_BASE}/loans/${loanId}/payments/${paymentId}`, {
      method: "DELETE",
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  // Archives
  async getArchives(): Promise<Archive[]> {
    const res = await fetch(`${API_BASE}/archives`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async restoreArchive(id: string): Promise<{ success: boolean; restoredCycle: string }> {
    const res = await fetch(`${API_BASE}/archives/${id}/restore`, {
      method: "POST",
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  // Activity Logs
  async getLogs(): Promise<ActivityLog[]> {
    const res = await fetch(`${API_BASE}/logs`, { headers: getHeaders() });
    return handleResponse(res);
  },

  // Backups
  async getBackups(): Promise<BackupRecord[]> {
    const res = await fetch(`${API_BASE}/backups`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async createBackup(): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/backups`, {
      method: "POST",
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  async restoreBackup(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/backups/${id}/restore`, {
      method: "POST",
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  async deleteBackup(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/backups/${id}`, {
      method: "DELETE",
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  async importBackup(data: any): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/backups/import`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  async seedSPayLater(): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/backups/seed-spaylater`, {
      method: "POST",
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  // Budgets API
  async getBudgets(): Promise<MonthlyBudget[]> {
    const res = await fetch(`${API_BASE}/budgets`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async updateBudgetConfig(data: { month: string; salary: number; additionalIncome: number }): Promise<MonthlyBudget> {
    const res = await fetch(`${API_BASE}/budgets/current`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  async addBudgetAllocation(data: { month: string; category: string; allocatedAmount: number }): Promise<MonthlyBudget> {
    const res = await fetch(`${API_BASE}/budgets/allocations`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  async updateBudgetAllocation(id: string, data: { month: string; category?: string; allocatedAmount?: number }): Promise<MonthlyBudget> {
    const res = await fetch(`${API_BASE}/budgets/allocations/${id}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  async deleteBudgetAllocation(id: string, month: string): Promise<MonthlyBudget> {
    const res = await fetch(`${API_BASE}/budgets/allocations/${id}?month=${encodeURIComponent(month)}`, {
      method: "DELETE",
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  async addBudgetExpense(data: { month: string; allocationId: string; itemName: string; amount: number; date?: string; notes?: string }): Promise<MonthlyBudget> {
    const res = await fetch(`${API_BASE}/budgets/expenses`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  async deleteBudgetExpense(id: string, month: string): Promise<MonthlyBudget> {
    const res = await fetch(`${API_BASE}/budgets/expenses/${id}?month=${encodeURIComponent(month)}`, {
      method: "DELETE",
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  async rolloverBudget(data: { sourceMonth: string; targetMonth: string }): Promise<MonthlyBudget> {
    const res = await fetch(`${API_BASE}/budgets/reset`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  // Credit Card API - a data type distinct from SPayLater/Lending/Budget
  async getCreditCardEntries(): Promise<CreditCardEntry[]> {
    const res = await fetch(`${API_BASE}/credit-card`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async createCreditCardEntry(entry: Partial<CreditCardEntry>): Promise<CreditCardEntry> {
    const res = await fetch(`${API_BASE}/credit-card`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(entry)
    });
    return handleResponse(res);
  },

  async updateCreditCardEntry(id: string, entry: Partial<CreditCardEntry>): Promise<CreditCardEntry> {
    const res = await fetch(`${API_BASE}/credit-card/${id}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(entry)
    });
    return handleResponse(res);
  },

  async deleteCreditCardEntry(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/credit-card/${id}`, {
      method: "DELETE",
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  getExportUrl(): string {
    const token = getAuthToken();
    return `${API_BASE}/backups/export?token=${token || ""}`;
  }
};
