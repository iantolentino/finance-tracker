import React, { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import { X, Search, Wallet, CreditCard, HandCoins } from "lucide-react";
import { Customer, Loan, SystemSettings } from "../types";
import { api } from "../api";

interface QuickLogModalProps {
  onClose: () => void;
  customers: Customer[];
  loans: Loan[];
  activeCycle: string;
  settings: SystemSettings;
  onLogCustomerPayment: (customerId: string, amount: number) => Promise<any>;
  onLogLoanPayment: (loanId: string, amount: number) => Promise<any>;
  onLogBudgetExpense: (allocationId: string, amount: number, itemName: string) => Promise<any>;
}

type Destination =
  | { kind: "customer"; id: string; label: string; sublabel: string }
  | { kind: "loan"; id: string; label: string; sublabel: string }
  | { kind: "budget"; id: string; label: string; sublabel: string };

const statusRank: Record<string, number> = { Overdue: 0, Active: 1, "Fully Paid": 2, Completed: 2 };

export default function QuickLogModal({
  onClose,
  customers,
  loans,
  activeCycle,
  settings,
  onLogCustomerPayment,
  onLogLoanPayment,
  onLogBudgetExpense
}: QuickLogModalProps) {
  const [amount, setAmount] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Destination | null>(null);
  const [budgetCategories, setBudgetCategories] = useState<{ id: string; category: string; remaining: number }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getBudgets()
      .then(budgets => {
        const active = budgets.find(b => b.month === activeCycle);
        if (active) {
          setBudgetCategories(active.allocations.map(a => ({
            id: a.id,
            category: a.category,
            remaining: a.allocatedAmount - a.spentAmount
          })));
        }
      })
      .catch(() => { /* Budget categories are optional in this picker - fine if unavailable */ });
  }, [activeCycle]);

  const destinations = useMemo<Destination[]>(() => {
    const customerDests: Destination[] = [...customers]
      .sort((a, b) => statusRank[a.status] - statusRank[b.status])
      .map(c => ({ kind: "customer", id: c.id, label: c.fullName, sublabel: `SPayLater · ${c.status}` }));

    const loanDests: Destination[] = [...loans]
      .sort((a, b) => statusRank[a.status] - statusRank[b.status])
      .map(l => ({ kind: "loan", id: l.id, label: l.borrowerName, sublabel: `Loan · ${l.status}` }));

    const budgetDests: Destination[] = budgetCategories.map(b => ({
      kind: "budget",
      id: b.id,
      label: b.category,
      sublabel: `Budget · ${settings.currency} ${b.remaining.toLocaleString()} remaining`
    }));

    const all = [...customerDests, ...loanDests, ...budgetDests];
    if (!query.trim()) return all;
    const q = query.trim().toLowerCase();
    return all.filter(d => d.label.toLowerCase().includes(q));
  }, [customers, loans, budgetCategories, query, settings.currency]);

  const handleConfirm = async () => {
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0 || !selected) return;

    setIsSubmitting(true);
    setError("");
    try {
      if (selected.kind === "customer") {
        await onLogCustomerPayment(selected.id, numericAmount);
      } else if (selected.kind === "loan") {
        await onLogLoanPayment(selected.id, numericAmount);
      } else {
        await onLogBudgetExpense(selected.id, numericAmount, "Quick log");
      }
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to log this entry.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const iconFor = (kind: Destination["kind"]) =>
    kind === "customer" ? <CreditCard className="w-4 h-4" /> : kind === "loan" ? <HandCoins className="w-4 h-4" /> : <Wallet className="w-4 h-4" />;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-h-[85vh] flex flex-col"
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Log Money</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg" title="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold">{settings.currency}</span>
              <input
                type="number"
                inputMode="decimal"
                autoFocus
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-14 pr-4 py-3 text-lg font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Where does it go?</label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search customer, loan, or category..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div className="max-h-56 overflow-y-auto space-y-1 border border-slate-100 dark:border-slate-800 rounded-xl p-1.5">
              {destinations.length === 0 && (
                <div className="text-xs text-slate-400 text-center py-6">No matches.</div>
              )}
              {destinations.map(d => (
                <button
                  key={`${d.kind}-${d.id}`}
                  type="button"
                  onClick={() => setSelected(d)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition ${
                    selected?.kind === d.kind && selected?.id === d.id
                      ? "bg-brand-600 text-white"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <span className={selected?.kind === d.kind && selected?.id === d.id ? "text-white" : "text-brand-600"}>
                    {iconFor(d.kind)}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-semibold truncate">{d.label}</span>
                    <span className={`block text-[10px] ${selected?.kind === d.kind && selected?.id === d.id ? "text-white/80" : "text-slate-400"}`}>
                      {d.sublabel}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="text-[11px] font-medium text-red-600 bg-red-50 dark:bg-red-950/30 p-2.5 rounded-xl border border-red-100 dark:border-red-900">
              {error}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            disabled={!amount || Number(amount) <= 0 || !selected || isSubmitting}
            onClick={handleConfirm}
            className="w-full py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-sm transition"
          >
            {isSubmitting ? "Logging..." : selected ? `Log ${settings.currency} ${amount || "0"} to ${selected.label}` : "Select a destination"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
