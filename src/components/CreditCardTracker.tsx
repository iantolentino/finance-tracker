import React, { useState, useMemo } from "react";
import { Landmark, Plus, Trash2, Edit2, X, Search, Receipt } from "lucide-react";
import { CreditCardEntry, SystemSettings } from "../types";

interface CreditCardTrackerProps {
  entries: CreditCardEntry[];
  settings: SystemSettings;
  onAddEntry: (e: Partial<CreditCardEntry>) => Promise<any>;
  onEditEntry: (id: string, e: Partial<CreditCardEntry>) => Promise<any>;
  onDeleteEntry: (id: string) => Promise<any>;
}

const CATEGORIES = ["Groceries", "Dining", "Shopping", "Bills & Utilities", "Transportation", "Health", "Other"];

const emptyForm = {
  personName: "",
  itemName: "",
  category: CATEGORIES[0],
  amount: "",
  date: new Date().toISOString().split("T")[0],
  notes: ""
};

export default function CreditCardTracker({ entries, settings, onAddEntry, onEditEntry, onDeleteEntry }: CreditCardTrackerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [modal, setModal] = useState<{ open: boolean; editId?: string } & typeof emptyForm>({ open: false, ...emptyForm });
  const [isSaving, setIsSaving] = useState(false);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-PH", { style: "currency", currency: settings.currency || "PHP" }).format(amount);

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
    if (!q) return sorted;
    return sorted.filter(e => e.personName.toLowerCase().includes(q) || e.itemName.toLowerCase().includes(q) || e.category.toLowerCase().includes(q));
  }, [entries, searchQuery]);

  const totalCharged = useMemo(() => entries.reduce((sum, e) => sum + e.amount, 0), [entries]);

  const thisMonthTotal = useMemo(() => {
    const now = new Date();
    return entries
      .filter(e => {
        const d = new Date(e.date);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      })
      .reduce((sum, e) => sum + e.amount, 0);
  }, [entries]);

  const topCategory = useMemo(() => {
    const totals: Record<string, number> = {};
    entries.forEach(e => { totals[e.category] = (totals[e.category] || 0) + e.amount; });
    const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] || "—";
  }, [entries]);

  const openAddModal = () => setModal({ open: true, ...emptyForm });
  const openEditModal = (entry: CreditCardEntry) => setModal({
    open: true,
    editId: entry.id,
    personName: entry.personName,
    itemName: entry.itemName,
    category: entry.category,
    amount: entry.amount.toString(),
    date: entry.date,
    notes: entry.notes
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modal.personName.trim() || !modal.itemName.trim() || !modal.amount) return;
    setIsSaving(true);
    try {
      const payload = {
        personName: modal.personName,
        itemName: modal.itemName,
        category: modal.category,
        amount: Number(modal.amount) || 0,
        date: modal.date,
        notes: modal.notes
      };
      if (modal.editId) {
        await onEditEntry(modal.editId, payload);
      } else {
        await onAddEntry(payload);
      }
      setModal({ open: false, ...emptyForm });
    } catch (err: any) {
      alert(err.message || "Failed to save credit card charge.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this credit card charge entry?")) return;
    try {
      await onDeleteEntry(id);
    } catch (err: any) {
      alert(err.message || "Failed to delete entry.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 rounded-xl p-5 shadow-xs border border-slate-200/80 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Landmark className="w-6 h-6 text-brand-600 dark:text-brand-400" />
            Credit Card Tracker
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Log charges made on your personal credit card, by person and category. Kept separate from SPayLater, Lending, and Budget data.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition"
        >
          <Plus className="w-4 h-4 mr-2" />
          Log Charge
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Charged (All Time)</span>
          <h3 className="text-2xl font-bold text-slate-950 dark:text-white mt-2">{formatCurrency(totalCharged)}</h3>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">Charged This Month</span>
          <h3 className="text-2xl font-bold text-slate-950 dark:text-white mt-2">{formatCurrency(thisMonthTotal)}</h3>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">Top Category</span>
          <h3 className="text-2xl font-bold text-slate-950 dark:text-white mt-2">{topCategory}</h3>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by person, item, or category..."
          className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      {/* Entries table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        {filteredEntries.length === 0 ? (
          <div className="py-16 text-center text-slate-400 dark:text-slate-500 text-sm flex flex-col items-center gap-2">
            <Receipt className="w-8 h-8" />
            No credit card charges logged yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 uppercase font-bold text-[10px]">
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Person</th>
                  <th className="py-2.5 px-4">Item</th>
                  <th className="py-2.5 px-4">Category</th>
                  <th className="py-2.5 px-4 text-right">Amount</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/40">
                {filteredEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 text-slate-700 dark:text-slate-300 transition">
                    <td className="py-3 px-4 font-medium whitespace-nowrap">{entry.date}</td>
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{entry.personName}</td>
                    <td className="py-3 px-4">{entry.itemName}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg text-[10px] font-bold">
                        {entry.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-black text-brand-600 dark:text-brand-400">{formatCurrency(entry.amount)}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditModal(entry)}
                          className="p-1.5 text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 rounded-lg transition"
                          title="Edit entry"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(entry.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition"
                          title="Delete entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {modal.open && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between">
              <h4 className="font-bold text-slate-950 dark:text-white text-xs">
                {modal.editId ? "Edit Credit Card Charge" : "Log New Credit Card Charge"}
              </h4>
              <button onClick={() => setModal({ open: false, ...emptyForm })} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-4 space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Person / Customer</label>
                <input
                  type="text"
                  required
                  value={modal.personName}
                  onChange={(e) => setModal(m => ({ ...m, personName: e.target.value }))}
                  placeholder="Who is this charge for?"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Item Purchased</label>
                <input
                  type="text"
                  required
                  value={modal.itemName}
                  onChange={(e) => setModal(m => ({ ...m, itemName: e.target.value }))}
                  placeholder="What was bought?"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Category</label>
                  <select
                    value={modal.category}
                    onChange={(e) => setModal(m => ({ ...m, category: e.target.value }))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 dark:text-white focus:outline-none"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Amount ({settings.currency})</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={modal.amount}
                    onChange={(e) => setModal(m => ({ ...m, amount: e.target.value }))}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={modal.date}
                  onChange={(e) => setModal(m => ({ ...m, date: e.target.value }))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Notes (optional)</label>
                <textarea
                  value={modal.notes}
                  onChange={(e) => setModal(m => ({ ...m, notes: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setModal({ open: false, ...emptyForm })}
                  className="px-4 py-2 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-sm transition"
                >
                  {isSaving ? "Saving..." : modal.editId ? "Save Changes" : "Log Charge"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
