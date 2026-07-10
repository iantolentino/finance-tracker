import express from "express";
import fs from "fs";
import path from "path";

const app = express();
const PORT = 3000;

// Path to data and backup directories
const DATA_DIR = path.join(process.cwd(), "data");
const BACKUPS_DIR = path.join(process.cwd(), "backups");

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

// Default Data files initialization helpers
const initFile = (filename: string, defaultData: any) => {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2), "utf8");
  }
};

// Initialize JSON database files
initFile("settings.json", {
  masterPassword: "admin", // Default password
  currency: "PHP",
  theme: "light",
  personalBusinessName: "Personal Finance Management System",
  defaultBillingDate: "15",
  defaultDueDate: "30",
  backupPreference: "manual"
});

initFile("billing_cycles.json", {
  activeCycle: "July 2026",
  cycles: ["July 2026"]
});

initFile("customers.json", []);
initFile("purchases.json", []);
initFile("payments.json", []);
initFile("loans.json", []);
initFile("archives.json", []);
initFile("activity_logs.json", [
  {
    id: "log-init",
    action: "System Initialized",
    details: "Personal Finance Management System successfully started.",
    timestamp: new Date().toISOString()
  }
]);

// Helper to read database file
const readDb = (filename: string): any => {
  const filePath = path.join(DATA_DIR, filename);
  try {
    const content = fs.readFileSync(filePath, "utf8");
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error reading ${filename}:`, error);
    return [];
  }
};

// Helper to write database file
const writeDb = (filename: string, data: any) => {
  const filePath = path.join(DATA_DIR, filename);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
    // Trigger auto-backup check on writing changes
    checkAndTriggerAutoBackup();
  } catch (error) {
    console.error(`Error writing ${filename}:`, error);
  }
};

// Log recent activity helper
const addLog = (action: string, details: string) => {
  const logs = readDb("activity_logs.json");
  const newLog = {
    id: "log-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
    action,
    details,
    timestamp: new Date().toISOString()
  };
  logs.unshift(newLog); // Put new log at the start
  // Keep last 100 logs
  writeDb("activity_logs.json", logs.slice(0, 100));
};

// Auto backup helper: Once per day if settings.backupPreference !== "disabled"
const checkAndTriggerAutoBackup = () => {
  const settings = readDb("settings.json");
  if (settings.backupPreference === "disabled") return;

  const backups = fs.readdirSync(BACKUPS_DIR).filter(f => f.startsWith("auto_") && f.endsWith(".json"));
  let runBackup = false;

  if (backups.length === 0) {
    runBackup = true;
  } else {
    // Check latest auto backup timestamp
    backups.sort();
    const latest = backups[backups.length - 1];
    // File format auto_YYYY-MM-DD.json
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
    createSystemBackup(true);
  }
};

// Create a bundled system backup
const createSystemBackup = (isAuto = false) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const prefix = isAuto ? "auto_" : "manual_";
  const dateString = new Date().toISOString().split("T")[0];
  const filename = `${prefix}${dateString}_${timestamp.substring(11, 19).replace(/-/g, "")}.json`;
  
  const backupData = {
    timestamp: new Date().toISOString(),
    type: isAuto ? "automatic" : "manual",
    settings: readDb("settings.json"),
    billingCycles: readDb("billing_cycles.json"),
    customers: readDb("customers.json"),
    purchases: readDb("purchases.json"),
    payments: readDb("payments.json"),
    loans: readDb("loans.json"),
    archives: readDb("archives.json"),
    activityLogs: readDb("activity_logs.json")
  };

  fs.writeFileSync(path.join(BACKUPS_DIR, filename), JSON.stringify(backupData, null, 2), "utf8");
  console.log(`Backup created: ${filename}`);
};

// Middleware
app.use(express.json());

// Token verification middleware
const verifyToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "No authorization token provided" });
  }

  const token = authHeader.split(" ")[1];
  const settings = readDb("settings.json");
  // In a real production system, you'd use a real JWT or securely hashed session.
  // For this single-user local web app, comparing the token against the masterPassword is secure & simple.
  if (token === settings.masterPassword) {
    next();
  } else {
    res.status(403).json({ error: "Invalid master password token" });
  }
};

// ==========================================
// API ENDPOINTS
// ==========================================

// 1. AUTHENTICATION API
app.post("/api/auth/login", (req, res) => {
  const { password } = req.body;
  const settings = readDb("settings.json");

  if (password === settings.masterPassword) {
    addLog("User Login", "Admin successfully logged into the system.");
    res.json({ success: true, token: settings.masterPassword });
  } else {
    addLog("Failed Login", "An unauthorized login attempt was blocked.");
    res.status(401).json({ error: "Invalid master password" });
  }
});

app.post("/api/auth/verify", (req, res) => {
  const { token } = req.body;
  const settings = readDb("settings.json");
  if (token === settings.masterPassword) {
    res.json({ valid: true });
  } else {
    res.json({ valid: false });
  }
});

app.post("/api/auth/change-password", verifyToken, (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const settings = readDb("settings.json");

  if (oldPassword !== settings.masterPassword) {
    return res.status(400).json({ error: "Incorrect current password" });
  }

  settings.masterPassword = newPassword;
  writeDb("settings.json", settings);
  addLog("Password Changed", "Master password was successfully updated.");
  res.json({ success: true, token: newPassword });
});

// 2. SETTINGS API
app.get("/api/settings", verifyToken, (req, res) => {
  const settings = { ...readDb("settings.json") };
  // Hide password in standard retrieval
  delete settings.masterPassword;
  res.json(settings);
});

app.put("/api/settings", verifyToken, (req, res) => {
  const updatedSettings = req.body;
  const currentSettings = readDb("settings.json");

  // Preserve the master password
  const finalSettings = {
    ...currentSettings,
    ...updatedSettings,
    masterPassword: currentSettings.masterPassword
  };

  writeDb("settings.json", finalSettings);
  addLog("Settings Updated", "System configurations have been updated.");
  res.json({ success: true, settings: updatedSettings });
});

// 3. BILLING CYCLES API
app.get("/api/billing-cycles", verifyToken, (req, res) => {
  res.json(readDb("billing_cycles.json"));
});

// Complete Payment & Archive current cycle
app.post("/api/billing-cycles/complete", verifyToken, (req, res) => {
  const billingCycleData = readDb("billing_cycles.json");
  const activeCycle = billingCycleData.activeCycle;

  // Retrieve current active datasets
  const customers = readDb("customers.json");
  const purchases = readDb("purchases.json");
  const payments = readDb("payments.json");

  // Save active cycle state to archives
  const archives = readDb("archives.json");
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
  writeDb("archives.json", archives);

  // Generate next billing cycle (e.g. June 2026 -> July 2026)
  const parts = activeCycle.split(" ");
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  let monthIndex = monthNames.indexOf(parts[0]);
  let year = parseInt(parts[1], 10);

  monthIndex++;
  if (monthIndex > 11) {
    monthIndex = 0;
    year++;
  }
  const nextCycle = `${monthNames[monthIndex]} ${year}`;

  // Reset active workspace:
  // Customers are carried forward, but assigned to the new cycle.
  // Any customer with an active remaining balance will start the new cycle with that balance.
  const activeCustomers = customers.map((c: any) => {
    // Calculate final balance from active cycle to carry forward
    const customerPurchases = purchases.filter((p: any) => p.customerId === c.id && p.billingCycle === activeCycle);
    const customerPayments = payments.filter((p: any) => p.customerId === c.id && p.billingCycle === activeCycle);
    
    const totalPurchases = customerPurchases.reduce((sum: number, p: any) => sum + p.totalAmount, 0);
    const totalPayments = customerPayments.reduce((sum: number, p: any) => sum + p.amountPaid, 0);
    const remainingBalance = totalPurchases - totalPayments;

    return {
      ...c,
      billingCycle: nextCycle,
      status: remainingBalance > 0 ? "Active" : "Fully Paid",
      // Store the carried over balance so it can be accounted for
      carriedOverBalance: remainingBalance,
      notes: remainingBalance > 0 
        ? `${c.notes || ""}\n[Carried over ${remainingBalance} PHP from ${activeCycle}]`.trim() 
        : c.notes
    };
  });

  // Write new lists
  writeDb("customers.json", activeCustomers);
  // Purchases & payments of completed cycle are removed from the active lists (they live in archives now)
  const remainingPurchases = purchases.filter((p: any) => p.billingCycle !== activeCycle);
  const remainingPayments = payments.filter((p: any) => p.billingCycle !== activeCycle);
  writeDb("purchases.json", remainingPurchases);
  writeDb("payments.json", remainingPayments);

  // Update active billing cycles list
  billingCycleData.activeCycle = nextCycle;
  if (!billingCycleData.cycles.includes(nextCycle)) {
    billingCycleData.cycles.push(nextCycle);
  }
  writeDb("billing_cycles.json", billingCycleData);

  addLog("Billing Cycle Completed", `Archived cycle ${activeCycle}. Shifted active workspace to ${nextCycle}.`);
  res.json({ success: true, nextCycle });
});

// 4. CUSTOMERS API
app.get("/api/customers", verifyToken, (req, res) => {
  res.json(readDb("customers.json"));
});

app.post("/api/customers", verifyToken, (req, res) => {
  const customers = readDb("customers.json");
  const billingCycleData = readDb("billing_cycles.json");

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
  writeDb("customers.json", customers);

  addLog("Customer Added", `Added new customer: ${newCustomer.fullName}`);
  res.json(newCustomer);
});

app.put("/api/customers/:id", verifyToken, (req, res) => {
  const customers = readDb("customers.json");
  const index = customers.findIndex((c: any) => c.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: "Customer not found" });
  }

  customers[index] = {
    ...customers[index],
    ...req.body
  };

  writeDb("customers.json", customers);
  addLog("Customer Updated", `Updated customer profile: ${customers[index].fullName}`);
  res.json(customers[index]);
});

app.delete("/api/customers/:id", verifyToken, (req, res) => {
  let customers = readDb("customers.json");
  const customer = customers.find((c: any) => c.id === req.params.id);

  if (!customer) {
    return res.status(404).json({ error: "Customer not found" });
  }

  customers = customers.filter((c: any) => c.id !== req.params.id);
  writeDb("customers.json", customers);

  // Clean up purchases and payments for this customer in active list
  let purchases = readDb("purchases.json");
  let payments = readDb("payments.json");
  purchases = purchases.filter((p: any) => p.customerId !== req.params.id);
  payments = payments.filter((p: any) => p.customerId !== req.params.id);
  writeDb("purchases.json", purchases);
  writeDb("payments.json", payments);

  addLog("Customer Deleted", `Removed customer: ${customer.fullName} and cleared active purchases/payments.`);
  res.json({ success: true });
});

// 5. PURCHASES API
app.get("/api/purchases", verifyToken, (req, res) => {
  res.json(readDb("purchases.json"));
});

app.post("/api/purchases", verifyToken, (req, res) => {
  const purchases = readDb("purchases.json");
  const billingCycleData = readDb("billing_cycles.json");

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
  writeDb("purchases.json", purchases);

  // Automatically recalculate customer status
  updateCustomerStatus(newPurchase.customerId);

  addLog("Purchase Added", `Added purchase: ${newPurchase.itemName} for amount ${newPurchase.totalAmount} PHP`);
  res.json(newPurchase);
});

app.put("/api/purchases/:id", verifyToken, (req, res) => {
  const purchases = readDb("purchases.json");
  const index = purchases.findIndex((p: any) => p.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: "Purchase not found" });
  }

  const customerId = purchases[index].customerId;
  purchases[index] = {
    ...purchases[index],
    ...req.body,
    originalCost: parseFloat(req.body.originalCost) || purchases[index].originalCost,
    totalAmount: parseFloat(req.body.totalAmount) || purchases[index].totalAmount,
    quantity: parseInt(req.body.quantity, 10) || purchases[index].quantity
  };

  writeDb("purchases.json", purchases);
  updateCustomerStatus(customerId);

  addLog("Purchase Updated", `Updated purchase: ${purchases[index].itemName}`);
  res.json(purchases[index]);
});

app.delete("/api/purchases/:id", verifyToken, (req, res) => {
  let purchases = readDb("purchases.json");
  const purchase = purchases.find((p: any) => p.id === req.params.id);

  if (!purchase) {
    return res.status(404).json({ error: "Purchase not found" });
  }

  purchases = purchases.filter((p: any) => p.id !== req.params.id);
  writeDb("purchases.json", purchases);
  updateCustomerStatus(purchase.customerId);

  addLog("Purchase Deleted", `Deleted purchase item: ${purchase.itemName}`);
  res.json({ success: true });
});

// 6. PAYMENTS API
app.get("/api/payments", verifyToken, (req, res) => {
  res.json(readDb("payments.json"));
});

app.post("/api/payments", verifyToken, (req, res) => {
  const payments = readDb("payments.json");
  const billingCycleData = readDb("billing_cycles.json");

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
  writeDb("payments.json", payments);

  // Automatically recalculate customer status
  updateCustomerStatus(newPayment.customerId);

  addLog("Payment Recorded", `Recorded payment: ${newPayment.amountPaid} PHP via ${newPayment.paymentMethod}`);
  res.json(newPayment);
});

app.put("/api/payments/:id", verifyToken, (req, res) => {
  const payments = readDb("payments.json");
  const index = payments.findIndex((p: any) => p.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: "Payment not found" });
  }

  const customerId = payments[index].customerId;
  payments[index] = {
    ...payments[index],
    ...req.body,
    amountPaid: parseFloat(req.body.amountPaid) || payments[index].amountPaid
  };

  writeDb("payments.json", payments);
  updateCustomerStatus(customerId);

  addLog("Payment Updated", `Updated payment record: ${payments[index].amountPaid} PHP`);
  res.json(payments[index]);
});

app.delete("/api/payments/:id", verifyToken, (req, res) => {
  let payments = readDb("payments.json");
  const payment = payments.find((p: any) => p.id === req.params.id);

  if (!payment) {
    return res.status(404).json({ error: "Payment not found" });
  }

  payments = payments.filter((p: any) => p.id !== req.params.id);
  writeDb("payments.json", payments);
  updateCustomerStatus(payment.customerId);

  addLog("Payment Deleted", `Removed payment record of ${payment.amountPaid} PHP`);
  res.json({ success: true });
});

// Helper to auto update customer status
const updateCustomerStatus = (customerId: string) => {
  const customers = readDb("customers.json");
  const purchases = readDb("purchases.json");
  const payments = readDb("payments.json");

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
    // Check if overdue
    const isOverdue = custPurchases.some((p: any) => p.dueDate && new Date(p.dueDate).getTime() < Date.now());
    customers[custIndex].status = isOverdue ? "Overdue" : "Active";
  }

  writeDb("customers.json", customers);
};

// 7. LENDING MANAGEMENT API
app.get("/api/loans", verifyToken, (req, res) => {
  res.json(readDb("loans.json"));
});

app.post("/api/loans", verifyToken, (req, res) => {
  const loans = readDb("loans.json");

  const newLoan = {
    id: "loan-" + Date.now(),
    borrowerName: req.body.borrowerName,
    contactNumber: req.body.contactNumber || "",
    address: req.body.address || "",
    principalAmount: parseFloat(req.body.principalAmount) || 0,
    loanDate: req.body.loanDate || new Date().toISOString().split("T")[0],
    dueDate: req.body.dueDate || "",
    paymentSchedule: req.body.paymentSchedule || "On Due Date",
    interestType: req.body.interestType || "Fixed Amount", // "Fixed Amount" or "Percentage"
    interestValue: parseFloat(req.body.interestValue) || 0,
    status: req.body.status || "Active",
    notes: req.body.notes || "",
    payments: [],
    createdAt: new Date().toISOString()
  };

  loans.push(newLoan);
  writeDb("loans.json", loans);

  addLog("Loan Created", `Granted cash loan to: ${newLoan.borrowerName} for ${newLoan.principalAmount} PHP`);
  res.json(newLoan);
});

app.put("/api/loans/:id", verifyToken, (req, res) => {
  const loans = readDb("loans.json");
  const index = loans.findIndex((l: any) => l.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: "Loan record not found" });
  }

  // Handle nested edits or general edits
  loans[index] = {
    ...loans[index],
    ...req.body,
    principalAmount: parseFloat(req.body.principalAmount) || loans[index].principalAmount,
    interestValue: parseFloat(req.body.interestValue) || loans[index].interestValue
  };

  // Recalculate loan status automatically on update
  recalculateLoanStatus(loans[index]);

  writeDb("loans.json", loans);
  addLog("Loan Updated", `Updated loan details for: ${loans[index].borrowerName}`);
  res.json(loans[index]);
});

app.delete("/api/loans/:id", verifyToken, (req, res) => {
  let loans = readDb("loans.json");
  const loan = loans.find((l: any) => l.id === req.params.id);

  if (!loan) {
    return res.status(404).json({ error: "Loan not found" });
  }

  loans = loans.filter((l: any) => l.id !== req.params.id);
  writeDb("loans.json", loans);

  addLog("Loan Deleted", `Removed loan profile of: ${loan.borrowerName}`);
  res.json({ success: true });
});

// Loan payments routes
app.post("/api/loans/:id/payments", verifyToken, (req, res) => {
  const loans = readDb("loans.json");
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

  writeDb("loans.json", loans);
  addLog("Loan Payment Recorded", `Recorded payment of ${newPayment.amountPaid} PHP from ${loans[index].borrowerName}`);
  res.json(loans[index]);
});

app.put("/api/loans/:loanId/payments/:paymentId", verifyToken, (req, res) => {
  const loans = readDb("loans.json");
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
    amountPaid: parseFloat(req.body.amountPaid) || loans[lIndex].payments[pIndex].amountPaid
  };

  recalculateLoanStatus(loans[lIndex]);
  writeDb("loans.json", loans);
  addLog("Loan Payment Updated", `Updated loan payment record for ${loans[lIndex].borrowerName}`);
  res.json(loans[lIndex]);
});

app.delete("/api/loans/:loanId/payments/:paymentId", verifyToken, (req, res) => {
  const loans = readDb("loans.json");
  const lIndex = loans.findIndex((l: any) => l.id === req.params.loanId);

  if (lIndex === -1) {
    return res.status(404).json({ error: "Loan not found" });
  }

  loans[lIndex].payments = loans[lIndex].payments.filter((p: any) => p.id !== req.params.paymentId);
  recalculateLoanStatus(loans[lIndex]);
  writeDb("loans.json", loans);
  addLog("Loan Payment Deleted", `Deleted loan payment record for ${loans[lIndex].borrowerName}`);
  res.json(loans[lIndex]);
});

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
app.get("/api/archives", verifyToken, (req, res) => {
  res.json(readDb("archives.json"));
});

// Restore archive (Dangerous but highly requested)
app.post("/api/archives/:id/restore", verifyToken, (req, res) => {
  const archives = readDb("archives.json");
  const index = archives.findIndex((a: any) => a.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: "Archive not found" });
  }

  const archiveToRestore = archives[index];
  const billingCycleData = readDb("billing_cycles.json");

  // Keep restored cycle as active
  billingCycleData.activeCycle = archiveToRestore.cycle;
  writeDb("billing_cycles.json", billingCycleData);

  // Restore datasets (We append/merge or replace. Replacing active workspace is the direct restore behavior)
  writeDb("customers.json", archiveToRestore.data.customers);
  writeDb("purchases.json", archiveToRestore.data.purchases);
  writeDb("payments.json", archiveToRestore.data.payments);

  // Remove archive record
  const updatedArchives = archives.filter((a: any) => a.id !== req.params.id);
  writeDb("archives.json", updatedArchives);

  addLog("Archive Restored", `Restored archive of ${archiveToRestore.cycle} back to the active workspace.`);
  res.json({ success: true, restoredCycle: archiveToRestore.cycle });
});

// 9. LOGS API
app.get("/api/logs", verifyToken, (req, res) => {
  res.json(readDb("activity_logs.json"));
});

// 10. BACKUP API
app.get("/api/backups", verifyToken, (req, res) => {
  try {
    const files = fs.readdirSync(BACKUPS_DIR).filter(f => f.endsWith(".json"));
    const backups = files.map(file => {
      const stats = fs.statSync(path.join(BACKUPS_DIR, file));
      return {
        id: file,
        filename: file,
        type: file.startsWith("auto_") ? "automatic" : "manual",
        createdAt: stats.birthtime.toISOString(),
        size: stats.size
      };
    });
    // Return newest first
    backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json(backups);
  } catch (error) {
    res.status(500).json({ error: "Could not list backups" });
  }
});

app.post("/api/backups", verifyToken, (req, res) => {
  try {
    createSystemBackup(false);
    addLog("Backup Created", "Manual backup successfully generated.");
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Backup creation failed" });
  }
});

app.post("/api/backups/:id/restore", verifyToken, (req, res) => {
  try {
    const backupFile = req.params.id;
    const backupPath = path.join(BACKUPS_DIR, backupFile);
    
    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ error: "Backup file not found" });
    }

    const backupContent = fs.readFileSync(backupPath, "utf8");
    const data = JSON.parse(backupContent);

    // Validate structure briefly
    if (!data.settings || !data.customers || !data.purchases || !data.payments || !data.loans) {
      return res.status(400).json({ error: "Invalid backup file structure" });
    }

    // Restore each database file
    writeDb("settings.json", data.settings);
    writeDb("billing_cycles.json", data.billingCycles || { activeCycle: "July 2026", cycles: ["July 2026"] });
    writeDb("customers.json", data.customers);
    writeDb("purchases.json", data.purchases);
    writeDb("payments.json", data.payments);
    writeDb("loans.json", data.loans);
    writeDb("archives.json", data.archives || []);
    writeDb("activity_logs.json", data.activityLogs || []);

    addLog("System Restored", `System restored successfully from backup file: ${backupFile}`);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to restore backup" });
  }
});

app.delete("/api/backups/:id", verifyToken, (req, res) => {
  try {
    const backupFile = req.params.id;
    const backupPath = path.join(BACKUPS_DIR, backupFile);
    
    if (fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath);
      addLog("Backup Deleted", `Backup file deleted: ${backupFile}`);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Backup file not found" });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to delete backup file" });
  }
});

// Import complete backup from uploaded JSON string
app.post("/api/backups/import", verifyToken, (req, res) => {
  try {
    const data = req.body;
    
    if (!data.settings || !data.customers || !data.purchases || !data.payments || !data.loans) {
      return res.status(400).json({ error: "Invalid import schema" });
    }

    // Restore files
    writeDb("settings.json", data.settings);
    writeDb("billing_cycles.json", data.billingCycles || { activeCycle: "July 2026", cycles: ["July 2026"] });
    writeDb("customers.json", data.customers);
    writeDb("purchases.json", data.purchases);
    writeDb("payments.json", data.payments);
    writeDb("loans.json", data.loans);
    writeDb("archives.json", data.archives || []);
    writeDb("activity_logs.json", data.activityLogs || []);

    addLog("Backup Imported", "A full external backup JSON was imported successfully.");
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to import backup JSON" });
  }
});

// Export complete system state as a direct download
app.get("/api/backups/export", verifyToken, (req, res) => {
  try {
    const backupData = {
      timestamp: new Date().toISOString(),
      type: "exported",
      settings: readDb("settings.json"),
      billingCycles: readDb("billing_cycles.json"),
      customers: readDb("customers.json"),
      purchases: readDb("purchases.json"),
      payments: readDb("payments.json"),
      loans: readDb("loans.json"),
      archives: readDb("archives.json"),
      activityLogs: readDb("activity_logs.json")
    };

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename=pfms_export_${new Date().toISOString().split("T")[0]}.json`);
    res.send(JSON.stringify(backupData, null, 2));
  } catch (error) {
    res.status(500).json({ error: "Export failed" });
  }
});


// ==========================================
// VITE OR STATIC FRONTEND SERVING
// ==========================================

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Development Mode
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production Mode
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
});
