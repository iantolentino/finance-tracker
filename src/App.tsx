import React, { useState, useEffect, Suspense } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  LayoutDashboard,
  CreditCard,
  Calculator,
  Archive,
  FileText,
  Settings as SettingsIcon,
  LogOut,
  Menu,
  X,
  TrendingUp,
  User,
  Lock,
  Eye,
  EyeOff,
  Building,
  ShieldAlert,
  Sun,
  Moon,
  Wallet,
  Plus
} from "lucide-react";

import { api, getAuthToken, setAuthToken, getDisplayName, setDisplayName } from "./api";
import { Customer, Purchase, Payment, Loan, SystemSettings, ActivityLog, BackupRecord } from "./types";

// Components
const Dashboard = React.lazy(() => import("./components/Dashboard"));
const SPayLater = React.lazy(() => import("./components/SPayLater"));
const Lending = React.lazy(() => import("./components/Lending"));
const BudgetTracker = React.lazy(() => import("./components/BudgetTracker"));
const Archives = React.lazy(() => import("./components/Archives"));
const Reports = React.lazy(() => import("./components/Reports"));
const Settings = React.lazy(() => import("./components/Settings"));
const QuickLogModal = React.lazy(() => import("./components/QuickLogModal"));

export default function App() {
  // Authentication states
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isVerifyingAuth, setIsVerifyingAuth] = useState<boolean>(true);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [displayName, setDisplayNameState] = useState("");

  // System states
  const [currentTab, setCurrentTab] = useState<string>("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const [quickLogPreset, setQuickLogPreset] = useState<{ customerId?: string; loanId?: string } | null>(null);

  // Database datasets state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [archives, setArchives] = useState<any[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [settings, setSettings] = useState<SystemSettings>({
    currency: "PHP",
    theme: "light",
    personalBusinessName: "Personal Finance Management System",
    defaultBillingDate: "15",
    defaultDueDate: "30",
    backupPreference: "manual"
  });
  const [activeCycle, setActiveCycle] = useState<string>("July 2026");
  const [availableCycles, setAvailableCycles] = useState<string[]>(["July 2026"]);

  // Dynamic theme applier
  useEffect(() => {
    if (settings.theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [settings.theme]);

  // Activity logs are an audit trail, not something that needs to stay live
  // after every click - fetch fresh only when the Settings tab (which
  // displays them) is actually opened, instead of after every mutation.
  useEffect(() => {
    if (currentTab === "settings" && isAuthenticated) {
      refreshLogs();
    }
  }, [currentTab, isAuthenticated]);

  // Global Session Check
  useEffect(() => {
    const checkAuth = async () => {
      const token = getAuthToken();
      if (!token) {
        setIsVerifyingAuth(false);
        return;
      }
      try {
        const verifyRes = await api.verify(token);
        if (verifyRes.valid) {
          setIsAuthenticated(true);
          setDisplayNameState(getDisplayName() || "");
          await loadAllData();
        } else {
          setAuthToken(null);
          setDisplayName(null);
        }
      } catch (err) {
        setAuthToken(null);
        setDisplayName(null);
      } finally {
        setIsVerifyingAuth(false);
      }
    };

    checkAuth();

    // Listen for auth expiration events from API layer
    const handleAuthExpired = () => {
      setIsAuthenticated(false);
      setDisplayNameState("");
      setCustomers([]);
      setPurchases([]);
      setPayments([]);
      setLoans([]);
      setArchives([]);
      setLogs([]);
      setBackups([]);
    };

    window.addEventListener("auth-expired", handleAuthExpired);
    return () => {
      window.removeEventListener("auth-expired", handleAuthExpired);
    };
  }, []);

  // Fetch all database records
  const loadAllData = async () => {
    try {
      const [
        cyclesData,
        customersList,
        purchasesList,
        paymentsList,
        loansList,
        archivesList,
        logsList,
        backupsList,
        settingsData
      ] = await Promise.all([
        api.getBillingCycles(),
        api.getCustomers(),
        api.getPurchases(),
        api.getPayments(),
        api.getLoans(),
        api.getArchives(),
        api.getLogs(),
        api.getBackups(),
        api.getSettings()
      ]);

      setActiveCycle(cyclesData.activeCycle);
      setAvailableCycles(cyclesData.cycles);
      setCustomers(customersList);
      setPurchases(purchasesList);
      setPayments(paymentsList);
      setLoans(loansList);
      setArchives(archivesList);
      setLogs(logsList);
      setBackups(backupsList);
      setSettings(settingsData);
    } catch (err) {
      console.error("Failed to load records:", err);
    }
  };

  // Login handler
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    try {
      const loginRes = await api.login(loginUsername, loginPassword);
      if (loginRes.success) {
        setAuthToken(loginRes.token);
        setDisplayName(loginRes.displayName);
        setDisplayNameState(loginRes.displayName);
        setIsAuthenticated(true);
        await loadAllData();
        setLoginUsername("");
        setLoginPassword("");
      }
    } catch (err: any) {
      setLoginError(err.message || "Invalid username or password!");
    }
  };

  // Logout handler
  const handleLogout = () => {
    if (confirm("Are you sure you want to log out of the system?")) {
      setAuthToken(null);
      setDisplayName(null);
      setIsAuthenticated(false);
      setDisplayNameState("");
      setCurrentTab("dashboard");
    }
  };

  // ==========================================
  // CUSTOMERS OPERATIONS
  // ==========================================
  const handleAddCustomer = async (c: Partial<Customer>) => {
    const newCust = await api.createCustomer(c);
    setCustomers(prev => [...prev, newCust]);
    return newCust;
  };

  const handleEditCustomer = async (id: string, c: Partial<Customer>) => {
    const updatedCust = await api.updateCustomer(id, c);
    setCustomers(prev => prev.map(cust => cust.id === id ? updatedCust : cust));
    return updatedCust;
  };

  const handleDeleteCustomer = async (id: string) => {
    const res = await api.deleteCustomer(id);
    if (res.success) {
      setCustomers(prev => prev.filter(c => c.id !== id));
      setPurchases(prev => prev.filter(p => p.customerId !== id));
      setPayments(prev => prev.filter(p => p.customerId !== id));
    }
    return res;
  };

  // Merges a server-recalculated customer (returned alongside purchase/payment
  // writes) into local state, instead of refetching the entire customer list.
  const mergeUpdatedCustomer = (updatedCustomer: Customer | null) => {
    if (!updatedCustomer) return;
    setCustomers(prev => prev.map(c => c.id === updatedCustomer.id ? updatedCustomer : c));
  };

  // ==========================================
  // PURCHASES OPERATIONS
  // ==========================================
  const handleAddPurchase = async (p: Partial<Purchase>) => {
    const { purchase, updatedCustomer } = await api.createPurchase(p);
    setPurchases(prev => [...prev, purchase]);
    mergeUpdatedCustomer(updatedCustomer);
    return purchase;
  };

  const handleEditPurchase = async (id: string, p: Partial<Purchase>) => {
    const { purchase, updatedCustomer } = await api.updatePurchase(id, p);
    setPurchases(prev => prev.map(item => item.id === id ? purchase : item));
    mergeUpdatedCustomer(updatedCustomer);
    return purchase;
  };

  const handleDeletePurchase = async (id: string) => {
    const res = await api.deletePurchase(id);
    if (res.success) {
      setPurchases(prev => prev.filter(item => item.id !== id));
      mergeUpdatedCustomer(res.updatedCustomer);
    }
    return res;
  };

  // ==========================================
  // PAYMENTS OPERATIONS
  // ==========================================
  const handleAddPayment = async (pay: Partial<Payment>) => {
    const { payment, updatedCustomer } = await api.createPayment(pay);
    setPayments(prev => [...prev, payment]);
    mergeUpdatedCustomer(updatedCustomer);
    return payment;
  };

  const handleEditPayment = async (id: string, pay: Partial<Payment>) => {
    const { payment, updatedCustomer } = await api.updatePayment(id, pay);
    setPayments(prev => prev.map(p => p.id === id ? payment : p));
    mergeUpdatedCustomer(updatedCustomer);
    return payment;
  };

  const handleDeletePayment = async (id: string) => {
    const res = await api.deletePayment(id);
    if (res.success) {
      setPayments(prev => prev.filter(p => p.id !== id));
      mergeUpdatedCustomer(res.updatedCustomer);
    }
    return res;
  };

  // ==========================================
  // LENDING / CASH LOANS OPERATIONS
  // ==========================================
  const handleAddLoan = async (loan: Partial<Loan>) => {
    const newLoan = await api.createLoan(loan);
    setLoans(prev => [...prev, newLoan]);
    return newLoan;
  };

  const handleEditLoan = async (id: string, loan: Partial<Loan>) => {
    const updatedLoan = await api.updateLoan(id, loan);
    setLoans(prev => prev.map(l => l.id === id ? updatedLoan : l));
    return updatedLoan;
  };

  const handleDeleteLoan = async (id: string) => {
    const res = await api.deleteLoan(id);
    if (res.success) {
      setLoans(prev => prev.filter(l => l.id !== id));
    }
    return res;
  };

  // Loan Payments
  const handleAddLoanPayment = async (loanId: string, pay: any) => {
    const updatedLoan = await api.createLoanPayment(loanId, pay);
    setLoans(prev => prev.map(l => l.id === loanId ? updatedLoan : l));
    return updatedLoan;
  };

  const handleEditLoanPayment = async (loanId: string, paymentId: string, pay: any) => {
    const updatedLoan = await api.updateLoanPayment(loanId, paymentId, pay);
    setLoans(prev => prev.map(l => l.id === loanId ? updatedLoan : l));
    return updatedLoan;
  };

  const handleDeleteLoanPayment = async (loanId: string, paymentId: string) => {
    const updatedLoan = await api.deleteLoanPayment(loanId, paymentId);
    setLoans(prev => prev.map(l => l.id === loanId ? updatedLoan : l));
    return updatedLoan;
  };

  // ==========================================
  // QUICK LOG (one entry point for any of the 3 places money gets logged)
  // ==========================================
  const handleQuickLogCustomerPayment = async (customerId: string, amount: number) => {
    return handleAddPayment({
      customerId,
      amountPaid: amount,
      paymentDate: new Date().toISOString().split("T")[0],
      paymentMethod: "Cash",
      notes: "Logged via Quick Log"
    });
  };

  const handleQuickLogLoanPayment = async (loanId: string, amount: number) => {
    return handleAddLoanPayment(loanId, {
      amountPaid: amount,
      paymentDate: new Date().toISOString().split("T")[0],
      paymentMethod: "Cash",
      notes: "Logged via Quick Log"
    });
  };

  const handleQuickLogBudgetExpense = async (allocationId: string, amount: number, itemName: string) => {
    return api.addBudgetExpense({
      month: activeCycle,
      allocationId,
      itemName,
      amount,
      date: new Date().toISOString().split("T")[0],
      notes: "Logged via Quick Log"
    });
  };

  // Opens Quick Log pre-filled for a specific customer/loan - used by the
  // Dashboard's Needs Attention widget so acting on an overdue record is one tap.
  const openQuickLogFor = (preset: { customerId?: string; loanId?: string }) => {
    setQuickLogPreset(preset);
    setQuickLogOpen(true);
  };

  // ==========================================
  // SETTINGS & REFRESHERS
  // ==========================================
  const handleUpdateSettings = async (updated: Partial<SystemSettings>) => {
    const res = await api.updateSettings(updated);
    if (res.success) {
      setSettings(res.settings);
    }
    return res;
  };

  const handleChangePassword = async (oldPass: string, newPass: string) => {
    const res = await api.changePassword({ oldPassword: oldPass, newPassword: newPass });
    if (res.success) {
      setAuthToken(res.token);
    }
    return res;
  };

  const handleCompleteBillingCycle = async () => {
    const res = await api.completeBillingCycle();
    if (res.success) {
      // Narrower than a full loadAllData() reload - only these actually change
      // when a cycle completes. (Budgets are BudgetTracker's own state, kept
      // in sync there via its activeCycle-dependent fetch effect.)
      const [cyclesData, customersList, purchasesList, paymentsList, archivesList] = await Promise.all([
        api.getBillingCycles(),
        api.getCustomers(),
        api.getPurchases(),
        api.getPayments(),
        api.getArchives()
      ]);
      setActiveCycle(cyclesData.activeCycle);
      setAvailableCycles(cyclesData.cycles);
      setCustomers(customersList);
      setPurchases(purchasesList);
      setPayments(paymentsList);
      setArchives(archivesList);
    }
    return res;
  };

  const handleRestoreArchive = async (id: string) => {
    const res = await api.restoreArchive(id);
    if (res.success) {
      const [cyclesData, customersList, purchasesList, paymentsList, archivesList] = await Promise.all([
        api.getBillingCycles(),
        api.getCustomers(),
        api.getPurchases(),
        api.getPayments(),
        api.getArchives()
      ]);
      setActiveCycle(cyclesData.activeCycle);
      setAvailableCycles(cyclesData.cycles);
      setCustomers(customersList);
      setPurchases(purchasesList);
      setPayments(paymentsList);
      setArchives(archivesList);
    }
    return res;
  };

  const refreshBackups = async () => {
    const backupsList = await api.getBackups();
    setBackups(backupsList);
  };

  const refreshLogs = async () => {
    const logsList = await api.getLogs();
    setLogs(logsList);
  };

  // Verified loader spinner
  if (isVerifyingAuth) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-slate-50 gap-4">
        <div className="w-12 h-12 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest animate-pulse">
          Securing Workspace Environment...
        </span>
      </div>
    );
  }

  // Master login flow
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen w-screen items-center justify-center bg-slate-50 p-4">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden"
        >
          {/* Cover bar decoration */}
          <div className="h-2.5 bg-gradient-to-r from-brand-600 via-brand-500 to-slate-800" />
          <div className="p-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="inline-flex p-3 bg-brand-50 text-brand-600 rounded-2xl">
                <Building className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold tracking-tight text-slate-950">PFMS Workspace</h2>
              <p className="text-xs text-slate-500">
                Personal Finance Management System. Authentication Required.
              </p>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Username
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-slate-400">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    autoComplete="username"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="Enter Username..."
                    className="w-full pl-9 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-slate-50/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-slate-400">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type={showLoginPass ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter Password..."
                    className="w-full pl-9 pr-10 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-slate-50/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPass(!showLoginPass)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                  >
                    {showLoginPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {loginError && (
                <div className="text-[11px] font-medium text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-100 flex items-center gap-1.5 animate-bounce">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow transition"
              >
                Access System Workspace
              </button>
            </form>

            <div className="border-t border-slate-100 pt-4 text-center">
              <span className="text-[10px] text-slate-400">
                Authorized Use Only • Powered by Secure local JSON-Persistence
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Sidebar Layout definition
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "spaylater", label: "SPayLater Tracker", icon: CreditCard },
    { id: "lending", label: "Lending Portfolio", icon: Calculator },
    { id: "budget", label: "Monthly Budget", icon: Wallet },
    { id: "archives", label: "Monthly Archives", icon: Archive },
    { id: "reports", label: "Financial Reports", icon: FileText },
    { id: "settings", label: "System Settings", icon: SettingsIcon }
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col md:flex-row relative">
      {/* Mobile Top Header (collapsible drawer toggle) */}
      <div className="md:hidden flex items-center justify-between bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 p-4 shrink-0 print:hidden">
        <span className="text-xs font-bold uppercase tracking-wider">{settings.personalBusinessName}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              const nextTheme = settings.theme === "dark" ? "light" : "dark";
              await handleUpdateSettings({ theme: nextTheme });
            }}
            className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            title={settings.theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {settings.theme === "dark" ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5 text-brand-500" />}
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg transition"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex flex-col w-[260px] bg-white dark:bg-slate-900 text-slate-900 dark:text-white shrink-0 border-r border-slate-200 dark:border-slate-800 sticky top-0 h-screen print:hidden">
        {/* Brand details */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="p-2 bg-brand-600 rounded-xl text-white shrink-0">
            <Building className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xs font-black truncate">{settings.personalBusinessName}</h2>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">{displayName || "Workspace"}</span>
          </div>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentTab(item.id);
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all duration-150 ${
                  currentTab === item.id
                    ? "bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 border-l-2 border-brand-600 rounded-l-none"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Bottom details / logout */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
          <button
            onClick={async () => {
              const nextTheme = settings.theme === "dark" ? "light" : "dark";
              await handleUpdateSettings({ theme: nextTheme });
            }}
            className="w-full flex items-center justify-between px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/40 hover:text-slate-900 dark:hover:text-white transition"
          >
            <div className="flex items-center gap-3">
              {settings.theme === "dark" ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-brand-500" />}
              <span>{settings.theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
            </div>
            <div className={`w-8 h-4 rounded-full p-0.5 transition-colors duration-200 ${settings.theme === "dark" ? "bg-brand-600" : "bg-slate-200 dark:bg-slate-700"}`}>
              <div className={`w-3 h-3 rounded-full bg-white transition-transform duration-200 ${settings.theme === "dark" ? "translate-x-4" : "translate-x-0"}`} />
            </div>
          </button>

          <div className="bg-slate-100 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-200 dark:border-slate-800/60 flex flex-col gap-1 text-xs text-slate-700 dark:text-slate-300">
            <div className="flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-brand-500 dark:text-brand-400 shrink-0" />
              <span className="truncate font-bold">Ian Tolentino</span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium ml-5">PFMS System Manager</span>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-700 dark:hover:text-red-300 transition"
          >
            <LogOut className="w-4 h-4" />
            Logout Session
          </button>
        </div>
      </aside>

      {/* Mobile Drawer Sidebar */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.aside
            initial={{ x: -260 }}
            animate={{ x: 0 }}
            exit={{ x: -260 }}
            transition={{ type: "tween", duration: 0.2 }}
            className="md:hidden fixed inset-y-0 left-0 w-[260px] bg-white dark:bg-slate-900 text-slate-900 dark:text-white shrink-0 z-40 flex flex-col border-r border-slate-200 dark:border-slate-800 print:hidden h-full shadow-2xl"
          >
            {/* Brand details with Mobile Close Button */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 bg-brand-600 rounded-xl text-white shrink-0">
                  <Building className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-xs font-black truncate">{settings.personalBusinessName}</h2>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">{displayName || "Workspace"}</span>
                </div>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg transition shrink-0"
                aria-label="Close Sidebar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation links */}
            <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setCurrentTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all duration-150 ${
                      currentTab === item.id
                        ? "bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 border-l-2 border-brand-600 rounded-l-none"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            {/* Bottom details / logout */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <button
                onClick={async () => {
                  const nextTheme = settings.theme === "dark" ? "light" : "dark";
                  await handleUpdateSettings({ theme: nextTheme });
                }}
                className="w-full flex items-center justify-between px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/40 hover:text-slate-900 dark:hover:text-white transition"
              >
                <div className="flex items-center gap-3">
                  {settings.theme === "dark" ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-brand-500" />}
                  <span>{settings.theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
                </div>
                <div className={`w-8 h-4 rounded-full p-0.5 transition-colors duration-200 ${settings.theme === "dark" ? "bg-brand-600" : "bg-slate-200 dark:bg-slate-700"}`}>
                  <div className={`w-3 h-3 rounded-full bg-white transition-transform duration-200 ${settings.theme === "dark" ? "translate-x-4" : "translate-x-0"}`} />
                </div>
              </button>

              <div className="bg-slate-100 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-200 dark:border-slate-800/60 flex flex-col gap-1 text-xs text-slate-700 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-brand-500 dark:text-brand-400 shrink-0" />
                  <span className="truncate font-bold">{displayName || "PFMS User"}</span>
                </div>
                <span className="text-[10px] text-slate-400 font-medium ml-5">PFMS System Manager</span>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-700 dark:hover:text-red-300 transition"
              >
                <LogOut className="w-4 h-4" />
                Logout Session
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Mobile Back-drop - Hide on print */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/40 z-30 md:hidden print:hidden"
        />
      )}

      {/* Main Content canvas view container */}
      <main className="flex-1 p-4 pb-24 md:p-8 overflow-x-hidden min-h-0 print:p-0">
        <Suspense fallback={
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
          </div>
        }>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentTab}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="max-w-6xl mx-auto h-full"
          >
            {currentTab === "dashboard" && (
              <Dashboard
                customers={customers}
                purchases={purchases}
                payments={payments}
                loans={loans}
                logs={logs}
                settings={settings}
                activeCycle={activeCycle}
                onNavigate={setCurrentTab}
                onQuickLog={openQuickLogFor}
              />
            )}

            {currentTab === "spaylater" && (
              <SPayLater
                customers={customers}
                purchases={purchases}
                payments={payments}
                settings={settings}
                activeCycle={activeCycle}
                onAddCustomer={handleAddCustomer}
                onEditCustomer={handleEditCustomer}
                onDeleteCustomer={handleDeleteCustomer}
                onAddPurchase={handleAddPurchase}
                onEditPurchase={handleEditPurchase}
                onDeletePurchase={handleDeletePurchase}
                onAddPayment={handleAddPayment}
                onEditPayment={handleEditPayment}
                onDeletePayment={handleDeletePayment}
                onCompleteBillingCycle={handleCompleteBillingCycle}
              />
            )}

            {currentTab === "lending" && (
              <Lending
                loans={loans}
                settings={settings}
                onAddLoan={handleAddLoan}
                onEditLoan={handleEditLoan}
                onDeleteLoan={handleDeleteLoan}
                onAddLoanPayment={handleAddLoanPayment}
                onEditLoanPayment={handleEditLoanPayment}
                onDeleteLoanPayment={handleDeleteLoanPayment}
              />
            )}

            {currentTab === "budget" && (
              <BudgetTracker
                settings={settings}
                activeCycle={activeCycle}
                availableCycles={availableCycles}
                customers={customers}
                purchases={purchases}
                loans={loans}
              />
            )}

            {currentTab === "archives" && (
              <Archives
                archives={archives}
                settings={settings}
                onRestoreArchive={handleRestoreArchive}
              />
            )}

            {currentTab === "reports" && (
              <Reports
                customers={customers}
                purchases={purchases}
                payments={payments}
                loans={loans}
                settings={settings}
                activeCycle={activeCycle}
              />
            )}

            {currentTab === "settings" && (
              <Settings
                settings={settings}
                logs={logs}
                backups={backups}
                onUpdateSettings={handleUpdateSettings}
                onChangePassword={handleChangePassword}
                onRefreshBackups={refreshBackups}
                onRefreshLogs={refreshLogs}
              />
            )}
          </motion.div>
        </AnimatePresence>
        </Suspense>
      </main>

      {/* Quick Log FAB - desktop only; mobile gets the elevated center button in the bottom nav below */}
      <button
        type="button"
        onClick={() => setQuickLogOpen(true)}
        title="Log Money"
        className="hidden md:flex fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-brand-600 hover:bg-brand-700 text-white shadow-lg shadow-brand-600/30 items-center justify-center transition print:hidden"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Mobile Bottom Navigation - 1 tap to switch between the most-used
          tabs instead of hamburger-then-drawer, plus the Quick Log action
          front and center. "More" reuses the existing drawer for the rest. */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-stretch justify-around print:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {[
          { id: "dashboard", label: "Home", icon: LayoutDashboard },
          { id: "spaylater", label: "SPayLater", icon: CreditCard }
        ].map(item => {
          const Icon = item.icon;
          const active = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[56px] ${
                active ? "text-brand-600 dark:text-brand-400" : "text-slate-500 dark:text-slate-400"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[9px] font-semibold">{item.label}</span>
            </button>
          );
        })}

        <button
          onClick={() => setQuickLogOpen(true)}
          className="flex-1 flex flex-col items-center justify-center"
          title="Log Money"
        >
          <span className="-mt-6 w-12 h-12 rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/30 flex items-center justify-center">
            <Plus className="w-6 h-6" />
          </span>
        </button>

        {[
          { id: "budget", label: "Budget", icon: Wallet }
        ].map(item => {
          const Icon = item.icon;
          const active = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[56px] ${
                active ? "text-brand-600 dark:text-brand-400" : "text-slate-500 dark:text-slate-400"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[9px] font-semibold">{item.label}</span>
            </button>
          );
        })}

        <button
          onClick={() => setMobileMenuOpen(true)}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[56px] text-slate-500 dark:text-slate-400"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[9px] font-semibold">More</span>
        </button>
      </nav>

      {quickLogOpen && (
        <Suspense fallback={null}>
          <QuickLogModal
            onClose={() => { setQuickLogOpen(false); setQuickLogPreset(null); }}
            customers={customers}
            loans={loans}
            activeCycle={activeCycle}
            settings={settings}
            onLogCustomerPayment={handleQuickLogCustomerPayment}
            onLogLoanPayment={handleQuickLogLoanPayment}
            onLogBudgetExpense={handleQuickLogBudgetExpense}
            initialCustomerId={quickLogPreset?.customerId}
            initialLoanId={quickLogPreset?.loanId}
          />
        </Suspense>
      )}
    </div>
  );
}
