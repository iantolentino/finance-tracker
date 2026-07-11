import "dotenv/config";
import express from "express";
import seedData from "../spaylater_import.json";
import { readDb, writeDb, writeDbBatch, listBackups, readBackup, writeBackup, deleteBackup } from "./githubStore.js";

export const app = express();

// ==========================================
// DEFAULTS (used when a data file doesn't exist yet in the GitHub repo)
// ==========================================

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function currentCycleLabel(): string {
  const now = new Date();
  return `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;
}

function defaultBillingCycles() {
  const label = currentCycleLabel();
  return { activeCycle: label, cycles: [label] };
}

const DEFAULT_SETTINGS = {
  masterPassword: "admin",
  currency: "PHP",
  theme: "light",
  personalBusinessName: "Personal Finance Management System",
  defaultBillingDate: "15",
  defaultDueDate: "30",
  backupPreference: "manual"
};

function defaultActivityLogs() {
  return [
    {
      id: "log-init",
      action: "System Initialized",
      details: "Personal Finance Management System successfully started.",
      timestamp: new Date().toISOString()
    }
  ];
}

// ==========================================
// HELPERS
// ==========================================

// Parses a numeric field on update, keeping the existing value only when the
// field is genuinely absent - unlike `parseFloat(x) || existing`, this lets
// a value be edited down to 0 instead of silently reverting.
const numOrExisting = (value: any, existing: number): number => {
  if (value === undefined) return existing;
  const n = parseFloat(value);
  return Number.isNaN(n) ? existing : n;
};

// Wraps an async route handler so thrown errors / rejected promises reach
// Express's error middleware instead of crashing the function or hanging.
const h = (fn: express.RequestHandler): express.RequestHandler => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const addLog = async (action: string, details: string) => {
  const logs = await readDb("activity_logs.json", defaultActivityLogs());
  const newLog = {
    id: "log-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
    action,
    details,
    timestamp: new Date().toISOString()
  };
  logs.unshift(newLog);
  await writeDb("activity_logs.json", logs.slice(0, 100));
};

// Create a bundled system backup
const createSystemBackup = async (isAuto = false) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const prefix = isAuto ? "auto_" : "manual_";
  const dateString = new Date().toISOString().split("T")[0];
  const filename = `${prefix}${dateString}_${timestamp.substring(11, 19).replace(/-/g, "")}.json`;

  const [settings, billingCycles, customers, purchases, payments, loans, budgets, archives, activityLogs] =
    await Promise.all([
      readDb("settings.json", DEFAULT_SETTINGS),
      readDb("billing_cycles.json", defaultBillingCycles()),
      readDb("customers.json", []),
      readDb("purchases.json", []),
      readDb("payments.json", []),
      readDb("loans.json", []),
      readDb("budgets.json", []),
      readDb("archives.json", []),
      readDb("activity_logs.json", defaultActivityLogs())
    ]);

  const backupData = {
    timestamp: new Date().toISOString(),
    type: isAuto ? "automatic" : "manual",
    settings,
    billingCycles,
    customers,
    purchases,
    payments,
    loans,
    budgets,
    archives,
    activityLogs
  };

  await writeBackup(filename, backupData);
  console.log(`Backup created: ${filename}`);
};

// Auto backup helper: once per day, if settings.backupPreference !== "disabled".
// Runs on login only (not on every write) to avoid piling extra GitHub API
// calls / latency onto every single request.
const checkAndTriggerAutoBackup = async () => {
  const settings = await readDb("settings.json", DEFAULT_SETTINGS);
  if (settings.backupPreference === "disabled") return;

  const backups = (await listBackups())
    .map(b => b.name)
    .filter(name => name.startsWith("auto_") && name.endsWith(".json"));

  let runBackup = false;
  if (backups.length === 0) {
    runBackup = true;
  } else {
    backups.sort();
    const latest = backups[backups.length - 1];
    const dateStr = latest.substring(5, 15); // "YYYY-MM-DD"
    const latestDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    latestDate.setHours(0, 0, 0, 0);

    if (today.getTime() > latestDate.getTime()) {
      runBackup = true;
    }
  }

  if (runBackup) {
    await createSystemBackup(true);
  }
};

// Middleware
app.use(express.json());

// Token verification middleware
const verifyToken = h(async (req, res, next) => {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader) {
    token = authHeader.split(" ")[1];
  } else if (req.query.token) {
    token = req.query.token as string;
  }

  if (!token) {
    return res.status(401).json({ error: "No authorization token provided" });
  }

  const settings = await readDb("settings.json", DEFAULT_SETTINGS);
  if (token === settings.masterPassword) {
    next();
  } else {
    res.status(403).json({ error: "Invalid master password token" });
  }
});

// ==========================================
// API ENDPOINTS
// ==========================================

// 1. AUTHENTICATION API
app.post("/api/auth/login", h(async (req, res) => {
  const { password } = req.body;
  const settings = await readDb("settings.json", DEFAULT_SETTINGS);

  if (password === settings.masterPassword) {
    await addLog("User Login", "Admin successfully logged into the system.");
    // Awaited (not fire-and-forget): on serverless, work left running after the
    // response is sent isn't guaranteed to finish. Never fail the login on backup issues.
    await checkAndTriggerAutoBackup().catch(err => console.error("Auto-backup check failed:", err));
    res.json({ success: true, token: settings.masterPassword });
  } else {
    await addLog("Failed Login", "An unauthorized login attempt was blocked.");
    res.status(401).json({ error: "Invalid master password" });
  }
}));

app.post("/api/auth/verify", h(async (req, res) => {
  const { token } = req.body;
  const settings = await readDb("settings.json", DEFAULT_SETTINGS);
  res.json({ valid: token === settings.masterPassword });
}));

app.post("/api/auth/change-password", verifyToken, h(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const settings = await readDb("settings.json", DEFAULT_SETTINGS);

  if (oldPassword !== settings.masterPassword) {
    return res.status(400).json({ error: "Incorrect current password" });
  }

  settings.masterPassword = newPassword;
  await writeDb("settings.json", settings);
  await addLog("Password Changed", "Master password was successfully updated.");
  res.json({ success: true, token: newPassword });
}));

// 2. SETTINGS API
app.get("/api/settings", verifyToken, h(async (req, res) => {
  const settings = { ...(await readDb("settings.json", DEFAULT_SETTINGS)) };
  delete settings.masterPassword;
  res.json(settings);
}));

app.put("/api/settings", verifyToken, h(async (req, res) => {
  const updatedSettings = req.body;
  const currentSettings = await readDb("settings.json", DEFAULT_SETTINGS);

  const finalSettings = {
    ...currentSettings,
    ...updatedSettings,
    masterPassword: currentSettings.masterPassword
  };

  await writeDb("settings.json", finalSettings);
  await addLog("Settings Updated", "System configurations have been updated.");
  const { masterPassword, ...safeSettings } = finalSettings;
  res.json({ success: true, settings: safeSettings });
}));

// 3. BILLING CYCLES API
app.get("/api/billing-cycles", verifyToken, h(async (req, res) => {
  res.json(await readDb("billing_cycles.json", defaultBillingCycles()));
}));

// Complete Payment & Archive current cycle
app.post("/api/billing-cycles/complete", verifyToken, h(async (req, res) => {
  const billingCycleData = await readDb("billing_cycles.json", defaultBillingCycles());
  const activeCycle = billingCycleData.activeCycle;

  const [customers, purchases, payments, archives] = await Promise.all([
    readDb("customers.json", []),
    readDb("purchases.json", []),
    readDb("payments.json", []),
    readDb("archives.json", [])
  ]);

  const newArchive = {
    id: "arch-" + Date.now(),
    cycle: activeCycle,
    archivedAt: new Date().toISOString(),
    data: {
      customers: customers.filter((c: any) => c.billingCycle === activeCycle),
      purchases: purchases.filter((p: any) => p.billingCycle === activeCycle),
      payments: payments.filter((py: any) => py.billingCycle === activeCycle)
    }
  };

  archives.push(newArchive);
  await writeDb("archives.json", archives);

  const parts = activeCycle.split(" ");
  let monthIndex = MONTH_NAMES.indexOf(parts[0]);
  let year = parseInt(parts[1], 10);

  monthIndex++;
  if (monthIndex > 11) {
    monthIndex = 0;
    year++;
  }
  const nextCycle = `${MONTH_NAMES[monthIndex]} ${year}`;

  const activeCustomers = customers.map((c: any) => {
    const customerPurchases = purchases.filter((p: any) => p.customerId === c.id && p.billingCycle === activeCycle);
    const customerPayments = payments.filter((p: any) => p.customerId === c.id && p.billingCycle === activeCycle);

    const totalPurchases = customerPurchases.reduce((sum: number, p: any) => sum + p.totalAmount, 0);
    const totalPayments = customerPayments.reduce((sum: number, p: any) => sum + p.amountPaid, 0);
    const remainingBalance = totalPurchases - totalPayments;

    return {
      ...c,
      billingCycle: nextCycle,
      status: remainingBalance > 0 ? "Active" : "Fully Paid",
      carriedOverBalance: remainingBalance,
      notes: remainingBalance > 0
        ? `${c.notes || ""}\n[Carried over ${remainingBalance} PHP from ${activeCycle}]`.trim()
        : c.notes
    };
  });

  const remainingPurchases = purchases.filter((p: any) => p.billingCycle !== activeCycle);
  const remainingPayments = payments.filter((p: any) => p.billingCycle !== activeCycle);

  billingCycleData.activeCycle = nextCycle;
  if (!billingCycleData.cycles.includes(nextCycle)) {
    billingCycleData.cycles.push(nextCycle);
  }

  await writeDbBatch([
    ["customers.json", activeCustomers],
    ["purchases.json", remainingPurchases],
    ["payments.json", remainingPayments],
    ["billing_cycles.json", billingCycleData]
  ]);

  await addLog("Billing Cycle Completed", `Archived cycle ${activeCycle}. Shifted active workspace to ${nextCycle}.`);
  res.json({ success: true, nextCycle });
}));

// 4. CUSTOMERS API
app.get("/api/customers", verifyToken, h(async (req, res) => {
  res.json(await readDb("customers.json", []));
}));

app.post("/api/customers", verifyToken, h(async (req, res) => {
  const [customers, billingCycleData] = await Promise.all([
    readDb("customers.json", []),
    readDb("billing_cycles.json", defaultBillingCycles())
  ]);

  const newCustomer = {
    id: "cust-" + Date.now(),
    fullName: req.body.fullName,
    contactNumber: req.body.contactNumber || "",
    messengerLink: req.body.messengerLink || "",
    notes: req.body.notes || "",
    status: req.body.status || "Active",
    carriedOverBalance: req.body.carriedOverBalance || 0,
    billingCycle: billingCycleData.activeCycle,
    createdAt: new Date().toISOString()
  };

  customers.push(newCustomer);
  await writeDb("customers.json", customers);

  await addLog("Customer Added", `Added new customer: ${newCustomer.fullName}`);
  res.json(newCustomer);
}));

app.put("/api/customers/:id", verifyToken, h(async (req, res) => {
  const customers = await readDb("customers.json", []);
  const index = customers.findIndex((c: any) => c.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: "Customer not found" });
  }

  customers[index] = {
    ...customers[index],
    ...req.body
  };

  await writeDb("customers.json", customers);
  await addLog("Customer Updated", `Updated customer profile: ${customers[index].fullName}`);
  res.json(customers[index]);
}));

app.delete("/api/customers/:id", verifyToken, h(async (req, res) => {
  let customers = await readDb("customers.json", []);
  const customer = customers.find((c: any) => c.id === req.params.id);

  if (!customer) {
    return res.status(404).json({ error: "Customer not found" });
  }

  customers = customers.filter((c: any) => c.id !== req.params.id);

  let [purchases, payments] = await Promise.all([
    readDb("purchases.json", []),
    readDb("payments.json", [])
  ]);
  purchases = purchases.filter((p: any) => p.customerId !== req.params.id);
  payments = payments.filter((p: any) => p.customerId !== req.params.id);

  await writeDbBatch([
    ["customers.json", customers],
    ["purchases.json", purchases],
    ["payments.json", payments]
  ]);

  await addLog("Customer Deleted", `Removed customer: ${customer.fullName} and cleared active purchases/payments.`);
  res.json({ success: true });
}));

// 5. PURCHASES API
app.get("/api/purchases", verifyToken, h(async (req, res) => {
  res.json(await readDb("purchases.json", []));
}));

app.post("/api/purchases", verifyToken, h(async (req, res) => {
  const [purchases, billingCycleData] = await Promise.all([
    readDb("purchases.json", []),
    readDb("billing_cycles.json", defaultBillingCycles())
  ]);

  const newPurchase = {
    id: "purch-" + Date.now(),
    customerId: req.body.customerId,
    itemName: req.body.itemName,
    description: req.body.description || "",
    quantity: parseInt(req.body.quantity, 10) || 1,
    purchaseDate: req.body.purchaseDate || new Date().toISOString().split("T")[0],
    originalCost: parseFloat(req.body.originalCost) || 0,
    totalAmount: parseFloat(req.body.totalAmount) || 0,
    dueDate: req.body.dueDate || "",
    installmentMonths: parseInt(req.body.installmentMonths, 10) || 0,
    remarks: req.body.remarks || "",
    billingCycle: billingCycleData.activeCycle
  };

  purchases.push(newPurchase);
  await writeDb("purchases.json", purchases);

  await updateCustomerStatus(newPurchase.customerId);

  await addLog("Purchase Added", `Added purchase: ${newPurchase.itemName} for amount ${newPurchase.totalAmount} PHP`);
  res.json(newPurchase);
}));

app.put("/api/purchases/:id", verifyToken, h(async (req, res) => {
  const purchases = await readDb("purchases.json", []);
  const index = purchases.findIndex((p: any) => p.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: "Purchase not found" });
  }

  const customerId = purchases[index].customerId;
  purchases[index] = {
    ...purchases[index],
    ...req.body,
    originalCost: numOrExisting(req.body.originalCost, purchases[index].originalCost),
    totalAmount: numOrExisting(req.body.totalAmount, purchases[index].totalAmount),
    quantity: numOrExisting(req.body.quantity, purchases[index].quantity)
  };

  await writeDb("purchases.json", purchases);
  await updateCustomerStatus(customerId);

  await addLog("Purchase Updated", `Updated purchase: ${purchases[index].itemName}`);
  res.json(purchases[index]);
}));

app.delete("/api/purchases/:id", verifyToken, h(async (req, res) => {
  let purchases = await readDb("purchases.json", []);
  const purchase = purchases.find((p: any) => p.id === req.params.id);

  if (!purchase) {
    return res.status(404).json({ error: "Purchase not found" });
  }

  purchases = purchases.filter((p: any) => p.id !== req.params.id);
  await writeDb("purchases.json", purchases);
  await updateCustomerStatus(purchase.customerId);

  await addLog("Purchase Deleted", `Deleted purchase item: ${purchase.itemName}`);
  res.json({ success: true });
}));

// 6. PAYMENTS API
app.get("/api/payments", verifyToken, h(async (req, res) => {
  res.json(await readDb("payments.json", []));
}));

app.post("/api/payments", verifyToken, h(async (req, res) => {
  const [payments, billingCycleData] = await Promise.all([
    readDb("payments.json", []),
    readDb("billing_cycles.json", defaultBillingCycles())
  ]);

  const newPayment = {
    id: "pay-" + Date.now(),
    customerId: req.body.customerId,
    paymentDate: req.body.paymentDate || new Date().toISOString().split("T")[0],
    amountPaid: parseFloat(req.body.amountPaid) || 0,
    paymentMethod: req.body.paymentMethod || "GCash",
    notes: req.body.notes || "",
    billingCycle: billingCycleData.activeCycle
  };

  payments.push(newPayment);
  await writeDb("payments.json", payments);

  await updateCustomerStatus(newPayment.customerId);

  await addLog("Payment Recorded", `Recorded payment: ${newPayment.amountPaid} PHP via ${newPayment.paymentMethod}`);
  res.json(newPayment);
}));

app.put("/api/payments/:id", verifyToken, h(async (req, res) => {
  const payments = await readDb("payments.json", []);
  const index = payments.findIndex((p: any) => p.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: "Payment not found" });
  }

  const customerId = payments[index].customerId;
  payments[index] = {
    ...payments[index],
    ...req.body,
    amountPaid: numOrExisting(req.body.amountPaid, payments[index].amountPaid)
  };

  await writeDb("payments.json", payments);
  await updateCustomerStatus(customerId);

  await addLog("Payment Updated", `Updated payment record: ${payments[index].amountPaid} PHP`);
  res.json(payments[index]);
}));

app.delete("/api/payments/:id", verifyToken, h(async (req, res) => {
  let payments = await readDb("payments.json", []);
  const payment = payments.find((p: any) => p.id === req.params.id);

  if (!payment) {
    return res.status(404).json({ error: "Payment not found" });
  }

  payments = payments.filter((p: any) => p.id !== req.params.id);
  await writeDb("payments.json", payments);
  await updateCustomerStatus(payment.customerId);

  await addLog("Payment Deleted", `Removed payment record of ${payment.amountPaid} PHP`);
  res.json({ success: true });
}));

// Helper to auto update customer status
const updateCustomerStatus = async (customerId: string) => {
  const [customers, purchases, payments] = await Promise.all([
    readDb("customers.json", []),
    readDb("purchases.json", []),
    readDb("payments.json", [])
  ]);

  const custIndex = customers.findIndex((c: any) => c.id === customerId);
  if (custIndex === -1) return;

  const customer = customers[custIndex];
  const cycle = customer.billingCycle;

  const custPurchases = purchases.filter((p: any) => p.customerId === customerId && p.billingCycle === cycle);
  const custPayments = payments.filter((p: any) => p.customerId === customerId && p.billingCycle === cycle);

  const totalPurchases = custPurchases.reduce((sum: number, p: any) => sum + p.totalAmount, 0) + (customer.carriedOverBalance || 0);
  const totalPayments = custPayments.reduce((sum: number, p: any) => sum + p.amountPaid, 0);

  const remaining = totalPurchases - totalPayments;

  if (remaining <= 0) {
    customers[custIndex].status = "Fully Paid";
  } else {
    const isOverdue = custPurchases.some((p: any) => p.dueDate && new Date(p.dueDate).getTime() < Date.now());
    customers[custIndex].status = isOverdue ? "Overdue" : "Active";
  }

  await writeDb("customers.json", customers);
};

// 7. LENDING MANAGEMENT API
app.get("/api/loans", verifyToken, h(async (req, res) => {
  res.json(await readDb("loans.json", []));
}));

app.post("/api/loans", verifyToken, h(async (req, res) => {
  const loans = await readDb("loans.json", []);

  const newLoan = {
    id: "loan-" + Date.now(),
    borrowerName: req.body.borrowerName,
    contactNumber: req.body.contactNumber || "",
    address: req.body.address || "",
    principalAmount: parseFloat(req.body.principalAmount) || 0,
    loanDate: req.body.loanDate || new Date().toISOString().split("T")[0],
    dueDate: req.body.dueDate || "",
    paymentSchedule: req.body.paymentSchedule || "On Due Date",
    interestType: req.body.interestType || "Fixed Amount",
    interestValue: parseFloat(req.body.interestValue) || 0,
    status: req.body.status || "Active",
    notes: req.body.notes || "",
    payments: [],
    createdAt: new Date().toISOString()
  };

  loans.push(newLoan);
  await writeDb("loans.json", loans);

  await addLog("Loan Created", `Granted cash loan to: ${newLoan.borrowerName} for ${newLoan.principalAmount} PHP`);
  res.json(newLoan);
}));

app.put("/api/loans/:id", verifyToken, h(async (req, res) => {
  const loans = await readDb("loans.json", []);
  const index = loans.findIndex((l: any) => l.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: "Loan record not found" });
  }

  loans[index] = {
    ...loans[index],
    ...req.body,
    principalAmount: numOrExisting(req.body.principalAmount, loans[index].principalAmount),
    interestValue: numOrExisting(req.body.interestValue, loans[index].interestValue)
  };

  recalculateLoanStatus(loans[index]);

  await writeDb("loans.json", loans);
  await addLog("Loan Updated", `Updated loan details for: ${loans[index].borrowerName}`);
  res.json(loans[index]);
}));

app.delete("/api/loans/:id", verifyToken, h(async (req, res) => {
  let loans = await readDb("loans.json", []);
  const loan = loans.find((l: any) => l.id === req.params.id);

  if (!loan) {
    return res.status(404).json({ error: "Loan not found" });
  }

  loans = loans.filter((l: any) => l.id !== req.params.id);
  await writeDb("loans.json", loans);

  await addLog("Loan Deleted", `Removed loan profile of: ${loan.borrowerName}`);
  res.json({ success: true });
}));

// Loan payments routes
app.post("/api/loans/:id/payments", verifyToken, h(async (req, res) => {
  const loans = await readDb("loans.json", []);
  const index = loans.findIndex((l: any) => l.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: "Loan record not found" });
  }

  const newPayment = {
    id: "loan-pay-" + Date.now(),
    paymentDate: req.body.paymentDate || new Date().toISOString().split("T")[0],
    amountPaid: parseFloat(req.body.amountPaid) || 0,
    paymentMethod: req.body.paymentMethod || "Cash",
    notes: req.body.notes || ""
  };

  loans[index].payments.push(newPayment);
  recalculateLoanStatus(loans[index]);

  await writeDb("loans.json", loans);
  await addLog("Loan Payment Recorded", `Recorded payment of ${newPayment.amountPaid} PHP from ${loans[index].borrowerName}`);
  res.json(loans[index]);
}));

app.put("/api/loans/:loanId/payments/:paymentId", verifyToken, h(async (req, res) => {
  const loans = await readDb("loans.json", []);
  const lIndex = loans.findIndex((l: any) => l.id === req.params.loanId);

  if (lIndex === -1) {
    return res.status(404).json({ error: "Loan not found" });
  }

  const pIndex = loans[lIndex].payments.findIndex((p: any) => p.id === req.params.paymentId);
  if (pIndex === -1) {
    return res.status(404).json({ error: "Payment not found" });
  }

  loans[lIndex].payments[pIndex] = {
    ...loans[lIndex].payments[pIndex],
    ...req.body,
    amountPaid: numOrExisting(req.body.amountPaid, loans[lIndex].payments[pIndex].amountPaid)
  };

  recalculateLoanStatus(loans[lIndex]);
  await writeDb("loans.json", loans);
  await addLog("Loan Payment Updated", `Updated loan payment record for ${loans[lIndex].borrowerName}`);
  res.json(loans[lIndex]);
}));

app.delete("/api/loans/:loanId/payments/:paymentId", verifyToken, h(async (req, res) => {
  const loans = await readDb("loans.json", []);
  const lIndex = loans.findIndex((l: any) => l.id === req.params.loanId);

  if (lIndex === -1) {
    return res.status(404).json({ error: "Loan not found" });
  }

  loans[lIndex].payments = loans[lIndex].payments.filter((p: any) => p.id !== req.params.paymentId);
  recalculateLoanStatus(loans[lIndex]);
  await writeDb("loans.json", loans);
  await addLog("Loan Payment Deleted", `Deleted loan payment record for ${loans[lIndex].borrowerName}`);
  res.json(loans[lIndex]);
}));

const recalculateLoanStatus = (loan: any) => {
  const principal = loan.principalAmount;
  const interestType = loan.interestType;
  const interestValue = loan.interestValue;

  const totalInterest = interestType === "Percentage"
    ? (principal * (interestValue / 100))
    : interestValue;

  const totalDue = principal + totalInterest;
  const totalPaid = loan.payments.reduce((sum: number, p: any) => sum + p.amountPaid, 0);
  const remaining = totalDue - totalPaid;

  if (remaining <= 0) {
    loan.status = "Completed";
  } else {
    const isOverdue = loan.dueDate && new Date(loan.dueDate).getTime() < Date.now();
    loan.status = isOverdue ? "Overdue" : "Active";
  }
};

// 8. ARCHIVES API
app.get("/api/archives", verifyToken, h(async (req, res) => {
  res.json(await readDb("archives.json", []));
}));

// Restore archive (Dangerous but highly requested)
app.post("/api/archives/:id/restore", verifyToken, h(async (req, res) => {
  const archives = await readDb("archives.json", []);
  const index = archives.findIndex((a: any) => a.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: "Archive not found" });
  }

  const archiveToRestore = archives[index];
  const billingCycleData = await readDb("billing_cycles.json", defaultBillingCycles());

  billingCycleData.activeCycle = archiveToRestore.cycle;

  const updatedArchives = archives.filter((a: any) => a.id !== req.params.id);

  await writeDbBatch([
    ["billing_cycles.json", billingCycleData],
    ["customers.json", archiveToRestore.data.customers],
    ["purchases.json", archiveToRestore.data.purchases],
    ["payments.json", archiveToRestore.data.payments],
    ["archives.json", updatedArchives]
  ]);

  await addLog("Archive Restored", `Restored archive of ${archiveToRestore.cycle} back to the active workspace.`);
  res.json({ success: true, restoredCycle: archiveToRestore.cycle });
}));

// ==========================================
// 8.5. BUDGETS API
// ==========================================

app.get("/api/budgets", verifyToken, h(async (req, res) => {
  res.json(await readDb("budgets.json", []));
}));

app.put("/api/budgets/current", verifyToken, h(async (req, res) => {
  const { month, salary, additionalIncome } = req.body;
  if (!month) {
    return res.status(400).json({ error: "Month parameter is required." });
  }

  const budgets = await readDb("budgets.json", []);
  let budget = budgets.find((b: any) => b.month === month);

  if (!budget) {
    budget = {
      id: "budget-" + Date.now(),
      month,
      salary: Number(salary) || 0,
      additionalIncome: Number(additionalIncome) || 0,
      allocations: [],
      expenses: [],
      createdAt: new Date().toISOString()
    };
    budgets.push(budget);
    await addLog("Budget Set", `Set up initial monthly budget for ${month}`);
  } else {
    budget.salary = Number(salary) || 0;
    budget.additionalIncome = Number(additionalIncome) || 0;
    await addLog("Budget Updated", `Updated monthly salary and income configuration for ${month}`);
  }

  await writeDb("budgets.json", budgets);
  res.json(budget);
}));

app.post("/api/budgets/allocations", verifyToken, h(async (req, res) => {
  const { month, category, allocatedAmount } = req.body;
  if (!month || !category) {
    return res.status(400).json({ error: "Month and category are required" });
  }

  const budgets = await readDb("budgets.json", []);
  let budget = budgets.find((b: any) => b.month === month);

  if (!budget) {
    budget = {
      id: "budget-" + Date.now(),
      month,
      salary: 0,
      additionalIncome: 0,
      allocations: [],
      expenses: [],
      createdAt: new Date().toISOString()
    };
    budgets.push(budget);
  }

  const newAllocation = {
    id: "alloc-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
    category,
    allocatedAmount: Number(allocatedAmount) || 0,
    spentAmount: 0
  };

  budget.allocations.push(newAllocation);
  await addLog("Allocation Created", `Created budget allocation of ${allocatedAmount} for ${category} in ${month}`);

  await writeDb("budgets.json", budgets);
  res.json(budget);
}));

app.put("/api/budgets/allocations/:id", verifyToken, h(async (req, res) => {
  const { id } = req.params;
  const { month, category, allocatedAmount } = req.body;

  const budgets = await readDb("budgets.json", []);
  const budget = budgets.find((b: any) => b.month === month);

  if (!budget) {
    return res.status(404).json({ error: "Monthly budget not found" });
  }

  const allocation = budget.allocations.find((a: any) => a.id === id);
  if (!allocation) {
    return res.status(404).json({ error: "Allocation not found" });
  }

  if (category !== undefined) allocation.category = category;
  if (allocatedAmount !== undefined) allocation.allocatedAmount = Number(allocatedAmount) || 0;

  const spent = budget.expenses
    .filter((e: any) => e.allocationId === id)
    .reduce((sum: number, e: any) => sum + e.amount, 0);
  allocation.spentAmount = spent;

  await addLog("Allocation Updated", `Updated budget allocation ${allocation.category} in ${month}`);
  await writeDb("budgets.json", budgets);
  res.json(budget);
}));

app.delete("/api/budgets/allocations/:id", verifyToken, h(async (req, res) => {
  const { id } = req.params;
  const { month } = req.query;

  const budgets = await readDb("budgets.json", []);
  const budget = budgets.find((b: any) => b.month === month);

  if (!budget) {
    return res.status(404).json({ error: "Monthly budget not found" });
  }

  const allocIndex = budget.allocations.findIndex((a: any) => a.id === id);
  if (allocIndex === -1) {
    return res.status(404).json({ error: "Allocation not found" });
  }

  const deletedAlloc = budget.allocations[allocIndex];
  budget.allocations.splice(allocIndex, 1);
  budget.expenses = budget.expenses.filter((e: any) => e.allocationId !== id);

  await addLog("Allocation Deleted", `Deleted budget allocation ${deletedAlloc.category} in ${month}`);
  await writeDb("budgets.json", budgets);
  res.json(budget);
}));

app.post("/api/budgets/expenses", verifyToken, h(async (req, res) => {
  const { month, allocationId, itemName, amount, date, notes } = req.body;
  if (!month || !allocationId || !itemName || amount === undefined) {
    return res.status(400).json({ error: "Month, allocationId, itemName, and amount are required" });
  }

  const budgets = await readDb("budgets.json", []);
  const budget = budgets.find((b: any) => b.month === month);

  if (!budget) {
    return res.status(404).json({ error: "Monthly budget not found" });
  }

  const allocation = budget.allocations.find((a: any) => a.id === allocationId);
  if (!allocation) {
    return res.status(404).json({ error: "Allocation not found" });
  }

  const newExpense = {
    id: "exp-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
    allocationId,
    itemName,
    amount: Number(amount) || 0,
    date: date || new Date().toISOString().split("T")[0],
    notes: notes || ""
  };

  budget.expenses.push(newExpense);

  const spent = budget.expenses
    .filter((e: any) => e.allocationId === allocationId)
    .reduce((sum: number, e: any) => sum + e.amount, 0);
  allocation.spentAmount = spent;

  await addLog("Expense Logged", `Logged spent amount ${amount} for ${itemName} under ${allocation.category} in ${month}`);
  await writeDb("budgets.json", budgets);
  res.json(budget);
}));

app.delete("/api/budgets/expenses/:id", verifyToken, h(async (req, res) => {
  const { id } = req.params;
  const { month } = req.query;

  const budgets = await readDb("budgets.json", []);
  const budget = budgets.find((b: any) => b.month === month);

  if (!budget) {
    return res.status(404).json({ error: "Monthly budget not found" });
  }

  const expIndex = budget.expenses.findIndex((e: any) => e.id === id);
  if (expIndex === -1) {
    return res.status(404).json({ error: "Expense not found" });
  }

  const deletedExpense = budget.expenses[expIndex];
  budget.expenses.splice(expIndex, 1);

  const allocation = budget.allocations.find((a: any) => a.id === deletedExpense.allocationId);
  if (allocation) {
    const spent = budget.expenses
      .filter((e: any) => e.allocationId === deletedExpense.allocationId)
      .reduce((sum: number, e: any) => sum + e.amount, 0);
    allocation.spentAmount = spent;
  }

  await addLog("Expense Deleted", `Deleted expense record ${deletedExpense.itemName} in ${month}`);
  await writeDb("budgets.json", budgets);
  res.json(budget);
}));

app.post("/api/budgets/reset", verifyToken, h(async (req, res) => {
  const { sourceMonth, targetMonth } = req.body;
  if (!sourceMonth || !targetMonth) {
    return res.status(400).json({ error: "Source month and target month are required." });
  }

  const budgets = await readDb("budgets.json", []);
  const sourceBudget = budgets.find((b: any) => b.month === sourceMonth);
  let targetBudget = budgets.find((b: any) => b.month === targetMonth);

  if (!sourceBudget) {
    return res.status(404).json({ error: "Source month budget configuration not found." });
  }

  const copiedAllocations = sourceBudget.allocations.map((a: any) => ({
    id: "alloc-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6) + "-" + Math.random().toString(36).substring(2, 4),
    category: a.category,
    allocatedAmount: a.allocatedAmount,
    spentAmount: 0
  }));

  if (!targetBudget) {
    targetBudget = {
      id: "budget-" + Date.now(),
      month: targetMonth,
      salary: sourceBudget.salary,
      additionalIncome: sourceBudget.additionalIncome,
      allocations: copiedAllocations,
      expenses: [],
      createdAt: new Date().toISOString()
    };
    budgets.push(targetBudget);
  } else {
    targetBudget.salary = sourceBudget.salary;
    targetBudget.additionalIncome = sourceBudget.additionalIncome;
    targetBudget.allocations = copiedAllocations;
    targetBudget.expenses = [];
  }

  await addLog("Budget Rollover", `Rolled over budget layout from ${sourceMonth} to ${targetMonth}`);
  await writeDb("budgets.json", budgets);
  res.json(targetBudget);
}));

// 9. LOGS API
app.get("/api/logs", verifyToken, h(async (req, res) => {
  res.json(await readDb("activity_logs.json", defaultActivityLogs()));
}));

// 10. BACKUP API
app.get("/api/backups", verifyToken, h(async (req, res) => {
  const files = await listBackups();
  const backups = files.map(file => {
    // Filenames look like: manual_YYYY-MM-DD_HHMMSS.json / auto_YYYY-MM-DD_HHMMSS.json
    const isAuto = file.name.startsWith("auto_");
    const dateMatch = file.name.match(/_(\d{4}-\d{2}-\d{2})_(\d{6})\.json$/);
    const createdAt = dateMatch
      ? `${dateMatch[1]}T${dateMatch[2].substring(0, 2)}:${dateMatch[2].substring(2, 4)}:${dateMatch[2].substring(4, 6)}.000Z`
      : new Date(0).toISOString();

    return {
      id: file.name,
      filename: file.name,
      type: isAuto ? "automatic" : "manual",
      createdAt,
      size: file.size
    };
  });
  backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(backups);
}));

app.post("/api/backups", verifyToken, h(async (req, res) => {
  await createSystemBackup(false);
  await addLog("Backup Created", "Manual backup successfully generated.");
  res.json({ success: true });
}));

app.post("/api/backups/:id/restore", verifyToken, h(async (req, res) => {
  const backupFile = req.params.id;
  const data = await readBackup(backupFile);

  if (!data) {
    return res.status(404).json({ error: "Backup file not found" });
  }

  if (!data.settings || !data.customers || !data.purchases || !data.payments || !data.loans) {
    return res.status(400).json({ error: "Invalid backup file structure" });
  }

  await writeDbBatch([
    ["settings.json", data.settings],
    ["billing_cycles.json", data.billingCycles || defaultBillingCycles()],
    ["customers.json", data.customers],
    ["purchases.json", data.purchases],
    ["payments.json", data.payments],
    ["loans.json", data.loans],
    ["budgets.json", data.budgets || []],
    ["archives.json", data.archives || []],
    ["activity_logs.json", data.activityLogs || []]
  ]);

  await addLog("System Restored", `System restored successfully from backup file: ${backupFile}`);
  res.json({ success: true });
}));

app.delete("/api/backups/:id", verifyToken, h(async (req, res) => {
  await deleteBackup(req.params.id);
  await addLog("Backup Deleted", `Backup file deleted: ${req.params.id}`);
  res.json({ success: true });
}));

// Import complete backup from uploaded JSON string
app.post("/api/backups/import", verifyToken, h(async (req, res) => {
  const data = req.body;

  if (!data || typeof data !== "object") {
    return res.status(400).json({ error: "Invalid backup data structure received." });
  }

  if (!data.settings && !data.customers && !data.purchases) {
    return res.status(400).json({ error: "Invalid backup schema. File is not a recognized PFMS export JSON." });
  }

  await writeDbBatch([
    ["settings.json", data.settings || await readDb("settings.json", DEFAULT_SETTINGS)],
    ["billing_cycles.json", data.billingCycles || defaultBillingCycles()],
    ["customers.json", data.customers || []],
    ["purchases.json", data.purchases || []],
    ["payments.json", data.payments || []],
    ["loans.json", data.loans || []],
    ["budgets.json", data.budgets || []],
    ["archives.json", data.archives || []],
    ["activity_logs.json", data.activityLogs || []]
  ]);

  await addLog("Backup Imported", "A full external backup JSON was imported successfully.");
  res.json({ success: true });
}));

// Seed SPayLater sample summary data instantly
app.post("/api/backups/seed-spaylater", verifyToken, h(async (req, res) => {
  const data: any = seedData;

  await writeDbBatch([
    ["settings.json", data.settings],
    ["billing_cycles.json", data.billingCycles || defaultBillingCycles()],
    ["customers.json", data.customers],
    ["purchases.json", data.purchases],
    ["payments.json", data.payments],
    ["loans.json", data.loans],
    ["budgets.json", data.budgets || []],
    ["archives.json", data.archives || []],
    ["activity_logs.json", data.activityLogs || []]
  ]);

  await addLog("Database Seeded", "SpayLater tracker summary imported automatically via 1-click seeder.");
  res.json({ success: true });
}));

// Export complete system state as a direct download
app.get("/api/backups/export", verifyToken, h(async (req, res) => {
  const [settings, billingCycles, customers, purchases, payments, loans, budgets, archives, activityLogs] =
    await Promise.all([
      readDb("settings.json", DEFAULT_SETTINGS),
      readDb("billing_cycles.json", defaultBillingCycles()),
      readDb("customers.json", []),
      readDb("purchases.json", []),
      readDb("payments.json", []),
      readDb("loans.json", []),
      readDb("budgets.json", []),
      readDb("archives.json", []),
      readDb("activity_logs.json", defaultActivityLogs())
    ]);

  const backupData = {
    timestamp: new Date().toISOString(),
    type: "exported",
    settings,
    billingCycles,
    customers,
    purchases,
    payments,
    loans,
    budgets,
    archives,
    activityLogs
  };

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename=pfms_export_${new Date().toISOString().split("T")[0]}.json`);
  res.send(JSON.stringify(backupData, null, 2));
}));

// Error-handling middleware: turns thrown/rejected errors from any handler
// above into a clean JSON 500 instead of an unhandled rejection or crash.
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("API error:", err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: err?.message || "Internal server error" });
});
