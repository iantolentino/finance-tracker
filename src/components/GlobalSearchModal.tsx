import React, { useState, useMemo } from "react";
import { motion } from "motion/react";
import { X, Search, CreditCard, HandCoins } from "lucide-react";
import { Customer, Loan } from "../types";

interface GlobalSearchModalProps {
  onClose: () => void;
  customers: Customer[];
  loans: Loan[];
  onSelectCustomer: (customerId: string) => void;
  onSelectLoan: (loanId: string) => void;
}

export default function GlobalSearchModal({
  onClose,
  customers,
  loans,
  onSelectCustomer,
  onSelectLoan
}: GlobalSearchModalProps) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const customerResults = customers
      .filter(c => !q || c.fullName.toLowerCase().includes(q))
      .map(c => ({ kind: "customer" as const, id: c.id, label: c.fullName, sublabel: `SPayLater · ${c.status}` }));
    const loanResults = loans
      .filter(l => !q || l.borrowerName.toLowerCase().includes(q))
      .map(l => ({ kind: "loan" as const, id: l.id, label: l.borrowerName, sublabel: `Loan · ${l.status}` }));
    return [...customerResults, ...loanResults];
  }, [customers, loans, query]);

  const handleSelect = (kind: "customer" | "loan", id: string) => {
    if (kind === "customer") onSelectCustomer(id);
    else onSelectLoan(id);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-20 p-4">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-h-[70vh] flex flex-col"
      >
        <div className="flex items-center gap-2 p-3 border-b border-slate-100 dark:border-slate-800">
          <Search className="w-4 h-4 text-slate-400 ml-1" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customer or borrower..."
            className="flex-1 bg-transparent text-sm focus:outline-none dark:text-white"
          />
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg" title="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-1.5">
          {results.length === 0 && (
            <div className="text-xs text-slate-400 text-center py-8">No matches.</div>
          )}
          {results.map(r => (
            <button
              key={`${r.kind}-${r.id}`}
              onClick={() => handleSelect(r.kind, r.id)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              <span className="text-brand-600">
                {r.kind === "customer" ? <CreditCard className="w-4 h-4" /> : <HandCoins className="w-4 h-4" />}
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{r.label}</span>
                <span className="block text-[10px] text-slate-400">{r.sublabel}</span>
              </span>
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
