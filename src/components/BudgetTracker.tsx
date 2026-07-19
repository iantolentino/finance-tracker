import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Wallet,
  ArrowUpRight,
  TrendingUp,
  Percent,
  Plus,
  Trash2,
  Edit2,
  Calendar,
  Sparkles,
  RotateCcw,
  Check,
  AlertTriangle,
  Receipt,
  FileSpreadsheet,
  Info,
  DollarSign,
  ChevronRight,
  ArrowRightLeft,
  X
} from "lucide-react";
import { MonthlyBudget, BudgetAllocation, BudgetExpense, SystemSettings, Customer, Purchase, Loan } from "../types";
import { api } from "../api";

interface BudgetTrackerProps {
  settings: SystemSettings;
  // The budget's own calendar month - independent of SPayLater's billing
  // cycle, so completing/resetting an SPayLater cycle never touches Budget data.
  budgetMonth: string;
  activeCycle: string;
  availableCycles: string[];
  customers: Customer[];
  purchases: Purchase[];
  loans: Loan[];
}

export default function BudgetTracker({
  settings,
  budgetMonth,
  activeCycle,
  availableCycles,
  customers,
  purchases,
  loans
}: BudgetTrackerProps) {
  // State variables
  const [budgets, setBudgets] = useState<MonthlyBudget[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Modals state
  const [incomeModalOpen, setIncomeModalOpen] = useState<boolean>(false);
  const [allocModalOpen, setAllocModalOpen] = useState<boolean>(false);
  const [expenseModalOpen, setExpenseModalOpen] = useState<boolean>(false);
  const [rolloverModalOpen, setRolloverModalOpen] = useState<boolean>(false);

  // Selected or temp states for forms
  const [tempSalary, setTempSalary] = useState<string>("");
  const [tempAdditional, setTempAdditional] = useState<string>("");

  const [selectedAlloc, setSelectedAlloc] = useState<BudgetAllocation | null>(null);
  const [allocCategory, setAllocCategory] = useState<string>("");
  const [allocAmount, setAllocAmount] = useState<string>("");

  const [expenseAllocId, setExpenseAllocId] = useState<string>("");
  const [expenseName, setExpenseName] = useState<string>("");
  const [expenseAmount, setExpenseAmount] = useState<string>("");
  const [expenseDate, setExpenseDate] = useState<string>("");
  const [expenseNotes, setExpenseNotes] = useState<string>("");

  const [rolloverSource, setRolloverSource] = useState<string>("");

  // Load budgets from backend
  const fetchBudgets = async () => {
    setLoading(true);
    try {
      const data = await api.getBudgets();
      setBudgets(data);
    } catch (err: any) {
      setError(err.message || "Failed to load budget records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBudgets();
    // Refetch when the calendar month rolls over so a newly-needed budget
    // record shows up without requiring a full page reload.
  }, [budgetMonth]);

  // Find the current active month's budget, or fall back to a default-initialized local one if not saved yet
  const activeBudget = budgets.find(b => b.month === budgetMonth) || {
    id: "temp-active",
    month: budgetMonth,
    salary: 0,
    additionalIncome: 0,
    allocations: [],
    expenses: [],
    createdAt: new Date().toISOString()
  };

  // Helper to open income editor
  const openIncomeModal = () => {
    setTempSalary(activeBudget.salary.toString());
    setTempAdditional(activeBudget.additionalIncome.toString());
    setIncomeModalOpen(true);
  };

  // Handle saving income
  const handleSaveIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updated = await api.updateBudgetConfig({
        month: budgetMonth,
        salary: Number(tempSalary) || 0,
        additionalIncome: Number(tempAdditional) || 0
      });
      // Update budgets list
      setBudgets(prev => {
        const idx = prev.findIndex(b => b.month === budgetMonth);
        if (idx === -1) {
          return [...prev, updated];
        }
        return prev.map(b => b.month === budgetMonth ? updated : b);
      });
      setIncomeModalOpen(false);
    } catch (err: any) {
      alert(err.message || "Failed to update salary configuration.");
    } finally {
      setIsSaving(false);
    }
  };

  // Helper to open Allocation modal
  const openAllocModal = (alloc: BudgetAllocation | null = null) => {
    if (alloc) {
      setSelectedAlloc(alloc);
      setAllocCategory(alloc.category);
      setAllocAmount(alloc.allocatedAmount.toString());
    } else {
      setSelectedAlloc(null);
      setAllocCategory("");
      setAllocAmount("");
    }
    setAllocModalOpen(true);
  };

  // Handle saving budget allocations
  const handleSaveAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocCategory.trim() || !allocAmount) return;

    setIsSaving(true);
    try {
      let updated: MonthlyBudget;
      if (selectedAlloc) {
        // Edit existing
        updated = await api.updateBudgetAllocation(selectedAlloc.id, {
          month: budgetMonth,
          category: allocCategory,
          allocatedAmount: Number(allocAmount) || 0
        });
      } else {
        // Create new
        updated = await api.addBudgetAllocation({
          month: budgetMonth,
          category: allocCategory,
          allocatedAmount: Number(allocAmount) || 0
        });
      }

      setBudgets(prev => {
        const idx = prev.findIndex(b => b.month === budgetMonth);
        if (idx === -1) return [...prev, updated];
        return prev.map(b => b.month === budgetMonth ? updated : b);
      });
      setAllocModalOpen(false);
    } catch (err: any) {
      alert(err.message || "Failed to save allocation.");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle deleting allocation
  const handleDeleteAllocation = async (id: string) => {
    if (!confirm("Are you sure you want to delete this budget category? This will also remove any logged expenses in this category!")) return;
    setIsSaving(true);
    try {
      const updated = await api.deleteBudgetAllocation(id, budgetMonth);
      setBudgets(prev => prev.map(b => b.month === budgetMonth ? updated : b));
    } catch (err: any) {
      alert(err.message || "Failed to delete allocation.");
    } finally {
      setIsSaving(false);
    }
  };

  // Helper to open log expense modal
  const openExpenseModal = (allocationId = "") => {
    setExpenseAllocId(allocationId || (activeBudget.allocations[0]?.id || ""));
    setExpenseName("");
    setExpenseAmount("");
    setExpenseDate(new Date().toISOString().split("T")[0]);
    setExpenseNotes("");
    setExpenseModalOpen(true);
  };

  // Handle logging a new expense
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseAllocId || !expenseName.trim() || !expenseAmount) return;

    setIsSaving(true);
    try {
      const updated = await api.addBudgetExpense({
        month: budgetMonth,
        allocationId: expenseAllocId,
        itemName: expenseName,
        amount: Number(expenseAmount) || 0,
        date: expenseDate,
        notes: expenseNotes
      });

      setBudgets(prev => prev.map(b => b.month === budgetMonth ? updated : b));
      setExpenseModalOpen(false);
    } catch (err: any) {
      alert(err.message || "Failed to log expense.");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle deleting an expense
  const handleDeleteExpense = async (id: string) => {
    if (!confirm("Are you sure you want to delete this expense transaction?")) return;
    setIsSaving(true);
    try {
      const updated = await api.deleteBudgetExpense(id, budgetMonth);
      setBudgets(prev => prev.map(b => b.month === budgetMonth ? updated : b));
    } catch (err: any) {
      alert(err.message || "Failed to delete expense.");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle budget template rollover (reset / rollover template)
  const handleRolloverBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rolloverSource) return;

    setIsSaving(true);
    try {
      const updated = await api.rolloverBudget({
        sourceMonth: rolloverSource,
        targetMonth: budgetMonth
      });

      setBudgets(prev => {
        const idx = prev.findIndex(b => b.month === budgetMonth);
        if (idx === -1) return [...prev, updated];
        return prev.map(b => b.month === budgetMonth ? updated : b);
      });
      setRolloverModalOpen(false);
    } catch (err: any) {
      alert(err.message || "Rollover failed.");
    } finally {
      setIsSaving(false);
    }
  };

  // Smart Sync Dues calculations
  // 1. Calculate SPayLater total bills due this billing cycle
  const activeCyclePurchases = useMemo(
    () => purchases.filter(p => p.billingCycle === activeCycle),
    [purchases, activeCycle]
  );
  const totalSPayLaterDue = useMemo(
    () => activeCyclePurchases.reduce((sum, p) => sum + p.totalAmount, 0),
    [activeCyclePurchases]
  );

  // 2. Active lending portfolio stats
  const { activeLoansCount, totalPrincipalLent } = useMemo(() => {
    const active = loans.filter(l => l.status === "Active");
    return {
      activeLoansCount: active.length,
      totalPrincipalLent: active.reduce((sum, l) => sum + l.principalAmount, 0)
    };
  }, [loans]);

  // Quick helper to add SPayLater directly as a recommended budget category
  const handleAddSpayLaterRecommendation = async () => {
    setIsSaving(true);
    try {
      const updated = await api.addBudgetAllocation({
        month: budgetMonth,
        category: `SPayLater Bill (${activeCycle})`,
        allocatedAmount: totalSPayLaterDue
      });
      setBudgets(prev => prev.map(b => b.month === budgetMonth ? updated : b));
      alert(`Success! Added 'SPayLater Bill (${activeCycle})' with a budget of ${settings.currency} ${totalSPayLaterDue.toLocaleString()}!`);
    } catch (err: any) {
      alert(err.message || "Failed to add allocation.");
    } finally {
      setIsSaving(false);
    }
  };

  // Calculations for dashboard circles & stats
  const totalIncome = activeBudget.salary + activeBudget.additionalIncome;
  const totalAllocated = useMemo(
    () => activeBudget.allocations.reduce((sum, a) => sum + a.allocatedAmount, 0),
    [activeBudget]
  );
  const totalSpent = useMemo(
    () => activeBudget.expenses.reduce((sum, e) => sum + e.amount, 0),
    [activeBudget]
  );

  const remainingCash = Math.max(0, totalIncome - totalSpent);
  // Raw "remaining cash" ignores money already committed elsewhere (SPayLater
  // dues for this cycle you haven't logged as a budget expense yet) - this is
  // the number that actually answers "can I afford this right now".
  const safeToSpend = Math.max(0, remainingCash - totalSPayLaterDue);
  const allocationProgress = totalIncome > 0 ? (totalAllocated / totalIncome) * 100 : 0;
  const spendingProgress = totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0;

  // How far through the active cycle we are, only meaningful for the
  // currently-live month - a past or future cycle has no "pace" to compare against.
  const cycleProgress = useMemo(() => {
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const parts = budgetMonth.split(" ");
    const monthIndex = monthNames.indexOf(parts[0]);
    const year = parseInt(parts[1], 10);
    if (monthIndex === -1 || Number.isNaN(year)) return null;

    const now = new Date();
    if (now.getFullYear() !== year || now.getMonth() !== monthIndex) return null;

    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    return { percentElapsed: (now.getDate() / daysInMonth) * 100 };
  }, [budgetMonth]);

  // "On track" / "Spending faster than usual" label for a given spent%,
  // relative to how far through the cycle we are.
  const pacingLabel = (spentPercent: number): { text: string; tone: "ok" | "warn" } | null => {
    if (!cycleProgress) return null;
    const aheadBy = spentPercent - cycleProgress.percentElapsed;
    if (aheadBy > 15) return { text: "Spending faster than usual", tone: "warn" };
    return { text: "On track", tone: "ok" };
  };

  // Render loading state
  if (loading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Loading Salary & Budgets...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
        <span className="text-sm font-semibold text-red-600 dark:text-red-400">{error}</span>
        <button
          onClick={() => { setError(""); fetchBudgets(); }}
          className="px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg bg-brand-600 text-white hover:bg-brand-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Header & Active Cycle Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-sm">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 rounded-lg text-[10px] font-bold uppercase tracking-wider">
            <Calendar className="w-3.5 h-3.5" />
            Active Budget Cycle
          </div>
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            Salary & Monthly Budgeting Tracker
            <span className="text-brand-600 dark:text-brand-400 font-medium">({budgetMonth})</span>
          </h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xl">
            Design dynamic budget allocations, track actual daily transactions, and configure recurring salaries.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setRolloverModalOpen(true)}
            className="inline-flex items-center justify-center px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm transition"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5 text-brand-500" />
            Rollover Template
          </button>
          <button
            onClick={openIncomeModal}
            className="inline-flex items-center justify-center px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-sm transition"
          >
            <Wallet className="w-3.5 h-3.5 mr-1.5" />
            Setup Monthly Income
          </button>
        </div>
      </div>

      {/* 2. Visual Statistics & Bento Grid Indicators - 2-up even on the
          smallest phones, 3-up from small tablets, so this doesn't take up
          the whole screen in a single stacked column. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Total Income Card */}
        <div className="p-3 sm:p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-sm space-y-2 sm:space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Cashflow</span>
            <div className="p-1.5 sm:p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-base sm:text-xl font-black text-slate-900 dark:text-white break-words">
              {settings.currency} {totalIncome.toLocaleString()}
            </h3>
            <p className="text-[9px] sm:text-[10px] text-slate-400 mt-1">
              Salary: {settings.currency} {activeBudget.salary.toLocaleString()} • Addl: {settings.currency} {activeBudget.additionalIncome.toLocaleString()}
            </p>
          </div>
          <div className="absolute bottom-0 inset-x-0 h-1 bg-emerald-500" />
        </div>

        {/* Allocated Budget Card */}
        <div className="p-3 sm:p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-sm space-y-2 sm:space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Allocated</span>
            <div className="p-1.5 sm:p-2 bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 rounded-xl">
              <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-base sm:text-xl font-black text-slate-900 dark:text-white break-words">
              {settings.currency} {totalAllocated.toLocaleString()}
            </h3>
            <div className="flex items-center gap-1.5 mt-1 text-[9px] sm:text-[10px]">
              <span className="text-brand-600 dark:text-brand-400 font-bold">{allocationProgress.toFixed(0)}%</span>
              <span className="text-slate-400">of cash flow allocated</span>
            </div>
          </div>
          <div className="absolute bottom-0 inset-x-0 h-1 bg-brand-500" />
        </div>

        {/* Actual Spent Card */}
        <div className="p-3 sm:p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-sm space-y-2 sm:space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Spending</span>
            <div className="p-1.5 sm:p-2 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-xl">
              <Receipt className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-base sm:text-xl font-black text-slate-900 dark:text-white break-words">
              {settings.currency} {totalSpent.toLocaleString()}
            </h3>
            <div className="flex items-center gap-1.5 mt-1 text-[9px] sm:text-[10px]">
              <span className={`${spendingProgress > 100 ? "text-red-500 font-extrabold" : "text-emerald-500 font-bold"}`}>
                {spendingProgress.toFixed(0)}%
              </span>
              <span className="text-slate-400">spent of target</span>
            </div>
            {spendingProgress <= 100 && pacingLabel(spendingProgress) && (
              <span className={`inline-block mt-1 text-[9px] font-bold uppercase tracking-wide ${pacingLabel(spendingProgress)!.tone === "warn" ? "text-amber-600" : "text-slate-400"}`}>
                {pacingLabel(spendingProgress)!.text}
              </span>
            )}
          </div>
          <div className="absolute bottom-0 inset-x-0 h-1 bg-rose-500" />
        </div>

        {/* Safe to Spend - nets out committed SPayLater dues, not just raw remaining cash */}
        <div className="p-3 sm:p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-sm space-y-2 sm:space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Safe to Spend</span>
            <div className="p-1.5 sm:p-2 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-xl">
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-base sm:text-xl font-black text-slate-900 dark:text-white break-words">
              {settings.currency} {safeToSpend.toLocaleString()}
            </h3>
            <p className="text-[9px] sm:text-[10px] text-slate-400 mt-1">
              {settings.currency} {remainingCash.toLocaleString()} remaining − {settings.currency} {totalSPayLaterDue.toLocaleString()} SPayLater dues
            </p>
          </div>
          <div className="absolute bottom-0 inset-x-0 h-1 bg-amber-500" />
        </div>
      </div>

      {/* 3. Deep Integration & Smart Warnings Container */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Header of allocations */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold uppercase text-slate-500 tracking-wider flex items-center gap-2">
              <Wallet className="w-4 h-4 text-slate-400" />
              Allocated Budget Categories ({activeBudget.allocations.length})
            </h3>
            <button
              onClick={() => openAllocModal()}
              className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/40 hover:bg-brand-100/80 rounded-xl transition"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Category
            </button>
          </div>

          {activeBudget.allocations.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-3">
              <div className="inline-flex p-3.5 bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-full">
                <Wallet className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Budget Categories Created Yet</h4>
              <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm mx-auto">
                Allocating your income helps you plan expenses. You can initialize with a previous layout using the "Rollover Template" button.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => openAllocModal()}
                  className="px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-sm transition"
                >
                  Create First Allocation Category
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {activeBudget.allocations.map((alloc) => {
                const percent = alloc.allocatedAmount > 0 ? (alloc.spentAmount / alloc.allocatedAmount) * 100 : 0;
                const isOverBudget = alloc.spentAmount > alloc.allocatedAmount;
                const pacing = !isOverBudget ? pacingLabel(percent) : null;

                return (
                  <div
                    key={alloc.id}
                    className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800/80 shadow-sm flex flex-col justify-between hover:shadow-md transition space-y-4"
                  >
                    {/* Allocation Card Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs shrink-0 truncate">
                          {alloc.category}
                        </h4>
                        <span className="text-[10px] text-slate-400 font-medium block">
                          Budget: {settings.currency} {alloc.allocatedAmount.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => openAllocModal(alloc)}
                          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-brand-600 rounded-lg transition"
                          title="Edit Category Name / Amount"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteAllocation(alloc.id)}
                          disabled={isSaving}
                          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-red-600 rounded-lg transition disabled:opacity-50"
                          title="Delete Category"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Allocated vs Spent Metrics */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-semibold text-slate-500">Spent: {settings.currency} {alloc.spentAmount.toLocaleString()}</span>
                        <span className={`font-bold ${isOverBudget ? "text-red-500" : "text-slate-400"}`}>
                          {percent.toFixed(0)}%
                        </span>
                      </div>

                      {/* Progress slider bar */}
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-350 ${
                            isOverBudget
                              ? "bg-red-500"
                              : percent > 85
                              ? "bg-amber-500"
                              : "bg-brand-600 dark:bg-brand-500"
                          }`}
                          style={{ width: `${Math.min(100, percent)}%` }}
                        />
                      </div>
                      {pacing && (
                        <span className={`inline-block text-[9px] font-bold uppercase tracking-wide ${pacing.tone === "warn" ? "text-amber-600" : "text-slate-400"}`}>
                          {pacing.text}
                        </span>
                      )}
                    </div>

                    {/* Quick Add Expense inside this specific Category */}
                    <div className="pt-2 border-t border-slate-50 dark:border-slate-800/50 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 italic">
                        {isOverBudget ? "Over budget limit" : `${settings.currency} ${(alloc.allocatedAmount - alloc.spentAmount).toLocaleString()} left`}
                      </span>
                      <button
                        onClick={() => openExpenseModal(alloc.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-lg transition"
                      >
                        <Plus className="w-3 h-3" />
                        Log Expense
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar panels for budget: Smart Sync with SPayLater & loans */}
        <div className="space-y-6">
          <h3 className="text-sm font-extrabold uppercase text-slate-500 tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
            Smart Integrations
          </h3>

          {/* SPayLater Integration Sync widget */}
          <div className="p-5 bg-gradient-to-br from-brand-900 to-slate-900 dark:from-brand-950 dark:to-slate-950 text-white rounded-2xl shadow-md border border-brand-500/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 transform translate-x-4 -translate-y-4 opacity-5 pointer-events-none">
              <TrendingUp className="w-48 h-48" />
            </div>

            <div className="space-y-4 relative z-10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-brand-500/20 rounded-xl border border-brand-400/30">
                  <TrendingUp className="w-4.5 h-4.5 text-brand-400" />
                </div>
                <div>
                  <h4 className="font-bold text-xs tracking-wide">SPayLater Active Cycle Sync</h4>
                  <p className="text-[10px] text-brand-200">Sync purchases due in active cycle</p>
                </div>
              </div>

              <div className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-1">
                <span className="text-[9px] uppercase font-bold text-brand-300 block">Total Due in {activeCycle}:</span>
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-black text-white">
                    {settings.currency} {totalSPayLaterDue.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-brand-200">{activeCyclePurchases.length} Purchase items</span>
                </div>
              </div>

              {activeBudget.allocations.some(a => a.category.toLowerCase().includes("spaylater")) ? (
                <div className="p-2.5 bg-emerald-500/15 text-emerald-300 text-[10px] rounded-xl border border-emerald-500/20 flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>SPayLater dues successfully integrated in your active budget categories!</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleAddSpayLaterRecommendation}
                  disabled={isSaving}
                  className="w-full py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow transition flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {isSaving ? "Adding..." : "Add SPayLater to Budget Category"}
                </button>
              )}
            </div>
          </div>

          {/* Lending portfolio collection statistics */}
          <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 rounded-xl">
                <FileSpreadsheet className="w-4.5 h-4.5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-200 text-xs">Lending Active Outstanding</h4>
                <p className="text-[10px] text-slate-400">Receivables tracking</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <span className="text-slate-500 font-medium">Active Borrowers:</span>
                <span className="font-bold text-slate-900 dark:text-white">{activeLoansCount} People</span>
              </div>
              <div className="flex items-center justify-between text-xs p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <span className="text-slate-500 font-medium">Outstanding Lent:</span>
                <span className="font-bold text-brand-600 dark:text-brand-400">
                  {settings.currency} {totalPrincipalLent.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-[10px] text-slate-400 dark:text-slate-500 flex items-start gap-2">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
              <span>Outstanding borrower payments do not automatically adjust your basic salary, but repayments count toward available personal cash.</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Spent Log Transactions details */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="space-y-0.5">
            <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">Spent Log & Transaction History</h3>
            <p className="text-[11px] text-slate-400">Individual expense payouts logged this billing month</p>
          </div>
          <button
            onClick={() => openExpenseModal()}
            disabled={activeBudget.allocations.length === 0}
            className="inline-flex items-center justify-center px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow transition"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Log New Outflow
          </button>
        </div>

        {activeBudget.expenses.length === 0 ? (
          <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-xs">
            No expenses logged for {budgetMonth} yet. Keep tracking your spending.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase font-bold text-[10px]">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Notes</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/40">
                {activeBudget.expenses
                  .slice()
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((exp) => {
                    const matchedAlloc = activeBudget.allocations.find(a => a.id === exp.allocationId);
                    return (
                      <tr key={exp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 text-slate-700 dark:text-slate-300 transition">
                        <td className="py-3 px-3 font-medium whitespace-nowrap">{exp.date}</td>
                        <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">{exp.itemName}</td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg text-[10px] font-bold">
                            {matchedAlloc ? matchedAlloc.category : "Unassigned"}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-400 max-w-xs truncate">{exp.notes || "—"}</td>
                        <td className="py-3 px-3 text-right font-black text-rose-600 dark:text-rose-400">
                          {settings.currency} {exp.amount.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => handleDeleteExpense(exp.id)}
                            disabled={isSaving}
                            className="p-1 text-slate-400 hover:text-red-500 rounded-lg transition disabled:opacity-50"
                            title="Delete transaction"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ==================== MODALS INBUILT SECTION ==================== */}

      {/* 1. Monthly Income Setup Modal Overlay */}
      {incomeModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl w-full max-w-sm overflow-hidden shadow-xl"
          >
            <div className="p-4 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between">
              <h4 className="font-bold text-slate-950 dark:text-white text-xs">Setup Cash Income ({budgetMonth})</h4>
              <button onClick={() => setIncomeModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveIncome} className="p-4 space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Primary Monthly Salary ({settings.currency})
                </label>
                <input
                  type="number"
                  required
                  value={tempSalary}
                  onChange={(e) => setTempSalary(e.target.value)}
                  placeholder="Enter monthly salary base..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Additional Cash Inflow / Sideline Income ({settings.currency})
                </label>
                <input
                  type="number"
                  value={tempAdditional}
                  onChange={(e) => setTempAdditional(e.target.value)}
                  placeholder="Freelance or bonus earnings..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setIncomeModalOpen(false)}
                  className="px-4 py-2 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl"
                >
                  Discard
                </button>
                <button type="submit" disabled={isSaving} className="px-4 py-2 bg-brand-600 text-white font-bold rounded-xl shadow-sm disabled:opacity-60">
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* 2. Allocation Add/Edit Modal Overlay */}
      {allocModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl w-full max-w-sm overflow-hidden shadow-xl"
          >
            <div className="p-4 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between">
              <h4 className="font-bold text-slate-950 dark:text-white text-xs">
                {selectedAlloc ? "Edit Budget Category" : "Add Budget Category"}
              </h4>
              <button onClick={() => setAllocModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveAllocation} className="p-4 space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Category Name
                </label>
                <input
                  type="text"
                  required
                  value={allocCategory}
                  onChange={(e) => setAllocCategory(e.target.value)}
                  placeholder="e.g. Groceries, Rent, Emergency Savings..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Allocated Limit Amount ({settings.currency})
                </label>
                <input
                  type="number"
                  required
                  value={allocAmount}
                  onChange={(e) => setAllocAmount(e.target.value)}
                  placeholder="Allocated maximum spent goal..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setAllocModalOpen(false)}
                  className="px-4 py-2 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl"
                >
                  Discard
                </button>
                <button type="submit" disabled={isSaving} className="px-4 py-2 bg-brand-600 text-white font-bold rounded-xl shadow-sm disabled:opacity-60">
                  {isSaving ? "Saving..." : selectedAlloc ? "Update Allocation" : "Add to Budget"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* 3. Log Expense Modal Overlay */}
      {expenseModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl w-full max-w-sm overflow-hidden shadow-xl"
          >
            <div className="p-4 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between">
              <h4 className="font-bold text-slate-950 dark:text-white text-xs">Log Outflow / Cash Spent</h4>
              <button onClick={() => setExpenseModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveExpense} className="p-4 space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Budget Allocation Category
                </label>
                <select
                  value={expenseAllocId}
                  onChange={(e) => setExpenseAllocId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  {activeBudget.allocations.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.category} (Limit: {settings.currency} {a.allocatedAmount.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Description / Item Name
                </label>
                <input
                  type="text"
                  required
                  value={expenseName}
                  onChange={(e) => setExpenseName(e.target.value)}
                  placeholder="e.g. Weekly grocery stock, Grab ride..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    Amount Paid
                  </label>
                  <input
                    type="number"
                    required
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    placeholder="PHP"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                  {expenseAllocId && expenseAmount && Number(expenseAmount) > 0 && (() => {
                    const alloc = activeBudget.allocations.find(a => a.id === expenseAllocId);
                    if (!alloc) return null;
                    const remaining = alloc.allocatedAmount - alloc.spentAmount;
                    const afterThis = remaining - Number(expenseAmount);
                    const overBudget = afterThis < 0;
                    const nearLimit = !overBudget && afterThis < alloc.allocatedAmount * 0.15;
                    return (
                      <p className={`mt-1 text-[10px] font-semibold ${overBudget ? "text-red-600" : nearLimit ? "text-amber-600" : "text-slate-400"}`}>
                        {overBudget
                          ? `Over budget by ${settings.currency} ${Math.abs(afterThis).toLocaleString()} for "${alloc.category}"`
                          : `${settings.currency} ${afterThis.toLocaleString()} left in "${alloc.category}" after this`}
                      </p>
                    );
                  })()}
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    Transaction Date
                  </label>
                  <input
                    type="date"
                    required
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 dark:text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Additional Memo / Notes (Optional)
                </label>
                <input
                  type="text"
                  value={expenseNotes}
                  onChange={(e) => setExpenseNotes(e.target.value)}
                  placeholder="Notes, store location, receipt info..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setExpenseModalOpen(false)}
                  className="px-4 py-2 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl"
                >
                  Discard
                </button>
                <button type="submit" disabled={isSaving} className="px-4 py-2 bg-brand-600 text-white font-bold rounded-xl shadow-sm disabled:opacity-60">
                  {isSaving ? "Saving..." : "Log Outflow"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* 4. Rollover / Reset Template Modal Overlay */}
      {rolloverModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl w-full max-w-sm overflow-hidden shadow-xl"
          >
            <div className="p-4 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between">
              <h4 className="font-bold text-slate-950 dark:text-white text-xs">Rollover Previous Month Layout</h4>
              <button onClick={() => setRolloverModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleRolloverBudget} className="p-4 space-y-4">
              <div className="p-3 bg-brand-50 dark:bg-brand-950/30 text-brand-700 dark:text-brand-300 text-[11px] rounded-xl border border-brand-100 dark:border-brand-900/50 leading-relaxed flex gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  This action copies your previous budget category limits and income settings from the chosen month into your current active month ({budgetMonth}), starting fresh with 0 spent.
                </span>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Source Month Budget Template
                </label>
                <select
                  required
                  value={rolloverSource}
                  onChange={(e) => setRolloverSource(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 dark:text-white focus:outline-none"
                >
                  <option value="">-- Choose past budget cycle --</option>
                  {budgets
                    .filter(b => b.month !== budgetMonth)
                    .map(b => (
                      <option key={b.id} value={b.month}>
                        {b.month} (Salary: {settings.currency} {b.salary.toLocaleString()})
                      </option>
                    ))}
                </select>
                {budgets.filter(b => b.month !== budgetMonth).length === 0 && (
                  <p className="text-[10px] text-red-500 mt-1">
                    No other monthly budgets exist yet in the database.
                  </p>
                )}
              </div>

              <div className="pt-2 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setRolloverModalOpen(false)}
                  className="px-4 py-2 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!rolloverSource || isSaving}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-sm transition"
                >
                  {isSaving ? "Rolling over..." : "Run Template Rollover"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
