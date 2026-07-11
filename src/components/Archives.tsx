import React, { useState, useMemo } from "react";
import {
  Archive as ArchiveIcon,
  Calendar,
  Users,
  Search,
  Printer,
  ChevronRight,
  Database,
  RefreshCw,
  ArrowRight,
  FileText,
  TrendingUp,
  Activity,
  AlertCircle
} from "lucide-react";
import { Archive, SystemSettings } from "../types";

interface ArchivesProps {
  archives: Archive[];
  settings: SystemSettings;
  onRestoreArchive: (id: string) => Promise<any>;
}

export default function Archives({ archives, settings, onRestoreArchive }: ArchivesProps) {
  
  // States
  const [selectedArchiveId, setSelectedArchiveId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Currency formatter
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: settings.currency || "PHP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
  };

  // Find currently selected archive details
  const selectedArchive = useMemo(() => {
    if (!selectedArchiveId) return null;
    return archives.find(a => a.id === selectedArchiveId) || null;
  }, [selectedArchiveId, archives]);

  // Archive list summary computations
  const archiveSummaries = useMemo(() => {
    return archives.map(arch => {
      const custs = arch.data.customers || [];
      const purchs = arch.data.purchases || [];
      const pays = arch.data.payments || [];

      const totalPurchases = purchs.reduce((sum, p) => sum + p.totalAmount, 0) + custs.reduce((sum, c) => sum + (c.carriedOverBalance || 0), 0);
      const totalPaid = pays.reduce((sum, p) => sum + p.amountPaid, 0);
      const outstanding = Math.max(0, totalPurchases - totalPaid);

      return {
        ...arch,
        customersCount: custs.length,
        purchasesCount: purchs.length,
        totalPurchases,
        totalPaid,
        outstanding
      };
    });
  }, [archives]);

  // Selected Archive filtered customers
  const archiveCustomersFiltered = useMemo(() => {
    if (!selectedArchive) return [];
    const custs = selectedArchive.data.customers || [];
    return custs.filter(c => c.fullName.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [selectedArchive, searchQuery]);

  // Selected customer summary inside archive
  const archiveCustomerDetails = useMemo(() => {
    if (!selectedArchive || !selectedCustomerId) return null;
    const customer = selectedArchive.data.customers.find(c => c.id === selectedCustomerId);
    if (!customer) return null;

    const custPurchases = selectedArchive.data.purchases.filter(p => p.customerId === selectedCustomerId);
    const custPayments = selectedArchive.data.payments.filter(p => p.customerId === selectedCustomerId);

    const totalBuy = custPurchases.reduce((sum, p) => sum + p.totalAmount, 0) + (customer.carriedOverBalance || 0);
    const totalPay = custPayments.reduce((sum, p) => sum + p.amountPaid, 0);
    const remaining = Math.max(0, totalBuy - totalPay);

    return {
      ...customer,
      purchases: custPurchases,
      payments: custPayments,
      totalBuy,
      totalPay,
      remaining
    };
  }, [selectedArchive, selectedCustomerId]);

  // Restore archive
  const handleRestoreClick = async (id: string, cycle: string) => {
    if (confirm(`CRITICAL WARNING: Restoring the archive of ${cycle} will REPLACE your current active workspace with this archive data! Your current active workspace will be lost unless you have backed it up. Are you absolutely sure you want to proceed?`)) {
      setIsLoading(true);
      try {
        await onRestoreArchive(id);
        setSelectedArchiveId(null);
        setSelectedCustomerId(null);
        alert(`Successfully restored ${cycle} to active workspace!`);
      } catch (err) {
        alert("Restore failed.");
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <ArchiveIcon className="w-5 h-5 text-brand-500" />
          Completed Billing Archives (Read-Only)
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Review, analyze, or print detailed customer records and invoices of finalized billing months.
        </p>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Side: Archives List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <h3 className="font-semibold text-slate-800 text-sm mb-3">Archived Months ({archives.length})</h3>
            
            {archives.length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-300">
                No archived billing cycles found. Finalize active billing cycles in the SPayLater tab to create archives.
              </div>
            ) : (
              <div className="space-y-2">
                {archiveSummaries.map((arch) => (
                  <div
                    key={arch.id}
                    onClick={() => {
                      setSelectedArchiveId(arch.id);
                      setSelectedCustomerId(null);
                    }}
                    className={`p-4 rounded-xl border cursor-pointer transition relative overflow-hidden ${
                      selectedArchiveId === arch.id
                        ? "bg-slate-900 border-slate-900 text-white shadow"
                        : "bg-white border-slate-100 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-xs flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                          {arch.cycle}
                        </h4>
                        <span className={`text-[10px] block mt-1 ${selectedArchiveId === arch.id ? "text-slate-300" : "text-slate-400"}`}>
                          {arch.customersCount} Customers • {arch.purchasesCount} Purchases
                        </span>
                      </div>
                      <span className="text-xs font-bold block shrink-0">
                        {formatCurrency(arch.totalPurchases)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center mt-3 text-[10px]">
                      <span className={selectedArchiveId === arch.id ? "text-slate-400" : "text-slate-500"}>
                        Collected: <strong className={selectedArchiveId === arch.id ? "text-emerald-400" : "text-emerald-600"}>{formatCurrency(arch.totalPaid)}</strong>
                      </span>
                      <span className={selectedArchiveId === arch.id ? "text-slate-400" : "text-slate-500"}>
                        Outstanding: <strong className={selectedArchiveId === arch.id ? "text-orange-400" : "text-orange-600"}>{formatCurrency(arch.outstanding)}</strong>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Selected Archive Details */}
        <div className="lg:col-span-2">
          {!selectedArchive ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-100 shadow-sm text-center flex flex-col items-center justify-center min-h-[480px]">
              <div className="p-4 bg-slate-50 text-slate-400 rounded-2xl mb-4">
                <ArchiveIcon className="w-8 h-8" />
              </div>
              <h3 className="font-semibold text-slate-800 text-sm">No Archive Selected</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Select an archived billing cycle from the left list to inspect customer profiles, purchase history grids, payments, or restore month records.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Archive Stats Header with Restore option */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b border-slate-50 pb-3">
                  <div>
                    <span className="text-[10px] bg-brand-50 text-brand-600 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Archived Content</span>
                    <h3 className="text-base font-bold text-slate-900 mt-1 flex items-center gap-1.5">
                      {selectedArchive.cycle} Summary
                    </h3>
                  </div>
                  <div>
                    <button
                      onClick={() => handleRestoreClick(selectedArchive.id, selectedArchive.cycle)}
                      disabled={isLoading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition border border-red-100"
                    >
                      <RefreshCw className="w-3.5 h-3.5 animate-spin-hover" />
                      Restore Workspace
                    </button>
                  </div>
                </div>

                {/* Subgrid of statistics for selected archive */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <span className="block text-slate-400 uppercase font-semibold text-[10px]">Total Billed</span>
                    <span className="block text-sm font-bold mt-1 text-slate-800">
                      {formatCurrency(
                        selectedArchive.data.purchases.reduce((sum, p) => sum + p.totalAmount, 0) +
                        selectedArchive.data.customers.reduce((sum, c) => sum + (c.carriedOverBalance || 0), 0)
                      )}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <span className="block text-slate-400 uppercase font-semibold text-[10px]">Total Collected</span>
                    <span className="block text-sm font-bold mt-1 text-emerald-600">
                      {formatCurrency(selectedArchive.data.payments.reduce((sum, p) => sum + p.amountPaid, 0))}
                    </span>
                  </div>
                  <div className="p-3 bg-orange-50/50 rounded-xl">
                    <span className="block text-orange-700 uppercase font-semibold text-[10px]">Unpaid Outstanding</span>
                    <span className="block text-sm font-bold mt-1 text-orange-600">
                      {formatCurrency(
                        Math.max(0,
                          (selectedArchive.data.purchases.reduce((sum, p) => sum + p.totalAmount, 0) + selectedArchive.data.customers.reduce((sum, c) => sum + (c.carriedOverBalance || 0), 0)) -
                          selectedArchive.data.payments.reduce((sum, p) => sum + p.amountPaid, 0)
                        )
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Customers inside this archive split */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                {/* Customers list inside archive */}
                <div className="md:col-span-1 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
                  <h4 className="font-semibold text-xs text-slate-800 border-b border-slate-50 pb-2">Archived Customers</h4>
                  
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-[10px] rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-slate-50/50"
                    />
                  </div>

                  <div className="space-y-1 overflow-y-auto max-h-[320px] pr-1">
                    {archiveCustomersFiltered.map(c => {
                      // Calculate balance
                      const custPurchases = selectedArchive.data.purchases.filter(p => p.customerId === c.id);
                      const custPayments = selectedArchive.data.payments.filter(p => p.customerId === c.id);
                      const totalBuy = custPurchases.reduce((sum, p) => sum + p.totalAmount, 0) + (c.carriedOverBalance || 0);
                      const totalPay = custPayments.reduce((sum, p) => sum + p.amountPaid, 0);
                      const bal = Math.max(0, totalBuy - totalPay);

                      return (
                        <div
                          key={c.id}
                          onClick={() => setSelectedCustomerId(c.id)}
                          className={`p-2 rounded-lg text-xs cursor-pointer transition flex justify-between items-center ${
                            selectedCustomerId === c.id
                              ? "bg-slate-100 text-slate-900 font-semibold"
                              : "hover:bg-slate-50 text-slate-600"
                          }`}
                        >
                          <span className="truncate max-w-[100px]">{c.fullName}</span>
                          <span className="font-semibold text-slate-900 shrink-0">{formatCurrency(bal)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Selected customer's archived records */}
                <div className="md:col-span-2 space-y-4">
                  {!archiveCustomerDetails ? (
                    <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm text-center text-slate-400 text-xs py-16">
                      Select an archived customer profile to view purchases & payments.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Customer summary inside archive */}
                      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                        <div className="flex justify-between items-start border-b border-slate-50 pb-2 mb-3">
                          <div>
                            <h4 className="font-bold text-slate-900 text-xs">{archiveCustomerDetails.fullName}</h4>
                            <span className="text-[10px] text-slate-400 block mt-0.5">Phone: {archiveCustomerDetails.contactNumber || "N/A"}</span>
                          </div>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                            archiveCustomerDetails.status === "Fully Paid"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-orange-100 text-orange-800"
                          }`}>
                            {archiveCustomerDetails.status}
                          </span>
                        </div>

                        {/* Customer totals display */}
                        <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
                          <div className="p-2 bg-slate-50 rounded-lg">
                            <span className="block text-slate-400">Total Charged</span>
                            <span className="block font-bold text-slate-800 mt-0.5">{formatCurrency(archiveCustomerDetails.totalBuy)}</span>
                          </div>
                          <div className="p-2 bg-slate-50 rounded-lg">
                            <span className="block text-slate-400">Paid Amount</span>
                            <span className="block font-bold text-emerald-600 mt-0.5">{formatCurrency(archiveCustomerDetails.totalPay)}</span>
                          </div>
                          <div className="p-2 bg-slate-50 rounded-lg">
                            <span className="block text-slate-400">Unpaid Balance</span>
                            <span className="block font-bold text-brand-600 mt-0.5">{formatCurrency(archiveCustomerDetails.remaining)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Purchased products list inside archive */}
                      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-2">
                        <h5 className="text-[11px] font-bold text-slate-800">Purchased Items</h5>
                        <div className="divide-y divide-slate-50 text-[10px]">
                          {archiveCustomerDetails.carriedOverBalance > 0 && (
                            <div className="py-1.5 flex justify-between text-slate-600">
                              <span>Carried over balance from previous cycles</span>
                              <span className="font-semibold text-slate-900">{formatCurrency(archiveCustomerDetails.carriedOverBalance)}</span>
                            </div>
                          )}
                          {archiveCustomerDetails.purchases.length === 0 && archiveCustomerDetails.carriedOverBalance === 0 ? (
                            <p className="py-2 text-slate-300 italic">No purchase items logged.</p>
                          ) : (
                            archiveCustomerDetails.purchases.map(p => (
                              <div key={p.id} className="py-1.5 flex justify-between">
                                <div>
                                  <strong className="text-slate-800">{p.itemName}</strong>
                                  {p.description && <span className="block text-[9px] text-slate-400">{p.description}</span>}
                                </div>
                                <span className="font-semibold text-slate-900 shrink-0">{formatCurrency(p.totalAmount)}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Payments recorded inside archive */}
                      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-2">
                        <h5 className="text-[11px] font-bold text-slate-800">Payments Recorded</h5>
                        <div className="divide-y divide-slate-50 text-[10px]">
                          {archiveCustomerDetails.payments.length === 0 ? (
                            <p className="py-2 text-slate-300 italic">No payments logged in this archive.</p>
                          ) : (
                            archiveCustomerDetails.payments.map(py => (
                              <div key={py.id} className="py-1.5 flex justify-between">
                                <div className="text-slate-600">
                                  <span>{py.paymentDate} via <strong>{py.paymentMethod}</strong></span>
                                  {py.notes && <span className="block text-[9px] text-slate-400">{py.notes}</span>}
                                </div>
                                <span className="font-semibold text-emerald-600 shrink-0">{formatCurrency(py.amountPaid)}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
