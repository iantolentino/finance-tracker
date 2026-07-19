import React, { useState } from "react";
import { motion } from "motion/react";
import { X } from "lucide-react";
import { CreditCardEntry, SystemSettings } from "../types";

interface CreditCardQuickAddModalProps {
  onClose: () => void;
  settings: SystemSettings;
  onAddEntry: (e: Partial<CreditCardEntry>) => Promise<any>;
}

const CATEGORIES = ["Groceries", "Dining", "Shopping", "Bills & Utilities", "Transportation", "Health", "Other"];

export default function CreditCardQuickAddModal({ onClose, settings, onAddEntry }: CreditCardQuickAddModalProps) {
  const [personName, setPersonName] = useState("");
  const [itemName, setItemName] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personName.trim() || !itemName.trim() || !amount || Number(amount) <= 0) return;

    setIsSubmitting(true);
    setError("");
    try {
      await onAddEntry({
        personName,
        itemName,
        category,
        amount: Number(amount),
        date: new Date().toISOString().split("T")[0]
      });
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to log this charge.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-h-[85vh] flex flex-col"
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Credit Card Charge</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg" title="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleConfirm} className="p-4 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Person / Customer</label>
            <input
              type="text"
              autoFocus
              required
              value={personName}
              onChange={(e) => setPersonName(e.target.value)}
              placeholder="Who is this charge for?"
              className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Item Purchased</label>
            <input
              type="text"
              required
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="What was bought?"
              className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 dark:text-white focus:outline-none"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold">{settings.currency}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  required
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-10 pr-3 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="text-[11px] font-medium text-red-600 bg-red-50 dark:bg-red-950/30 p-2.5 rounded-xl border border-red-100 dark:border-red-900">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!personName || !itemName || !amount || Number(amount) <= 0 || isSubmitting}
            className="w-full py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-sm transition"
          >
            {isSubmitting ? "Logging..." : "Log Charge"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
